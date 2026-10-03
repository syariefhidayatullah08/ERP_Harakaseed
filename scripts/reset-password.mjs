// Pemakaian: node --env-file=.env.local scripts/reset-password.mjs <email> <kata-sandi-baru>
// Mengganti kata sandi pengguna langsung di database (mis. lupa kata sandi admin).
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error("Pemakaian: reset-password.mjs <email> <kata-sandi-baru (min. 8 karakter)>");
  process.exit(1);
}

// Format sama dengan src/lib/password.ts
const salt = randomBytes(16).toString("hex");
const hash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });
await client.connect();
const r = await client.query("UPDATE users SET password_hash = $1 WHERE lower(email) = lower($2)", [hash, email]);
await client.end();
console.log(r.rowCount ? `Kata sandi ${email} diganti.` : `Pengguna ${email} tidak ditemukan.`);
