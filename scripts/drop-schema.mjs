// Pemakaian: node --env-file=.env.local scripts/drop-schema.mjs <nama_schema>
// Menghapus schema uji (DB_SCHEMA) dari database. Tidak bisa menghapus "public".
import pg from "pg";

const { Client } = pg;

const schema = process.argv[2];
if (!schema || schema === "public" || !/^[a-z_][a-z0-9_]*$/.test(schema)) {
  console.error("Beri nama schema uji yang valid (bukan public).");
  process.exit(1);
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });
  await c.connect();
  await c.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  const r = await c.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name <> 'information_schema'");
  console.log("Schema tersisa:", r.rows.map((x) => x.schema_name).join(", "));
  await c.end();
})();
