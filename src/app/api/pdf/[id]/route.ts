import { currentUser } from "@/lib/session";
import { canAccess } from "@/lib/access";
import { orderPdf } from "@/lib/invoice-pdf";

/** Unduh invoice (default) atau surat jalan (?doc=sj) dalam PDF. */
export async function GET(request: Request, ctx: RouteContext<"/api/pdf/[id]">) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canAccess(user.role, "penjualan")) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  const doc = new URL(request.url).searchParams.get("doc") === "sj" ? "sj" : "invoice";
  const pdf = await orderPdf(Number(id), doc);
  if (!pdf) return new Response("Pesanan tidak ditemukan", { status: 404 });
  return new Response(Buffer.from(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdf.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
