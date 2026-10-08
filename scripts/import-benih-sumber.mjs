// Mengimpor dua file Excel benih sumber ke Lembar Kerja Offline (tabel sheet_rows), posisi baris = nomor baris Excel.
// Sebelum menyimpan, setiap rumus dihitung ulang dengan mesin rumus ERP dan dibandingkan dengan hasil di file Excel.
//
// Pemakaian:
//   node --env-file=.env.local scripts/import-benih-sumber.mjs            → hanya membaca & menguji rumus
//   node --env-file=.env.local scripts/import-benih-sumber.mjs --yes      → menyimpan (baris hasil impor ditimpa)
//   tambahkan --schema <nama> untuk schema uji.
import ExcelJS from "exceljs";
import pg from "pg";
import { FILES, SHEETS } from "./benih-sumber.config.mjs";
import { BENIH_SUMBER_SHEETS } from "../src/lib/sheets-benih-sumber.ts";
import { Evaluator, formatValue, isError } from "../src/lib/sheet-formula.ts";

const args = process.argv.slice(2);
const schema = args.includes("--schema") ? args[args.indexOf("--schema") + 1] : null;
if (schema && !/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error("Nama schema tidak valid");

const fill = (cell) => {
  const f = cell.fill;
  const argb = f?.type === "pattern" && f.pattern === "solid" ? f.fgColor?.argb : null;
  return argb && argb.length === 8 && !/^FF(FFFFFF|000000)$/i.test(argb) ? `#${argb.slice(2)}` : undefined;
};
const ddmmyyyy = (d) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;

/** Isi sel Excel → teks seperti yang akan diketik di lembar ERP. */
function cellText(cell) {
  if (cell.formula) return `=${cell.formula}`;
  const v = cell.value;
  if (v == null) return "";
  if (v instanceof Date) return ddmmyyyy(v);
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    if ("error" in v) return String(v.error);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    return "";
  }
  return String(v);
}

/** Hasil tersimpan di Excel untuk sel berumus (untuk menguji mesin rumus). */
function cached(cell) {
  const r = cell.value?.result;
  if (r instanceof Date) return ddmmyyyy(r);
  if (r && typeof r === "object" && "error" in r) return { error: r.error };
  return r ?? "";
}

const books = {};
for (const [k, f] of Object.entries(FILES)) {
  books[k] = new ExcelJS.Workbook();
  await books[k].xlsx.readFile(f);
}

// 1. Baca semua sheet menjadi baris.
const sheets = new Map();
for (const s of SHEETS) {
  const def = BENIH_SUMBER_SHEETS.find((d) => d.key === s.key);
  const ws = books[s.file].getWorksheet(s.name);
  const cols = def.columns.filter((c) => !c.computed);
  const rows = new Map();
  const formulaCells = [];
  for (let r = s.dataStart; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const data = {};
    for (const c of cols) {
      const cell = row.getCell(c.key);
      if (cell.isMerged && cell.master !== cell) continue;
      const t = cellText(cell);
      if (t.trim() === "") continue;
      data[c.key] = t;
      const bg = fill(cell);
      if (bg) data[`${c.key}#bg`] = bg;
      if (cell.formula) formulaCells.push({ col: c.key, row: r, expect: cached(cell), formula: t });
    }
    if (Object.keys(data).some((k) => !k.includes("#"))) rows.set(r, data);
  }
  // Catatan di atas tabel (mis. tanggal update) ikut bisa dirujuk rumus.
  const notes = new Map(def.notes.map((n) => [n.cell, n.formula ?? n.text]));
  sheets.set(s.key, { def, rows, formulaCells, notes });
}

// 2. Uji mesin rumus terhadap hasil Excel.
const byName = new Map([...sheets.values()].map((x) => [x.def.excelName.trim().toLowerCase(), x]));
const sources = new Map();
const sourceOf = (x) => {
  if (!sources.has(x)) {
    const positions = [...x.rows.keys()].sort((a, b) => a - b);
    sources.set(x, {
      raw: (col, row) => x.rows.get(row)?.[col] ?? (row < x.def.dataStart ? (x.notes.get(`${col}${row}`) ?? "") : ""),
      rows: () => positions,
      computed: (col) => x.def.columns.find((c) => c.key === col)?.computed,
    });
  }
  return sources.get(x);
};
const book = { sheet: (name) => (byName.has(name.trim().toLowerCase()) ? sourceOf(byName.get(name.trim().toLowerCase())) : null) };
const ev = new Evaluator(book);
let total = 0;
let bad = 0;
for (const x of sheets.values()) {
  const src = sourceOf(x);
  const miss = [];
  for (const f of x.formulaCells) {
    total++;
    const got = ev.value(src, f.col, f.row);
    const exp = f.expect;
    const same = isError(exp)
      ? isError(got) || got === 0
      : typeof exp === "number"
        ? typeof got === "number" && Math.abs(got - exp) < 0.01
        : formatValue(got) === String(exp) || (exp === "" && (got === 0 || got === ""));
    if (!same) miss.push(`${f.col}${f.row} ${f.formula.slice(0, 60)} → ERP ${formatValue(got)} · Excel ${isError(exp) ? exp.error : exp}`);
  }
  bad += miss.length;
  console.log(`${x.def.key.padEnd(20)} ${String(x.rows.size).padStart(4)} baris · ${String(x.formulaCells.length).padStart(4)} rumus · beda dengan Excel: ${miss.length}`);
  for (const m of miss.slice(0, 6)) console.log(`     ${m}`);
}
console.log(`\nRumus: ${total} diuji, ${total - bad} sama persis dengan hasil Excel, ${bad} beda.`);

// 3. Simpan.
if (!args.includes("--yes")) {
  console.log("Belum disimpan. Jalankan dengan --yes untuk menyimpan ke database.");
  process.exit(0);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });
await client.connect();
if (schema) await client.query(`SET search_path TO "${schema}"`);
await client.query("BEGIN");
let saved = 0;
for (const x of sheets.values()) {
  const ids = [...x.rows.keys()].map((r) => `bs-${x.def.key}-${r}`);
  // Baris hasil impor sebelumnya yang sudah tidak ada di file ditandai terhapus; baris yang ditambah di ERP tidak disentuh.
  await client.query("UPDATE sheet_rows SET deleted = true, rev = nextval('sheet_rev_seq') WHERE sheet = $1 AND id LIKE 'bs-%' AND NOT (id = ANY($2))", [x.def.key, ids]);
  for (const [r, data] of x.rows) {
    await client.query(
      `INSERT INTO sheet_rows (id, sheet, data, position, deleted) VALUES ($1, $2, $3::jsonb, $4, false)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, position = EXCLUDED.position, deleted = false, rev = nextval('sheet_rev_seq'),
         updated_at = to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS')`,
      [`bs-${x.def.key}-${r}`, x.def.key, JSON.stringify(data), r],
    );
    saved++;
  }
}
await client.query("COMMIT");
await client.end();
console.log(`Tersimpan: ${saved} baris di ${sheets.size} lembar.`);
