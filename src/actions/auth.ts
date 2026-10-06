"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { get, run } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  cookieOptions,
  createPasswordToken,
  createTwoFactorToken,
  SESSION_COOKIE,
  setSessionCookie,
  TWO_FACTOR_COOKIE,
  TWO_FACTOR_MINUTES,
  verifyPasswordToken,
  verifyTwoFactorToken,
} from "@/lib/session";
import { consumeRecoveryCode, verifyTotp } from "@/lib/totp";
import { passwordLinkEmail, sendEmail } from "@/lib/email";
import { logActivity, SYSTEM_ACTOR } from "@/lib/activity";

// Salah kata sandi / kode OTP berturut-turut sebanyak ini → akun dikunci sementara.
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

const lockedMessage = (ms: number) =>
  `Terlalu banyak percobaan salah. Akun dikunci sementara, coba lagi dalam ${Math.max(1, Math.ceil(ms / 60_000))} menit atau pakai "Lupa kata sandi?".`;

type Actor = { id: number; name: string; email: string; role: string };

/** Catat satu percobaan gagal; kunci akun bila sudah mencapai batas. Mengembalikan pesan untuk form. */
async function countFailure(user: Actor, what: string, wrongMessage: string) {
  // Penambahan dihitung di database agar percobaan yang bersamaan tidak lolos hitungan.
  const fails = (await get<{ failed_logins: number }>("UPDATE users SET failed_logins = failed_logins + 1 WHERE id = ? RETURNING failed_logins", user.id))!.failed_logins;
  if (fails >= MAX_FAILED_LOGINS) {
    await run("UPDATE users SET failed_logins = 0, locked_until = ? WHERE id = ?", new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString(), user.id);
    await logActivity("login", "Akun dikunci sementara", `${MAX_FAILED_LOGINS}× salah ${what}, dikunci ${LOCK_MINUTES} menit`, user);
    return lockedMessage(LOCK_MINUTES * 60_000);
  }
  await logActivity("login", `Login gagal: ${what} salah`, `percobaan ke-${fails} dari ${MAX_FAILED_LOGINS}`, user);
  return wrongMessage;
}

/** Login selesai: catat, pasang cookie sesi, masuk ke dashboard. */
async function finishLogin(user: Actor, note = "") {
  await run(
    "UPDATE users SET failed_logins = 0, locked_until = NULL, last_login = to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS') WHERE id = ?",
    user.id,
  );
  await logActivity("login", "Login berhasil", note, user);
  (await cookies()).delete(TWO_FACTOR_COOKIE);
  await setSessionCookie(user.id);
  redirect("/");
}

/** Kata sandi benar tapi akun memakai verifikasi dua langkah: lanjut ke langkah kode OTP. */
async function askOtp(userId: number, passwordHash: string): Promise<never> {
  (await cookies()).set(TWO_FACTOR_COOKIE, createTwoFactorToken(userId, passwordHash), cookieOptions(TWO_FACTOR_MINUTES * 60));
  redirect("/login?langkah=otp");
}

export async function login(_: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await get<{ id: number; name: string; email: string; role: string; password_hash: string; active: number; locked_until: string | null; totp_secret: string | null }>(
    "SELECT id, name, email, role, password_hash, active, locked_until, totp_secret FROM users WHERE lower(email) = ?",
    email,
  );
  const lockedMs = user?.locked_until ? Date.parse(user.locked_until) - Date.now() : 0;
  if (lockedMs > 0) return { error: lockedMessage(lockedMs) };
  if (!user) {
    await logActivity("login", "Login gagal: email tidak terdaftar", email.slice(0, 120), SYSTEM_ACTOR);
    return { error: "Email atau kata sandi salah." };
  }
  if (!verifyPassword(password, user.password_hash)) return { error: await countFailure(user, "kata sandi", "Email atau kata sandi salah.") };
  if (!user.active) return { error: "Akun ini dinonaktifkan. Hubungi Founder." };
  if (user.totp_secret) await askOtp(user.id, user.password_hash);
  await finishLogin(user);
}

