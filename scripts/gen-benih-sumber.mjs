// Membuat src/lib/sheets-benih-sumber.ts dari dua file Excel benih sumber: kolom (huruf, judul 1–2 tingkat, lebar),
// catatan di atas tabel, dan rumus standar tiap kolom (dipakai otomatis untuk baris baru, seperti "tarik ke bawah").
// Pemakaian: node scripts/gen-benih-sumber.mjs   (jalankan ulang bila susunan kolom di file Excel berubah)
import fs from "node:fs";
import ExcelJS from "exceljs";
import { FILES, SHEETS } from "./benih-sumber.config.mjs";

const text = (cell) => {
  let v = cell.value;
  if (v && typeof v === "object" && !(v instanceof Date)) v = "formula" in v || "sharedFormula" in v ? v.result : v.text ?? (v.richText ? v.richText.map((r) => r.text).join("") : "");
  if (v instanceof Date) return `${String(v.getUTCDate()).padStart(2, "0")}/${String(v.getUTCMonth() + 1).padStart(2, "0")}/${v.getUTCFullYear()}`;
  return v == null || typeof v === "object" ? "" : String(v).replace(/\s+/g, " ").trim();
};
const fill = (cell) => {
  const f = cell.fill;
  const argb = f?.type === "pattern" && f.pattern === "solid" ? f.fgColor?.argb : null;
  return argb && argb.length === 8 && !/^FF(FFFFFF|000000)$/i.test(argb) ? `#${argb.slice(2)}` : undefined;
};
const letter = (n) => {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

// Warna tema Office standar (dipakai bila warna sel di Excel menunjuk ke tema, bukan kode warna langsung).
const THEME = ["FFFFFF", "000000", "E7E6E6", "44546A", "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47"];
const color = (c) => {
  if (!c) return undefined;
  let hex = c.argb && c.argb.length === 8 ? c.argb.slice(2) : c.theme != null ? THEME[c.theme] : undefined;
  if (!hex) return undefined;
  if (c.tint) {
    hex = [0, 2, 4]
      .map((i) => {
        const v = parseInt(hex.slice(i, i + 2), 16);
        const t = c.tint < 0 ? v * (1 + c.tint) : v + (255 - v) * c.tint;
        return Math.round(t).toString(16).padStart(2, "0");
      })
      .join("");
  }
  return `#${hex.toUpperCase()}`;
};
/** Gaya sel Excel → bentuk ringkas (lihat CellStyle di src/lib/sheets.ts). */
const styleOf = (cell) => {
  const st = {};
  const f = cell.font ?? {};
  if (f.bold) st.b = 1;
  if (f.italic) st.i = 1;
  if (f.underline) st.u = 1;
  if (f.size && f.size !== 11) st.z = f.size;
  const fc = color(f.color);
  if (fc && fc !== "#000000") st.c = fc;
  const bg = cell.fill?.type === "pattern" && cell.fill.pattern === "solid" ? color(cell.fill.fgColor) : undefined;
  if (bg && bg !== "#FFFFFF") st.f = bg;
  const a = cell.alignment ?? {};
  if (a.horizontal && a.horizontal !== "general") st.h = a.horizontal === "centerContinuous" ? "center" : a.horizontal;
  if (a.vertical && a.vertical !== "bottom") st.v = a.vertical;
  if (a.wrapText) st.w = 1;
  const b = cell.border ?? {};
  const bd = ["top", "right", "bottom", "left"]
    .filter((k) => b[k]?.style)
    .map((k) => (/medium|thick|double/.test(b[k].style) ? k[0].toUpperCase() : k[0]))
    .join("");
  if (bd) st.bd = bd;
  return st;
};
const pxWidth = (w) => Math.round((w ?? 8.43) * 7 + 5);
const pxHeight = (pt) => Math.round((pt * 4) / 3);

/** Rumus → pola relatif baris: referensi ke baris yang sama menjadi {r}. Null bila merujuk baris lain / sheet lain. */
function relative(formula, row) {
  if (/!/.test(formula)) return null;
  let sameRowOnly = true;
  const out = formula.replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)/g, (m, d1, col, d2, r) => {
    if (Number(r) !== row || d2) sameRowOnly = false;
    return `${d1}${col}{r}`;
  });
  return sameRowOnly ? out : null;
}

