// Mesin rumus mirip Excel untuk Lembar Kerja Offline. Berjalan di browser (juga saat offline) dan di server/skrip.
// Didukung: angka, teks "…", + - * / ^ & % (persen), perbandingan = <> < > <= >=, rujukan sel (A1, $B$1),
// rentang (A1:B9, K:K), rujukan sheet lain ('Nama Sheet'!A1), serta fungsi SUM, SUMIF, COUNTIF, IF, ROUND, MIN,
// MAX, AVERAGE, ABS. Nomor baris = nomor baris Excel (posisi baris di lembar).

export type FormulaError = { error: string };
export type CellValue = number | string | FormulaError;

export interface SheetSource {
  /** Isi mentah sel seperti diketik/disimpan ("" bila kosong). */
  raw(col: string, row: number): string;
  /** Nomor baris yang berisi data (untuk rentang satu kolom penuh seperti K:K). */
  rows(): number[];
  /** Rumus kolom otomatis (dihitung untuk setiap baris, tidak disimpan), dengan {r} = nomor baris. */
  computed?(col: string): string | undefined;
}

export interface Workbook {
  /** Sheet berdasarkan nama Excel (tanpa beda huruf besar/kecil & spasi tepi); null bila tidak ada. */
  sheet(name: string): SheetSource | null;
}

export const isError = (v: unknown): v is FormulaError => typeof v === "object" && v !== null && "error" in v;
const err = (e: string): FormulaError => ({ error: e });

/** Angka dari teks yang diketik: "13.3", "2,5", "1.250,75", "25000". Selain itu null. */
export function parseNumber(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  if (/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(t)) return Number(t);
  if (/^[-+]?\d+,\d+$/.test(t)) return Number(t.replace(",", "."));
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, "").replace(",", "."));
  return null;
}

/** Tampilan hasil: angka dibulatkan maks. 2 desimal (titik desimal, seperti di file Excel). */
export function formatValue(v: CellValue): string {
  if (isError(v)) return v.error;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "#NUM!";
    const r = Math.round(v * 100) / 100;
    return String(Object.is(r, -0) ? 0 : r);
  }
  return v;
}

/** Angka seri tanggal Excel → dd/mm/yyyy. */
const serialDate = (n: number) => {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86_400_000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};

/**
 * Tampilan angka mengikuti format sel Excel ("#,##0", "0.00", akuntansi `_-* #,##0_-;…;_-* "-"_-`, persen, tanggal).
 * Selain angka, atau tanpa format: sama dengan formatValue.
 */
