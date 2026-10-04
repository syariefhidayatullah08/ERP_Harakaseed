import { toId } from "@/lib/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { waLink } from "@/lib/whatsapp";
import { all, get } from "@/lib/db";
import { CUSTOMER_KIND, rupiah, SO_STATUS, paymentStatus, tanggal } from "@/lib/format";
import { Badge, Card, Empty, Flash, PageHeader, StatCard } from "@/components/ui";
import { EmailCompose } from "@/components/email-compose";
import { EmailList, type EmailRow } from "@/components/email-list";
import { CustomerForm, type Customer } from "../customer-form";
import { can, requireAccess } from "@/lib/session";
import { Attachments } from "@/components/attachments";

export default async function CustomerDetail({ params, searchParams }: PageProps<"/pelanggan/[id]">) {
  const user = await requireAccess("pelanggan");
  const finance = can(user, "keuangan");
  const sales = can(user, "penjualan") || finance;
  const { id } = await params;
  const sp = await searchParams;
  const c = await get<Customer>("SELECT * FROM customers WHERE id = ?", toId(id));
  if (!c) notFound();

  const orders = await all<{ id: number; so_no: string; order_date: string; status: string; total: number; paid: number; invoice_no: string | null; due_date: string | null }>(
    "SELECT * FROM sales_orders WHERE customer_id = ? ORDER BY order_date DESC, id DESC",
    c.id,
  );
  const valid = orders.filter((o) => o.status !== "draft" && o.status !== "batal");
  const revenue = valid.reduce((s, o) => s + o.total, 0);
  const outstanding = valid.filter((o) => o.invoice_no).reduce((s, o) => s + (o.total - o.paid), 0);
  const emails = await all<EmailRow>(
    `SELECT * FROM emails WHERE ((ref_type = 'customer' AND ref_id = ?)
       OR (ref_type IN ('sales_order','invoice') AND ref_id IN (SELECT id FROM sales_orders WHERE customer_id = ?))
       OR (? != '' AND (lower(to_addr) ILIKE ? OR lower(from_addr) ILIKE ?)))
       ${finance ? "" : "AND COALESCE(ref_type, '') <> 'invoice'"}
     ORDER BY created_at DESC LIMIT 30`,
    c.id,
    c.id,
    c.email,
    `%${c.email}%`,
    `%${c.email}%`,
  );

  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={`${c.code} · ${CUSTOMER_KIND[c.kind] ?? c.kind} · ${c.city || "—"}`}
        back={{ href: "/pelanggan", label: "Pelanggan" }}
        actions={
          <>
            {waLink(c.phone, "x") && (
              <a href={waLink(c.phone, `Halo ${c.contact_person || c.name},

`)} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                <MessageCircle size={15} className="text-[#25D366]" /> WhatsApp
              </a>
            )}
            {can(user, "penjualan") && (
              <Link href={`/penjualan/baru?customer=${c.id}`} className="btn-accent">
                + Buat pesanan
              </Link>
            )}
          </>
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {finance ? (
          <>
            <StatCard label="Total omzet" value={rupiah(revenue)} hint={`${valid.length} pesanan`} />
            <StatCard label="Piutang" value={rupiah(outstanding)} tone={outstanding > 0 ? "warn" : "default"} />
          </>
        ) : (
          <StatCard label="Jumlah pesanan" value={valid.length} />
        )}
        <StatCard label="Termin" value={`${c.payment_terms} hari`} />
        <StatCard label="Order terakhir" value={tanggal(orders[0]?.order_date)} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          {sales && <Card title="Riwayat pesanan" className="overflow-hidden">
            {orders.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Tanggal</th>
                    <th>Status</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const ps = paymentStatus(o.total, o.paid);
                    return (
                      <tr key={o.id}>
                        <td>
                          <Link href={`/penjualan/${o.id}`} className="whitespace-nowrap font-medium text-brand-700 hover:underline">
                            {o.so_no}
                          </Link>
                        </td>
                        <td className="text-muted">{tanggal(o.order_date)}</td>
                        <td className="space-x-1">
                          <Badge tone={SO_STATUS[o.status]?.tone}>{SO_STATUS[o.status]?.label}</Badge>
                          {finance && o.invoice_no && o.status !== "batal" && <Badge tone={ps.tone}>{ps.label}</Badge>}
                        </td>
                        <td className="num">{rupiah(o.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <Empty>Belum ada pesanan.</Empty>
            )}
          </Card>}
          <Card title="Data pelanggan">
            <CustomerForm c={c} />
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Kirim email ke pelanggan">
            {!can(user, "email") ? (
              <Empty>Kirim email ke pelanggan melalui divisi yang punya akses Email.</Empty>
            ) : c.email ? (
              <EmailCompose to={c.email} back={`/pelanggan/${c.id}`} refType="customer" refId={c.id} message={`Yth. ${c.contact_person || c.name},\n\n`} />
            ) : (
              <Empty>Isi email pelanggan pada form data pelanggan untuk mengirim email.</Empty>
            )}
          </Card>
          <Card title="Riwayat email">
            <EmailList rows={emails} empty="Belum ada korespondensi email dengan pelanggan ini." />
          </Card>
          <Attachments refType="customer" refId={c.id} title="Dokumen pelanggan" />
        </div>
      </div>
    </>
  );
}
