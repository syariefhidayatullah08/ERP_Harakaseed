import "server-only";
import { get } from "./db";
import { hasAny } from "./access";
import { ATTACHMENT_REFS, type AttachmentRef } from "./attachments";
import type { SessionUser } from "./session";

/**
 * Boleh melihat/mengunggah lampiran dokumen ini? Umumnya cukup modulnya; khusus temuan audit,
 * divisi penanggung jawab juga boleh (untuk mengunggah bukti tindakan perbaikan).
 */
export async function canUseAttachments(user: SessionUser, refType: AttachmentRef, refId: number) {
  if (hasAny(user.modules, ATTACHMENT_REFS[refType].module)) return true;
  if (refType === "finding") {
    const f = await get<{ division: string }>("SELECT division FROM findings WHERE id = ?", refId);
    return f?.division === user.role;
  }
  return false;
}
