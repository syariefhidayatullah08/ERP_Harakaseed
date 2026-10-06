import "server-only";
import { all } from "./db";
import { freeName, perKg, type Channel } from "./sales-channel";

/**
 * Saran nama baris untuk jenis yang namanya diketik bebas: varietas di menu Produk, nama yang pernah dipakai di jenis itu,
 * dan (khusus per kg) kode & nama di Stok Bahan Baku.
 */
/** Saran nama petani untuk kerjasama produksi: yang pernah dipakai, petani mitra, dan petani di buku induk. */
export async function farmerSuggestions(channel: Channel): Promise<string[]> {
  if (channel !== "kerjasama") return [];
  const rows = await all<{ n: string }>(
    `SELECT DISTINCT n FROM (
       SELECT farmer_name n FROM so_items WHERE farmer_name <> ''
       UNION SELECT name FROM growers
       UNION SELECT farmer FROM seed_intakes
     ) t WHERE n <> '' ORDER BY 1 LIMIT 600`,
  );
  return rows.map((r) => r.n);
}

/**
 * Benih masuk di buku induk (internal & eksternal) yang bisa diambil sebagai baris kerjasama produksi:
 * belum dipakai pesanan lain yang tidak batal. `exceptSoId`: pesanan yang sedang diubah tetap melihat barisnya sendiri.
 */
export async function intakeOptions(channel: Channel, exceptSoId = 0) {
  if (channel !== "kerjasama") return [];
  return all<{ id: number; kind: string; company: string; received_date: string | null; farmer: string; location: string; production_code: string; batch_no: string; kg: number }>(
    `SELECT s.id, s.kind, s.company, s.received_date, s.farmer, s.location, s.production_code, s.batch_no, COALESCE(s.fix_kg, s.net_kg) kg
     FROM seed_intakes s
     WHERE COALESCE(s.fix_kg, s.net_kg) > 0
       AND NOT EXISTS (SELECT 1 FROM so_items i JOIN sales_orders so ON so.id = i.so_id WHERE i.intake_id = s.id AND so.status <> 'batal' AND so.id <> ?)
     ORDER BY s.received_date DESC NULLS LAST, s.id DESC LIMIT 1000`,
    exceptSoId,
  );
}

export async function itemNameSuggestions(channel: Channel): Promise<string[]> {
  if (!freeName(channel)) return [];
  const bulk = perKg(channel)
    ? `UNION SELECT product_name FROM bulk_stock WHERE product_name <> ''
       UNION SELECT production_code FROM bulk_stock`
    : "";
  const rows = await all<{ n: string }>(
    `SELECT DISTINCT n FROM (
       SELECT name n FROM products WHERE active = 1
       ${bulk}
       UNION SELECT i.item_name FROM so_items i JOIN sales_orders so ON so.id = i.so_id WHERE so.channel = ? AND i.item_name <> ''
     ) t WHERE n <> '' ORDER BY 1 LIMIT 400`,
    channel,
  );
  return rows.map((r) => r.n);
}
