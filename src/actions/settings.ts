"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exec, get, run, setSetting, tx } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { str, withMsg } from "@/lib/form";
import { hashPassword, verifyPassword } from "@/lib/password";

const TEXT_KEYS = [
  "company_name",
  "company_brand",
  "company_tagline",
  "company_address",
  "company_phone",
  "company_email",
  "company_website",
  "bank_info",
  "alert_email",
];
const TOGGLES = ["auto_email_order", "auto_email_shipping", "auto_email_invoice"];

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect(withMsg("/pengaturan", "Hanya admin yang dapat mengubah pengaturan ini.", "error"));
  return user;
}

export async function saveSettings(fd: FormData) {
  await requireAdmin();
  for (const k of TEXT_KEYS) if (fd.has(k)) await setSetting(k, str(fd, k));
  if (fd.get("toggles")) for (const k of TOGGLES) await setSetting(k, fd.get(k) ? "1" : "0");
  revalidatePath("/", "layout");
  redirect(withMsg("/pengaturan", "Pengaturan disimpan."));
}

export async function addUser(fd: FormData) {
  await requireAdmin();
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (!email || password.length < 8) redirect(withMsg("/pengaturan", "Email wajib dan kata sandi minimal 8 karakter.", "error"));
  if (await get("SELECT id FROM users WHERE email = ?", email)) redirect(withMsg("/pengaturan", "Email sudah terdaftar.", "error"));
  await run(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)",
    str(fd, "name") || email,
    email,
    hashPassword(password),
    str(fd, "role") === "admin" ? "admin" : "staff",
  );
  redirect(withMsg("/pengaturan", `Pengguna ${email} ditambahkan.`));
}

export async function changePassword(fd: FormData) {
  const user = await requireUser();
  const current = str(fd, "current");
  const next = str(fd, "next");
  const row = (await get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", user.id))!;
  if (!verifyPassword(current, row.password_hash)) redirect(withMsg("/pengaturan", "Kata sandi lama salah.", "error"));
  if (next.length < 8) redirect(withMsg("/pengaturan", "Kata sandi baru minimal 8 karakter.", "error"));
  await run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(next), user.id);
  redirect(withMsg("/pengaturan", "Kata sandi diganti."));
}

/** Menghapus seluruh data transaksi & master contoh. Produk, pengaturan, dan pengguna tetap. */
export async function clearTransactions(fd: FormData) {
  await requireAdmin();
  if (str(fd, "confirm") !== "HAPUS") redirect(withMsg("/pengaturan", "Ketik HAPUS untuk konfirmasi.", "error"));
  await tx(async () => {
    await exec(`
      DELETE FROM so_allocations; DELETE FROM payments; DELETE FROM so_items; DELETE FROM sales_orders;
      DELETE FROM stock_moves; DELETE FROM lots; DELETE FROM productions; DELETE FROM growers;
      DELETE FROM po_items; DELETE FROM purchase_orders; DELETE FROM suppliers; DELETE FROM customers; DELETE FROM emails;
    `);
  });
  revalidatePath("/", "layout");
  redirect(withMsg("/pengaturan", "Semua data transaksi dihapus. Sistem siap dipakai dengan data asli."));
}