const books = {};
for (const [k, f] of Object.entries(FILES)) {
  books[k] = new ExcelJS.Workbook();
  await books[k].xlsx.readFile(f);
}

const defs = [];
for (const s of SHEETS) {
  const ws = books[s.file].getWorksheet(s.name);
  if (!ws) throw new Error(`Sheet "${s.name}" tidak ada`);
  let lastCol = 0;
  ws.eachRow({ includeEmpty: false }, (row, r) => row.eachCell({ includeEmpty: false }, (cell, c) => {
    if (r >= s.header[0] && (text(cell) || cell.formula)) lastCol = Math.max(lastCol, c);
  }));
  const styles = [];
  const styleKeys = new Map();
  const styleId = (st) => {
    if (!Object.keys(st).length) return undefined;
    const k = JSON.stringify(st);
    if (!styleKeys.has(k)) styleKeys.set(k, styles.push(st) - 1);
    return styleKeys.get(k);
  };
  // Baris data terakhir: gaya kolom diambil dari baris yang memang berisi (baris kosong di bawah tidak bergaris).
  let lastData = s.dataStart;
  ws.eachRow({ includeEmpty: false }, (row, r) => {
    if (r >= s.dataStart && row.values.some((v) => v != null && v !== "")) lastData = r;
  });
  const columns = [];
  for (let c = 1; c <= lastCol; c++) {
    const top = text(ws.getRow(s.header[0]).getCell(c));
    const bottom = s.header[1] ? text(ws.getRow(s.header[1]).getCell(c)) : "";
    const col = { key: letter(c) };
    if (bottom && top && bottom !== top) Object.assign(col, { group: top, label: bottom });
    else col.label = top || bottom || letter(c);
    // Lebar persis seperti Excel (lebar karakter Calibri 11 → piksel).
    col.width = pxWidth(ws.getColumn(c).width);
    if (ws.getColumn(c).hidden) col.hidden = true;
    // Gaya & format angka kolom = yang paling banyak dipakai di baris data.
    const styleCount = {};
    const fmtCount = {};
    for (let r = s.dataStart; r <= lastData; r++) {
      const cell = ws.getRow(r).getCell(c);
      // Warna isi tidak ikut gaya kolom: warna disimpan per sel (kolom "#bg") seperti di Excel.
      const st = styleOf(cell);
      delete st.f;
      const k = JSON.stringify(st);
      styleCount[k] = (styleCount[k] ?? 0) + 1;
      // Hanya format angka (tanggal disimpan sebagai teks dd/mm/yyyy, jadi format tanggal tidak dipakai ke angka biasa).
      if (cell.value != null && cell.value !== "" && /[0#]/.test(cell.numFmt ?? "")) fmtCount[cell.numFmt] = (fmtCount[cell.numFmt] ?? 0) + 1;
    }
    const topStyle = Object.entries(styleCount).sort((a, b) => b[1] - a[1])[0];
    if (topStyle) {
      const id = styleId(JSON.parse(topStyle[0]));
      if (id !== undefined) col.s = id;
    }
    const topFmt = Object.entries(fmtCount).sort((a, b) => b[1] - a[1])[0];
    if (topFmt) col.fmt = topFmt[0];
    // Jenis kolom & rumus standar dari isi data.
    let dates = 0, values = 0;
    const patterns = {};
    let formulas = 0;
    for (let r = s.dataStart; r <= ws.rowCount; r++) {
      const cell = ws.getRow(r).getCell(c);
      if (cell.isMerged && cell.master !== cell) continue;
      const v = cell.value;
      if (v == null || v === "") continue;
      values++;
      if (v instanceof Date || (v && typeof v === "object" && v.result instanceof Date)) dates++;
      if (cell.formula) {
        formulas++;
        const p = relative(cell.formula, r);
        if (p) patterns[p] = (patterns[p] ?? 0) + 1;
      }
    }
    if (values && dates / values > 0.6) col.type = "date";
    const best = Object.entries(patterns).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 3 && best[1] >= formulas * 0.5) col.formula = `=${best[0]}`;
    columns.push(col);
  }
  // Catatan di atas tabel (judul, legenda warna, tanggal update) ditampilkan apa adanya.
  const notes = [];
  for (let r = 1; r < s.header[0]; r++) {
    const seen = new Set();
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
      const master = cell.isMerged ? cell.master : cell;
      if (seen.has(master.address)) return;
      seen.add(master.address);
      const t = text(master);
      if (!t && !master.formula) return;
      notes.push({ cell: master.address, text: t, ...(master.formula ? { formula: `=${master.formula}` } : {}), ...(fill(master) ? { bg: fill(master) } : {}) });
    });
  }
  // Baris di atas data (judul, catatan, judul kolom) persis seperti Excel: isi, gaya, sel gabungan, tinggi baris.
  const headRows = s.dataStart - 1;
  const merges = (ws.model.merges ?? [])
    .map((m) => {
      const [a, b] = m.split(":");
      const ca = ws.getCell(a);
      const cb = ws.getCell(b);
      return { r1: Number(ca.row), c1: Number(ca.col), r2: Number(cb.row), c2: Number(cb.col) };
    })
    .filter((m) => m.r1 <= headRows && m.c1 <= lastCol)
    .map((m) => ({ ...m, r2: Math.min(m.r2, headRows), c2: Math.min(m.c2, lastCol) }))
    .filter((m) => m.r2 > m.r1 || m.c2 > m.c1);
  const covered = new Set();
  for (const m of merges) for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) if (r !== m.r1 || c !== m.c1) covered.add(`${letter(c)}${r}`);
  const cells = {};
  const heights = {};
  for (let r = 1; r <= headRows; r++) {
    const row = ws.getRow(r);
    if (row.height) heights[r] = pxHeight(row.height);
    for (let c = 1; c <= lastCol; c++) {
      const addr = `${letter(c)}${r}`;
      if (covered.has(addr)) continue;
      const cell = row.getCell(c);
      const out = {};
      const t = text(cell);
      if (t) out.t = t;
      if (cell.formula) out.f = `=${cell.formula}`;
      // Sel gabungan: garis tepi kanan/bawah diambil dari sel ujung gabungan.
      const m = merges.find((x) => x.r1 === r && x.c1 === c);
      const st = styleOf(cell);
      if (m) {
        const end = styleOf(ws.getRow(m.r2).getCell(m.c2));
        const sides = new Set([...(st.bd ?? "")].filter((x) => /[tlTL]/.test(x)).concat([...(end.bd ?? "")].filter((x) => /[rbRB]/.test(x))));
        if (sides.size) st.bd = [...sides].join("");
        else delete st.bd;
      }
      const id = styleId(st);
      if (id !== undefined) out.s = id;
      if (Object.keys(out).length) cells[addr] = out;
    }
  }
  const view = ws.views?.[0];
  const freeze = view?.state === "frozen" ? { x: view.xSplit ?? 0, y: view.ySplit ?? 0 } : undefined;

  defs.push({
    key: s.key,
    title: s.name.trim(),
    excelName: s.name,
    workbook: s.file,
    module: s.module,
    headerRows: s.header,
    dataStart: s.dataStart,
    notes,
    columns,
    head: {
      rows: headRows,
      cells,
      ...(Object.keys(heights).length ? { heights } : {}),
      ...(merges.length ? { merges: merges.map((m) => `${letter(m.c1)}${m.r1}:${letter(m.c2)}${m.r2}`) } : {}),
    },
    styles,
    ...(freeze ? { freeze } : {}),
    ...(ws.properties.defaultRowHeight && ws.properties.defaultRowHeight !== 15 ? { rowHeight: pxHeight(ws.properties.defaultRowHeight) } : {}),
    ...(ws.state !== "visible" ? { hiddenInExcel: true } : {}),
    ...(color(ws.properties.tabColor) ? { tabColor: color(ws.properties.tabColor) } : {}),
  });
}

