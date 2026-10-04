import { toId } from "@/lib/form";
import { currentUser } from "@/lib/session";
import { hasAny } from "@/lib/access";
import { orderPdf } from "@/lib/invoice-pdf";
import { invoiceFileBase, orderInvoiceDoc } from "@/lib/invoice-doc";
import { renderInvoiceDocx } from "@/lib/invoice-render-docx";

/** Unduh invoice (default) atau surat jalan (?doc=sj) dalam PDF. Invoice juga tersedia sebagai Word (?format=docx). */
export async function GET(request: Request, ctx: RouteContext<"/api/pdf/[id]">) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const doc = url.searchParams.get("doc") === "sj" ? "sj" : "invoice";
  // Invoice berisi tagihan & pembayaran → hanya keuangan; surat jalan → penjualan/pengiriman.
  if (!hasAny(user.modules, doc === "sj" ? ["penjualan", "pengiriman", "keuangan"] : ["keuangan"])) return new Response("Forbidden", { status: 403 });

  if (doc === "invoice" && url.searchParams.get("format") === "docx") {
    const inv = await orderInvoiceDoc(toId(id));
    if (!inv) return new Response("Pesanan tidak ditemukan", { status: 404 });
    return new Response(new Uint8Array(await renderInvoiceDocx(inv)), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(invoiceFileBase(inv))}.docx`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const pdf = await orderPdf(toId(id), doc);
  if (!pdf) return new Response("Pesanan tidak ditemukan", { status: 404 });
  return new Response(Buffer.from(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(pdf.filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
