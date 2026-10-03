import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { get } from "./db";

export const SESSION_COOKIE = "haraka_session";
const SECRET = process.env.SESSION_SECRET ?? "haraka-dev-secret-ganti-di-.env";

export type SessionUser = { id: number; name: string; email: string; role: string };

function sign(payload: string) {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
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
  return get<SessionUser>("SELECT id, name, email, role FROM users WHERE id = ?", id) ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
