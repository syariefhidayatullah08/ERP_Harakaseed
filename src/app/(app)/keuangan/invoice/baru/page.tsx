import { all } from "@/lib/db";
import { today } from "@/lib/format";
import { invoiceNumber, nextManualSeq } from "@/lib/invoice-doc";
import { PageHeader } from "@/components/ui";
import { requireAccess } from "@/lib/session";
import { InvoiceForm } from "../invoice-form";

export default async function NewManualInvoicePage() {
  await requireAccess("keuangan");
  const date = today();
  const customers = await all<{ id: number; name: string; address: string; city: string; phone: string; email: string }>(
    "SELECT id, name, address, city, phone, email FROM customers ORDER BY name",
  );
  return (
    <>
      <PageHeader title="Buat invoice" subtitle="Nomor berikutnya otomatis; bisa diubah bila perlu." back={{ href: "/keuangan/invoice", label: "Invoice Manual" }} />
      <InvoiceForm
        customers={customers}
        values={{
          number: invoiceNumber(await nextManualSeq(), date),
          invoice_date: date,
          customer_id: null,
          cust_name: "",
          cust_address: "",
          cust_city: "",
          cust_phone: "",
          cust_email: "",
          label_code: "Kode Produksi",
          label_name: "Nama Petani",
          label_qty: "Bobot (Kg)",
          notes: "",
          rows: [],
        }}
      />
    </>
  );
}
