"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { get, insert, run } from "@/lib/db";
import { createPasswordToken, requireAccess, type SessionUser } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import { numf, str, withMsg } from "@/lib/form";
import { DIVISIONS, isDivision } from "@/lib/access";
import { passwordLinkEmail, sendEmail } from "@/lib/email";

const BACK = "/pengguna";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

/** Hanya Owner yang boleh membuat/mengubah akun Owner. */
function assertCanManage(actor: SessionUser, targetRole: string) {
  if (targetRole === "owner" && actor.role !== "owner") redirect(withMsg(BACK, "Hanya Owner yang dapat mengelola akun Owner.", "error"));
}

async function activeOwners() {
  return (await get<{ n: number }>("SELECT COUNT(*) n FROM users WHERE role = 'owner' AND active = 1"))!.n;
}

/** Kirim tautan undangan (72 jam) atau reset (1 jam). Mengembalikan pesan untuk ditampilkan. */
async function sendLink(user: { id: number; name: string; email: string; password_hash: string; role: string }, kind: "invite" | "reset") {
  const token = createPasswordToken(user.id, user.password_hash, kind === "invite" ? 72 : 1);
  const link = `${await baseUrl()}/login/reset?token=${token}`;
  const mail = await passwordLinkEmail(user.name, link, kind, isDivision(user.role) ? DIVISIONS[user.role].label : undefined);
  const res = await sendEmail({ to: user.email, ...mail, refType: "account", refId: user.id });
  return res.ok
    ? `Email ${kind === "invite" ? "undangan" : "reset"} terkirim ke ${user.email}.`
    : `Email gagal terkirim (${res.error}). Bagikan tautan ini secara langsung: ${link}`;
}

export async function inviteUser(fd: FormData) {
  const actor = await requireAccess("pengguna");
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "role");
  if (!name || !EMAIL_RE.test(email)) redirect(withMsg(BACK, "Isi nama dan email yang valid.", "error"));
  if (!isDivision(role)) redirect(withMsg(BACK, "Pilih divisi.", "error"));
  assertCanManage(actor, role);
  if (await get("SELECT id FROM users WHERE lower(email) = ?", email)) redirect(withMsg(BACK, `${email} sudah terdaftar.`, "error"));

  // Kata sandi acak yang tidak diketahui siapa pun; pengguna membuat sendiri lewat tautan undangan.
  const hash = hashPassword(randomBytes(24).toString("base64url"));
  const id = await insert("INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)", name, email, hash, role);
  const note = await sendLink({ id, name, email, password_hash: hash, role }, "invite");
  revalidatePath(BACK);
  redirect(withMsg(BACK, `Akun ${name} (${DIVISIONS[role].label}) dibuat. ${note}`));
}

export async function updateUser(fd: FormData) {
  const actor = await requireAccess("pengguna");
  const id = numf(fd, "id");
  const target = await get<{ id: number; role: string; active: number }>("SELECT id, role, active FROM users WHERE id = ?", id);
  if (!target) redirect(withMsg(BACK, "Pengguna tidak ditemukan.", "error"));
  const role = str(fd, "role");
  const active = fd.get("active") ? 1 : 0;
  if (!isDivision(role)) redirect(withMsg(BACK, "Divisi tidak dikenal.", "error"));
  assertCanManage(actor, target.role);
  assertCanManage(actor, role);
  if (id === actor.id && (role !== actor.role || !active)) redirect(withMsg(BACK, "Anda tidak bisa mengubah divisi atau menonaktifkan akun sendiri.", "error"));
  if (target.role === "owner" && target.active && (role !== "owner" || !active) && (await activeOwners()) <= 1) {
    redirect(withMsg(BACK, "Harus ada minimal satu Owner aktif.", "error"));
  }
  await run("UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?", str(fd, "name") || "Pengguna", role, active, id);
  revalidatePath(BACK);
  redirect(withMsg(BACK, active ? "Akun diperbarui." : "Akun dinonaktifkan; pengguna langsung keluar dari ERP."));
}

export async function sendUserLink(fd: FormData) {
  const actor = await requireAccess("pengguna");
  const user = await get<{ id: number; name: string; email: string; password_hash: string; role: string; active: number; last_login: string | null }>(
    "SELECT id, name, email, password_hash, role, active, last_login FROM users WHERE id = ?",
    numf(fd, "id"),
  );
  if (!user || !user.active) redirect(withMsg(BACK, "Akun tidak aktif.", "error"));
  assertCanManage(actor, user.role);
  const note = await sendLink(user, user.last_login ? "reset" : "invite");
  redirect(withMsg(BACK, note, note.startsWith("Email gagal") ? "error" : "msg"));
}

export async function deleteUser(fd: FormData) {
  const actor = await requireAccess("pengguna");
  const id = numf(fd, "id");
  const target = await get<{ role: string; email: string; active: number }>("SELECT role, email, active FROM users WHERE id = ?", id);
  if (!target) redirect(withMsg(BACK, "Pengguna tidak ditemukan.", "error"));
  if (id === actor.id) redirect(withMsg(BACK, "Tidak bisa menghapus akun sendiri.", "error"));
  assertCanManage(actor, target.role);
  if (target.role === "owner" && target.active && (await activeOwners()) <= 1) redirect(withMsg(BACK, "Harus ada minimal satu Owner aktif.", "error"));
  await run("DELETE FROM users WHERE id = ?", id);
  revalidatePath(BACK);
  redirect(withMsg(BACK, `Akun ${target.email} dihapus.`));
}
