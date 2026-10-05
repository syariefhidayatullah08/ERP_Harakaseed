"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { all, exec, get, run, setSetting, tx } from "@/lib/db";
import { readSignature, SIGNATURE_KEYS, SIGNATURE_MAX_BYTES, type SignatureKey } from "@/lib/signature";
import { createToken, requireUser, SESSION_COOKIE } from "@/lib/session";
import { str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";
import { runBackup } from "@/lib/backup";
import { hashPassword, verifyPassword } from "@/lib/password";
import { ALL_MODULES, DEFAULT_ACCESS, OWNER_ONLY, type AccessMatrix, type Division, type Module } from "@/lib/access";

const BACK = "/pengaturan";
const TEXT_KEYS = [
  "company_name", "company_brand", "company_tagline", "company_address", "company_phone", "company_email", "company_website", "bank_info", "alert_email",
  "bank_name", "bank_account", "bank_holder", "signer_name", "signer_title", "signer2_name", "signer2_title", "invoice_city",
];
const TOGGLES = ["auto_email_order", "auto_email_shipping", "auto_email_invoice"];
// Pilihan dengan nilai terbatas.
const CHOICES: Record<string, string[]> = { backup_email: ["harian", "mingguan", "mati"] };
const CHOICE_KEYS = Object.keys(CHOICES);

async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "owner") redirect(withMsg(BACK, "Hanya Founder yang dapat mengubah pengaturan ini.", "error"));
  return user;
}

export async function saveSettings(fd: FormData) {
  await requireOwner();
  for (const k of TEXT_KEYS) if (fd.has(k)) await setSetting(k, str(fd, k));
  if (fd.get("toggles")) for (const k of TOGGLES) await setSetting(k, fd.get(k) ? "1" : "0");
  for (const k of CHOICE_KEYS) if (CHOICES[k].includes(str(fd, k))) await setSetting(k, str(fd, k));
  revalidatePath("/", "layout");
  await logActivity("pengaturan", "Mengubah pengaturan", [...TEXT_KEYS, ...TOGGLES, ...CHOICE_KEYS].filter((k) => fd.has(k)).join(", "));
  redirect(withMsg(BACK, "Pengaturan disimpan."));
}

/** Unggah atau hapus gambar tanda tangan (kiri/kanan) yang ditempel di PDF & Word invoice dan surat PB. */
export async function saveSignature(fd: FormData) {
  await requireOwner();
  const back = (msg: string, kind: "msg" | "error" = "msg") => redirect(withMsg(BACK, msg, kind) + "#ttd");
  const slot = str(fd, "slot") as SignatureKey;
  if (!SIGNATURE_KEYS.includes(slot)) back("Penanda tangan tidak dikenal.", "error");
  const side = slot === "signer_sig" ? "kiri" : "kanan";
  if (fd.get("remove")) {
    await run("DELETE FROM settings WHERE key = ?", slot);
    await logActivity("pengaturan", "Menghapus gambar tanda tangan", side);
    back(`Gambar tanda tangan ${side} dihapus.`);
  }
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return back("Pilih file gambar tanda tangan (PNG atau JPG).", "error");
  if (file.size > SIGNATURE_MAX_BYTES) back(`Ukuran file maksimal ${SIGNATURE_MAX_BYTES / 1024} KB. Perkecil gambarnya dulu.`, "error");
  const sig = await readSignature(new Uint8Array(await file.arrayBuffer()), file.type);
  if (!sig) return back("File harus berupa gambar PNG atau JPG yang valid.", "error");
  await setSetting(slot, JSON.stringify(sig));
  await logActivity("pengaturan", "Mengunggah gambar tanda tangan", side);
  back(`Gambar tanda tangan ${side} disimpan. Invoice dan surat PB berikutnya langsung memakainya.`);
}

/** Simpan modul yang boleh dibuka tiap divisi. Modul khusus Founder (keuangan, akun pengguna) tidak pernah bisa diberikan. */
export async function saveAccessMatrix(fd: FormData) {
  await requireOwner();
  if (fd.get("reset")) {
    await run("DELETE FROM settings WHERE key = 'access_matrix'");
    revalidatePath("/", "layout");
    await logActivity("pengaturan", "Mengembalikan hak akses divisi ke bawaan");
    redirect(withMsg(BACK, "Hak akses dikembalikan ke bawaan.") + "#akses");
  }
  const matrix: AccessMatrix = {};
  for (const division of Object.keys(DEFAULT_ACCESS) as Exclude<Division, "owner">[]) {
    matrix[division] = ALL_MODULES.filter((m: Module) => !OWNER_ONLY.includes(m) && fd.get(`${division}:${m}`));
  }
  await setSetting("access_matrix", JSON.stringify(matrix));
  revalidatePath("/", "layout");
  await logActivity("pengaturan", "Mengubah hak akses divisi", Object.entries(matrix).map(([d, m]) => `${d}: ${m.join("/")}`).join("; "));
  redirect(withMsg(BACK, "Hak akses divisi disimpan. Berlaku langsung untuk semua pengguna.") + "#akses");
}

export async function updateMyName(fd: FormData) {
  const user = await requireUser();
  const name = str(fd, "name");
  if (!name) redirect(withMsg(BACK, "Nama tidak boleh kosong.", "error"));
  await run("UPDATE users SET name = ? WHERE id = ?", name, user.id);
  revalidatePath("/", "layout");
  await logActivity("akun", "Mengubah nama tampilan", name);
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
  await logActivity("akun", "Mengganti kata sandi");
  redirect(withMsg(BACK, "Kata sandi diganti. Perangkat lain yang memakai akun ini otomatis keluar."));
}

/** Founder membuat backup saat itu juga (mis. sebelum menghapus data atau perubahan besar). */
export async function backupNow() {
  await requireOwner();
  const res = await runBackup({ scheduled: false });
  revalidatePath(BACK);
  redirect(withMsg(BACK, res.message, res.ok ? "msg" : "error") + "#backup");
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
  await logActivity("pengaturan", "Menghapus semua data transaksi & data contoh");
  redirect(withMsg(BACK, "Semua data transaksi dihapus. Sistem siap dipakai dengan data asli."));
}
