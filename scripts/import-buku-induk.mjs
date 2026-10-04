// Mengimpor "BUKU INDUK PEMBAYARAN BENIH … .xlsx" (sheet INTERNAL & EKSTERNAL) ke modul Pembayaran Benih Petani.
//
// Pemakaian:
//   node --env-file=.env.local scripts/import-buku-induk.mjs <file.xlsx>            → hanya memeriksa & meringkas isi file
//   node --env-file=.env.local scripts/import-buku-induk.mjs <file.xlsx> --yes      → menyimpan ke database
//   tambahkan --schema <nama> untuk schema uji (DB_SCHEMA); --append bila buku induk di ERP sudah berisi data.
//
// Tabel harus sudah ada (buka ERP sekali agar tabel dibuat otomatis). Semua baris masuk dalam satu transaksi.
import ExcelJS from "exceljs";
import pg from "pg";

const args = process.argv.slice(2);
const schema = args.includes("--schema") ? args[args.indexOf("--schema") + 1] : null;
const file = args.find((a) => !a.startsWith("--") && a !== schema);
if (!file || (schema && !/^[a-z_][a-z0-9_]*$/.test(schema))) {
  console.error("Pemakaian: node --env-file=.env.local scripts/import-buku-induk.mjs <file.xlsx> [--schema nama] [--append] [--yes]");
  process.exit(1);
}

// Kolom per sheet (nomor kolom Excel, A = 1).
const SHEETS = {
  INTERNAL: { kind: "internal", received: 2, due: 3, farmer: 5, location: 6, officer: 7, contract: 8, code: 9, batch: 10, gross: 11, net: 12, ka: 13, km: 14, db: 15, loan: 16, price: 17, amount: 18, status: 19, badDebt: 20, sortir: 21, notes: 22 },
  EKSTERNAL: { kind: "eksternal", company: 2, received: 3, due: 4, farmer: 7, location: 8, officer: 9, contract: 10, code: 11, gross: 12, net: 13, shipped: 14, fix: 15, ka: 16, km: 17, db: 18, shipDate: 19, loan: 20, contractPrice: 21, price: 22, amount: 24, status: 25, badDebt: 26, sortir: 27, notes: 28, position: 29 },
};
const STATUS = { lunas: "lunas", "proses uji": "proses_uji", "kredit macet": "kredit_macet" };

/** Nilai sel: hasil rumus bila ada; sel gabungan mengembalikan nilai sel induknya. */
const raw = (cell) => {
  let v = cell.value;
  if (v && typeof v === "object" && !(v instanceof Date)) v = "result" in v ? v.result : "richText" in v ? v.richText.map((t) => t.text).join("") : undefined;
  return v && typeof v === "object" && !(v instanceof Date) ? undefined : v;
};
const text = (cell) => {
  const v = raw(cell);
  return v == null || v instanceof Date ? "" : String(typeof v === "number" ? Math.round(v * 100) / 100 : v).trim();
};
/** Angka; sel gabungan lanjutan dihitung 0 agar nilai uang tidak terhitung berulang. */
const number = (cell) => {
  if (cell.isMerged && cell.master !== cell) return null;
  const v = raw(cell);
  if (typeof v === "number") return v;
  const n = typeof v === "string" && v.trim() !== "" ? Number(v.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".")) : NaN;
  return Number.isFinite(n) && /\d/.test(String(v)) && !/[a-z]{3}/i.test(String(v)) ? n : null;
};
const iso = (y, m, d) => (y > 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null);
/**
 * Tanggal di file diketik hari/bulan/tahun. Yang terbaca Excel sebagai tanggal tertukar hari↔bulannya
 * (mis. 4 Des 2024 tersimpan sebagai 12 Apr 2024), jadi ditukar kembali; yang berupa teks dibaca apa adanya.
 */
