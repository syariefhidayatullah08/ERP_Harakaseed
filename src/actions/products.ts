"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { get, run } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";

function read(fd: FormData) {
  return {
    sku: str(fd, "sku").toUpperCase(),
    name: str(fd, "name").toUpperCase(),
    crop: str(fd, "crop"),
    category: str(fd, "category"),
    seed_type: str(fd, "seed_type") || "F1 Hibrida",
    pack_size: str(fd, "pack_size"),
    unit_price: numf(fd, "unit_price"),
    min_stock: numf(fd, "min_stock"),
    shelf_life_months: numf(fd, "shelf_life_months") || 18,
    description: str(fd, "description"),
    active: fd.get("active") ? 1 : 0,
  };
}

export async function saveProduct(fd: FormData) {
  await requireUser();
  const id = numf(fd, "id");
  const p = read(fd);
  const back = id ? `/produk/${id}` : "/produk/baru";
  if (!p.sku || !p.name || !p.crop || !p.pack_size) redirect(withMsg(back, "SKU, nama, komoditas, dan kemasan wajib diisi.", "error"));
  const dup = await get<{ id: number }>("SELECT id FROM products WHERE sku = ? AND id != ?", p.sku, id);
  if (dup) redirect(withMsg(back, `SKU ${p.sku} sudah dipakai.`, "error"));

  if (id) {
    await run(
      `UPDATE products SET sku=?, name=?, crop=?, category=?, seed_type=?, pack_size=?, unit_price=?, min_stock=?, shelf_life_months=?, description=?, active=? WHERE id=?`,
      p.sku, p.name, p.crop, p.category, p.seed_type, p.pack_size, p.unit_price, p.min_stock, p.shelf_life_months, p.description, p.active, id,
    );
  } else {
    await run(
      `INSERT INTO products (sku, name, crop, category, seed_type, pack_size, unit_price, min_stock, shelf_life_months, description, active) VALUES (?,?,?,?,?,?,?,?,?,?,1)`,
      p.sku, p.name, p.crop, p.category, p.seed_type, p.pack_size, p.unit_price, p.min_stock, p.shelf_life_months, p.description,
    );
  }
  revalidatePath("/produk");
  redirect(withMsg("/produk", `Produk ${p.name} disimpan.`));
}
