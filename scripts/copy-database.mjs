// Salin seluruh isi database ERP ke database lain (dipakai untuk pindah wilayah server, mis. AS → Singapura).
// Database SUMBER hanya dibaca. Database TUJUAN: struktur dibuat dari SCHEMA_SQL kode ini (bila masih kosong),
// struktur dicocokkan dengan sumber, isi dikosongkan, lalu semua baris & nomor urut disalin dan diverifikasi
// per tabel (jumlah baris + sidik isi md5). Bila ada satu saja yang beda, skrip berhenti dengan kode gagal.
//
// Pemakaian:
//   node --env-file=.env.local --env-file=<env tujuan> scripts/copy-database.mjs <VAR_SUMBER> <VAR_TUJUAN>
//   mis. ... scripts/copy-database.mjs DATABASE_URL_UNPOOLED SG_DATABASE_URL_UNPOOLED
//   tambahkan --verify-only untuk hanya membandingkan tanpa menyalin.
import fs from "node:fs";
import pg from "pg";

const [srcVar, dstVar] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const verifyOnly = process.argv.includes("--verify-only");
const srcUrl = process.env[srcVar ?? ""];
const dstUrl = process.env[dstVar ?? ""];
if (!srcUrl || !dstUrl) {
  console.error("Pemakaian: scripts/copy-database.mjs <VAR_SUMBER> <VAR_TUJUAN> [--verify-only] (keduanya harus berisi alamat database)");
  process.exit(1);
}
if (srcUrl === dstUrl) {
  console.error("Sumber dan tujuan sama.");
  process.exit(1);
}

const src = new pg.Client({ connectionString: srcUrl });
const dst = new pg.Client({ connectionString: dstUrl });
await src.connect();
await dst.connect();
const host = (u) => new URL(u).hostname;
console.log(`Sumber : ${host(srcUrl)}\nTujuan : ${host(dstUrl)}\n`);

