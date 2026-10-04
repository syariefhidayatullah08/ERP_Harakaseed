"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { get, getSetting, run, tx } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";
import { createLot, lowStockProducts } from "@/lib/inventory";
import { lowStockEmail, sendEmail } from "@/lib/email";
import { addDays } from "@/lib/format";

export async function createLotAction(fd: FormData) {
  await requireAccess("inventori");
  const productId = numf(fd, "product_id");
  const qty = Math.round(numf(fd, "qty"));
  const lotNo = str(fd, "lot_no").toUpperCase();
  const prodDate = str(fd, "prod_date");
  const product = await get<{ shelf_life_months: number }>("SELECT shelf_life_months FROM products WHERE id = ?", productId);
  if (!product || qty <= 0 || !lotNo || !prodDate) redirect(withMsg("/inventori", "Lengkapi produk, nomor lot, tanggal, dan qty.", "error"));
  if (await get("SELECT id FROM lots WHERE lot_no = ?", lotNo)) redirect(withMsg("/inventori", `Nomor lot ${lotNo} sudah ada.`, "error"));

  await tx(async () =>
    await createLot({
      lotNo,
      productId,
      qty,
      germination: numf(fd, "germination"),
      purity: numf(fd, "purity"),
      moisture: numf(fd, "moisture"),
      prodDate,
      expiryDate: str(fd, "expiry_date") || addDays(prodDate, product.shelf_life_months * 30),
      location: str(fd, "location") || "Gudang Jember",
      note: str(fd, "note") || "Penerimaan lot",
    }),
  );
  revalidatePath("/inventori");
  await logActivity("inventori", "Menambah lot", `${lotNo} · ${qty} kemasan`);
  redirect(withMsg("/inventori", `Lot ${lotNo} (${qty} kemasan) ditambahkan.`));
}

export async function adjustLot(fd: FormData) {
  await requireAccess("inventori");
  const lotId = numf(fd, "lot_id");
  const delta = Math.round(numf(fd, "delta"));
  const reason = str(fd, "reason");
  const lot = await get<{ id: number; product_id: number; lot_no: string; qty_available: number }>("SELECT * FROM lots WHERE id = ?", lotId);
  const back = `/inventori/${lotId}`;
  if (!lot || delta === 0) redirect(withMsg(back, "Isi jumlah penyesuaian (positif/negatif).", "error"));
  if (lot.qty_available + delta < 0) redirect(withMsg(back, "Penyesuaian membuat stok minus.", "error"));
  if (!reason) redirect(withMsg(back, "Alasan penyesuaian wajib diisi.", "error"));

  await tx(async () => {
    await run("UPDATE lots SET qty_available = qty_available + ? WHERE id = ?", delta, lotId);
    await run(
      "INSERT INTO stock_moves (lot_id, product_id, kind, qty, ref, note) VALUES (?,?, 'penyesuaian', ?, ?, ?)",
      lotId,
      lot.product_id,
      delta,
      lot.lot_no,
      reason,
    );
  });
  revalidatePath("/inventori");
  await logActivity("inventori", "Menyesuaikan stok lot", `${lot.lot_no} · ${delta > 0 ? "+" : ""}${delta} kemasan · ${reason}`);
  redirect(withMsg(back, "Stok lot disesuaikan."));
}

export async function sendLowStockAlert() {
  await requireAccess("inventori");
  const rows = await lowStockProducts();
  if (!rows.length) redirect(withMsg("/inventori", "Semua stok di atas minimum, tidak ada yang perlu dikirim."));
  const to = await getSetting("alert_email");
  const mail = await lowStockEmail(rows);
  const res = await sendEmail({ to, ...mail, refType: "alert" });
  redirect(
    withMsg("/inventori", res.ok ? `Peringatan stok rendah dikirim ke ${to}.` : `Gagal mengirim email: ${res.error}`, res.ok ? "msg" : "error"),
  );
}
