import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { get } from "./db";
import { cache } from "react";
import { hasAny, MODULES, resolveModules, type AccessMatrix, type Module } from "./access";

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

export function createToken(userId: number, passwordHash: string) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 7;
  return `${userId}.${exp}.${sign(`${userId}.${exp}.${fingerprint(passwordHash)}`)}`;
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

type UserRow = SessionUser & { password_hash: string; active: number };

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
  const row = await get<UserRow>("SELECT id, name, email, role, password_hash, active FROM users WHERE id = ?", Number(id));
  if (!row || !row.active || !safeEqual(sig, sign(`${id}.${exp}.${fingerprint(row.password_hash)}`))) return null;
  const modules = resolveModules(row.role, await getAccessMatrix());
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
