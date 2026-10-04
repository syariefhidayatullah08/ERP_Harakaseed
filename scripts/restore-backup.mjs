// Memulihkan database ERP dari file backup (haraka-erp-YYYY-MM-DD.json.gz).
//
// Pemakaian:
//   node --env-file=.env.local scripts/restore-backup.mjs <file.json.gz>            → hanya memeriksa isi file
//   node --env-file=.env.local scripts/restore-backup.mjs <file.json.gz> --yes      → MENIMPA seluruh data database
//   tambahkan --schema <nama> untuk memulihkan ke schema uji (DB_SCHEMA), bukan produksi.
//
// Tabel harus sudah ada (buka ERP sekali agar tabel dibuat otomatis). Seluruh isi tabel diganti
// dengan isi backup dalam satu transaksi: kalau gagal di tengah, tidak ada yang berubah.
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import pg from "pg";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && a !== args[args.indexOf("--schema") + 1]);
const yes = args.includes("--yes");
const schema = args.includes("--schema") ? args[args.indexOf("--schema") + 1] : null;
if (!file || (schema && !/^[a-z_][a-z0-9_]*$/.test(schema))) {
  console.error("Pemakaian: node --env-file=.env.local scripts/restore-backup.mjs <file.json.gz> [--schema nama] [--yes]");
  process.exit(1);
}

let backup = null;
try {
  backup = JSON.parse(gunzipSync(fs.readFileSync(file)).toString("utf8"));
} catch (e) {
  console.error(`File tidak bisa dibaca: ${e.message}`);
}
if (backup?.meta?.app !== "haraka-erp" || !backup.tables) {
  console.error("Ini bukan file backup ERP Haraka.");
  process.exit(1);
}
const order = backup.meta.order;
console.log(`Backup dibuat ${backup.meta.created_at} WIB`);
for (const t of order) console.log(`  ${t.padEnd(24)} ${backup.tables[t].length} baris`);
if (!yes) {
  console.log(`\nBelum ada yang diubah. Tambahkan --yes untuk MENIMPA seluruh data di ${schema ? `schema "${schema}"` : "database PRODUKSI"}.`);
  process.exit(0);
}

const q = (name) => `"${name.replace(/"/g, '""')}"`;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });
await client.connect();
try {
  if (schema) await client.query(`SET search_path TO ${q(schema)}`);
  await client.query("BEGIN");
  const existing = new Set(
    (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'")).rows.map((r) => r.table_name),
  );
  const missing = order.filter((t) => !existing.has(t));
  if (missing.length) throw new Error(`Tabel belum ada di database tujuan: ${missing.join(", ")}. Buka ERP sekali agar tabel dibuat.`);

  await client.query(`TRUNCATE ${order.map(q).join(", ")} RESTART IDENTITY CASCADE`);
  for (const t of order) {
    const rows = backup.tables[t];
    if (!rows.length) continue;
    const cols = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1", [t])).rows
      .map((r) => r.column_name)
      .filter((c) => c in rows[0]);
    // Sisipkan per 200 baris agar jumlah parameter tetap di bawah batas Postgres.
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const values = [];
      const tuples = chunk.map((row) => `(${cols.map((c) => (values.push(row[c] ?? null), `$${values.length}`)).join(",")})`);
      await client.query(`INSERT INTO ${q(t)} (${cols.map(q).join(",")}) VALUES ${tuples.join(",")}`, values);
    }
    // Nomor id berikutnya melanjutkan dari id terbesar yang dipulihkan.
    if (cols.includes("id")) {
      await client.query(`SELECT setval(pg_get_serial_sequence('${q(t)}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM ${q(t)}`);
    }
  }
  await client.query("COMMIT");
  console.log("\nSelesai: data dipulihkan dari backup.");
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("\nGAGAL, tidak ada data yang diubah:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
