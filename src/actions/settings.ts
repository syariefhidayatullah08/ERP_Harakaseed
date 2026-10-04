"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { all, exec, get, run, setSetting, tx } from "@/lib/db";
import { createToken, requireUser, SESSION_COOKIE } from "@/lib/session";
import { str, withMsg } from "@/lib/form";
import { hashPassword, verifyPassword } from "@/lib/password";
import { ALL_MODULES, DEFAULT_ACCESS, OWNER_ONLY, type AccessMatrix, type Division, type Module } from "@/lib/access";

const BACK = "/pengaturan";
const TEXT_KEYS = ["company_name", "company_brand", "company_tagline", "company_address", "company_phone", "company_email", "company_website", "bank_info", "alert_email"];
const TOGGLES = ["auto_email_order", "auto_email_shipping", "auto_email_invoice"];

async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "owner") redirect(withMsg(BACK, "Hanya Owner yang dapat mengubah pengaturan ini.", "error"));
  return user;
}

export async function saveSettings(fd: FormData) {
  await requireOwner();
  for (const k of TEXT_KEYS) if (fd.has(k)) await setSetting(k, str(fd, k));
  if (fd.get("toggles")) for (const k of TOGGLES) await setSetting(k, fd.get(k) ? "1" : "0");
  revalidatePath("/", "layout");
  redirect(withMsg(BACK, "Pengaturan disimpan."));
}

/** Simpan modul yang boleh dibuka tiap divisi. Modul khusus Owner (keuangan) tidak pernah bisa diberikan. */
export async function saveAccessMatrix(fd: FormData) {
  await requireOwner();
  if (fd.get("reset")) {
    await run("DELETE FROM settings WHERE key = 'access_matrix'");
    revalidatePath("/", "layout");
    redirect(withMsg(BACK, "Hak akses dikembalikan ke bawaan.") + "#akses");
  }
  const matrix: AccessMatrix = {};
  for (const division of Object.keys(DEFAULT_ACCESS) as Exclude<Division, "owner">[]) {
    matrix[division] = ALL_MODULES.filter((m: Module) => !OWNER_ONLY.includes(m) && fd.get(`${division}:${m}`));
  }
  await setSetting("access_matrix", JSON.stringify(matrix));
  revalidatePath("/", "layout");
  redirect(withMsg(BACK, "Hak akses divisi disimpan. Berlaku langsung untuk semua pengguna.") + "#akses");
}

export async function updateMyName(fd: FormData) {
  const user = await requireUser();
  const name = str(fd, "name");
  if (!name) redirect(withMsg(BACK, "Nama tidak boleh kosong.", "error"));
  await run("UPDATE users SET name = ? WHERE id = ?", name, user.id);
  revalidatePath("/", "layout");
  redirect(withMsg(BACK, "Nama diperbarui."));
}

export async function changePassword(fd: FormData) {
  const user = await requireUser();
  const current = str(fd, "current");
  const next = str(fd, "next");
  const row = (await get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", user.id))!;
  if (!verifyPassword(current, row.password_hash)) redirect(withMsg(BACK, "Kata sandi lama salah.", "error"));
  if (next.length < 8) redirect(withMsg(BACK, "Kata sandi baru minimal 8 karakter.", "error"));
  const hash = hashPassword(next);
  await run("UPDATE users SET password_hash = ? WHERE id = ?", hash, user.id);
  // Sesi lain (perangkat lain) otomatis keluar; sesi ini diperbarui agar tetap masuk.
  (await cookies()).set(SESSION_COOKIE, createToken(user.id, hash), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIE !== "1",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect(withMsg(BACK, "Kata sandi diganti. Perangkat lain yang memakai akun ini otomatis keluar."));
}

/** Menghapus seluruh data transaksi & master contoh. Produk, pengaturan, pengguna, dan data karyawan tetap. */
export async function clearTransactions(fd: FormData) {
  await requireOwner();
  if (str(fd, "confirm") !== "HAPUS") redirect(withMsg(BACK, "Ketik HAPUS untuk konfirmasi.", "error"));
  // Lampiran data SDM dan sistem mutu ISO bukan data contoh; jangan ikut dihapus.
  const KEEP = "('employee','audit','finding','qdoc')";
  const files = await all<{ pathname: string }>(`SELECT pathname FROM attachments WHERE ref_type NOT IN ${KEEP}`);
  await tx(async () => {
    await exec(`
      DELETE FROM attachments WHERE ref_type NOT IN ${KEEP};
      DELETE FROM complaints; DELETE FROM lot_tests;
      DELETE FROM so_allocations; DELETE FROM payments; DELETE FROM so_items; DELETE FROM sales_orders;
      DELETE FROM stock_moves; DELETE FROM lots; DELETE FROM productions; DELETE FROM growers;
      DELETE FROM po_items; DELETE FROM purchase_orders; DELETE FROM suppliers; DELETE FROM customers; DELETE FROM emails;
    `);
  });
  if (files.length) await del(files.map((f) => f.pathname)).catch(() => {});
  revalidatePath("/", "layout");
  redirect(withMsg(BACK, "Semua data transaksi dihapus. Sistem siap dipakai dengan data asli."));
}
