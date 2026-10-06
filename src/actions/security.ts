"use server";

import { redirect } from "next/navigation";
import { get, run } from "@/lib/db";
import { requireAccess, requireUser, setSessionCookie } from "@/lib/session";
import { verifyPassword } from "@/lib/password";
import { hashRecovery, newRecoveryCodes, verifyTotp } from "@/lib/totp";
import { numf, str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";

const BACK = "/pengaturan";
const USERS = "/pengguna";

/** Semua sesi akun ini batal (HP hilang, lupa keluar di komputer lain); perangkat yang sedang dipakai tetap masuk. */
export async function logoutOtherDevices() {
  const user = await requireUser();
  await run("UPDATE users SET session_version = session_version + 1 WHERE id = ?", user.id);
  await setSessionCookie(user.id);
  await logActivity("akun", "Keluar dari semua perangkat lain");
  redirect(withMsg(BACK, "Semua perangkat lain yang memakai akun Anda sudah dikeluarkan.") + "#keamanan");
}

/** Founder mengeluarkan akun orang lain dari semua perangkatnya, mis. HP karyawan hilang. */
export async function logoutUserEverywhere(fd: FormData) {
  const actor = await requireAccess("pengguna");
  const target = await get<{ id: number; email: string; role: string }>("SELECT id, email, role FROM users WHERE id = ?", numf(fd, "id"));
  if (!target) redirect(withMsg(USERS, "Pengguna tidak ditemukan.", "error"));
  if (target.role === "owner" && actor.role !== "owner") redirect(withMsg(USERS, "Hanya Founder yang dapat mengelola akun Founder.", "error"));
  await run("UPDATE users SET session_version = session_version + 1 WHERE id = ?", target.id);
  if (target.id === actor.id) await setSessionCookie(actor.id);
  await logActivity("pengguna", "Mengeluarkan akun dari semua perangkat", target.email);
  redirect(withMsg(USERS, `${target.email} dikeluarkan dari semua perangkat. Untuk masuk lagi perlu login ulang.`));
}

type SetupState = { error?: string; codes?: string[] } | null;

/**
 * Aktifkan verifikasi dua langkah. Kunci rahasia dibuat di halaman (QR code) dan dikirim balik bersama kode pertama
 * dari aplikasi authenticator; baru disimpan bila kodenya cocok, jadi tidak ada risiko terkunci karena salah pindai.
 */
export async function enableTotp(_: SetupState, fd: FormData): Promise<SetupState> {
  const user = await requireUser();
  const secret = str(fd, "secret");
  if (!/^[A-Z2-7]{32}$/.test(secret)) return { error: "Kunci tidak valid. Muat ulang halaman lalu pindai QR code yang baru." };
  const step = verifyTotp(secret, str(fd, "code"));
  if (step === null) return { error: "Kode belum cocok. Pastikan jam HP otomatis, lalu masukkan kode 6 digit yang sedang tampil." };
  const codes = newRecoveryCodes();
  const res = await get<{ id: number }>(
    "UPDATE users SET totp_secret = ?, totp_last_step = ?, totp_recovery = ? WHERE id = ? AND totp_secret IS NULL RETURNING id",
    secret, step, JSON.stringify(codes.map(hashRecovery)), user.id,
  );
  if (!res) return { error: "Verifikasi dua langkah sudah aktif di akun ini." };
  // Sesi lain yang masuk sebelum OTP aktif ikut dikeluarkan; mereka harus login ulang dengan kode.
  await run("UPDATE users SET session_version = session_version + 1 WHERE id = ?", user.id);
  await setSessionCookie(user.id);
  await logActivity("akun", "Mengaktifkan verifikasi dua langkah");
  return { codes };
}

/** Matikan verifikasi dua langkah akun sendiri; wajib kata sandi. */
export async function disableTotp(fd: FormData) {
  const user = await requireUser();
  const row = (await get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", user.id))!;
  if (!verifyPassword(str(fd, "password"), row.password_hash)) redirect(withMsg(BACK, "Kata sandi salah; verifikasi dua langkah tetap aktif.", "error") + "#keamanan");
  await run("UPDATE users SET totp_secret = NULL, totp_recovery = NULL, totp_last_step = 0 WHERE id = ?", user.id);
  await logActivity("akun", "Mematikan verifikasi dua langkah");
  redirect(withMsg(BACK, "Verifikasi dua langkah dimatikan.") + "#keamanan");
}

/** Founder mematikan OTP akun lain yang kehilangan HP dan kode cadangannya; orang itu lalu bisa login dan mengaktifkan ulang. */
export async function resetUserTotp(fd: FormData) {
  const actor = await requireAccess("pengguna");
  if (actor.role !== "owner") redirect(withMsg(USERS, "Hanya Founder yang dapat mematikan verifikasi dua langkah pengguna lain.", "error"));
  const target = await get<{ id: number; email: string }>("SELECT id, email FROM users WHERE id = ?", numf(fd, "id"));
  if (!target) redirect(withMsg(USERS, "Pengguna tidak ditemukan.", "error"));
  if (target.id === actor.id) redirect(withMsg(USERS, "Untuk akun sendiri, matikan lewat Pengaturan → Keamanan.", "error"));
  await run("UPDATE users SET totp_secret = NULL, totp_recovery = NULL, totp_last_step = 0, session_version = session_version + 1 WHERE id = ?", target.id);
  await logActivity("pengguna", "Mematikan verifikasi dua langkah pengguna", target.email);
  redirect(withMsg(USERS, `Verifikasi dua langkah ${target.email} dimatikan dan semua sesinya dikeluarkan. Minta dia mengaktifkannya lagi setelah login.`));
}
