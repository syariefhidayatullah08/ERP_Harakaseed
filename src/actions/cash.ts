"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { get, run } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";
import { rupiah } from "@/lib/format";
import { cashCategoryLabel, isCashCategory } from "@/lib/cash";

const backTo = (date: string) => `/kas?bulan=${date.slice(0, 7)}`;

export async function saveCashEntry(fd: FormData) {
  const user = await requireAccess("kas");
  const date = str(fd, "entry_date");
  const description = str(fd, "description");
  const category = str(fd, "category");
  const amount = Math.round(numf(fd, "amount") * 100) / 100;
  const isIn = str(fd, "direction") === "masuk";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect(withMsg("/kas", "Isi tanggal transaksi.", "error"));
  if (!description || amount <= 0) redirect(withMsg(backTo(date), "Isi keterangan dan jumlah lebih dari 0.", "error"));
  if (!isCashCategory(category)) redirect(withMsg(backTo(date), "Pilih kategori.", "error"));
  await run(
    "INSERT INTO cash_entries (entry_date, description, category, amount_in, amount_out, created_by) VALUES (?,?,?,?,?,?)",
    date, description, category, isIn ? amount : 0, isIn ? 0 : amount, user.id,
  );
  revalidatePath("/kas");
  await logActivity("kas", isIn ? "Mencatat pemasukan kas" : "Mencatat pengeluaran kas", `${date} · ${description} · ${rupiah(amount)} · ${cashCategoryLabel(category)}`);
  redirect(withMsg(backTo(date), `${isIn ? "Pemasukan" : "Pengeluaran"} ${rupiah(amount)} dicatat.`));
}

export async function deleteCashEntry(fd: FormData) {
  await requireAccess("kas");
  const id = numf(fd, "id");
  const row = await get<{ entry_date: string; description: string; amount_in: number; amount_out: number; auto: boolean }>("SELECT entry_date, description, amount_in, amount_out, (payment_id IS NOT NULL OR pb_id IS NOT NULL OR po_id IS NOT NULL) auto FROM cash_entries WHERE id = ?", id);
  if (!row) redirect(withMsg("/kas", "Transaksi tidak ditemukan.", "error"));
  // Baris otomatis (pembayaran pesanan, surat PB, PO) harus tetap sama dengan sumbernya.
  if (row.auto) redirect(withMsg(backTo(row.entry_date), "Transaksi ini tercatat otomatis dari modul lain, jadi diubah dari sumbernya, bukan dihapus dari Buku Kas.", "error"));
  await run("DELETE FROM cash_entries WHERE id = ?", id);
  revalidatePath("/kas");
  await logActivity("kas", "Menghapus transaksi kas", `${row.entry_date} · ${row.description} · ${rupiah(row.amount_in || row.amount_out)}`);
  redirect(withMsg(backTo(row.entry_date), `Transaksi "${row.description}" dihapus.`));
}