export function formatCell(v: CellValue, fmt?: string): string {
  if (typeof v !== "number" || !fmt || fmt === "General" || !Number.isFinite(v)) return formatValue(v);
  const sections = fmt.split(";");
  const sec = v < 0 && sections[1] ? sections[1] : v === 0 && sections[2] ? sections[2] : sections[0];
  const bare = sec.replace(/"[^"]*"/g, "").replace(/\\./g, "").replace(/_./g, "");
  if (!/[0#]/.test(bare)) {
    if (/[dmy]/i.test(bare)) return serialDate(v);
    const lit = sec.match(/"([^"]*)"/);
    if (lit) return lit[1];
  }
  const pct = bare.includes("%");
  const n = Math.abs(pct ? v * 100 : v);
  const dec = (bare.match(/\.([0#]+)/)?.[1].length ?? 0);
  const out = n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: bare.includes(",") });
  const body = `${out}${pct ? "%" : ""}`;
  if (v >= 0) return body;
  return sections[1] && sec.includes("(") ? `(${body})` : `-${body}`;
}

/* ------------------------------- Tokenizer ------------------------------- */

type Tok =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "ref"; sheet: string | null; c1: string; r1: number | null; c2?: string; r2?: number | null }
  | { t: "fn"; v: string }
  | { t: "op"; v: string };

const colNum = (c: string) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const colName = (n: number) => {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const cell = /^\$?([A-Za-z]{1,3})\$?(\d+)/;
  const wholeCol = /^\$?([A-Za-z]{1,3}):\$?([A-Za-z]{1,3})(?![\w(])/;
  while (i < src.length) {
    const rest = src.slice(i);
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    // Rujukan dengan nama sheet: 'Nama Sheet'!A1 atau Sheet1!A1
    let sheet: string | null = null;
    let m = rest.match(/^'((?:[^']|'')+)'!/) ?? rest.match(/^([A-Za-z_][\w.]*)!/);
    let j = 0;
    if (m) {
      sheet = m[1].replace(/''/g, "'");
      j = m[0].length;
    }
    const after = rest.slice(j);
    const w = after.match(wholeCol);
    if (w && (sheet || !/^[A-Za-z]{1,3}\(/.test(after))) {
      out.push({ t: "ref", sheet, c1: w[1].toUpperCase(), r1: null, c2: w[2].toUpperCase(), r2: null });
      i += j + w[0].length;
      continue;
    }
    const c = after.match(cell);
    if (c && !/^[A-Za-z(_]/.test(after.slice(c[0].length))) {
      const ref: Tok = { t: "ref", sheet, c1: c[1].toUpperCase(), r1: Number(c[2]) };
      let k = j + c[0].length;
      const r2 = rest.slice(k).match(/^:\$?([A-Za-z]{1,3})\$?(\d+)/);
      if (r2) {
        Object.assign(ref, { c2: r2[1].toUpperCase(), r2: Number(r2[2]) });
        k += r2[0].length;
      }
      out.push(ref);
      i += k;
      continue;
    }
    if (sheet) throw new Error("#REF!");
    if ((m = rest.match(/^\d+(\.\d+)?([eE][-+]?\d+)?/))) {
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (ch === '"') {
      let k = 1;
      let s = "";
      for (; k < rest.length; k++) {
        if (rest[k] === '"') {
          if (rest[k + 1] === '"') {
            s += '"';
            k++;
          } else break;
        } else s += rest[k];
      }
      out.push({ t: "str", v: s });
      i += k + 1;
      continue;
    }
    if ((m = rest.match(/^([A-Za-z_][\w.]*)\s*\(/))) {
      out.push({ t: "fn", v: m[1].toUpperCase() });
      i += m[0].length;
      continue;
    }
    if ((m = rest.match(/^(<>|<=|>=|[-+*/^&%=<>(),;:])/))) {
      out.push({ t: "op", v: m[1] === ";" ? "," : m[1] });
      i += m[1].length;
      continue;
    }
    throw new Error("#NAME?");
  }
  return out;
}

/* ------------------------------- Parser → AST ------------------------------- */

type Node =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "ref"; ref: Extract<Tok, { t: "ref" }> }
  | { k: "un"; op: string; a: Node }
  | { k: "pct"; a: Node }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "fn"; name: string; args: Node[] };

function parse(tokens: Tok[]): Node {
  let p = 0;
  const peek = () => tokens[p];
  const isOp = (v: string) => peek()?.t === "op" && (peek() as { v: string }).v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new Error("#ERROR!");
    p++;
  };
  const binary = (next: () => Node, ops: string[]) => () => {
    let a = next();
    while (peek()?.t === "op" && ops.includes((peek() as { v: string }).v)) {
      const op = (tokens[p++] as { v: string }).v;
      a = { k: "bin", op, a, b: next() };
    }
    return a;
  };
  const primary = (): Node => {
    const t = tokens[p++];
    if (!t) throw new Error("#ERROR!");
    if (t.t === "num") return { k: "num", v: t.v };
    if (t.t === "str") return { k: "str", v: t.v };
    if (t.t === "ref") return { k: "ref", ref: t };
    if (t.t === "fn") {
      const args: Node[] = [];
      if (!isOp(")")) {
        args.push(compare());
        while (isOp(",")) {
          p++;
          args.push(compare());
        }
      }
      expect(")");
      return { k: "fn", name: t.v, args };
    }
    if (t.v === "(") {
      const e = compare();
      expect(")");
      return e;
    }
    if (t.v === "-" || t.v === "+") return { k: "un", op: t.v, a: power() };
    throw new Error("#ERROR!");
  };
  const percent = (): Node => {
    let a = primary();
    while (isOp("%")) {
      p++;
      a = { k: "pct", a };
    }
    return a;
  };
  const power = binary(percent, ["^"]);
  const mul = binary(power, ["*", "/"]);
  const add = binary(mul, ["+", "-"]);
  const concat = binary(add, ["&"]);
  const compare: () => Node = binary(concat, ["=", "<>", "<", ">", "<=", ">="]);
  const root = compare();
  if (p !== tokens.length) throw new Error("#ERROR!");
  return root;
}

const astCache = new Map<string, Node | FormulaError>();
function compile(formula: string): Node | FormulaError {
  let n = astCache.get(formula);
  if (!n) {
    try {
      n = parse(tokenize(formula));
    } catch (e) {
      n = err(e instanceof Error && e.message.startsWith("#") ? e.message : "#ERROR!");
    }
    if (astCache.size > 20000) astCache.clear();
    astCache.set(formula, n);
  }
  return n;
}

/* ------------------------------- Evaluator ------------------------------- */

type Range = { kind: "range"; src: SheetSource; c1: number; c2: number; r1: number | null; r2: number | null };

/**
 * Menghitung nilai sel dalam satu "buku kerja" (kumpulan lembar). Hasil disimpan sementara (memo), jadi buat
 * Evaluator baru setiap kali isi lembar berubah.
 */
export class Evaluator {
  private memo = new Map<string, CellValue>();
  private busy = new Set<string>();
  private sumifIndex = new Map<string, Map<string, number | FormulaError>>();
  private ids = new WeakMap<SheetSource, number>();
  private nextId = 1;
  private book: Workbook;

  constructor(book: Workbook) {
    this.book = book;
  }

  private id(src: SheetSource) {
    let n = this.ids.get(src);
    if (n === undefined) this.ids.set(src, (n = this.nextId++));
    return n;
  }

  /** Nilai sel (dengan rumus & kolom otomatis dihitung). */
  value(src: SheetSource, col: string, row: number): CellValue {
    const key = `${this.id(src)}|${col}${row}`;
    const hit = this.memo.get(key);
    if (hit !== undefined) return hit;
    if (this.busy.has(key)) return err("#SIKLUS!");
    this.busy.add(key);
    let raw = src.raw(col, row);
    if (raw === "" && src.computed) {
      const tpl = src.computed(col);
      if (tpl) raw = tpl.replace(/\{r\}/g, String(row));
    }
    let v: CellValue;
    if (raw.startsWith("=") && raw.length > 1) v = this.formula(src, raw.slice(1));
    else v = parseNumber(raw) ?? raw; // angka yang diketik dihitung sebagai angka, seperti di Excel
    this.busy.delete(key);
    this.memo.set(key, v);
    return v;
  }

  /** Hitung sebuah rumus (tanpa "=") dalam konteks lembar `src`. */
  formula(src: SheetSource, f: string): CellValue {
    const ast = compile(f);
    if (isError(ast)) return ast;
    try {
      const v = this.eval(ast, src);
      return isRange(v) ? err("#VALUE!") : v;
    } catch (e) {
      return err(e instanceof Error && e.message.startsWith("#") ? e.message : "#ERROR!");
    }
  }

  private source(cur: SheetSource, name: string | null) {
    if (!name) return cur;
    const s = this.book.sheet(name);
    if (!s) throw new Error("#REF!");
    return s;
  }

  private eval(n: Node, src: SheetSource): CellValue | Range {
    switch (n.k) {
      case "num":
        return n.v;
      case "str":
        return n.v;
      case "ref": {
        const r = n.ref;
        const s = this.source(src, r.sheet);
        if (r.c2 === undefined) return this.value(s, r.c1, r.r1!);
        return { kind: "range", src: s, c1: colNum(r.c1), c2: colNum(r.c2), r1: r.r1, r2: r.r2 ?? null };
      }
      case "un": {
        const a = num(this.scalar(n.a, src));
        return n.op === "-" ? -a : a;
      }
      case "pct":
        return num(this.scalar(n.a, src)) / 100;
      case "bin":
        return this.binary(n.op, this.scalar(n.a, src), this.scalar(n.b, src));
      case "fn":
        return this.call(n.name, n.args, src);
    }
  }

  private scalar(n: Node, src: SheetSource): CellValue {
    const v = this.eval(n, src);
    if (isRange(v)) throw new Error("#VALUE!");
    if (isError(v)) throw new Error(v.error);
    return v;
  }

  private binary(op: string, a: CellValue, b: CellValue): CellValue {
    if (op === "&") return text(a) + text(b);
    if (["=", "<>", "<", ">", "<=", ">="].includes(op)) {
      const c = compareValues(a, b);
      return ({ "=": c === 0, "<>": c !== 0, "<": c < 0, ">": c > 0, "<=": c <= 0, ">=": c >= 0 } as Record<string, boolean>)[op] ? 1 : 0;
    }
    const x = num(a);
    const y = num(b);
    if (op === "+") return x + y;
    if (op === "-") return x - y;
    if (op === "*") return x * y;
    if (op === "^") return x ** y;
    if (y === 0) throw new Error("#DIV/0!");
    return x / y;
  }

  /** Semua sel dalam rentang, baris demi baris. */
  private cells(r: Range): CellValue[] {
    const out: CellValue[] = [];
    for (const row of this.rowsOf(r)) for (let c = r.c1; c <= r.c2; c++) out.push(this.value(r.src, colName(c), row));
    return out;
  }

  private rowsOf(r: Range) {
    const rows = r.src.rows();
    return r.r1 === null ? rows : rows.filter((x) => x >= r.r1! && x <= r.r2!);
  }

  private args(args: Node[], src: SheetSource): CellValue[] {
    const out: CellValue[] = [];
    for (const a of args) {
      const v = this.eval(a, src);
      if (isRange(v)) out.push(...this.cells(v).filter((x) => typeof x === "number" || isError(x)));
      else out.push(v);
    }
    const e = out.find(isError);
    if (e) throw new Error(e.error);
    return out;
  }

  private call(name: string, args: Node[], src: SheetSource): CellValue {
    const rangeArg = (i: number) => {
      const v = args[i] ? this.eval(args[i], src) : null;
      if (!v || !isRange(v)) throw new Error("#VALUE!");
      return v;
    };
    switch (name) {
      case "SUM":
        return this.args(args, src).reduce<number>((s, v) => s + num(v), 0);
      case "MIN":
      case "MAX": {
        const xs = this.args(args, src).map(num);
        return xs.length ? Math[name === "MIN" ? "min" : "max"](...xs) : 0;
      }
      case "AVERAGE": {
        const xs = this.args(args, src).map(num);
        if (!xs.length) throw new Error("#DIV/0!");
        return xs.reduce((s, v) => s + v, 0) / xs.length;
      }
      case "ABS":
        return Math.abs(num(this.scalar(args[0], src)));
      case "ROUND": {
        const f = 10 ** num(args[1] ? this.scalar(args[1], src) : 0);
        return Math.round(num(this.scalar(args[0], src)) * f) / f;
      }
      case "IF": {
        const c = this.scalar(args[0], src);
        const yes = typeof c === "number" ? c !== 0 : text(c) !== "" && text(c).toUpperCase() !== "FALSE";
        const pick = yes ? args[1] : args[2];
        return pick ? this.scalar(pick, src) : yes ? 1 : 0;
      }
      case "SUMIF":
      case "COUNTIF": {
        const range = rangeArg(0);
        const crit = this.scalar(args[1], src);
        const sumRange = name === "SUMIF" && args[2] ? rangeArg(2) : range;
        return this.sumif(range, crit, sumRange, name === "COUNTIF");
      }
      default:
        throw new Error("#NAME?");
    }
  }

  /** SUMIF/COUNTIF seperti Excel. Kriteria sama-dengan biasa memakai indeks agar ribuan baris tetap cepat. */
  private sumif(range: Range, crit: CellValue, sumRange: Range, count: boolean): number {
    const critText = text(crit);
    const op = critText.match(/^(<>|<=|>=|=|<|>)(.*)$/);
    const wild = !op && /[*?]/.test(critText);
    const offsetC = sumRange.c1 - range.c1;
    const rows = this.rowsOf(range);
    const sumAt = (row: number) => (count ? 1 : this.value(sumRange.src, colName(range.c1 + offsetC), row + ((sumRange.r1 ?? 0) - (range.r1 ?? 0))));
    if (!op && !wild && range.c1 === range.c2) {
      const key = `${this.id(range.src)}|${range.c1}|${range.r1}|${range.r2}|${this.id(sumRange.src)}|${sumRange.c1}|${sumRange.r1}|${count}`;
      let index = this.sumifIndex.get(key);
      if (!index) {
        index = new Map();
        for (const row of rows) {
          const k = critKey(this.value(range.src, colName(range.c1), row));
          if (k === null) continue;
          const s = sumAt(row);
          const prev = index.get(k) ?? 0;
          if (isError(prev)) continue;
          index.set(k, isError(s) ? s : prev + (typeof s === "number" ? s : (parseNumber(String(s)) ?? 0)));
        }
        this.sumifIndex.set(key, index);
      }
      const k = critKey(crit);
      const v = k === null ? 0 : (index.get(k) ?? 0);
      if (isError(v)) throw new Error(v.error);
      return v;
    }
    let total = 0;
    const test = matcher(op, wild, critText);
    for (const row of rows) {
      if (!test(this.value(range.src, colName(range.c1), row))) continue;
      const s = sumAt(row);
      if (isError(s)) throw new Error(s.error);
      total += typeof s === "number" ? s : (parseNumber(String(s)) ?? 0);
    }
    return total;
  }
}

const isRange = (v: unknown): v is Range => typeof v === "object" && v !== null && (v as Range).kind === "range";

function num(v: CellValue): number {
  if (typeof v === "number") return v;
  if (isError(v)) throw new Error(v.error);
  if (v.trim() === "") return 0;
  const n = parseNumber(v);
  if (n === null) throw new Error("#VALUE!");
  return n;
}

function text(v: CellValue): string {
  if (isError(v)) throw new Error(v.error);
  return typeof v === "number" ? formatValue(v) : v;
}

/** Kunci pencocokan SUMIF: angka disamakan sebagai angka, teks tanpa beda huruf besar/kecil. Sel kosong tidak dicocokkan. */
function critKey(v: CellValue): string | null {
  if (isError(v)) return null;
  if (typeof v === "number") return `n:${v}`;
  const n = parseNumber(v);
  if (n !== null) return `n:${n}`;
  return v === "" ? null : `s:${v.toLowerCase()}`;
}

function compareValues(a: CellValue, b: CellValue): number {
  const x = typeof a === "number" ? a : parseNumber(String(a));
  const y = typeof b === "number" ? b : parseNumber(String(b));
  if (x !== null && y !== null) return x - y;
  const s = text(a).toLowerCase();
  const t = text(b).toLowerCase();
  return s < t ? -1 : s > t ? 1 : 0;
}

function matcher(op: RegExpMatchArray | null, wild: boolean, critText: string) {
  if (op) {
    const target = op[2];
    return (v: CellValue) => {
      if (isError(v)) return false;
      const c = compareValues(v, target);
      return ({ "=": c === 0, "<>": c !== 0, "<": c < 0, ">": c > 0, "<=": c <= 0, ">=": c >= 0 } as Record<string, boolean>)[op[1]];
    };
  }
  const re = new RegExp(`^${critText.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`, "i");
  return (v: CellValue) => !isError(v) && re.test(text(v));
}
