import Link from "next/link";
import type { Metadata } from "next";
import { all } from "@/lib/db";
import { daysUntil, paymentStatus, rupiah, SO_STATUS, tanggal, today } from "@/lib/format";
import { Badge, Card, Empty, Flash, PageHeader, StatCard } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { sendOverdueReminders } from "@/actions/sales";

export const metadata: Metadata = { title: "Penjualan" };

type Row = {
  id: number; so_no: string; customer: string; city: string; order_date: string; status: string; total: number; paid: number;
  invoice_no: string | null; due_date: string | null; email: string;
};

export default async function SalesPage({ searchParams }: PageProps<"/penjualan">) {
  const sp = await searchParams;
  const tab = String(sp.tab ?? "pesanan");
  const status = String(sp.status ?? "");
  const q = String(sp.q ?? "").trim();

  const rows = await all<Row>(
    `SELECT so.*, c.name customer, c.city, c.email FROM sales_orders so JOIN customers c ON c.id = so.customer_id
     WHERE (? = '' OR so.status = ?) AND (so.so_no ILIKE ? OR c.name ILIKE ? OR COALESCE(so.invoice_no,'') ILIKE ?)
     ORDER BY so.order_date DESC, so.id DESC LIMIT 300`,
    status, status, `%${q}%`, `%${q}%`, `%${q}%`,
  );
  const receivables = await all<Row>(
    `SELECT so.*, c.name customer, c.city, c.email FROM sales_orders so JOIN customers c ON c.id = so.customer_id
     WHERE so.invoice_no IS NOT NULL AND so.status != 'batal' AND so.paid < so.total ORDER BY so.due_date`,
  );
  const t = today();
  const overdue = receivables.filter((r) => r.due_date && r.due_date < t);
  const counts = await all<{ status: string; n: number }>("SELECT status, COUNT(*) n FROM sales_orders GROUP BY status");
  const count = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;

  const tabLink = (key: string, label: string, n?: number, st = "") => {
    const active = key === "piutang" ? tab === "piutang" : tab !== "piutang" && status === st;
    return (
      <Link
        key={key}
        href={key === "piutang" ? "/penjualan?tab=piutang" : st ? `/penjualan?status=${st}` : "/penjualan"}
        className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${active ? "border-brand-700 font-semibold text-brand-800" : "border-transparent text-muted hover:text-ink"}`}
      >
        {label} {n !== undefined && <span className="ml-1 rounded-full bg-canvas px-1.5 text-xs">{n}</span>}
      </Link>
    );
  };

  return (
    <>
      <PageHeader
        title="Penjualan"
        subtitle="Pesanan, pengiriman, invoice, dan piutang"
        actions={
          <Link href="/penjualan/baru" className="btn-primary">
            + Pesanan baru
          </Link>
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {tabLink("all", "Semua")}
        {tabLink("draft", "Draft", count("draft"), "draft")}
        {tabLink("dikonfirmasi", "Perlu dikirim", count("dikonfirmasi"), "dikonfirmasi")}
        {tabLink("dikirim", "Dikirim", count("dikirim"), "dikirim")}
        {tabLink("selesai", "Selesai", count("selesai"), "selesai")}
        {tabLink("piutang", "Piutang", receivables.length)}
      </div>

      {tab === "piutang" ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Total piutang" value={rupiah(receivables.reduce((s, r) => s + r.total - r.paid, 0))} hint={`${receivables.length} invoice`} />
            <StatCard
              label="Lewat jatuh tempo"
              value={rupiah(overdue.reduce((s, r) => s + r.total - r.paid, 0))}
              hint={`${overdue.length} invoice`}
              tone={overdue.length ? "danger" : "default"}
            />
            <div className="card col-span-2 flex flex-col justify-center gap-2 p-5 lg:col-span-1">
              <div className="text-sm text-muted">Kirim email pengingat ke semua invoice yang lewat jatuh tempo.</div>
              <form action={sendOverdueReminders}>
                <SubmitButton className="btn-secondary" pendingText="Mengirim…" confirm={`Kirim pengingat ke ${overdue.length} pelanggan?`}>
                  Kirim pengingat ({overdue.length})
                </SubmitButton>
              </form>
            </div>
          </div>
          <Card className="overflow-hidden">
            {receivables.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Pelanggan</th>
                      <th>Jatuh tempo</th>
                      <th className="num">Total</th>
                      <th className="num">Dibayar</th>
                      <th className="num">Sisa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivables.map((r) => {
                      const d = r.due_date ? daysUntil(r.due_date) : 0;
                      return (
                        <tr key={r.id}>
                          <td>
                            <Link href={`/penjualan/${r.id}`} className="font-medium text-brand-700 hover:underline">
                              {r.invoice_no}
                            </Link>
                            <div className="text-xs text-muted">{r.so_no}</div>
                          </td>
                          <td>
                            {r.customer}
                            {!r.email && <div className="text-xs text-amber-700">tanpa email</div>}
                          </td>
                          <td className="whitespace-nowrap">
                            {tanggal(r.due_date)}{" "}
                            {d < 0 ? <Badge tone="red">telat {-d} hr</Badge> : d <= 7 ? <Badge tone="amber">{d} hr lagi</Badge> : null}
                          </td>
                          <td className="num">{rupiah(r.total)}</td>
                          <td className="num text-muted">{rupiah(r.paid)}</td>
                          <td className="num font-semibold">{rupiah(r.total - r.paid)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Tidak ada piutang. 🎉</Empty>
            )}
          </Card>
        </>
      ) : (
        <>
          <form className="mb-4 flex gap-2">
            {status && <input type="hidden" name="status" value={status} />}
            <input name="q" defaultValue={q} placeholder="Cari no. pesanan, invoice, pelanggan…" className="input max-w-sm" />
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
                      <th>Pembayaran</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((o) => {
                      const ps = paymentStatus(o.total, o.paid);
                      return (
                        <tr key={o.id}>
                          <td>
                            <Link href={`/penjualan/${o.id}`} className="font-medium text-brand-700 hover:underline">
                              {o.so_no}
                            </Link>
                            {o.invoice_no && <div className="text-xs text-muted">{o.invoice_no}</div>}
                          </td>
                          <td>
                            {o.customer} <div className="text-xs text-muted">{o.city}</div>
                          </td>
                          <td className="whitespace-nowrap text-muted">{tanggal(o.order_date)}</td>
                          <td>
                            <Badge tone={SO_STATUS[o.status]?.tone}>{SO_STATUS[o.status]?.label}</Badge>
                          </td>
                          <td>{o.invoice_no && o.status !== "batal" ? <Badge tone={ps.tone}>{ps.label}</Badge> : <span className="text-xs text-muted">—</span>}</td>
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
      )}
    </>
  );
}