// Di Excel, baris Rekap & Ketersediaan SS menunjuk ke baris tertentu; baris baru di ERP otomatis menjumlahkan Rincian
// per kode produksi (sama artinya dengan SUMIF di Rekap).
const setFormula = (key, col, formula) => (defs.find((d) => d.key === key).columns.find((c) => c.key === col).formula = formula);
const sumRincian = (col) => `=SUMIF('Rincian Ketersediaan SS'!C:C,C{r},'Rincian Ketersediaan SS'!${col}:${col})`;
setFormula("rekap-rincian-ss", "D", sumRincian("J"));
setFormula("rekap-rincian-ss", "E", sumRincian("K"));
setFormula("ketersediaan-ss", "H", sumRincian("J"));
setFormula("ketersediaan-ss", "I", sumRincian("K"));

// Penghubung dua file: per LOT di Rincian, berapa yang masuk & keluar menurut Buku Induk (kolom otomatis setelah kolom Excel).
const rincian = defs.find((d) => d.key === "rincian-ss");
const n = rincian.columns.length;
const masuk = (lot) =>
  `=IF(${lot}{r}="","",SUMIF('SS Masuk BENIH INTERNAL '!K:K,${lot}{r},'SS Masuk BENIH INTERNAL '!I:I)+SUMIF('SS MASUK NH'!K:K,${lot}{r},'SS MASUK NH'!I:I))`;
