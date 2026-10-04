"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { get, run } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createPasswordToken, createToken, SESSION_COOKIE, verifyPasswordToken } from "@/lib/session";
import { passwordLinkEmail, sendEmail } from "@/lib/email";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIE !== "1",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export async function login(_: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await get<{ id: number; password_hash: string; active: number }>(
    "SELECT id, password_hash, active FROM users WHERE lower(email) = ?",
    email,
  );
  if (!user || !verifyPassword(password, user.password_hash)) return { error: "Email atau kata sandi salah." };
  if (!user.active) return { error: "Akun ini dinonaktifkan. Hubungi Owner atau Admin/SDM." };
  await run("UPDATE users SET last_login = to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS') WHERE id = ?", user.id);
  (await cookies()).set(SESSION_COOKIE, createToken(user.id, user.password_hash), cookieOptions);
  redirect("/");
}

export async function logout() {
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
  await run("UPDATE users SET password_hash = ?, reset_requested_at = NULL WHERE id = ?", hash, user.id);
  (await cookies()).set(SESSION_COOKIE, createToken(user.id, hash), cookieOptions);
  redirect("/?msg=" + encodeURIComponent(`Kata sandi tersimpan. Selamat datang, ${user.name}.`));
}
