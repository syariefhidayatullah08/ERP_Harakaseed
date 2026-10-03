import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { get } from "./db";
import { canAccess, MODULES, type Module } from "./access";

export const SESSION_COOKIE = "haraka_session";
const SECRET =
  process.env.SESSION_SECRET ??
  (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview"
    ? (() => {
        throw new Error("SESSION_SECRET wajib diisi di environment Vercel.");
      })()
    : "haraka-dev-secret-ganti-di-.env");

export type SessionUser = { id: number; name: string; email: string; role: string };

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

export function createToken(userId: number) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 7;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string | undefined): number | null {
  if (!token) return null;
  const [id, exp, sig] = token.split(".");
  if (!id || !exp || !sig) return null;
  const expected = Buffer.from(sign(`${id}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(exp) < Date.now()) return null;
  return Number(id);
}

export async function currentUser(): Promise<SessionUser | null> {
  const id = readToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!id) return null;
  return await get<SessionUser>("SELECT id, name, email, role FROM users WHERE id = ?", id) ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/** Wajib login + punya akses ke modul; jika tidak, kembali ke dashboard dengan pesan. */
export async function requireAccess(mod: Module): Promise<SessionUser> {
  const user = await requireUser();
  if (!canAccess(user.role, mod)) {
    redirect(`/?error=${encodeURIComponent(`Peran Anda tidak punya akses ke modul ${MODULES[mod]}.`)}`);
  }
  return user;
}
