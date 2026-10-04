import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, FileText, Pencil, Printer } from "lucide-react";
import { all, get } from "@/lib/db";
import { toId } from "@/lib/form";
import { rupiah, tanggal } from "@/lib/format";
import { terbilang } from "@/lib/terbilang";
import { Card, DL, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { EmailList, type EmailRow } from "@/components/email-list";
import { deleteManualInvoice, emailManualInvoice } from "@/actions/manual-invoice";
import { requireAccess } from "@/lib/session";

export default async function ManualInvoicePage({ params, searchParams }: PageProps<"/keuangan/invoice/[id]">) {
  await requireAccess("keuangan");
  const { id } = await params;
  const sp = await searchParams;
  const inv = await get<{ id: number; number: string; invoice_date: string; cust_name: string; cust_address: string; cust_city: string; cust_phone: string; cust_email: string; total: number; created_at: string }>(
    "SELECT * FROM manual_invoices WHERE id = ?",
    toId(id),
  );
  if (!inv) notFound();
  const items = await all<{ qty: number }>("SELECT qty FROM manual_invoice_items WHERE invoice_id = ?", inv.id);
  const emails = await all<EmailRow>("SELECT * FROM emails WHERE ref_type = 'manual_invoice' AND ref_id = ? ORDER BY id DESC", inv.id);
  const pdfUrl = `/api/invoice-manual/${inv.id}`;

  return (
    <>
      <PageHeader
        title={<span className="font-mono">{inv.number}</span>}
        subtitle={`${inv.cust_name} · ${tanggal(inv.invoice_date)} · ${rupiah(inv.total)}`}
        back={{ href: "/keuangan/invoice", label: "Invoice Manual" }}
        actions={
          <>
            <a href={pdfUrl} target="_blank" className="btn-accent">
              <Printer size={15} /> Buka & cetak PDF
            </a>
            <a href={`${pdfUrl}?download`} className="btn-secondary">
              <FileDown size={15} /> Unduh PDF
            </a>
            <a href={`${pdfUrl}?format=docx`} className="btn-secondary">
              <FileText size={15} /> Unduh Word
            </a>
            <Link href={`/keuangan/invoice/${inv.id}/edit`} className="btn-secondary">
              <Pencil size={15} /> Ubah
            </Link>
          </>
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Pratinjau" className="overflow-hidden lg:col-span-2">
          <iframe src={pdfUrl} title={`Invoice ${inv.number}`} className="h-[880px] w-full bg-canvas" />
        </Card>
        <div className="space-y-5">
          <Card title="Ringkasan">
            <div className="space-y-3 p-5 text-sm">
              <DL
                items={[
                  ["Customer", inv.cust_name],
                  ["Kota", inv.cust_city || "—"],
                  ["Telepon", inv.cust_phone || "—"],
                  ["Baris", String(items.length)],
                  ["Jumlah", <b key="t">{rupiah(inv.total)}</b>],
                ]}
              />
              <p className="rounded-lg bg-brand-50 p-3 text-xs italic text-brand-900">{terbilang(inv.total)}</p>
            </div>
          </Card>
          <Card title="Kirim ke customer via email">
            <form action={emailManualInvoice} className="space-y-3 p-5">
              <input type="hidden" name="id" value={inv.id} />
              <Field label="Email tujuan">
                <input name="to" type="email" required defaultValue={inv.cust_email} className="input" placeholder="email@customer.com" />
              </Field>
              <SubmitButton className="btn-primary w-full" pendingText="Mengirim…">
                Kirim invoice (PDF terlampir)
              </SubmitButton>
            </form>
            <EmailList rows={emails} empty="Belum pernah dikirim lewat email." />
          </Card>
          <form action={deleteManualInvoice} className="text-right">
            <input type="hidden" name="id" value={inv.id} />
            <SubmitButton className="btn-danger btn-sm" confirm={`Hapus invoice ${inv.number}?`}>
              Hapus invoice
            </SubmitButton>
          </form>
        </div>
      </div>
    </>
  );
}
