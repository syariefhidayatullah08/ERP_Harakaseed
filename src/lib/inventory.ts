import "server-only";
import { all, get, insert, run } from "./db";
import { today } from "./format";

export type ProductStock = {
  id: number;
  sku: string;
  name: string;
  crop: string;
  category: string;
  seed_type: string;
  pack_size: string;
  unit_price: number;
  min_stock: number;
  shelf_life_months: number;
  description: string;
  harvest_age: string;
  yield_potential: string;
  fruit_weight: string;
  image: string;
  active: number;
  stock: number;
  reserved: number;
};

/** Stok layak jual = lot yang belum kadaluarsa. Reserved = qty pesanan dikonfirmasi yang belum dikirim. */
export async function productStock(where = "1=1", ...params: (string | number)[]): Promise<ProductStock[]> {
  return await all<ProductStock>(
    `SELECT p.*,
       COALESCE((SELECT SUM(qty_available) FROM lots l WHERE l.product_id = p.id AND l.expiry_date >= ?), 0) AS stock,
       COALESCE((SELECT SUM(i.qty) FROM so_items i JOIN sales_orders so ON so.id = i.so_id
                 WHERE i.product_id = p.id AND so.status = 'dikonfirmasi'), 0) AS reserved
     FROM products p WHERE ${where} ORDER BY p.category, p.name`,
    today(),
    ...params,
  );
}

export async function lowStockProducts() {
  return (await productStock("p.active = 1")).filter((p) => p.stock < p.min_stock);
}

/**
 * Alokasi stok FEFO (First Expired, First Out) untuk satu baris pesanan.
 * Mengurangi qty_available lot, mencatat stock_moves dan so_allocations.
 * Harus dipanggil di dalam transaksi (lot dikunci FOR UPDATE agar tidak terjual ganda).
 */
export async function allocateFefo(soItemId: number, productId: number, qty: number, ref: string) {
  const lots = await all<{ id: number; lot_no: string; qty_available: number }>(
    `SELECT id, lot_no, qty_available FROM lots
     WHERE product_id = ? AND qty_available > 0 AND expiry_date >= ?
     ORDER BY expiry_date, id
     FOR UPDATE`,
    productId,
    today(),
  );
  let remaining = qty;
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, lot.qty_available);
    await run("UPDATE lots SET qty_available = qty_available - ? WHERE id = ?", take, lot.id);
    await run("INSERT INTO so_allocations (so_item_id, lot_id, qty) VALUES (?,?,?)", soItemId, lot.id, take);
    await run(
      "INSERT INTO stock_moves (lot_id, product_id, kind, qty, ref, note) VALUES (?,?, 'keluar', ?, ?, 'Pengiriman pesanan')",
      lot.id,
      productId,
      -take,
      ref,
    );
    remaining -= take;
  }
  if (remaining > 0) {
    const p = await get<{ name: string }>("SELECT name FROM products WHERE id = ?", productId);
    throw new Error(`Stok ${p?.name ?? "produk"} tidak cukup (kurang ${remaining}).`);
  }
}

/** Kembalikan stok yang sudah dialokasikan (mis. pesanan terkirim dibatalkan). */
export async function releaseAllocations(soId: number, ref: string) {
  const allocs = await all<{ id: number; lot_id: number; qty: number; product_id: number }>(
    `SELECT a.id, a.lot_id, a.qty, i.product_id FROM so_allocations a
     JOIN so_items i ON i.id = a.so_item_id WHERE i.so_id = ?`,
    soId,
  );
  for (const a of allocs) {
    await run("UPDATE lots SET qty_available = qty_available + ? WHERE id = ?", a.qty, a.lot_id);
    await run(
      "INSERT INTO stock_moves (lot_id, product_id, kind, qty, ref, note) VALUES (?,?, 'retur', ?, ?, 'Pembatalan pesanan')",
      a.lot_id,
      a.product_id,
      a.qty,
      ref,
    );
    await run("DELETE FROM so_allocations WHERE id = ?", a.id);
  }
}

export async function createLot(input: {
  lotNo: string;
  productId: number;
  productionId?: number | null;
  qty: number;
  germination: number;
  purity: number;
  moisture: number;
  prodDate: string;
  expiryDate: string;
  location: string;
  note: string;
}) {
  const lotId = await insert(
    `INSERT INTO lots (lot_no, product_id, production_id, qty_initial, qty_available, germination, purity, moisture, prod_date, expiry_date, location)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    input.lotNo,
    input.productId,
    input.productionId ?? null,
    input.qty,
    input.qty,
    input.germination,
    input.purity,
    input.moisture,
    input.prodDate,
    input.expiryDate,
    input.location,
  );
  await run(
    "INSERT INTO stock_moves (lot_id, product_id, kind, qty, ref, note) VALUES (?,?, 'masuk', ?, ?, ?)",
    lotId,
    input.productId,
    input.qty,
    input.lotNo,
    input.note,
  );
  return lotId;
}
