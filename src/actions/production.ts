"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { get, insert, nextNumber, run } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";

export async function createProduction(fd: FormData) {
  await requireAccess("produksi");
  const productId = numf(fd, "product_id");
  const plantDate = str(fd, "plant_date");
  if (!productId || !plantDate) redirect(withMsg("/produksi", "Pilih varietas dan tanggal tanam.", "error"));
  const code = await nextNumber("PRD", "productions", "code");
  const newId = await insert(
    "INSERT INTO productions (code, product_id, grower_id, area_ha, plant_date, est_harvest, notes) VALUES (?,?,?,?,?,?,?)",
    code,
    productId,
    numf(fd, "grower_id") || null,
    numf(fd, "area_ha"),
    plantDate,
    str(fd, "est_harvest") || null,
    str(fd, "notes"),
  );
  revalidatePath("/produksi");
  await logActivity("produksi", "Membuat batch produksi", code);
  redirect(withMsg(`/produksi/${newId}`, `Batch produksi ${code} dibuat.`));
}

const FLOW = ["tanam", "panen", "prosesing", "uji_lab", "lulus"];

export async function advanceProduction(fd: FormData) {
  await requireAccess("produksi");
  const id = numf(fd, "id");
  const next = str(fd, "next");
  const back = `/produksi/${id}`;
  const p = await get<{ id: number; code: string; status: string; product_id: number; shelf_life_months: number; sku: string }>(
    "SELECT pr.*, p.shelf_life_months, p.sku FROM productions pr JOIN products p ON p.id = pr.product_id WHERE pr.id = ?",
    id,
  );
  if (!p) redirect("/produksi");
  // Keputusan lulus/gagal uji lab adalah wewenang Lab/QC (lihat actions/qc.ts).
  if (p.status === "uji_lab" || next === "lulus") redirect(withMsg(back, "Batch sedang di Lab/QC. Keputusan lulus/gagal dilakukan divisi Lab/QC.", "error"));
  if (next === "gagal") {
    await run("UPDATE productions SET status = 'gagal', notes = notes || ? WHERE id = ?", `\n[Gagal di produksi] ${str(fd, "reason")}`, id);
    revalidatePath("/produksi");
    await logActivity("produksi", "Menandai batch gagal", `${p.code} · ${str(fd, "reason")}`);
    redirect(withMsg(back, "Batch ditandai gagal."));
  }
  if (FLOW.indexOf(next) !== FLOW.indexOf(p.status) + 1) redirect(withMsg(back, "Urutan status tidak valid.", "error"));

  if (next === "panen") {
    const kg = numf(fd, "harvest_kg");
    if (kg <= 0) redirect(withMsg(back, "Isi berat benih hasil panen (kg).", "error"));
    await run("UPDATE productions SET status = 'panen', harvest_kg = ? WHERE id = ?", kg, id);
  } else {
    await run("UPDATE productions SET status = ? WHERE id = ?", next, id);
  }
  revalidatePath("/produksi");
  revalidatePath("/qc");
  await logActivity("produksi", "Mengubah status produksi", `${p.code} → ${next}`);
  redirect(withMsg(back, next === "uji_lab" ? "Sampel diserahkan ke Lab/QC untuk diuji." : "Status produksi diperbarui."));
}

export async function saveGrower(fd: FormData) {
  await requireAccess("mitra");
  const id = numf(fd, "id");
  const name = str(fd, "name");
  if (!name) redirect(withMsg("/mitra", "Nama petani wajib diisi.", "error"));
  const vals = [name, str(fd, "village"), str(fd, "phone"), numf(fd, "area_ha")] as const;
  if (id) await run("UPDATE growers SET name=?, village=?, phone=?, area_ha=? WHERE id=?", ...vals, id);
  else await run("INSERT INTO growers (name, village, phone, area_ha) VALUES (?,?,?,?)", ...vals);
  revalidatePath("/mitra");
  await logActivity("mitra", id ? "Mengubah petani mitra" : "Menambah petani mitra", name);
  redirect(withMsg(id ? `/mitra/${id}` : "/mitra", `Petani mitra ${name} disimpan.`));
}
