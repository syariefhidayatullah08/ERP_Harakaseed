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

const VARIETAS = "/inventori/varietas";
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function createLotAction(fd: FormData) {
  await requireAccess("inventori");
  const [pid, ...rest] = str(fd, "product_pack").split("|");
  const productId = Number(pid) || 0;
  const packSize = rest.join("|");
  const qty = Math.round(numf(fd, "qty"));
  const lotNo = str(fd, "lot_no").toUpperCase();
  const prodDate = str(fd, "prod_date");
  const product = await get<{ shelf_life_months: number }>("SELECT shelf_life_months FROM products WHERE id = ?", productId);
  if (!product || qty <= 0 || !lotNo || !prodDate) redirect(withMsg("/inventori", "Lengkapi produk, nomor lot, tanggal, dan qty.", "error"));
  if (!(await get("SELECT id FROM product_packs WHERE product_id = ? AND pack_size = ?", productId, packSize))) {
    redirect(withMsg("/inventori", "Gramasi tidak dikenal. Tambahkan dulu di menu Produk.", "error"));
  }
  if (await get("SELECT id FROM lots WHERE lot_no = ?", lotNo)) redirect(withMsg("/inventori", `Nomor lot ${lotNo} sudah ada.`, "error"));

  await tx(async () =>
    await createLot({
      lotNo,
      productId,
      packSize,
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
  await logActivity("inventori", "Menambah lot", `${lotNo} · ${qty} kemasan ${packSize}`);
  redirect(withMsg("/inventori", `Lot ${lotNo} (${qty} kemasan ${packSize}) ditambahkan.`));
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

/**
 * Ubah data lot (salah ketik nomor lot, mutu, tanggal, lokasi). Varietas/gramasi hanya bisa diganti selama lot belum
 * dipakai pesanan, supaya ketertelusuran pengiriman tidak berubah. Jumlah stok diubah lewat Penyesuaian stok.
 */
export async function updateLot(fd: FormData) {
  await requireAccess("inventori");
  const id = numf(fd, "lot_id");
  const back = `/inventori/${id}`;
  const lot = await get<{ lot_no: string; product_id: number; pack_size: string }>("SELECT lot_no, product_id, pack_size FROM lots WHERE id = ?", id);
  if (!lot) redirect(withMsg(VARIETAS, "Lot tidak ditemukan.", "error"));
  const lotNo = str(fd, "lot_no").toUpperCase();
  const prodDate = str(fd, "prod_date");
  const expiry = str(fd, "expiry_date");
  if (!lotNo || !isDate(prodDate) || !isDate(expiry)) redirect(withMsg(back, "Nomor lot, tanggal produksi, dan kadaluarsa wajib diisi.", "error"));
  if (expiry < prodDate) redirect(withMsg(back, "Tanggal kadaluarsa tidak boleh sebelum tanggal produksi.", "error"));
  if (await get("SELECT 1 FROM lots WHERE lot_no = ? AND id <> ?", lotNo, id)) redirect(withMsg(back, `Nomor lot ${lotNo} sudah dipakai lot lain.`, "error"));
  const pct = (k: string) => Math.min(100, Math.max(0, numf(fd, k)));

  // Ganti varietas/gramasi (opsional).
  const [pid, ...rest] = str(fd, "product_pack").split("|");
  let productId = lot.product_id;
  let packSize = lot.pack_size;
  if (pid && (Number(pid) !== lot.product_id || rest.join("|") !== lot.pack_size)) {
    if (await get("SELECT 1 FROM so_allocations WHERE lot_id = ? LIMIT 1", id)) redirect(withMsg(back, "Varietas lot yang sudah dipakai pesanan tidak bisa diganti.", "error"));
    if (!(await get("SELECT 1 FROM product_packs WHERE product_id = ? AND pack_size = ?", Number(pid), rest.join("|")))) redirect(withMsg(back, "Gramasi tidak dikenal.", "error"));
    productId = Number(pid);
    packSize = rest.join("|");
  }

  await tx(async () => {
    await run(
      "UPDATE lots SET lot_no = ?, product_id = ?, pack_size = ?, germination = ?, purity = ?, moisture = ?, prod_date = ?, expiry_date = ?, location = ? WHERE id = ?",
      lotNo, productId, packSize, pct("germination"), pct("purity"), pct("moisture"), prodDate, expiry, str(fd, "location") || "Gudang Jember", id,
    );
    await run("UPDATE stock_moves SET product_id = ?, ref = CASE WHEN ref = ? THEN ? ELSE ref END WHERE lot_id = ?", productId, lot.lot_no, lotNo, id);
  });
  revalidatePath("/inventori");
  revalidatePath(VARIETAS);
  await logActivity("inventori", "Mengubah data lot", lot.lot_no === lotNo ? lotNo : `${lot.lot_no} → ${lotNo}`);
  redirect(withMsg(back, `Data lot ${lotNo} disimpan.`));
}

/**
 * Hapus lot yang salah input. Lot yang sudah dipakai pesanan/dikirim tidak bisa dihapus (jejak telusur ke pelanggan
 * harus tetap ada) — habiskan lewat Penyesuaian stok. Riwayat stok & hasil uji lot ikut terhapus.
 */
export async function deleteLot(fd: FormData) {
  await requireAccess("inventori");
  const id = numf(fd, "lot_id");
  const back = str(fd, "back") === VARIETAS ? VARIETAS : `/inventori/${id}`;
  const lot = await get<{ lot_no: string; qty_available: number }>("SELECT lot_no, qty_available FROM lots WHERE id = ?", id);
  if (!lot) redirect(withMsg(VARIETAS, "Lot tidak ditemukan.", "error"));
  if (await get("SELECT 1 FROM so_allocations WHERE lot_id = ? LIMIT 1", id))
    redirect(withMsg(back, `Lot ${lot.lot_no} sudah dipakai pesanan/pengiriman, jadi tidak bisa dihapus. Gunakan Penyesuaian stok untuk menghabiskannya.`, "error"));
  if (await get("SELECT 1 FROM attachments WHERE ref_type = 'lot' AND ref_id = ? LIMIT 1", id))
    redirect(withMsg(`/inventori/${id}`, `Lot ${lot.lot_no} masih punya dokumen terlampir. Hapus dokumennya dulu.`, "error"));
  await tx(async () => {
    await run("DELETE FROM stock_moves WHERE lot_id = ?", id);
    await run("DELETE FROM lots WHERE id = ?", id);
  });
  revalidatePath("/inventori");
  revalidatePath(VARIETAS);
  await logActivity("inventori", "Menghapus lot", `${lot.lot_no} · sisa ${lot.qty_available} kemasan`);
  redirect(withMsg(VARIETAS, `Lot ${lot.lot_no} dihapus.`));
}

/** Ubah data varietas yang dipakai di Stok Varietas (nama, komoditas, kategori, minimum stok, masa simpan, aktif). */
export async function updateVariety(fd: FormData) {
  await requireAccess(["inventori", "produk"]);
  const id = numf(fd, "id");
  const back = `${VARIETAS}/${id}`;
  const name = str(fd, "name").toUpperCase();
  const crop = str(fd, "crop");
  if (!(await get("SELECT 1 FROM products WHERE id = ?", id))) redirect(withMsg(VARIETAS, "Varietas tidak ditemukan.", "error"));
  if (!name || !crop) redirect(withMsg(back, "Nama varietas dan komoditas wajib diisi.", "error"));
  await run(
    "UPDATE products SET name = ?, crop = ?, category = ?, min_stock = ?, shelf_life_months = ?, active = ? WHERE id = ?",
    name, crop, str(fd, "category"), Math.max(0, Math.round(numf(fd, "min_stock"))), Math.max(1, Math.round(numf(fd, "shelf_life_months")) || 18), fd.get("active") ? 1 : 0, id,
  );
  revalidatePath("/inventori");
  revalidatePath("/produk");
  revalidatePath(VARIETAS);
  await logActivity("inventori", "Mengubah data varietas", name);
  redirect(withMsg(VARIETAS, `Varietas ${name} disimpan.`));
}

/**
 * Hapus varietas. Yang masih punya stok ditolak; yang sudah punya riwayat (lot, pesanan, produksi) hanya
 * disembunyikan (nonaktif) agar laporan & ketertelusuran tetap utuh; yang belum pernah dipakai dihapus.
 */
export async function deleteVariety(fd: FormData) {
  await requireAccess(["inventori", "produk"]);
  const id = numf(fd, "id");
  const p = await get<{ name: string }>("SELECT name FROM products WHERE id = ?", id);
  if (!p) redirect(withMsg(VARIETAS, "Varietas tidak ditemukan.", "error"));
  const left = (await get<{ n: number }>("SELECT COALESCE(SUM(qty_available), 0) n FROM lots WHERE product_id = ?", id))!.n;
  if (Number(left) > 0) redirect(withMsg(VARIETAS, `${p.name} masih punya stok ${left} kemasan. Habiskan/sesuaikan stok lotnya dulu.`, "error"));
  const used = await get(
    `SELECT 1 FROM lots WHERE product_id = ? UNION ALL SELECT 1 FROM so_items WHERE product_id = ?
     UNION ALL SELECT 1 FROM productions WHERE product_id = ? UNION ALL SELECT 1 FROM stock_moves WHERE product_id = ? LIMIT 1`,
    id, id, id, id,
  );
  if (used) await run("UPDATE products SET active = 0 WHERE id = ?", id);
  else await run("DELETE FROM products WHERE id = ?", id);
  revalidatePath("/inventori");
  revalidatePath("/produk");
  revalidatePath(VARIETAS);
  await logActivity("inventori", used ? "Menyembunyikan varietas" : "Menghapus varietas", p.name);
  redirect(
    withMsg(VARIETAS, used ? `${p.name} disembunyikan dari daftar (sudah punya riwayat lot/pesanan, jadi tidak dihapus permanen). Bisa diaktifkan lagi lewat Ubah.` : `Varietas ${p.name} dihapus.`),
  );
}
