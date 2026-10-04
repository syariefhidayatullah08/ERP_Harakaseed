"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { del, head } from "@vercel/blob";
import { get, insert, run } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canUseAttachments } from "@/lib/attachment-access";
import { numf, str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";
import { ATTACHMENT_CATEGORIES, ATTACHMENT_REFS, isAttachmentRef } from "@/lib/attachments";

/** Catat lampiran yang baru saja diunggah browser ke Blob. */
export async function registerAttachment(input: {
  refType: string;
  refId: number;
  pathname: string;
  filename: string;
  category: string;
  note: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isAttachmentRef(input.refType)) return { ok: false, error: "Dokumen tujuan tidak valid." };
  const ref = ATTACHMENT_REFS[input.refType];
  const user = await requireUser();
  if (!Number.isInteger(input.refId) || !(await canUseAttachments(user, input.refType, input.refId))) return { ok: false, error: "Tidak punya akses ke dokumen ini." };
  if (!input.pathname.startsWith(`evidence/${input.refType}/${input.refId}/`)) return { ok: false, error: "Lokasi file tidak valid." };

  // Pastikan file benar-benar ada di Blob, dan ambil ukuran & tipe dari sumbernya (bukan dari browser).
  let meta;
  try {
    meta = await head(input.pathname);
  } catch {
    return { ok: false, error: "File tidak ditemukan di penyimpanan. Coba unggah ulang." };
  }
  const categories = ATTACHMENT_CATEGORIES[input.refType];
  await insert(
    `INSERT INTO attachments (ref_type, ref_id, category, note, pathname, filename, content_type, size, uploaded_by)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    input.refType,
    input.refId,
    categories.includes(input.category) ? input.category : "Lainnya",
    input.note.slice(0, 500),
    input.pathname,
    input.filename.slice(0, 200),
    meta.contentType,
    meta.size,
    user.id,
  );
  await logActivity("lampiran", "Mengunggah lampiran", `${input.filename} (${input.refType} #${input.refId})`);
  for (const p of ref.paths(input.refId)) revalidatePath(p);
  return { ok: true };
}

export async function deleteAttachment(fd: FormData) {
  const id = numf(fd, "id");
  const row = await get<{ ref_type: string; ref_id: number; pathname: string; filename: string }>("SELECT * FROM attachments WHERE id = ?", id);
  if (!row || !isAttachmentRef(row.ref_type)) redirect(withMsg("/", "Lampiran tidak ditemukan.", "error"));
  const ref = ATTACHMENT_REFS[row.ref_type];
  const user = await requireUser();
  if (!(await canUseAttachments(user, row.ref_type, row.ref_id))) redirect(withMsg("/", "Tidak punya akses ke lampiran ini.", "error"));
  await del(row.pathname);
  await run("DELETE FROM attachments WHERE id = ?", id);
  await logActivity("lampiran", "Menghapus lampiran", `${row.filename} (${row.ref_type} #${row.ref_id})`);
  for (const p of ref.paths(row.ref_id)) revalidatePath(p);
  const back = str(fd, "back");
  redirect(withMsg(back.startsWith("/") && !back.startsWith("//") ? back : ref.paths(row.ref_id)[0], `Lampiran ${row.filename} dihapus.`));
}
