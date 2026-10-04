import { currentUser } from "@/lib/session";
import { hasAny } from "@/lib/access";
import { toId } from "@/lib/form";
import { invoiceFileBase, manualInvoiceDoc } from "@/lib/invoice-doc";
import { renderInvoicePdf } from "@/lib/invoice-render-pdf";
import { renderInvoiceDocx } from "@/lib/invoice-render-docx";

/** Unduh invoice manual: ?format=pdf (default, tampil di browser untuk dicetak) atau ?format=docx (Word). */
export async function GET(request: Request, ctx: RouteContext<"/api/invoice-manual/[id]">) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!hasAny(user.modules, "keuangan")) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  const doc = await manualInvoiceDoc(toId(id));
  if (!doc) return new Response("Invoice tidak ditemukan", { status: 404 });
  const url = new URL(request.url);
  const name = invoiceFileBase(doc);
  if (url.searchParams.get("format") === "docx") {
    return new Response(new Uint8Array(await renderInvoiceDocx(doc)), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}.docx`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  return new Response(new Uint8Array(await renderInvoicePdf(doc)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${url.searchParams.has("download") ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(name)}.pdf`,
      "Cache-Control": "private, no-store",
    },
  });
}
