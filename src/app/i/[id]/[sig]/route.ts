import { orderPdf } from "@/lib/invoice-pdf";
import { verifyInvoiceSignature } from "@/lib/session";

/** Tautan invoice untuk pelanggan (tanpa login). Hanya valid dengan tanda tangan yang dibuat server. */
export async function GET(request: Request, ctx: RouteContext<"/i/[id]/[sig]">) {
  const { id, sig } = await ctx.params;
  const soId = Number(id);
  if (!Number.isInteger(soId) || !verifyInvoiceSignature(soId, sig)) return new Response("Tautan tidak valid", { status: 404 });
  const doc = new URL(request.url).searchParams.get("doc") === "sj" ? "sj" : "invoice";
  const pdf = await orderPdf(soId, doc);
  if (!pdf) return new Response("Dokumen tidak ditemukan", { status: 404 });
  return new Response(Buffer.from(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(pdf.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
