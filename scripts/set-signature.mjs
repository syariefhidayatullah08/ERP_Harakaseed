// Pemakaian: node --env-file=.env.local scripts/set-signature.mjs <kiri|kanan> <file gambar> [--schema <nama>] [--out <file.png>]
// Memasang gambar tanda tangan dokumen cetak (invoice, surat PB) dari hasil foto/scan: tepi kosong dipotong dan
// latar kertas dijadikan transparan, lalu disimpan ke tabel settings (kiri = signer_sig, kanan = signer2_sig).
// Dengan --out, hasilnya hanya ditulis ke file PNG untuk diperiksa; database tidak disentuh.
// Sama dengan mengunggah lewat Pengaturan → Gambar tanda tangan, tetapi sekaligus membersihkan latarnya.
import fs from "node:fs";
import pg from "pg";
import sharp from "sharp";

const [side, file, ...rest] = process.argv.slice(2);
const opt = (name) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : undefined);
const key = { kiri: "signer_sig", kanan: "signer2_sig" }[side];
const schema = opt("--schema");
if (!key || !file || !fs.existsSync(file) || (schema && !/^[a-z_][a-z0-9_]*$/.test(schema))) {
  console.error("Pemakaian: set-signature.mjs <kiri|kanan> <file gambar> [--schema <nama>] [--out <file.png>]");
  process.exit(1);
}

// Latar kertas (terang) → transparan; tinta & cap tetap. Peralihannya dibuat halus agar tepi goresan tidak bergerigi.
const WHITE = 235; // kanal tergelap ≥ ini dianggap kertas
const SOLID = 170; // kanal tergelap ≤ ini dianggap tinta penuh
const { data, info } = await sharp(file).rotate().trim({ threshold: 40 }).resize({ width: 900, withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) {
  const darkest = Math.min(data[i], data[i + 1], data[i + 2]);
  data[i + 3] = Math.round(255 * Math.min(1, Math.max(0, (WHITE - darkest) / (WHITE - SOLID))));
}
const png = await sharp(data, { raw: info }).trim().png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
console.log(`${file} → PNG transparan ${png.info.width}×${png.info.height}, ${Math.round(png.data.length / 1024)} KB`);

if (opt("--out")) {
  fs.writeFileSync(opt("--out"), png.data);
  console.log(`Ditulis ke ${opt("--out")} (database tidak diubah).`);
  process.exit(0);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });
await db.connect();
if (schema) await db.query(`SET search_path TO "${schema}"`);
await db.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [
  key,
  JSON.stringify({ type: "png", w: png.info.width, h: png.info.height, b64: png.data.toString("base64") }),
]);
console.log(`Tanda tangan ${side} tersimpan di ${schema ?? "database utama"}.`);
await db.end();
