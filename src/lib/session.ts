import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { get } from "./db";
import { cache } from "react";
import { hasAny, MODULES, parseModules, resolveModules, type AccessMatrix, type Module } from "./access";

export const SESSION_COOKIE = "haraka_session";
const SECRET =
  process.env.SESSION_SECRET ??
  (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview"
    ? (() => {
        throw new Error("SESSION_SECRET wajib diisi di environment Vercel.");
      })()
    : "haraka-dev-secret-ganti-di-.env");

export type SessionUser = { id: number; name: string; email: string; role: string; modules: Module[] };

function sign(payload: string) {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/** Tanda tangan untuk tautan publik invoice (/i/<id>/<sig>) yang dibagikan ke pelanggan. */
export function invoiceSignature(soId: number) {
  return sign(`invoice:${soId}`).slice(0, 22);
}

export function verifyInvoiceSignature(soId: number, sig: string) {
  const a = Buffer.from(invoiceSignature(soId));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Sidik kata sandi: token sesi & token reset ikut tidak berlaku begitu kata sandi diganti.
const fingerprint = (passwordHash: string) => passwordHash.slice(-16);
// Sidik sesi: ditambah versi sesi, sehingga "keluar dari semua perangkat" (versi dinaikkan) membatalkan semua token lama.
// Versi 0 tidak ditulis agar sesi yang sudah ada sebelum fitur ini tetap berlaku.
const sessionPrint = (passwordHash: string, version: number) => (version ? `${fingerprint(passwordHash)}:${version}` : fingerprint(passwordHash));

const SESSION_DAYS = 7;

function createToken(userId: number, passwordHash: string, sessionVersion: number) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * SESSION_DAYS;
  return `${userId}.${exp}.${sign(`${userId}.${exp}.${sessionPrint(passwordHash, sessionVersion)}`)}`;
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIE !== "1",
  path: "/",
  maxAge,
});

/** Pasang cookie sesi untuk pengguna ini (dibaca ulang dari database: kata sandi & versi sesi terbaru). */
export async function setSessionCookie(userId: number) {
  const row = (await get<{ password_hash: string; session_version: number }>("SELECT password_hash, session_version FROM users WHERE id = ?", userId))!;
  (await cookies()).set(SESSION_COOKIE, createToken(userId, row.password_hash, row.session_version), cookieOptions(60 * 60 * 24 * SESSION_DAYS));
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

type UserRow = Omit<SessionUser, "modules"> & { password_hash: string; active: number; session_version: number; custom_modules?: string | null };

/** Ambil matriks hak akses sekali per request. */
export const getAccessMatrix = cache(async (): Promise<AccessMatrix | null> => {
  const raw = await get<{ value: string }>("SELECT value FROM settings WHERE key = 'access_matrix'");
  try {
    return raw ? (JSON.parse(raw.value) as AccessMatrix) : null;
  } catch {
    return null;
  }
});

export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const [id, exp, sig] = token?.split(".") ?? [];
  if (!id || !exp || !sig || !/^\d+$/.test(id) || Number(exp) < Date.now()) return null;
  const row = await get<UserRow>("SELECT id, name, email, role, password_hash, active, session_version, modules AS custom_modules FROM users WHERE id = ?", Number(id));
  if (!row || !row.active || !safeEqual(sig, sign(`${id}.${exp}.${sessionPrint(row.password_hash, row.session_version)}`))) return null;
  const modules = resolveModules(row.role, await getAccessMatrix(), parseModules(row.custom_modules));
  return { id: row.id, name: row.name, email: row.email, role: row.role, modules };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export const can = (user: SessionUser, mod: Module | readonly Module[]) => hasAny(user.modules, mod);

/** Wajib login + punya salah satu modul; jika tidak, kembali ke dashboard dengan pesan. */
export async function requireAccess(mod: Module | readonly Module[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasAny(user.modules, mod)) {
    const name = (Array.isArray(mod) ? mod : [mod]).map((m: Module) => MODULES[m]).join(" / ");
    redirect(`/?error=${encodeURIComponent(`Divisi Anda tidak punya akses ke ${name}.`)}`);
  }
  return user;
}

/* ------------------------- Token reset / undangan kata sandi ------------------------- */

export function createPasswordToken(userId: number, passwordHash: string, hours: number) {
  const exp = Date.now() + hours * 60 * 60 * 1000;
  return `${userId}.${exp}.${sign(`pw:${userId}.${exp}.${fingerprint(passwordHash)}`)}`;
}

/** Token sekali pakai: setelah kata sandi diganti, sidiknya berubah sehingga token lama tidak berlaku. */
export async function verifyPasswordToken(token: string) {
  const [id, exp, sig] = token.split(".");
  if (!id || !exp || !sig || !/^\d+$/.test(id) || Number(exp) < Date.now()) return null;
  const row = await get<UserRow>("SELECT id, name, email, role, password_hash, active FROM users WHERE id = ?", Number(id));
  if (!row || !row.active || !safeEqual(sig, sign(`pw:${id}.${exp}.${fingerprint(row.password_hash)}`))) return null;
  return { id: row.id, name: row.name, email: row.email };
}

/* ------------------------- Verifikasi dua langkah ------------------------- */

/** Cookie sementara antara "kata sandi benar" dan "kode OTP benar". Belum memberi akses apa pun. */
export const TWO_FACTOR_COOKIE = "haraka_2fa";
export const TWO_FACTOR_MINUTES = 5;

export function createTwoFactorToken(userId: number, passwordHash: string) {
  const exp = Date.now() + TWO_FACTOR_MINUTES * 60 * 1000;
  return `${userId}.${exp}.${sign(`2fa:${userId}.${exp}.${fingerprint(passwordHash)}`)}`;
}

export async function verifyTwoFactorToken(token: string) {
  const [id, exp, sig] = token.split(".");
  if (!id || !exp || !sig || !/^\d+$/.test(id) || Number(exp) < Date.now()) return null;
  const row = await get<{ id: number; name: string; email: string; role: string; password_hash: string; active: number; session_version: number; totp_secret: string | null; totp_last_step: number; totp_recovery: string | null; failed_logins: number; locked_until: string | null }>(
    "SELECT id, name, email, role, password_hash, active, session_version, totp_secret, totp_last_step, totp_recovery, failed_logins, locked_until FROM users WHERE id = ?",
    Number(id),
  );
  if (!row || !row.active || !safeEqual(sig, sign(`2fa:${id}.${exp}.${fingerprint(row.password_hash)}`))) return null;
  return row;
}
