// Menyalin dari sheet INTERNAL & EKSTERNAL buku induk ke ERP kolom-kolom yang di sheet diketik manual tapi tidak ikut
// diimpor dulu, supaya tabel buku induk di ERP tampil persis seperti spreadsheet: "No" (mulai lagi tiap bagian tahun,
// bisa loncat/kosong), bagian "TAHUN …", Tgl Maks Pengajuan PB, Tgl Maks Pengiriman Invoice, dan Tagihan Invoice.
// Baris sheet dipasangkan dengan data ERP menurut urutan impor (id) selama nama petaninya sama; baris di ujung yang
// tidak berpasangan (ditambah di sheet atau langsung di ERP setelah impor) dilaporkan dan tidak diubah.
//
// Pemakaian:
//   node --env-file=.env.local scripts/sync-no-buku-induk.mjs <file.xlsx>           → hanya memeriksa
//   node --env-file=.env.local scripts/sync-no-buku-induk.mjs <file.xlsx> --yes     → menyimpan
//   tambahkan --schema <nama> untuk schema uji.
import ExcelJS from "exceljs";
import pg from "pg";

const args = process.argv.slice(2);
const schema = args.includes("--schema") ? args[args.indexOf("--schema") + 1] : null;
const file = args.find((a) => !a.startsWith("--") && a !== schema);
if (!file || (schema && !/^[a-z_][a-z0-9_]*$/.test(schema))) {
  console.error("Pemakaian: node --env-file=.env.local scripts/sync-no-buku-induk.mjs <file.xlsx> [--schema nama] [--yes]");
  process.exit(1);
}

// Nomor kolom (A = 1). Nama petani, bobot, dan status dipakai untuk memilih baris data seperti scripts/import-buku-induk.mjs.
const SHEETS = {
  INTERNAL: { kind: "internal", farmer: 5, gross: 11, net: 12, status: 19, maxPb: 4 },
  EKSTERNAL: { kind: "eksternal", farmer: 7, gross: 12, net: 13, status: 25, maxInvoice: 5, maxPb: 6, bill: 23 },
};
const raw = (cell) => {
  let v = cell.value;
  if (v && typeof v === "object" && !(v instanceof Date)) v = "result" in v ? v.result : "richText" in v ? v.richText.map((t) => t.text).join("") : undefined;
  return v && typeof v === "object" && !(v instanceof Date) ? undefined : v;
};
const text = (cell) => {
  const v = raw(cell);
  return v == null || v instanceof Date ? "" : String(typeof v === "number" ? Math.round(v * 100) / 100 : v).trim();
};
const number = (cell) => {
  if (cell.isMerged && cell.master !== cell) return null;
  const v = raw(cell);
  if (typeof v === "number") return v;
  const n = typeof v === "string" && v.trim() !== "" ? Number(v.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".")) : NaN;
  return Number.isFinite(n) && /\d/.test(String(v)) && !/[a-z]{3}/i.test(String(v)) ? n : null;
};
const iso = (y, m, d) => (y > 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null);
/** Sama dengan import-buku-induk: tanggal yang terbaca Excel sebagai tanggal tertukar hari↔bulannya, jadi ditukar kembali. */
const date = (cell) => {
  const v = raw(cell);
  if (v instanceof Date) return iso(v.getUTCFullYear(), v.getUTCDate(), v.getUTCMonth() + 1) ?? iso(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  const m = String(v ?? "").trim().match(/^(\d{1,2})[/.](\d{1,2})[/.]?(\d{4})$/);
  return m ? iso(Number(m[3]), Number(m[2]), Number(m[1])) : null;
};

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });
await client.connect();
if (schema) await client.query(`SET search_path TO "${schema}"`);
for (const col of ["sheet_no TEXT", "sheet_year TEXT", "sheet_max_pb TEXT", "sheet_max_invoice TEXT", "sheet_bill DOUBLE PRECISION"]) {
  await client.query(`ALTER TABLE seed_intakes ADD COLUMN IF NOT EXISTS ${col}`);
}

const updates = [];
for (const [name, c] of Object.entries(SHEETS)) {
  const ws = wb.getWorksheet(name);
  const sheetRows = [];
  let section = "";
  ws.eachRow((row, r) => {
    const first = text(row.getCell(1));
    const tahun = first.match(/^TAHUN\s+(\d{4})/i);
    if (tahun) section = tahun[1];
    if (r < 6) return;
    const farmer = text(row.getCell(c.farmer));
    const net = number(row.getCell(c.net)) ?? 0;
    const gross = number(row.getCell(c.gross)) ?? 0;
    if (!farmer || tahun || (!net && !gross && !text(row.getCell(c.status)))) return;
    sheetRows.push({
      r,
      farmer,
      no: first, // apa adanya, termasuk "22a"
      section,
      maxPb: date(row.getCell(c.maxPb)),
      maxInvoice: c.maxInvoice ? date(row.getCell(c.maxInvoice)) : null,
      bill: c.bill ? number(row.getCell(c.bill)) : null,
    });
  });
  const db = (await client.query("SELECT id, farmer FROM seed_intakes WHERE kind = $1 ORDER BY id", [c.kind])).rows;
  let n = 0;
  while (n < Math.min(sheetRows.length, db.length) && sheetRows[n].farmer === db[n].farmer.trim()) n++;
  console.log(`${name}: ${sheetRows.length} baris sheet · ${db.length} baris ERP · berpasangan berurutan: ${n}`);
  if (n < db.length) console.log(`  ${db.length - n} baris ERP tanpa pasangan di sheet (mulai id ${db[n].id} "${db[n].farmer}") — No & tanggal dihitung otomatis.`);
  if (n < sheetRows.length) console.log(`  ${sheetRows.length - n} baris sheet belum ada di ERP (mulai baris ${sheetRows[n].r} "${sheetRows[n].farmer}").`);
  const paired = sheetRows.slice(0, n);
  console.log(`  bagian tahun: ${[...new Set(paired.map((s) => s.section))].join(", ")} · baris tanpa No: ${paired.filter((s) => !s.no).length} · tgl maks PB terbaca: ${paired.filter((s) => s.maxPb).length}`);
  paired.forEach((s, i) => updates.push({ id: db[i].id, ...s }));
}

console.log(`\n${updates.length} baris akan diperbarui.`);
if (args.includes("--yes")) {
  // Satu perintah untuk semua baris (jauh lebih cepat daripada satu UPDATE per baris lewat jaringan).
  await client.query(
    `UPDATE seed_intakes s SET sheet_no = u.no, sheet_year = u.year, sheet_max_pb = u.max_pb, sheet_max_invoice = u.max_invoice, sheet_bill = u.bill
     FROM unnest($1::int[], $2::text[], $3::text[], $4::text[], $5::text[], $6::float8[]) AS u(id, no, year, max_pb, max_invoice, bill)
     WHERE s.id = u.id`,
    ["id", "no", "section", "maxPb", "maxInvoice", "bill"].map((k) => updates.map((u) => u[k])),
  );
  console.log("Tersimpan.");
} else {
  console.log("Belum disimpan. Jalankan lagi dengan --yes.");
}
await client.end();
