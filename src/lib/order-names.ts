import "server-only";
import { all } from "./db";
import { freeName, perKg, type Channel } from "./sales-channel";

/**
 * Saran nama baris untuk jenis yang namanya diketik bebas: varietas di menu Produk, nama yang pernah dipakai di jenis itu,
 * dan (khusus per kg) kode & nama di Stok Bahan Baku.
 */
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
