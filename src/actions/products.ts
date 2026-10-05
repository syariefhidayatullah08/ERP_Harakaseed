"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { get, insert, PACK_SUMMARY_SQL, run } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";

function read(fd: FormData) {
  return {
    sku: str(fd, "sku").toUpperCase(),
    name: str(fd, "name").toUpperCase(),
    crop: str(fd, "crop"),
    category: str(fd, "category"),
    seed_type: str(fd, "seed_type") || "F1 Hibrida",
    min_stock: numf(fd, "min_stock"),
    shelf_life_months: numf(fd, "shelf_life_months") || 18,
    description: str(fd, "description"),
    harvest_age: str(fd, "harvest_age"),
    yield_potential: str(fd, "yield_potential"),
    fruit_weight: str(fd, "fruit_weight"),
    active: fd.get("active") ? 1 : 0,
  };
}

export async function saveProduct(fd: FormData) {
  await requireAccess("produk");
  const id = numf(fd, "id");
  const p = read(fd);
  const back = id ? `/produk/${id}` : "/produk/baru";
  if (!p.sku || !p.name || !p.crop) redirect(withMsg(back, "SKU, nama, dan komoditas wajib diisi.", "error"));
  const dup = await get<{ id: number }>("SELECT id FROM products WHERE sku = ? AND id != ?", p.sku, id);
  if (dup) redirect(withMsg(back, `SKU ${p.sku} sudah dipakai.`, "error"));

  if (id) {
    await run(
      `UPDATE products SET sku=?, name=?, crop=?, category=?, seed_type=?, min_stock=?, shelf_life_months=?, description=?,
       harvest_age=?, yield_potential=?, fruit_weight=?, active=? WHERE id=?`,
      p.sku, p.name, p.crop, p.category, p.seed_type, p.min_stock, p.shelf_life_months, p.description,
      p.harvest_age, p.yield_potential, p.fruit_weight, p.active, id,
    );
  }
  // Gramasi & harga varietas baru diisi di halaman produknya (tabel product_packs).
  const newId = id
    ? 0
    : await insert(
        `INSERT INTO products (sku, name, crop, category, seed_type, pack_size, unit_price, min_stock, shelf_life_months, description, harvest_age, yield_potential, fruit_weight, active)
         VALUES (?,?,?,?,?,'',0,?,?,?,?,?,?,1)`,
        p.sku, p.name, p.crop, p.category, p.seed_type, p.min_stock, p.shelf_life_months, p.description,
        p.harvest_age, p.yield_potential, p.fruit_weight,
      );
  revalidatePath("/produk");
  await logActivity("produk", id ? "Mengubah produk" : "Menambah produk", `${p.sku} · ${p.name}`);
  if (newId) redirect(withMsg(`/produk/${newId}`, `Produk ${p.name} disimpan. Tambahkan gramasi & harganya.`));
  redirect(withMsg("/produk", `Produk ${p.name} disimpan.`));
}

/** Tambah gramasi baru atau ubah harga gramasi yang ada. Nama gramasi tidak diubah karena lot & pesanan merujuknya. */
export async function savePack(fd: FormData) {
  await requireAccess("produk");
  const productId = numf(fd, "product_id");
  const back = `/produk/${productId}`;
  const packSize = str(fd, "pack_size").replace(/\s+/g, " ");
  const price = numf(fd, "price");
  const product = await get<{ name: string }>("SELECT name FROM products WHERE id = ?", productId);
  if (!product) redirect(withMsg("/produk", "Produk tidak ditemukan.", "error"));
  if (!packSize) redirect(withMsg(back, "Isi gramasi, mis. 10 g.", "error"));
  if (packSize.includes("|") || price < 0) redirect(withMsg(back, "Gramasi atau harga tidak valid.", "error"));
  await run(
    "INSERT INTO product_packs (product_id, pack_size, price) VALUES (?,?,?) ON CONFLICT (product_id, pack_size) DO UPDATE SET price = excluded.price, active = 1",
    productId, packSize, price,
  );
  await run(`${PACK_SUMMARY_SQL} WHERE p.id = ?`, productId);
  revalidatePath("/produk");
  await logActivity("produk", "Menyimpan gramasi", `${product.name} · ${packSize} · Rp ${price}`);
  redirect(withMsg(back, `Gramasi ${packSize} disimpan.`));
}

/** Hapus gramasi. Yang sudah dipakai lot atau pesanan hanya dinonaktifkan agar riwayatnya tetap utuh. */
export async function deletePack(fd: FormData) {
  await requireAccess("produk");
  const id = numf(fd, "id");
  const pack = await get<{ product_id: number; pack_size: string; name: string }>(
    "SELECT k.product_id, k.pack_size, p.name FROM product_packs k JOIN products p ON p.id = k.product_id WHERE k.id = ?", id);
  if (!pack) redirect(withMsg("/produk", "Gramasi tidak ditemukan.", "error"));
  const used = await get(
    `SELECT 1 FROM lots WHERE product_id = ? AND pack_size = ? UNION ALL SELECT 1 FROM so_items WHERE product_id = ? AND pack_size = ? LIMIT 1`,
    pack.product_id, pack.pack_size, pack.product_id, pack.pack_size,
  );
  if (used) await run("UPDATE product_packs SET active = 0 WHERE id = ?", id);
  else await run("DELETE FROM product_packs WHERE id = ?", id);
  await run(`${PACK_SUMMARY_SQL} WHERE p.id = ?`, pack.product_id);
  revalidatePath("/produk");
  await logActivity("produk", used ? "Menonaktifkan gramasi" : "Menghapus gramasi", `${pack.name} · ${pack.pack_size}`);
  redirect(withMsg(`/produk/${pack.product_id}`, used ? `Gramasi ${pack.pack_size} dinonaktifkan (sudah dipakai lot/pesanan).` : `Gramasi ${pack.pack_size} dihapus.`));
}