/** Langkah kedua login: kode 6 digit dari aplikasi authenticator, atau salah satu kode cadangan. */
export async function verifyLoginOtp(_: unknown, formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const user = await verifyTwoFactorToken((await cookies()).get(TWO_FACTOR_COOKIE)?.value ?? "");
  if (!user || !user.totp_secret) return { error: "Sesi verifikasi sudah habis. Kembali dan masukkan kata sandi lagi.", expired: true };
  const lockedMs = user.locked_until ? Date.parse(user.locked_until) - Date.now() : 0;
  if (lockedMs > 0) return { error: lockedMessage(lockedMs) };

  const step = verifyTotp(user.totp_secret, code, user.totp_last_step);
  if (step !== null) {
    // Simpan langkah waktu yang dipakai: kode yang sama tidak bisa dipakai ulang oleh orang yang sempat melihatnya.
    await run("UPDATE users SET totp_last_step = ? WHERE id = ?", step, user.id);
    await finishLogin(user);
  }
  const left = consumeRecoveryCode(user.totp_recovery, code);
  if (left) {
    await run("UPDATE users SET totp_recovery = ? WHERE id = ?", JSON.stringify(left), user.id);
    await finishLogin(user, `memakai kode cadangan, sisa ${left.length}`);
  }
  return { error: await countFailure(user, "kode verifikasi", "Kode salah atau sudah dipakai. Lihat kode terbaru di aplikasi authenticator.") };
}

export async function logout() {
  await logActivity("login", "Logout");
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

/** Alamat dasar aplikasi untuk tautan di email (domain produksi, atau host request saat lokal). */
async function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

/** Kirim tautan reset ke email pengguna. Jawaban selalu sama agar tidak membocorkan email mana yang terdaftar. */
export async function requestPasswordReset(_: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const done = { sent: true, email };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Format email tidak valid." };
  const user = await get<{ id: number; name: string; email: string; password_hash: string; active: number; reset_requested_at: string | null }>(
    "SELECT id, name, email, password_hash, active, reset_requested_at FROM users WHERE lower(email) = ?",
    email,
  );
  if (!user || !user.active) return done;
  // Batasi 1 permintaan per 2 menit per akun.
  if (user.reset_requested_at && Date.now() - Date.parse(user.reset_requested_at) < 2 * 60 * 1000) return done;
  await run("UPDATE users SET reset_requested_at = ? WHERE id = ?", new Date().toISOString(), user.id);
  const link = `${await baseUrl()}/login/reset?token=${createPasswordToken(user.id, user.password_hash, 1)}`;
  await sendEmail({ to: user.email, ...(await passwordLinkEmail(user.name, link, "reset")), refType: "account", refId: user.id });
  await logActivity("login", "Meminta tautan reset kata sandi", "", { ...user, role: "" });
  return done;
}

export async function resetPassword(_: unknown, formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const user = await verifyPasswordToken(token);
  if (!user) return { error: "Tautan sudah kedaluwarsa atau sudah dipakai. Minta tautan baru." };
  if (password.length < 8) return { error: "Kata sandi minimal 8 karakter." };
  if (password !== confirm) return { error: "Konfirmasi kata sandi tidak sama." };
  const hash = hashPassword(password);
  // Tautan reset dari email juga membuka akun yang terkunci.
  await run("UPDATE users SET password_hash = ?, reset_requested_at = NULL, failed_logins = 0, locked_until = NULL WHERE id = ?", hash, user.id);
  await logActivity("login", "Membuat kata sandi baru lewat tautan email", "", { ...user, role: "" });
  // Tautan email tidak boleh melewati verifikasi dua langkah: akun ber-OTP tetap diminta kodenya.
  const otp = await get<{ totp_secret: string | null }>("SELECT totp_secret FROM users WHERE id = ?", user.id);
  if (otp?.totp_secret) await askOtp(user.id, hash);
  await setSessionCookie(user.id);
  redirect("/?msg=" + encodeURIComponent(`Kata sandi tersimpan. Selamat datang, ${user.name}.`));
}
