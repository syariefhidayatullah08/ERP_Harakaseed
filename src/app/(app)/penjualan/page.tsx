import Link from "next/link";
import type { Metadata } from "next";
import { all } from "@/lib/db";
import { paymentStatus, rupiah, SO_STATUS, tanggal } from "@/lib/format";
import { Badge, Card, Empty, Flash, PageHeader } from "@/components/ui";
import { can, requireAccess } from "@/lib/session";
import { ExportMenu } from "@/components/export-menu";

export const metadata: Metadata = { title: "Penjualan" };

type Row = { id: number; so_no: string; customer: string; city: string; order_date: string; status: string; total: number; paid: number; invoice_no: string | null };

export default async function SalesPage({ searchParams }: PageProps<"/penjualan">) {
  const user = await requireAccess(["penjualan", "keuangan"]);
  const finance = can(user, "keuangan");
  const sp = await searchParams;
  const status = String(sp.status ?? "");
  const q = String(sp.q ?? "").trim();

  const rows = await all<Row>(
    `SELECT so.*, c.name customer, c.city FROM sales_orders so JOIN customers c ON c.id = so.customer_id
     WHERE (? = '' OR so.status = ?) AND (so.so_no ILIKE ? OR c.name ILIKE ? OR COALESCE(so.invoice_no,'') ILIKE ?)
     ORDER BY so.order_date DESC, so.id DESC LIMIT 300`,
    status, status, `%${q}%`, `%${q}%`, `%${q}%`,
  );
  const counts = await all<{ status: string; n: number }>("SELECT status, COUNT(*) n FROM sales_orders GROUP BY status");
  const count = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;

  const tab = (st: string, label: string, n?: number) => (
    <Link
      key={st || "all"}
      href={st ? `/penjualan?status=${st}` : "/penjualan"}
      className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${status === st ? "border-brand-700 font-semibold text-brand-800" : "border-transparent text-muted hover:text-ink"}`}
    >
      {label} {n !== undefined && <span className="ml-1 rounded-full bg-canvas px-1.5 text-xs">{n}</span>}
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Penjualan"
        subtitle={finance ? "Pesanan dan pengiriman. Piutang & pembayaran ada di menu Keuangan." : "Pesanan pelanggan dan status pengiriman"}
        actions={
          <>
            <ExportMenu type="pesanan" />
            {can(user, "penjualan") && (
            <Link href="/penjualan/baru" className="btn-accent">
              + Pesanan baru
            </Link>
          )}
          </>
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {tab("", "Semua")}
        {tab("draft", "Draft", count("draft"))}
        {tab("dikonfirmasi", "Perlu dikirim", count("dikonfirmasi"))}
        {tab("dikirim", "Dikirim", count("dikirim"))}
        {tab("selesai", "Selesai", count("selesai"))}
        {tab("batal", "Batal", count("batal"))}
      </div>

      <form className="mb-4 flex gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Cari no. pesanan, pelanggan…" className="input max-w-sm" />
        <button className="btn-secondary">Cari</button>
      </form>
      <Card className="overflow-hidden">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>No. Pesanan</th>
                  <th>Pelanggan</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  {finance && <th>Pembayaran</th>}
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const ps = paymentStatus(o.total, o.paid);
                  return (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/penjualan/${o.id}`} className="whitespace-nowrap font-medium text-brand-700 hover:underline">
                          {o.so_no}
                        </Link>
                        {finance && o.invoice_no && <div className="text-xs text-muted">{o.invoice_no}</div>}
                      </td>
                      <td>
                        {o.customer} <div className="text-xs text-muted">{o.city}</div>
                      </td>
                      <td className="whitespace-nowrap text-muted">{tanggal(o.order_date)}</td>
                      <td>
                        <Badge tone={SO_STATUS[o.status]?.tone}>{SO_STATUS[o.status]?.label}</Badge>
                      </td>
                      {finance && (
                        <td>{o.invoice_no && o.status !== "batal" ? <Badge tone={ps.tone}>{ps.label}</Badge> : <span className="text-xs text-muted">—</span>}</td>
                      )}
                      <td className="num font-medium">{rupiah(o.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Belum ada pesanan.</Empty>
        )}
      </Card>
    </>
  );
}
