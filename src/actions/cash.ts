"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { get, run, tx } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";
import { rupiah } from "@/lib/format";
import { CASH_ACCOUNTS, cashCategoryLabel, isCashCategory, toCashAccount } from "@/lib/cash";

const backTo = (date: string) => `/kas?bulan=${date.slice(0, 7)}`;

export async function saveCashEntry(fd: FormData) {
  const user = await requireAccess("kas");
  const date = str(fd, "entry_date");
  const description = str(fd, "description");
  const category = str(fd, "category");
  const amount = Math.round(numf(fd, "amount") * 100) / 100;
  const isIn = str(fd, "direction") === "masuk";
  const account = toCashAccount(str(fd, "account"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect(withMsg("/kas", "Isi tanggal transaksi.", "error"));
  if (!description || amount <= 0) redirect(withMsg(backTo(date), "Isi keterangan dan jumlah lebih dari 0.", "error"));
  if (!isCashCategory(category)) redirect(withMsg(backTo(date), "Pilih kategori.", "error"));
  await run(
    "INSERT INTO cash_entries (entry_date, description, category, amount_in, amount_out, created_by, account) VALUES (?,?,?,?,?,?,?)",
    date, description, category, isIn ? amount : 0, isIn ? 0 : amount, user.id, account,
  );
  revalidatePath("/kas");
  await logActivity("kas", isIn ? "Mencatat pemasukan kas" : "Mencatat pengeluaran kas", `${date} · ${description} · ${rupiah(amount)} · ${cashCategoryLabel(category)} · ${CASH_ACCOUNTS[account]}`);
  redirect(withMsg(backTo(date), `${isIn ? "Pemasukan" : "Pengeluaran"} ${rupiah(amount)} dicatat di ${CASH_ACCOUNTS[account]}.`));
}

/** Pindah saldo antar akun (antar rekening, tarik/setor tunai): dua baris berpasangan, total saldo tidak berubah. */
export async function transferCash(fd: FormData) {
  const user = await requireAccess("kas");
  const date = str(fd, "entry_date");
  const from = toCashAccount(str(fd, "from"));
  const to = toCashAccount(str(fd, "to"));
  const amount = Math.round(numf(fd, "amount") * 100) / 100;
  const note = str(fd, "note");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect(withMsg("/kas", "Isi tanggal pindah saldo.", "error"));
  if (amount <= 0) redirect(withMsg(backTo(date), "Isi jumlah lebih dari 0.", "error"));
  if (from === to) redirect(withMsg(backTo(date), "Akun asal dan tujuan harus berbeda.", "error"));
  const kind = to === "tunai" ? "Tarik tunai" : from === "tunai" ? "Setor tunai" : "Pindah antar rekening";
  const desc = `${kind}: ${CASH_ACCOUNTS[from]} → ${CASH_ACCOUNTS[to]}${note ? ` · ${note}` : ""}`;
  const ref = randomUUID();
  await tx(async () => {
    await run("INSERT INTO cash_entries (entry_date, description, category, amount_out, created_by, account, transfer_ref) VALUES (?,?, 'pindah', ?,?,?,?)", date, desc, amount, user.id, from, ref);
    await run("INSERT INTO cash_entries (entry_date, description, category, amount_in, created_by, account, transfer_ref) VALUES (?,?, 'pindah', ?,?,?,?)", date, desc, amount, user.id, to, ref);
  });
  revalidatePath("/kas");
  await logActivity("kas", "Pindah saldo", `${date} · ${desc} · ${rupiah(amount)}`);
  redirect(withMsg(backTo(date), `${rupiah(amount)} dipindah dari ${CASH_ACCOUNTS[from]} ke ${CASH_ACCOUNTS[to]}.`));
}

/**
 * Sesuaikan saldo satu akun dengan saldo sebenarnya (mis. sesuai rekening koran / hitung uang tunai) per tanggal:
 * selisihnya dicatat sebagai transaksi "Penyesuaian saldo", jadi riwayatnya tetap terlihat dan bisa dihapus.
 */
export async function adjustBalance(fd: FormData) {
  const user = await requireAccess("kas");
  const date = str(fd, "entry_date");
  const account = toCashAccount(str(fd, "account"));
  const target = Math.round(numf(fd, "balance") * 100) / 100;
  const note = str(fd, "note");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect(withMsg("/kas", "Isi tanggal saldo.", "error"));
  if (!str(fd, "balance")) redirect(withMsg(backTo(date), "Isi saldo sebenarnya.", "error"));
  const current = (await get<{ v: number }>("SELECT COALESCE(SUM(amount_in - amount_out), 0) v FROM cash_entries WHERE account = ? AND entry_date <= ?", account, date))!.v;
  const diff = Math.round((target - current) * 100) / 100;
  if (!diff) redirect(withMsg(backTo(date), `Saldo ${CASH_ACCOUNTS[account]} per tanggal itu sudah ${rupiah(target)}; tidak ada yang diubah.`));
  await run(
    "INSERT INTO cash_entries (entry_date, description, category, amount_in, amount_out, created_by, account) VALUES (?,?, 'penyesuaian', ?,?,?,?)",
    date, `Penyesuaian saldo ${CASH_ACCOUNTS[account]} menjadi ${rupiah(target)}${note ? ` · ${note}` : ""}`, diff > 0 ? diff : 0, diff < 0 ? -diff : 0, user.id, account,
  );
  revalidatePath("/kas");
  await logActivity("kas", "Menyesuaikan saldo", `${CASH_ACCOUNTS[account]} ${date}: ${rupiah(current)} → ${rupiah(target)}`);
  redirect(withMsg(backTo(date), `Saldo ${CASH_ACCOUNTS[account]} disesuaikan menjadi ${rupiah(target)} (selisih ${diff > 0 ? "+" : "−"}${rupiah(Math.abs(diff))}).`));
}

/** Ubah akun satu transaksi (mis. transaksi lama yang sebenarnya tunai). Surat PB ikut menyimpan akunnya. */
export async function setCashEntryAccount(fd: FormData) {
  await requireAccess("kas");
  const id = numf(fd, "id");
  const account = toCashAccount(str(fd, "account"));
  const row = await get<{ entry_date: string; description: string; pb_id: number | null; transfer_ref: string | null }>("SELECT entry_date, description, pb_id, transfer_ref FROM cash_entries WHERE id = ?", id);
  if (!row) redirect(withMsg("/kas", "Transaksi tidak ditemukan.", "error"));
  if (row.transfer_ref) redirect(withMsg(backTo(row.entry_date), "Akun pindah saldo tidak bisa diganti; hapus lalu catat ulang.", "error"));
  await run("UPDATE cash_entries SET account = ? WHERE id = ?", account, id);
  if (row.pb_id) await run("UPDATE seed_pb SET pay_account = ? WHERE id = ?", account, row.pb_id);
  revalidatePath("/kas");
  await logActivity("kas", "Mengubah akun transaksi kas", `${row.entry_date} · ${row.description} → ${CASH_ACCOUNTS[account]}`);
  redirect(withMsg(backTo(row.entry_date), `"${row.description}" dipindah ke ${CASH_ACCOUNTS[account]}.`));
}

export async function deleteCashEntry(fd: FormData) {
  await requireAccess("kas");
  const id = numf(fd, "id");
  const row = await get<{ entry_date: string; description: string; amount_in: number; amount_out: number; auto: boolean; transfer_ref: string | null }>("SELECT entry_date, description, amount_in, amount_out, (payment_id IS NOT NULL OR pb_id IS NOT NULL OR po_id IS NOT NULL) auto, transfer_ref FROM cash_entries WHERE id = ?", id);
  if (!row) redirect(withMsg("/kas", "Transaksi tidak ditemukan.", "error"));
  // Baris otomatis (pembayaran pesanan, surat PB, PO) harus tetap sama dengan sumbernya.
  if (row.auto) redirect(withMsg(backTo(row.entry_date), "Transaksi ini tercatat otomatis dari modul lain, jadi diubah dari sumbernya, bukan dihapus dari Buku Kas.", "error"));
  // Pindah saldo: kedua barisnya dihapus bersama.
  if (row.transfer_ref) await run("DELETE FROM cash_entries WHERE transfer_ref = ?", row.transfer_ref);
  else await run("DELETE FROM cash_entries WHERE id = ?", id);
  revalidatePath("/kas");
  await logActivity("kas", "Menghapus transaksi kas", `${row.entry_date} · ${row.description} · ${rupiah(row.amount_in || row.amount_out)}`);
  redirect(withMsg(backTo(row.entry_date), `Transaksi "${row.description}" dihapus.`));
}
