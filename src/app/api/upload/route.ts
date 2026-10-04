import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { currentUser } from "@/lib/session";
import { hasAny } from "@/lib/access";
import { ALLOWED_CONTENT_TYPES, ATTACHMENT_REFS, isAttachmentRef, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";

/**
 * Menerbitkan token upload sementara agar browser bisa mengunggah lampiran langsung ke Vercel Blob (privat).
 * File baru dicatat di database setelah upload selesai lewat server action `registerAttachment`.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await currentUser();
        if (!user) throw new Error("Silakan login ulang.");
        const { refType, refId } = JSON.parse(clientPayload ?? "{}") as { refType?: string; refId?: number };
        if (!isAttachmentRef(refType) || !Number.isInteger(refId)) throw new Error("Dokumen tujuan tidak valid.");
        if (!hasAny(user.modules, ATTACHMENT_REFS[refType].module)) throw new Error("Tidak punya akses ke dokumen ini.");
        if (!pathname.startsWith(`evidence/${refType}/${refId}/`)) throw new Error("Lokasi file tidak valid.");
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_ATTACHMENT_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(json);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Upload gagal" }, { status: 400 });
  }
}