const date = (cell) => {
  const v = raw(cell);
  if (v instanceof Date) return iso(v.getUTCFullYear(), v.getUTCDate(), v.getUTCMonth() + 1) ?? iso(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  const m = String(v ?? "").trim().match(/^(\d{1,2})[/.](\d{1,2})[/.]?(\d{4})$/);
  return m ? iso(Number(m[3]), Number(m[2]), Number(m[1])) : null;
};

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const rows = [];
const warn = [];
for (const [name, c] of Object.entries(SHEETS)) {
  const ws = wb.getWorksheet(name);
  if (!ws) {
    console.error(`Sheet ${name} tidak ada di file ini.`);
    process.exit(1);
  }
  ws.eachRow((row, r) => {
    if (r < 6) return;
    const cell = (k) => row.getCell(c[k]);
    const farmer = text(cell("farmer"));
    const net = number(cell("net")) ?? 0;
    const gross = number(cell("gross")) ?? 0;
    if (!farmer || /^TAHUN/i.test(text(row.getCell(1))) || (!net && !gross && !text(cell("status")))) return;
    const price = number(cell("price")) ?? 0;
    const loan = number(cell("loan")) ?? 0;
    const sortirNum = number(cell("sortir"));
    const sortirText = sortirNum == null && !(cell("sortir").isMerged && cell("sortir").master !== cell("sortir")) ? text(cell("sortir")) : "";
    const deduction = sortirNum ?? 0;
    const calc = Math.round(net * price - loan - deduction);
    const xlAmount = number(cell("amount"));
    const received = date(cell("received"));
    const due = date(cell("due"));
    if (text(cell("received")) && !received && !(raw(cell("received")) instanceof Date)) warn.push(`${name} baris ${r}: tanggal masuk "${text(cell("received"))}" tidak terbaca`);
    if (received && due && (due < received || (Date.parse(due) - Date.parse(received)) / 864e5 > 200)) warn.push(`${name} baris ${r}: masuk ${received}, jatuh tempo ${due}`);
    rows.push({
      kind: c.kind,
      company: c.company ? text(cell("company")) : "",
      received_date: received,
      due_date: due,
      farmer,
      location: text(cell("location")),
      officer: text(cell("officer")).toUpperCase(),
      contract_no: text(cell("contract")),
      production_code: text(cell("code")),
      batch_no: c.batch ? text(cell("batch")) : "",
      gross_kg: gross || net,
      net_kg: net,
      shipped_kg: c.shipped ? number(cell("shipped")) : null,
      fix_kg: c.fix ? number(cell("fix")) : null,
      ship_date: c.shipDate ? date(cell("shipDate")) : null,
      test_ka: text(cell("ka")),
      test_km: text(cell("km")),
      test_db: text(cell("db")),
      loan,
      price,
      contract_price: c.contractPrice ? (number(cell("contractPrice")) ?? 0) : 0,
      deduction,
      deduction_note: deduction ? "Sortir" : "",
      amount: Math.max(0, Math.round(xlAmount ?? calc)),
      bad_debt: Math.max(0, Math.round(number(cell("badDebt")) ?? 0)),
      status: STATUS[text(cell("status")).toLowerCase()] ?? "proses_uji",
      notes: [text(cell("notes")), sortirText && `Sortir: ${sortirText}`, c.position && text(cell("position")) && `Posisi benih: ${text(cell("position"))}`].filter(Boolean).join(" · "),
    });
  });
}

const rp = (n) => new Intl.NumberFormat("id-ID").format(Math.round(n));
for (const kind of ["internal", "eksternal"]) {
  const set = rows.filter((r) => r.kind === kind);
  console.log(`\n${kind.toUpperCase()}: ${set.length} baris`);
  for (const st of ["lunas", "proses_uji", "kredit_macet"]) {
    const s = set.filter((r) => r.status === st);
    console.log(`  ${st.padEnd(13)} ${String(s.length).padStart(5)} baris · bobot ${rp(s.reduce((a, r) => a + r.net_kg, 0))} kg · pembayaran Rp ${rp(s.reduce((a, r) => a + r.amount, 0))} · kredit macet Rp ${rp(s.reduce((a, r) => a + r.bad_debt, 0))}`);
  }
  console.log(`  tanpa tanggal masuk: ${set.filter((r) => !r.received_date).length} · tanpa jatuh tempo: ${set.filter((r) => !r.due_date).length}`);
}
if (warn.length) console.log(`\nPerlu dicek (${warn.length}):\n  ${warn.slice(0, 25).join("\n  ")}${warn.length > 25 ? `\n  … dan ${warn.length - 25} lagi` : ""}`);
if (!args.includes("--yes")) {
  console.log(`\nBelum ada yang disimpan. Tambahkan --yes untuk menyimpan ke ${schema ? `schema "${schema}"` : "database PRODUKSI"}.`);
  process.exit(0);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });
await client.connect();
try {
  if (schema) await client.query(`SET search_path TO "${schema}"`);
  await client.query("BEGIN");
  const existing = Number((await client.query("SELECT COUNT(*) n FROM seed_intakes")).rows[0].n);
  if (existing && !args.includes("--append")) throw new Error(`Buku induk di ERP sudah berisi ${existing} baris. Pakai --append bila memang ingin menambahkan.`);
  const cols = Object.keys(rows[0]);
  for (let i = 0; i < rows.length; i += 200) {
    const values = [];
    const tuples = rows.slice(i, i + 200).map((r) => `(${cols.map((k) => (values.push(r[k]), `$${values.length}`)).join(",")})`);
    await client.query(`INSERT INTO seed_intakes (${cols.join(",")}) VALUES ${tuples.join(",")}`, values);
  }
  await client.query("COMMIT");
  console.log(`\nSelesai: ${rows.length} baris masuk ke buku induk.`);
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("\nGAGAL, tidak ada data yang disimpan:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
