import { notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { toId } from "@/lib/form";
import { PageHeader } from "@/components/ui";
import { requireAccess } from "@/lib/session";
import { InvoiceForm, type InvoiceFormValues } from "../../invoice-form";

export default async function EditManualInvoicePage({ params }: PageProps<"/keuangan/invoice/[id]/edit">) {
  await requireAccess("keuangan");
  const { id } = await params;
  const inv = await get<Omit<InvoiceFormValues, "rows"> & { id: number }>("SELECT * FROM manual_invoices WHERE id = ?", toId(id));
  if (!inv) notFound();
  const rows = await all<{ code: string; name: string; qty: number; price: number }>(
    "SELECT code, name, qty, price FROM manual_invoice_items WHERE invoice_id = ? ORDER BY position, id",
    inv.id,
  );
  const customers = await all<{ id: number; name: string; address: string; city: string; phone: string; email: string }>(
    "SELECT id, name, address, city, phone, email FROM customers ORDER BY name",
  );
  return (
    <>
      <PageHeader title={`Ubah invoice ${inv.number}`} back={{ href: `/keuangan/invoice/${inv.id}`, label: inv.number }} />
      <InvoiceForm customers={customers} values={{ ...inv, rows }} />
    </>
  );
}
