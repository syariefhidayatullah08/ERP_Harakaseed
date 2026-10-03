"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSetting } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { customEmail, sendEmail, syncInbox, verifySmtp } from "@/lib/email";

const safeBack = (v: string) => (v.startsWith("/") && !v.startsWith("//") ? v : "/email");

export async function composeEmail(fd: FormData) {
  await requireUser();
  const to = str(fd, "to");
  const subject = str(fd, "subject");
  const message = str(fd, "message");
  const back = safeBack(str(fd, "back") || "/email?tab=terkirim");
  if (!to || !subject || !message) redirect(withMsg(back, "Tujuan, subjek, dan pesan wajib diisi.", "error"));
  const refId = numf(fd, "ref_id");
  const res = await sendEmail({ to, ...customEmail(subject, message), refType: str(fd, "ref_type") || undefined, refId: refId || undefined });
  revalidatePath("/email");
  redirect(withMsg(back, res.ok ? `Email terkirim ke ${to}.` : `Gagal mengirim: ${res.error}`, res.ok ? "msg" : "error"));
}

export async function syncInboxAction() {
  await requireUser();
  const res = await syncInbox();
  revalidatePath("/", "layout");
  redirect(
    withMsg("/email", res.ok ? `Sinkronisasi selesai — ${res.added} email baru.` : `Gagal sinkron: ${res.error}`, res.ok ? "msg" : "error"),
  );
}

export async function testEmail() {
  await requireUser();
  const check = await verifySmtp();
  if (!check.ok) redirect(withMsg("/pengaturan", `Koneksi SMTP gagal: ${check.error}`, "error"));
  const to = getSetting("alert_email") || getSetting("company_email");
  const res = await sendEmail({
    to,
    ...customEmail("Tes koneksi email ERP Haraka Seed", "Jika Anda menerima email ini, koneksi email ERP sudah berfungsi dengan baik."),
    refType: "test",
  });
  redirect(withMsg("/pengaturan", res.ok ? `Email tes terkirim ke ${to}.` : `Gagal: ${res.error}`, res.ok ? "msg" : "error"));
}
