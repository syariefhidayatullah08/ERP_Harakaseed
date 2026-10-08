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
  const columns = [];
  for (let c = 1; c <= lastCol; c++) {
    const top = text(ws.getRow(s.header[0]).getCell(c));
    const bottom = s.header[1] ? text(ws.getRow(s.header[1]).getCell(c)) : "";
    const col = { key: letter(c) };
    if (bottom && top && bottom !== top) Object.assign(col, { group: top, label: bottom });
    else col.label = top || bottom || letter(c);
    const w = ws.getColumn(c).width;
    col.width = Math.round(Math.min(260, Math.max(56, (w ?? 10) * 7.5)));
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
    if (values && dates / values > 0.6) {
      col.type = "date";
      col.width = Math.max(col.width, 92); // dd/mm/yyyy tidak terpotong
    }
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
