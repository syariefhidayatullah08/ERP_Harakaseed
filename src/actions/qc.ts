"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { get, insert, run, setSetting, tx } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";
import { createLot } from "@/lib/inventory";
import { addDays, today } from "@/lib/format";

const pct = (v: number) => Number.isFinite(v) && v >= 0 && v <= 100;

/** Keputusan Lab/QC untuk batch produksi yang sedang diuji: lulus → lot masuk stok, gagal → batch ditutup. */
export async function labDecision(fd: FormData) {
  const user = await requireAccess("qc");
  const id = numf(fd, "production_id");
  const decision = str(fd, "decision");
  const back = "/qc";
  const p = await get<{ id: number; code: string; status: string; product_id: number; shelf_life_months: number; sku: string }>(
    "SELECT pr.id, pr.code, pr.status, pr.product_id, p.shelf_life_months, p.sku FROM productions pr JOIN products p ON p.id = pr.product_id WHERE pr.id = ?",
    id,
  );
  if (!p || p.status !== "uji_lab") redirect(withMsg(back, "Batch ini tidak sedang menunggu uji lab.", "error"));

  const germination = numf(fd, "germination");
  const purity = numf(fd, "purity");
  const moisture = numf(fd, "moisture");
  const testDate = str(fd, "test_date") || today();
  const note = str(fd, "note");
  if (!pct(germination) || germination === 0 || !pct(purity) || !pct(moisture)) redirect(withMsg(back, "Isi hasil uji (daya kecambah, kemurnian, kadar air) dalam 0–100%.", "error"));

  if (decision === "gagal") {
    await run("UPDATE productions SET status = 'gagal', notes = notes || ? WHERE id = ?", `\n[Lab/QC ${testDate}] Tidak lulus: DK ${germination}%, kemurnian ${purity}%, KA ${moisture}%. ${note}`, id);
    revalidatePath("/qc");
    revalidatePath("/produksi");
    await logActivity("qc", "Keputusan uji lab: tidak lulus", `${p.code} · DK ${germination}%, kemurnian ${purity}%, KA ${moisture}%`);
    redirect(withMsg(back, `Batch ${p.code} dinyatakan TIDAK LULUS.`));
  }

  const qty = Math.round(numf(fd, "qty"));
  if (qty <= 0) redirect(withMsg(back, "Isi jumlah kemasan yang lulus.", "error"));
  const packSize = str(fd, "pack_size");
  if (!(await get("SELECT id FROM product_packs WHERE product_id = ? AND pack_size = ?", p.product_id, packSize))) {
    redirect(withMsg(back, "Pilih gramasi kemasan. Bila belum ada, tambahkan di menu Produk.", "error"));
  }
  const lotNo = (str(fd, "lot_no") || `L${p.code.replace(/\D/g, "")}-${p.sku.split("-")[1] ?? "X"}`).toUpperCase();
  if (await get("SELECT id FROM lots WHERE lot_no = ?", lotNo)) redirect(withMsg(back, `Nomor lot ${lotNo} sudah ada.`, "error"));
  const prodDate = str(fd, "prod_date") || testDate;

  await tx(async () => {
    const lotId = await createLot({
      lotNo,
      productId: p.product_id,
      packSize,
      productionId: id,
      qty,
      germination,
      purity,
      moisture,
      prodDate,
      expiryDate: addDays(prodDate, p.shelf_life_months * 30),
      location: str(fd, "location") || "Gudang Jember",
      note: `Lulus uji Lab/QC (${p.code})`,
    });
    await insert(
      "INSERT INTO lot_tests (lot_id, test_date, germination, purity, moisture, result, note, tested_by) VALUES (?,?,?,?,?, 'lulus', ?, ?)",
      lotId, testDate, germination, purity, moisture, note || "Uji awal produksi", user.id,
    );
    await run("UPDATE productions SET status = 'lulus' WHERE id = ?", id);
  });
  revalidatePath("/qc");
  revalidatePath("/produksi");
  revalidatePath("/inventori");
  await logActivity("qc", "Keputusan uji lab: lulus", `${p.code} → lot ${lotNo} (${qty} kemasan ${packSize}) · DK ${germination}%`);
  redirect(withMsg(back, `Batch ${p.code} LULUS. Lot ${lotNo} (${qty} kemasan ${packSize}) masuk stok gudang.`));
}

/** Uji ulang lot (mis. menjelang kadaluarsa atau ada keluhan). Hasil gagal → lot dikarantina, tidak bisa dijual. */
export async function retestLot(fd: FormData) {
  const user = await requireAccess("qc");
  const lotId = numf(fd, "lot_id");
  const back = `/qc/lot/${lotId}`;
  const lot = await get<{ id: number; lot_no: string }>("SELECT id, lot_no FROM lots WHERE id = ?", lotId);
  if (!lot) redirect(withMsg("/qc?tab=lot", "Lot tidak ditemukan.", "error"));
  const germination = numf(fd, "germination");
  const purity = numf(fd, "purity");
  const moisture = numf(fd, "moisture");
  const result = str(fd, "result") === "gagal" ? "gagal" : "lulus";
  if (!pct(germination) || germination === 0 || !pct(purity) || !pct(moisture)) redirect(withMsg(back, "Isi hasil uji dalam 0–100%.", "error"));
  await tx(async () => {
    await insert(
      "INSERT INTO lot_tests (lot_id, test_date, germination, purity, moisture, result, note, tested_by) VALUES (?,?,?,?,?,?,?,?)",
      lotId, str(fd, "test_date") || today(), germination, purity, moisture, result, str(fd, "note"), user.id,
    );
    await run(
      "UPDATE lots SET germination = ?, purity = ?, moisture = ?, qc_status = ? WHERE id = ?",
      germination, purity, moisture, result === "gagal" ? "karantina" : "lulus", lotId,
    );
  });
  revalidatePath("/qc");
  revalidatePath(back);
  revalidatePath("/inventori");
  await logActivity("qc", "Uji ulang lot", `${lot.lot_no} · ${result} · DK ${germination}%`);
  redirect(withMsg(back, result === "gagal" ? `Lot ${lot.lot_no} DIKARANTINA: tidak dihitung stok & tidak akan dikirim.` : `Hasil uji ulang lot ${lot.lot_no} tersimpan (lulus).`));
}

export async function saveQcStandard(fd: FormData) {
  await requireAccess("qc");
  const v = numf(fd, "min_germination");
  if (!pct(v) || v === 0) redirect(withMsg("/qc?tab=lot", "Standar harus 1–100%.", "error"));
  await setSetting("qc_min_germination", String(v));
  revalidatePath("/qc");
  await logActivity("qc", "Mengubah standar minimum daya kecambah", `${v}%`);
  redirect(withMsg("/qc?tab=lot", `Standar minimum daya kecambah: ${v}%.`));
}
