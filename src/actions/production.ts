"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { get, nextNumber, run, tx } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { createLot } from "@/lib/inventory";
import { addDays, today } from "@/lib/format";

export async function createProduction(fd: FormData) {
  await requireUser();
  const productId = numf(fd, "product_id");
  const plantDate = str(fd, "plant_date");
  if (!productId || !plantDate) redirect(withMsg("/produksi", "Pilih varietas dan tanggal tanam.", "error"));
  const code = nextNumber("PRD", "productions", "code");
  const r = run(
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
  redirect(withMsg(`/produksi/${r.lastInsertRowid}`, `Batch produksi ${code} dibuat.`));
}

const FLOW = ["tanam", "panen", "prosesing", "uji_lab", "lulus"];

export async function advanceProduction(fd: FormData) {
  await requireUser();
  const id = numf(fd, "id");
  const next = str(fd, "next");
  const back = `/produksi/${id}`;
  const p = get<{ id: number; code: string; status: string; product_id: number; shelf_life_months: number; sku: string }>(
    "SELECT pr.*, p.shelf_life_months, p.sku FROM productions pr JOIN products p ON p.id = pr.product_id WHERE pr.id = ?",
    id,
  );
  if (!p) redirect("/produksi");
  if (next === "gagal") {
    run("UPDATE productions SET status = 'gagal', notes = notes || ? WHERE id = ?", `\n[Gagal] ${str(fd, "reason")}`, id);
    redirect(withMsg(back, "Batch ditandai gagal."));
  }
  if (FLOW.indexOf(next) !== FLOW.indexOf(p.status) + 1) redirect(withMsg(back, "Urutan status tidak valid.", "error"));

  if (next === "panen") {
    const kg = numf(fd, "harvest_kg");
    if (kg <= 0) redirect(withMsg(back, "Isi berat benih hasil panen (kg).", "error"));
    run("UPDATE productions SET status = 'panen', harvest_kg = ? WHERE id = ?", kg, id);
  } else if (next === "lulus") {
    const qty = Math.round(numf(fd, "qty"));
    const germination = numf(fd, "germination");
    if (qty <= 0 || germination <= 0) redirect(withMsg(back, "Isi jumlah kemasan dan hasil uji daya kecambah.", "error"));
    const prodDate = str(fd, "prod_date") || today();
    const lotNo = (str(fd, "lot_no") || `L${p.code.replace(/\D/g, "")}-${p.sku.split("-")[1] ?? "X"}`).toUpperCase();
    if (get("SELECT id FROM lots WHERE lot_no = ?", lotNo)) redirect(withMsg(back, `Nomor lot ${lotNo} sudah ada.`, "error"));
    tx(() => {
      createLot({
        lotNo,
        productId: p.product_id,
        productionId: id,
        qty,
        germination,
        purity: numf(fd, "purity"),
        moisture: numf(fd, "moisture"),
        prodDate,
        expiryDate: addDays(prodDate, p.shelf_life_months * 30),
        location: str(fd, "location") || "Gudang Jember",
        note: `Hasil produksi ${p.code}`,
      });
      run("UPDATE productions SET status = 'lulus' WHERE id = ?", id);
    });
    revalidatePath("/inventori");
    redirect(withMsg(back, `Lulus uji mutu. Lot ${lotNo} (${qty} kemasan) masuk stok.`));
  } else {
    run("UPDATE productions SET status = ? WHERE id = ?", next, id);
  }
  revalidatePath("/produksi");
  redirect(withMsg(back, "Status produksi diperbarui."));
}

export async function saveGrower(fd: FormData) {
  await requireUser();
  const id = numf(fd, "id");
  const name = str(fd, "name");
  if (!name) redirect(withMsg("/mitra", "Nama petani wajib diisi.", "error"));
  const vals = [name, str(fd, "village"), str(fd, "phone"), numf(fd, "area_ha")] as const;
  if (id) run("UPDATE growers SET name=?, village=?, phone=?, area_ha=? WHERE id=?", ...vals, id);
  else run("INSERT INTO growers (name, village, phone, area_ha) VALUES (?,?,?,?)", ...vals);
  revalidatePath("/mitra");
  redirect(withMsg("/mitra", `Petani mitra ${name} disimpan.`));
}
