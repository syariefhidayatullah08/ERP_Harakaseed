"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { get, run } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";
import { today } from "@/lib/format";

const BACK = "/stok-bahan";
const kg = (fd: FormData, key: string) => Math.max(0, Math.round(numf(fd, key) * 100) / 100);

/** Tambah kode produksi baru atau perbarui stok bahan baku (kg) per tahap: belum uji, proses uji, siap jual. */
export async function saveBulkStock(fd: FormData) {
  await requireAccess("stok_bahan");
  const id = numf(fd, "id");
  const code = str(fd, "production_code").toUpperCase().replace(/\s+/g, " ");
  const name = str(fd, "product_name");
  if (!code) redirect(withMsg(BACK, "Kode produksi wajib diisi.", "error"));
  // Varietas pasangannya: penjualan bulky varietas ini akan mengurangi stok kode produksi ini.
  const productId = numf(fd, "product_id") || null;
  const vals = [code, name, kg(fd, "untested_kg"), kg(fd, "testing_kg"), kg(fd, "ready_kg"), str(fd, "packing"), str(fd, "note"), today(), productId] as const;
  if (id) await run("UPDATE bulk_stock SET production_code=?, product_name=?, untested_kg=?, testing_kg=?, ready_kg=?, packing=?, note=?, updated_at=?, product_id=? WHERE id=?", ...vals, id);
  else await run("INSERT INTO bulk_stock (production_code, product_name, untested_kg, testing_kg, ready_kg, packing, note, updated_at, product_id) VALUES (?,?,?,?,?,?,?,?,?)", ...vals);
  revalidatePath(BACK);
  await logActivity("stok_bahan", id ? "Memperbarui stok bahan baku" : "Menambah stok bahan baku", `${code} ${name} · belum uji ${vals[2]} kg · proses uji ${vals[3]} kg · siap jual ${vals[4]} kg`);
  redirect(withMsg(BACK, `Stok ${code}${name ? ` (${name})` : ""} disimpan.`));
}

export async function deleteBulkStock(fd: FormData) {
  await requireAccess("stok_bahan");
  const id = numf(fd, "id");
  const row = await get<{ production_code: string; product_name: string }>("SELECT production_code, product_name FROM bulk_stock WHERE id = ?", id);
  if (!row) redirect(withMsg(BACK, "Data tidak ditemukan.", "error"));
  await run("DELETE FROM bulk_stock WHERE id = ?", id);
  revalidatePath(BACK);
  await logActivity("stok_bahan", "Menghapus stok bahan baku", `${row.production_code} ${row.product_name}`);
  redirect(withMsg(BACK, `Kode ${row.production_code} dihapus dari stok bahan baku.`));
}
