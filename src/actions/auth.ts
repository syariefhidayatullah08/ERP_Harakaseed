"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { get, run } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createPasswordToken, createToken, SESSION_COOKIE, verifyPasswordToken } from "@/lib/session";
import { passwordLinkEmail, sendEmail } from "@/lib/email";
import { logActivity, SYSTEM_ACTOR } from "@/lib/activity";

// Salah kata sandi berturut-turut sebanyak ini → akun dikunci sementara.
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIE !== "1",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

const lockedMessage = (ms: number) =>
  `Terlalu banyak percobaan salah. Akun dikunci sementara, coba lagi dalam ${Math.max(1, Math.ceil(ms / 60_000))} menit atau pakai "Lupa kata sandi?".`;

export async function login(_: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await get<{ id: number; name: string; email: string; role: string; password_hash: string; active: number; locked_until: string | null }>(
    "SELECT id, name, email, role, password_hash, active, locked_until FROM users WHERE lower(email) = ?",
    email,
  );
  const lockedMs = user?.locked_until ? Date.parse(user.locked_until) - Date.now() : 0;
  if (lockedMs > 0) return { error: lockedMessage(lockedMs) };
  if (!user || !verifyPassword(password, user.password_hash)) {
    if (!user) {
      await logActivity("login", "Login gagal: email tidak terdaftar", email.slice(0, 120), SYSTEM_ACTOR);
      return { error: "Email atau kata sandi salah." };
    }
    // Penambahan dihitung di database agar percobaan yang bersamaan tidak lolos hitungan.
    const fails = (await get<{ failed_logins: number }>("UPDATE users SET failed_logins = failed_logins + 1 WHERE id = ? RETURNING failed_logins", user.id))!.failed_logins;
    if (fails >= MAX_FAILED_LOGINS) {
      await run("UPDATE users SET failed_logins = 0, locked_until = ? WHERE id = ?", new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString(), user.id);
      await logActivity("login", "Akun dikunci sementara", `${MAX_FAILED_LOGINS}× salah kata sandi, dikunci ${LOCK_MINUTES} menit`, user);
      return { error: lockedMessage(LOCK_MINUTES * 60_000) };
    }
    await logActivity("login", "Login gagal: kata sandi salah", `percobaan ke-${fails} dari ${MAX_FAILED_LOGINS}`, user);
    return { error: "Email atau kata sandi salah." };
  }
  if (!user.active) return { error: "Akun ini dinonaktifkan. Hubungi Founder." };
  await run(
    "UPDATE users SET failed_logins = 0, locked_until = NULL, last_login = to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS') WHERE id = ?",
    user.id,
  );
  await logActivity("login", "Login berhasil", "", user);
  (await cookies()).set(SESSION_COOKIE, createToken(user.id, user.password_hash), cookieOptions);
  redirect("/");
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
  (await cookies()).set(SESSION_COOKIE, createToken(user.id, hash), cookieOptions);
  redirect("/?msg=" + encodeURIComponent(`Kata sandi tersimpan. Selamat datang, ${user.name}.`));
}
