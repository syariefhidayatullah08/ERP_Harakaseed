import "server-only";
import { all } from "./db";
import { perKg, type Channel } from "./sales-channel";

/** Saran nama baris untuk penjualan per kg: varietas di menu Produk, kode & nama di Stok Bahan Baku, dan nama yang pernah dipakai di jenis itu. */
export async function itemNameSuggestions(channel: Channel): Promise<string[]> {
  if (!perKg(channel)) return [];
  const rows = await all<{ n: string }>(
    `SELECT DISTINCT n FROM (
       SELECT name n FROM products WHERE active = 1
       UNION SELECT product_name FROM bulk_stock WHERE product_name <> ''
       UNION SELECT production_code FROM bulk_stock
       UNION SELECT i.item_name FROM so_items i JOIN sales_orders so ON so.id = i.so_id WHERE so.channel = ? AND i.item_name <> ''
     ) t WHERE n <> '' ORDER BY 1 LIMIT 400`,
    channel,
  );
  return rows.map((r) => r.n);
}
