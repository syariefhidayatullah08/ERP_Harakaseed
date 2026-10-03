import { toId } from "@/lib/form";
import { get as getBlob } from "@vercel/blob";
import { get } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { canAccess } from "@/lib/access";
import { ATTACHMENT_REFS, isAttachmentRef } from "@/lib/attachments";

/** Buka/unduh lampiran bukti. File disimpan privat; hanya pengguna dengan akses modul terkait yang bisa membuka. */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const row = await get<{ ref_type: string; pathname: string; filename: string; content_type: string }>(
    "SELECT ref_type, pathname, filename, content_type FROM attachments WHERE id = ?",
    toId(id),
  );
  if (!row || !isAttachmentRef(row.ref_type)) return new Response("Tidak ditemukan", { status: 404 });
  if (!canAccess(user.role, ATTACHMENT_REFS[row.ref_type].module)) return new Response("Forbidden", { status: 403 });

  const file = await getBlob(row.pathname, { access: "private" });
  if (!file || file.statusCode !== 200) return new Response("File tidak ditemukan di penyimpanan", { status: 404 });

  const download = new URL(request.url).searchParams.has("download");
  const name = encodeURIComponent(row.filename);
  return new Response(file.stream, {
    headers: {
      "Content-Type": row.content_type || "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${name}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
