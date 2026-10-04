import { currentUser } from "@/lib/session";
import { hasAny } from "@/lib/access";
import { toId } from "@/lib/form";
import { pbDoc } from "@/lib/seed-payment";
import { renderPbPdf } from "@/lib/pb-render-pdf";

/** Surat Pengajuan Pembayaran Benih dalam PDF (tampil di browser untuk dicetak; ?download untuk mengunduh). */
export async function GET(request: Request, ctx: RouteContext<"/api/pb/[id]">) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!hasAny(user.modules, "pembayaran_benih")) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  const doc = await pbDoc(toId(id));
  if (!doc) return new Response("Surat PB tidak ditemukan", { status: 404 });
  const name = `PB ${doc.pb.number.replace(/\//g, "-")}.pdf`;
  return new Response(new Uint8Array(await renderPbPdf(doc)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${new URL(request.url).searchParams.has("download") ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
