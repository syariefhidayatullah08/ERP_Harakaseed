import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, types, type PoolClient } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { hashPassword } from "./password";
import { CATALOG } from "./catalog";

// COUNT/SUM di Postgres bertipe bigint/numeric → kembalikan sebagai number, bukan string.
types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1700, (v) => Number(v));

type Param = string | number | null;
type Queryable = Pick<PoolClient, "query">;

const SCHEMA = process.env.DB_SCHEMA; // hanya untuk pengujian: isolasi data di schema terpisah

const globalForDb = globalThis as unknown as { __harakaPool?: Pool; __harakaReady?: Promise<void> | null };

function pool(): Pool {
  if (globalForDb.__harakaPool) return globalForDb.__harakaPool;
  const connectionString = SCHEMA ? (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL) : process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum diatur. Jalankan `vercel env pull` atau isi .env.local.");
  const p = new Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000 });
  if (SCHEMA) p.on("connect", (c) => void c.query(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"; SET search_path TO "${SCHEMA}"`));
  attachDatabasePool(p);
  return (globalForDb.__harakaPool = p);
}

/** Ubah placeholder `?` menjadi `$1, $2, …`. */
const toPg = (sql: string) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

const txStore = new AsyncLocalStorage<PoolClient>();

async function ready() {
  globalForDb.__harakaReady ??= init().catch((e) => {
    globalForDb.__harakaReady = null;
    throw e;
  });
  await globalForDb.__harakaReady;
}

async function query(sql: string, params: Param[]) {
  await ready();
  const c: Queryable = txStore.getStore() ?? pool();
  return c.query(toPg(sql), params);
}

export async function all<T = Record<string, unknown>>(sql: string, ...params: Param[]): Promise<T[]> {
  return (await query(sql, params)).rows as T[];
}

export async function get<T = Record<string, unknown>>(sql: string, ...params: Param[]): Promise<T | undefined> {
  return (await query(sql, params)).rows[0] as T | undefined;
}

export async function run(sql: string, ...params: Param[]) {
  const r = await query(sql, params);
  return { changes: r.rowCount ?? 0 };
}

/** INSERT lalu kembalikan id baris baru. */
export async function insert(sql: string, ...params: Param[]): Promise<number> {
  const r = await query(`${sql} RETURNING id`, params);
  return Number(r.rows[0].id);
}

/** Jalankan beberapa perintah SQL tanpa parameter sekaligus. */
export async function exec(sql: string) {
  await ready();
  await (txStore.getStore() ?? pool()).query(sql);
}

/** Transaksi: semua all/get/run/insert di dalam `fn` memakai koneksi yang sama. */
export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  await ready();
  if (txStore.getStore()) return fn();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await txStore.run(client, fn);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Nomor dokumen berikutnya, mis. SO-2026-0007. */
export async function nextNumber(prefix: string, table: string, column: string): Promise<string> {
  const year = new Date().getFullYear();
  const row = await get<{ n: string | null }>(`SELECT MAX(${column}) AS n FROM ${table} WHERE ${column} LIKE ?`, `${prefix}-${year}-%`);
  const last = row?.n ? Number(row.n.split("-").pop()) : 0;
  return `${prefix}-${year}-${String(last + 1).padStart(4, "0")}`;
}

export async function getSetting(key: string, fallback = ""): Promise<string> {
  return (await get<{ value: string }>("SELECT value FROM settings WHERE key = ?", key))?.value ?? fallback;
}

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await all<{ key: string; value: string }>("SELECT key, value FROM settings");
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setSetting(key: string, value: string) {
  await run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", key, value);
}

async function init() {
  const client = await pool().connect();
  const ex = (sql: string, ...p: Param[]) => client.query(toPg(sql), p);
  try {
    await client.query("BEGIN");
    // Kunci agar migrasi/seed tidak berjalan ganda saat beberapa fungsi cold start bersamaan.
    await client.query("SELECT pg_advisory_xact_lock(724110)");
    await client.query(SCHEMA_SQL);
    const { rows } = await ex("SELECT COUNT(*) AS n FROM users");
    if (Number(rows[0].n) === 0) await seed(ex);
    else {
      const v = await ex("SELECT value FROM settings WHERE key = 'catalog_version'");
      if (v.rows[0]?.value !== CATALOG_VERSION) {
        await syncCatalog(ex);
        await ex(
          "INSERT INTO settings (key, value) VALUES ('catalog_version', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
          CATALOG_VERSION,
        );
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

type Ex = (sql: string, ...p: Param[]) => Promise<{ rows: Record<string, unknown>[] }>;

/** Naikkan bila CATALOG berubah agar database yang sudah berjalan ikut diperbarui sekali. */
const CATALOG_VERSION = "2";

/**
 * Samakan produk dengan katalog resmi. Varietas yang sudah ada hanya diperbarui datanya dari katalog
 * (komoditas, kategori, deskripsi, spesifikasi, foto); SKU, kemasan, harga, dan stok minimum yang
 * sudah diisi pengguna tidak disentuh. Varietas yang belum ada ditambahkan.
 */
async function syncCatalog(ex: Ex) {
  for (const c of CATALOG) {
    const found = await ex("SELECT id FROM products WHERE upper(name) = upper(?)", c.name);
    if (found.rows.length) {
      await ex(
        `UPDATE products SET crop = ?, category = ?, seed_type = ?, description = ?, harvest_age = ?, yield_potential = ?, fruit_weight = ?, image = ?
         WHERE id = ?`,
        c.crop, c.category, c.seedType, c.description, c.harvestAge, c.yieldPotential, c.fruitWeight, c.image, Number(found.rows[0].id),
      );
    } else {
      await ex(
        `INSERT INTO products (sku, name, crop, category, seed_type, pack_size, unit_price, min_stock, description, harvest_age, yield_potential, fruit_weight, image)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (sku) DO NOTHING`,
        c.sku, c.name, c.crop, c.category, c.seedType, c.packSize, c.price, c.minStock, c.description, c.harvestAge, c.yieldPotential, c.fruitWeight, c.image,
      );
    }
  }
}

const SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      crop TEXT NOT NULL,
      category TEXT NOT NULL,
      seed_type TEXT NOT NULL DEFAULT 'F1 Hibrida',
      pack_size TEXT NOT NULL,
      unit_price DOUBLE PRECISION NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 0,
      shelf_life_months INTEGER NOT NULL DEFAULT 18,
      description TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS growers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      village TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      area_ha DOUBLE PRECISION NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS productions (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      grower_id INTEGER REFERENCES growers(id),
      area_ha DOUBLE PRECISION NOT NULL DEFAULT 0,
      plant_date TEXT NOT NULL,
      est_harvest TEXT,
      harvest_kg DOUBLE PRECISION,
      status TEXT NOT NULL DEFAULT 'tanam',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS'))
    );

    CREATE TABLE IF NOT EXISTS lots (
      id SERIAL PRIMARY KEY,
      lot_no TEXT NOT NULL UNIQUE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      production_id INTEGER REFERENCES productions(id),
      qty_initial INTEGER NOT NULL,
      qty_available INTEGER NOT NULL,
      germination DOUBLE PRECISION NOT NULL DEFAULT 0,
      purity DOUBLE PRECISION NOT NULL DEFAULT 0,
      moisture DOUBLE PRECISION NOT NULL DEFAULT 0,
      prod_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT 'Gudang Jember',
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS'))
    );

    CREATE TABLE IF NOT EXISTS stock_moves (
      id SERIAL PRIMARY KEY,
      lot_id INTEGER NOT NULL REFERENCES lots(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      kind TEXT NOT NULL,
      qty INTEGER NOT NULL,
      ref TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'distributor',
      contact_person TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      payment_terms INTEGER NOT NULL DEFAULT 30,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS'))
    );

    CREATE TABLE IF NOT EXISTS sales_orders (
      id SERIAL PRIMARY KEY,
      so_no TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      order_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      discount_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
      tax_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
      subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
      total DOUBLE PRECISION NOT NULL DEFAULT 0,
      paid DOUBLE PRECISION NOT NULL DEFAULT 0,
      invoice_no TEXT,
      due_date TEXT,
      shipped_at TEXT,
      courier TEXT NOT NULL DEFAULT '',
      tracking_no TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS'))
    );

    CREATE TABLE IF NOT EXISTS so_items (
      id SERIAL PRIMARY KEY,
      so_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      qty INTEGER NOT NULL,
      price DOUBLE PRECISION NOT NULL
    );

    CREATE TABLE IF NOT EXISTS so_allocations (
      id SERIAL PRIMARY KEY,
      so_item_id INTEGER NOT NULL REFERENCES so_items(id) ON DELETE CASCADE,
      lot_id INTEGER NOT NULL REFERENCES lots(id),
      qty INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      so_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
      pay_date TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      method TEXT NOT NULL DEFAULT 'Transfer',
      note TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id SERIAL PRIMARY KEY,
      po_no TEXT NOT NULL UNIQUE,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      order_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      total DOUBLE PRECISION NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      received_at TEXT
    );

    CREATE TABLE IF NOT EXISTS po_items (
      id SERIAL PRIMARY KEY,
      po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      qty DOUBLE PRECISION NOT NULL,
      unit TEXT NOT NULL DEFAULT 'pcs',
      price DOUBLE PRECISION NOT NULL
    );

    CREATE TABLE IF NOT EXISTS emails (
      id SERIAL PRIMARY KEY,
      direction TEXT NOT NULL,
      message_id TEXT UNIQUE,
      from_addr TEXT NOT NULL DEFAULT '',
      to_addr TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      body_html TEXT NOT NULL DEFAULT '',
      body_text TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'terkirim',
      error TEXT NOT NULL DEFAULT '',
      ref_type TEXT,
      ref_id INTEGER,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS'))
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id SERIAL PRIMARY KEY,
      ref_type TEXT NOT NULL,
      ref_id INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT 'Lainnya',
      note TEXT NOT NULL DEFAULT '',
      pathname TEXT NOT NULL UNIQUE,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT '',
      size INTEGER NOT NULL DEFAULT 0,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS'))
    );
    CREATE INDEX IF NOT EXISTS idx_attachments_ref ON attachments(ref_type, ref_id);

    CREATE INDEX IF NOT EXISTS idx_lots_product ON lots(product_id);
    CREATE INDEX IF NOT EXISTS idx_moves_lot ON stock_moves(lot_id);
    CREATE INDEX IF NOT EXISTS idx_so_customer ON sales_orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_emails_ref ON emails(ref_type, ref_id);

    -- Spesifikasi varietas dari katalog resmi (v2)
    ALTER TABLE products ADD COLUMN IF NOT EXISTS harvest_age TEXT NOT NULL DEFAULT '';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS yield_potential TEXT NOT NULL DEFAULT '';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS fruit_weight TEXT NOT NULL DEFAULT '';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT NOT NULL DEFAULT '';

    -- Akun per divisi (v3): role = kode divisi
    ALTER TABLE users ADD COLUMN IF NOT EXISTS active INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_requested_at TEXT;
    UPDATE users SET role = 'owner' WHERE role = 'admin';
    UPDATE users SET role = 'marketing' WHERE role = 'sales';
    UPDATE users SET role = 'warehouse' WHERE role = 'gudang';
    UPDATE users SET role = 'admin_sdm' WHERE role = 'staff';

    -- Lab / QC: riwayat uji per lot
    CREATE TABLE IF NOT EXISTS lot_tests (
      id SERIAL PRIMARY KEY,
      lot_id INTEGER NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
      test_date TEXT NOT NULL,
      germination DOUBLE PRECISION NOT NULL,
      purity DOUBLE PRECISION NOT NULL DEFAULT 0,
      moisture DOUBLE PRECISION NOT NULL DEFAULT 0,
      result TEXT NOT NULL DEFAULT 'lulus',
      note TEXT NOT NULL DEFAULT '',
      tested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS'))
    );
    CREATE INDEX IF NOT EXISTS idx_lot_tests_lot ON lot_tests(lot_id);
    -- 'lulus' = boleh dijual; 'karantina' = ditahan Lab/QC (tidak dihitung stok jual & tidak dialokasikan)
    ALTER TABLE lots ADD COLUMN IF NOT EXISTS qc_status TEXT NOT NULL DEFAULT 'lulus';
    INSERT INTO settings (key, value) VALUES ('qc_min_germination', '85') ON CONFLICT (key) DO NOTHING;

    -- Mutu: keluhan pelanggan
    CREATE TABLE IF NOT EXISTS complaints (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      report_date TEXT NOT NULL,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      lot_id INTEGER REFERENCES lots(id) ON DELETE SET NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'sedang',
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'baru',
      root_cause TEXT NOT NULL DEFAULT '',
      action_taken TEXT NOT NULL DEFAULT '',
      closed_at TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS'))
    );

    -- SDM: data karyawan
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      division TEXT NOT NULL,
      position TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      join_date TEXT,
      status TEXT NOT NULL DEFAULT 'aktif',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS'))
    );
  `;


async function seed(ex: Ex) {
  await ex(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'owner')",
    "Owner",
    (process.env.ADMIN_EMAIL ?? "nurainimaulidia@gmail.com").toLowerCase(),
    hashPassword(process.env.ADMIN_PASSWORD ?? "haraka123"),
  );

  const settings: Record<string, string> = {
    company_name: "PT Benih Haraka Sejahtera",
    company_brand: "HARAKA SEED",
    company_tagline: "Quality you can plant with confidence",
    company_address: "Jl. H. Moh. Noer, RT001/RW001, Desa Rowoindah, Ajung, Jember, Jawa Timur",
    company_phone: "0811-3784-575",
    company_email: "ptbenihharakasejahtera@gmail.com",
    company_website: "https://harakaseeds.com",
    bank_info: "Bank —, No. Rek —, a.n. PT Benih Haraka Sejahtera",
    alert_email: "ptbenihharakasejahtera@gmail.com",
    auto_email_order: "1",
    auto_email_shipping: "1",
    auto_email_invoice: "1",
    catalog_version: CATALOG_VERSION,
  };
  for (const [k, v] of Object.entries(settings)) await ex("INSERT INTO settings (key, value) VALUES (?, ?)", k, v);

  await syncCatalog(ex);

  if (process.env.SEED_DEMO !== "0") await seedDemo(ex);
}

/** Contoh transaksi agar dashboard tidak kosong. Hapus lewat Pengaturan → Hapus data contoh. */
async function seedDemo(ex: Ex) {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const addDays = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return iso(d);
  };
  const ins = async (sql: string, ...p: Param[]) => Number((await ex(`${sql} RETURNING id`, ...p)).rows[0].id);

  const growers: number[] = [];
  for (const g of [
    ["Pak Sutrisno", "Rowoindah, Ajung", "0812-0000-0001", 1.5],
    ["Bu Siti Aminah", "Sukorambi", "0812-0000-0002", 0.8],
    ["Pak Hendra", "Kalisat", "0812-0000-0003", 2.0],
  ] as const) {
    growers.push(await ins("INSERT INTO growers (name, village, phone, area_ha) VALUES (?,?,?,?)", ...g));
  }

  const customers: number[] = [];
  for (const c of [
    ["CUST-001", "CV Tani Makmur (Contoh)", "distributor", "Bapak Agus", "Jember"],
    ["CUST-002", "UD Sumber Benih (Contoh)", "distributor", "Ibu Rina", "Banyuwangi"],
    ["CUST-003", "Toko Tani Subur (Contoh)", "toko", "Mas Dedi", "Lumajang"],
    ["CUST-004", "Kios Saprotan Jaya (Contoh)", "toko", "Pak Yanto", "Bondowoso"],
  ] as const) {
    customers.push(await ins("INSERT INTO customers (code, name, kind, contact_person, city, email) VALUES (?,?,?,?,?, '')", ...c));
  }

  await ex("INSERT INTO suppliers (name, category) VALUES (?, ?)", "Supplier Kemasan Aluminium Foil (Contoh)", "Kemasan");
  await ex("INSERT INTO suppliers (name, category) VALUES (?, ?)", "Supplier Fungisida Seed Treatment (Contoh)", "Bahan Perlakuan Benih");

  // Lot awal per produk
  const products = (await ex("SELECT id, sku, name, min_stock, unit_price FROM products WHERE unit_price > 0 ORDER BY id")).rows as {
    name: string;
    id: number;
    sku: string;
    min_stock: number;
    unit_price: number;
  }[];
  for (const [i, p] of products.entries()) {
    const qty = i % 4 === 3 ? Math.round(p.min_stock * 0.6) : p.min_stock * (3 + (i % 3));
    const lotNo = `L${today.getFullYear()}${String(i + 1).padStart(3, "0")}-${p.sku.split("-")[1]}`;
    const expiry = i === 5 ? addDays(40) : addDays(300 + i * 15);
    const lotId = await ins(
      "INSERT INTO lots (lot_no, product_id, qty_initial, qty_available, germination, purity, moisture, prod_date, expiry_date) VALUES (?,?,?,?,?,?,?,?,?)",
      lotNo, p.id, qty, qty, 85 + (i % 4) * 2.5, 98 + (i % 2), 7, addDays(-120 + i), expiry,
    );
    await ex(
      "INSERT INTO stock_moves (lot_id, product_id, kind, qty, ref, note, created_at) VALUES (?,?,?,?,?,?,?)",
      lotId, p.id, "masuk", qty, lotNo, "Stok awal", addDays(-120 + i) + " 08:00:00",
    );
  }

  await ex(
    "INSERT INTO productions (code, product_id, grower_id, area_ha, plant_date, est_harvest, status, notes) VALUES (?,?,?,?,?,?,?,?)",
    `PRD-${today.getFullYear()}-0001`, products.find((p) => p.name === "BIANTARA F1")!.id, growers[0], 1.5, addDays(-60), addDays(30), "tanam", "Produksi benih cabai musim kemarau",
  );
  await ex(
    "INSERT INTO productions (code, product_id, grower_id, area_ha, plant_date, est_harvest, harvest_kg, status, notes) VALUES (?,?,?,?,?,?,?,?,?)",
    `PRD-${today.getFullYear()}-0002`, products.find((p) => p.name === "KENTA F1")!.id, growers[2], 2.0, addDays(-110), addDays(-10), 42, "uji_lab", "Menunggu hasil uji daya kecambah",
  );

  // Pesanan contoh 6 bulan terakhir
  let n = 0;
  for (let m = 5; m >= 0; m--) {
    for (let k = 0; k < 3; k++) {
      n++;
      const d = new Date(today);
      d.setDate(d.getDate() - (m * 30 + (2 - k) * 9 + 1));
      const date = iso(d);
      const status = m === 0 && k === 2 ? "dikonfirmasi" : m === 0 && k === 1 ? "dikirim" : "selesai";
      const lines = [products[(n * 3) % products.length], products[(n * 5 + 1) % products.length]];
      const qtys = [10 + ((n * 7) % 30), 5 + ((n * 3) % 20)];
      const subtotal = lines.reduce((s, l, j) => s + l.unit_price * qtys[j], 0);
      const paid = status === "selesai" ? subtotal : status === "dikirim" ? Math.round(subtotal / 2) : 0;
      const inv = status === "dikonfirmasi" ? null : `INV-${d.getFullYear()}-${String(n).padStart(4, "0")}`;
      const due = new Date(d);
      due.setDate(due.getDate() + 30);
      const soId = await ins(
        "INSERT INTO sales_orders (so_no, customer_id, order_date, status, subtotal, total, paid, invoice_no, due_date, shipped_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        `SO-${d.getFullYear()}-${String(n).padStart(4, "0")}`, customers[n % 4], date, status, subtotal, subtotal, paid, inv, iso(due),
        status === "dikonfirmasi" ? null : date,
      );
      for (const [j, l] of lines.entries()) await ex("INSERT INTO so_items (so_id, product_id, qty, price) VALUES (?,?,?,?)", soId, l.id, qtys[j], l.unit_price);
      if (paid > 0) await ex("INSERT INTO payments (so_id, pay_date, amount, method) VALUES (?,?,?, 'Transfer')", soId, date, paid);
    }
  }
}
