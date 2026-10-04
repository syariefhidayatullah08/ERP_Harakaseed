"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { get, insert, nextNumber, run } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";
import { today } from "@/lib/format";
import { COMPLAINT_CATEGORIES, COMPLAINT_SEVERITY, COMPLAINT_STATUS } from "@/lib/keluhan";

/** Kode keluhan untuk log aktivitas. */
const complaintCode = async (id: number) => (await get<{ code: string }>("SELECT code FROM complaints WHERE id = ?", id))?.code ?? `#${id}`;

export async function createComplaint(fd: FormData) {
  const user = await requireAccess("keluhan");
  const description = str(fd, "description");
  const category = str(fd, "category");
  if (!description || !COMPLAINT_CATEGORIES.includes(category)) redirect(withMsg("/keluhan", "Isi kategori dan uraian keluhan.", "error"));
  const lotNo = str(fd, "lot_no").toUpperCase();
  const lot = lotNo ? await get<{ id: number; product_id: number }>("SELECT id, product_id FROM lots WHERE upper(lot_no) = ?", lotNo) : undefined;
  if (lotNo && !lot) redirect(withMsg("/keluhan", `Nomor lot ${lotNo} tidak ditemukan.`, "error"));
  const severity = str(fd, "severity");
  const code = await nextNumber("KLH", "complaints", "code");
  const id = await insert(
    `INSERT INTO complaints (code, report_date, customer_id, product_id, lot_id, category, severity, description, created_by)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    code,
    str(fd, "report_date") || today(),
    numf(fd, "customer_id") || null,
    lot?.product_id ?? (numf(fd, "product_id") || null),
    lot?.id ?? null,
    category,
    severity in COMPLAINT_SEVERITY ? severity : "sedang",
    description,
    user.id,
  );
  revalidatePath("/keluhan");
  await logActivity("keluhan", "Mencatat keluhan", `${code} · ${category}`);
  redirect(withMsg(`/keluhan/${id}`, "Keluhan dicatat."));
}

export async function updateComplaint(fd: FormData) {
  await requireAccess("keluhan");
  const id = numf(fd, "id");
  const status = str(fd, "status");
  if (!(status in COMPLAINT_STATUS)) redirect(withMsg(`/keluhan/${id}`, "Status tidak dikenal.", "error"));
  const rootCause = str(fd, "root_cause");
  const action = str(fd, "action_taken");
  if (status === "selesai" && (!rootCause || !action)) redirect(withMsg(`/keluhan/${id}`, "Isi akar masalah dan tindakan sebelum menutup keluhan.", "error"));
  await run(
    `UPDATE complaints SET status = ?, root_cause = ?, action_taken = ?, severity = ?,
       closed_at = CASE WHEN ? = 'selesai' THEN COALESCE(closed_at, ?) ELSE NULL END
     WHERE id = ?`,
    status,
    rootCause,
    action,
    str(fd, "severity") in COMPLAINT_SEVERITY ? str(fd, "severity") : "sedang",
    status,
    today(),
    id,
  );
  revalidatePath("/keluhan");
  await logActivity("keluhan", status === "selesai" ? "Menutup keluhan" : "Mengubah keluhan", `${await complaintCode(id)} · ${status}`);
  redirect(withMsg(`/keluhan/${id}`, status === "selesai" ? "Keluhan ditutup." : "Keluhan diperbarui."));
}
