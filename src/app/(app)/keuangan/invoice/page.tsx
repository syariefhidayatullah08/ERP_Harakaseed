import Link from "next/link";
import type { Metadata } from "next";
import { FileDown, FileText } from "lucide-react";
import { all } from "@/lib/db";
import { rupiah, tanggal } from "@/lib/format";
import { Card, Empty, Flash, PageHeader } from "@/components/ui";
import { requireAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Invoice Manual" };

export default async function ManualInvoicesPage({ searchParams }: PageProps<"/keuangan/invoice">) {
  await requireAccess("keuangan");
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim();
  const rows = await all<{ id: number; number: string; invoice_date: string; cust_name: string; cust_city: string; total: number; items: number }>(
    `SELECT m.id, m.number, m.invoice_date, m.cust_name, m.cust_city, m.total,
            (SELECT COUNT(*) FROM manual_invoice_items i WHERE i.invoice_id = m.id) items
     FROM manual_invoices m WHERE m.number ILIKE ? OR m.cust_name ILIKE ?
     ORDER BY m.invoice_date DESC, m.id DESC LIMIT 300`,
    `%${q}%`,
    `%${q}%`,
  );

  return (
    <>
      <PageHeader
        title="Invoice Manual"
        subtitle="Invoice dengan template resmi Haraka (logo, KAN, terbilang, rekening). Unduh PDF atau Word, lalu cetak."
        back={{ href: "/keuangan", label: "Keuangan" }}
        actions={
          <Link href="/keuangan/invoice/baru" className="btn-accent">
            + Buat invoice
          </Link>
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Cari nomor atau nama customer…" className="input max-w-sm" />
        <button className="btn-secondary">Cari</button>
      </form>
      <Card className="overflow-hidden">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nomor</th>
                  <th>Customer</th>
                  <th>Tanggal</th>
                  <th className="num">Jumlah tagihan</th>
                  <th>Unduh</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/keuangan/invoice/${r.id}`} className="whitespace-nowrap font-mono text-sm font-medium text-brand-700 hover:underline">
                        {r.number}
                      </Link>
                      <div className="text-xs text-muted">{r.items} baris</div>
                    </td>
                    <td>
                      {r.cust_name}
                      <div className="text-xs text-muted">{r.cust_city}</div>
                    </td>
                    <td className="whitespace-nowrap text-muted">{tanggal(r.invoice_date)}</td>
                    <td className="num font-semibold">{rupiah(r.total)}</td>
                    <td className="whitespace-nowrap">
                      <a href={`/api/invoice-manual/${r.id}`} target="_blank" className="btn-secondary btn-sm mr-1">
                        <FileDown size={13} /> PDF
                      </a>
                      <a href={`/api/invoice-manual/${r.id}?format=docx`} className="btn-secondary btn-sm">
                        <FileText size={13} /> Word
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Belum ada invoice manual. Klik &ldquo;+ Buat invoice&rdquo;.</Empty>
        )}
      </Card>
    </>
  );
}