const keluar = (lot, intCol, nhLot, nhCol) =>
  `=IF(${lot}{r}="","",SUMIF('SS KELUAR BENIH INTERNAL'!${lot === "H" ? "Q" : "R"}:${lot === "H" ? "Q" : "R"},${lot}{r},'SS KELUAR BENIH INTERNAL'!${intCol}:${intCol})+SUMIF('SS Keluar NH'!${nhLot}:${nhLot},${lot}{r},'SS Keluar NH'!${nhCol}:${nhCol}))`;
const link = [
  { label: "Masuk Male (gr)", computed: masuk("H") },
  { label: "Keluar Male (gr)", computed: keluar("H", "O", "P", "N") },
  { label: "Sisa Male (gr)", computed: `=IF(H{r}="","",${letter(n + 1)}{r}-${letter(n + 2)}{r})` },
  { label: "Masuk Female (gr)", computed: masuk("I") },
  { label: "Keluar Female (gr)", computed: keluar("I", "P", "Q", "O") },
  { label: "Sisa Female (gr)", computed: `=IF(I{r}="","",${letter(n + 4)}{r}-${letter(n + 5)}{r})` },
];
link.forEach((l, i) => rincian.columns.push({ key: letter(n + 1 + i), group: "Menurut Buku Induk (otomatis per LOT)", width: 110, ...l }));
{
  // Judul kolom penghubung di baris judul Excel (gabungan di baris atas, Male/Female di bawah), warna biru = otomatis.
  const [top, bottom] = SHEETS.find((x) => x.key === "rincian-ss").header;
  const sId = rincian.styles.push({ b: 1, f: "#DDEBF7", h: "center", v: "center", w: 1, bd: "trbl" }) - 1;
  const first = letter(n + 1);
  const last = letter(n + link.length);
  rincian.head.cells[`${first}${top}`] = { t: "Menurut Buku Induk (otomatis per LOT)", s: sId };
  for (let i = 2; i <= link.length; i++) rincian.head.cells[`${letter(n + i)}${top}`] = { s: sId };
  rincian.head.merges = [...(rincian.head.merges ?? []), `${first}${top}:${last}${top}`];
  link.forEach((l, i) => (rincian.head.cells[`${letter(n + 1 + i)}${bottom}`] = { t: l.label, s: sId }));
  const dId = rincian.styles.push({ f: "#F2F8FD", c: "#1F4E79", bd: "trbl" }) - 1;
  for (let i = 1; i <= link.length; i++) Object.assign(rincian.columns[n - 1 + i], { s: dId, fmt: '_-* #,##0.00_-;-* #,##0.00_-;_-* "-"_-;_-@_-' });
}

const out = `// DIBUAT OTOMATIS oleh scripts/gen-benih-sumber.mjs dari:
//   ${FILES.bukuInduk}
//   ${FILES.ketersediaan}
// Jangan diubah manual; jalankan ulang generatornya bila susunan kolom Excel berubah.
import type { SheetDef } from "./sheets";

export const BENIH_SUMBER_SHEETS: SheetDef[] = ${JSON.stringify(defs, null, 2)};
`;
fs.writeFileSync("src/lib/sheets-benih-sumber.ts", out);
for (const d of defs) {
  const f = d.columns.filter((c) => c.formula).map((c) => `${c.key}${c.formula}`);
  console.log(`${d.key.padEnd(20)} kolom ${d.columns[0].key}–${d.columns.at(-1).key} (${d.columns.length}) · catatan ${d.notes.length} · rumus standar: ${f.join("  ") || "-"}`);
}