const tables = async (c) =>
  (await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1")).rows.map((r) => r.table_name);

// 1. Struktur: database tujuan yang masih kosong dibuat dari SCHEMA_SQL kode ERP (sama seperti saat ERP pertama jalan).
if (!verifyOnly && (await tables(dst)).length === 0) {
  const code = fs.readFileSync(new URL("../src/lib/db.ts", import.meta.url), "utf8");
  const m = code.match(/const SCHEMA_SQL = `([\s\S]*?)\n  `;/);
  if (!m || m[1].includes("${")) throw new Error("SCHEMA_SQL tidak terbaca dari src/lib/db.ts");
  await dst.query("BEGIN");
  await dst.query(m[1]);
  await dst.query("COMMIT");
  console.log("✓ Struktur dibuat dari SCHEMA_SQL");
}

// Tabel sisa fitur lama yang sudah tidak ada di kode (hanya di sumber) boleh ditinggal, asal KOSONG.
const dstTables = await tables(dst);
const leftover = (await tables(src)).filter((t) => !dstTables.includes(t));
for (const t of leftover) {
  const n = (await src.query(`SELECT COUNT(*)::int n FROM "${t}"`)).rows[0].n;
  if (n) {
    console.error(`✗ Tabel ${t} hanya ada di sumber dan berisi ${n} baris; tidak ada data yang disalin.`);
    process.exit(2);
  }
}
if (leftover.length) console.log(`• Ditinggal (tabel lama, kosong, tidak dipakai kode): ${leftover.join(", ")}`);
const skip = (s) => leftover.some((t) => s.startsWith(`${t}.`) || s.startsWith(`${t}_`));

// 2. Cocokkan struktur: tabel, kolom (nama, tipe, boleh kosong), indeks, constraint, sequence.
const shape = async (c) => ({
  columns: (
    await c.query(
      `SELECT table_name || '.' || column_name || ' ' || data_type || CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END s
       FROM information_schema.columns WHERE table_schema = 'public' ORDER BY 1`,
    )
  ).rows.map((r) => r.s),
  indexes: (await c.query("SELECT tablename || '.' || indexname s FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1")).rows.map((r) => r.s),
  constraints: (
    await c.query(
      `SELECT conrelid::regclass::text || '.' || conname || ' ' || contype::text s FROM pg_constraint
       WHERE connamespace = 'public'::regnamespace ORDER BY 1`,
    )
  ).rows.map((r) => r.s),
  sequences: (await c.query("SELECT sequencename s FROM pg_sequences WHERE schemaname = 'public' ORDER BY 1")).rows.map((r) => r.s),
});
const [a, b] = [await shape(src), await shape(dst)];
let shapeOk = true;
for (const k of Object.keys(a)) {
  a[k] = a[k].filter((x) => !skip(x));
  const onlySrc = a[k].filter((x) => !b[k].includes(x));
  const onlyDst = b[k].filter((x) => !a[k].includes(x));
  if (onlySrc.length || onlyDst.length) {
    shapeOk = false;
    console.log(`✗ ${k} beda — hanya di sumber: ${onlySrc.join(", ") || "-"} | hanya di tujuan: ${onlyDst.join(", ") || "-"}`);
  }
}
if (!shapeOk) {
  console.error("\nStruktur tidak sama; tidak ada data yang disalin.");
  process.exit(2);
}
console.log(`✓ Struktur sama: ${a.columns.length} kolom, ${a.indexes.length} indeks, ${a.constraints.length} constraint, ${a.sequences.length} sequence`);

// Urutan tabel mengikuti foreign key (induk dulu), supaya baris anak selalu menemukan induknya.
const list = (await tables(src)).filter((t) => !leftover.includes(t));
const deps = (
  await src.query(
    `SELECT conrelid::regclass::text child, confrelid::regclass::text parent FROM pg_constraint
     WHERE contype = 'f' AND connamespace = 'public'::regnamespace`,
  )
).rows;
const ordered = [];
const visit = (t, path = []) => {
  if (ordered.includes(t) || path.includes(t)) return;
  for (const d of deps.filter((d) => d.child === t && d.parent !== t)) visit(d.parent, [...path, t]);
  ordered.push(t);
};
list.forEach((t) => visit(t));

// Sidik isi tabel: jumlah baris + md5 dari semua baris dalam bentuk jsonb (urutan kolom tidak berpengaruh).
const fingerprint = async (c, t) =>
  (
    await c.query(
      `SELECT COUNT(*)::int n, COALESCE(md5(string_agg(j, '|' ORDER BY j)), '-') h FROM (SELECT to_jsonb(x)::text j FROM "${t}" x) s`,
    )
  ).rows[0];

if (!verifyOnly) {
  // 3. Kosongkan tujuan lalu salin per tabel dalam satu transaksi.
  await dst.query("BEGIN");
  await dst.query(`TRUNCATE ${ordered.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
  for (const t of ordered) {
    const rows = (await src.query(`SELECT COALESCE(json_agg(x), '[]'::json) j FROM "${t}" x`)).rows[0].j;
    for (let i = 0; i < rows.length; i += 1000) {
      await dst.query(`INSERT INTO "${t}" SELECT * FROM json_populate_recordset(NULL::"${t}", $1::json)`, [JSON.stringify(rows.slice(i, i + 1000))]);
    }
  }
  // 4. Nomor urut (ID berikutnya) disamakan dengan sumber.
  for (const s of (await src.query("SELECT sequencename, last_value FROM pg_sequences WHERE schemaname = 'public'")).rows) {
    if (s.last_value === null || skip(s.sequencename)) continue;
    await dst.query(`SELECT setval('"${s.sequencename}"', $1, true)`, [s.last_value]);
  }
  await dst.query("COMMIT");
  console.log(`✓ Data disalin (${ordered.length} tabel)`);
}

// 5. Verifikasi per tabel.
let bad = 0;
let totalRows = 0;
for (const t of ordered) {
  const [x, y] = [await fingerprint(src, t), await fingerprint(dst, t)];
  totalRows += x.n;
  const same = x.n === y.n && x.h === y.h;
  if (!same) bad++;
  console.log(`${same ? "✓" : "✗"} ${t.padEnd(22)} sumber ${String(x.n).padStart(5)} · tujuan ${String(y.n).padStart(5)}${same ? "" : "  ← BEDA"}`);
}
const seqA = (await src.query("SELECT sequencename, last_value FROM pg_sequences WHERE schemaname = 'public' ORDER BY 1")).rows.filter((s) => !skip(s.sequencename));
const seqB = (await dst.query("SELECT sequencename, last_value FROM pg_sequences WHERE schemaname = 'public' ORDER BY 1")).rows;
const seqBad = seqA.filter((s) => String(seqB.find((x) => x.sequencename === s.sequencename)?.last_value) !== String(s.last_value));
if (seqBad.length) console.log(`✗ Nomor urut beda: ${seqBad.map((s) => s.sequencename).join(", ")}`);
console.log(`\n${bad || seqBad.length ? "GAGAL" : "BERHASIL"}: ${ordered.length} tabel, ${totalRows} baris, ${bad} tabel beda, ${seqBad.length} nomor urut beda.`);
await src.end();
await dst.end();
process.exit(bad || seqBad.length ? 3 : 0);
