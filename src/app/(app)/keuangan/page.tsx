import Link from "next/link";
import type { Metadata } from "next";
import { all, get } from "@/lib/db";
import { addDays, daysUntil, rupiah, tanggal, today } from "@/lib/format";
import { Badge, Card, Empty, Flash, PageHeader, StatCard } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { sendOverdueReminders } from "@/actions/sales";
import { requireAccess } from "@/lib/session";
import { ExportMenu } from "@/components/export-menu";

export const metadata: Metadata = { title: "Keuangan" };

type Recv = { id: number; so_no: string; invoice_no: string; customer: string; email: string; due_date: string | null; total: number; paid: number };

export default async function FinancePage({ searchParams }: PageProps<"/keuangan">) {
  await requireAccess("keuangan");
  const sp = await searchParams;
  const t = today();
  const monthStart = t.slice(0, 8) + "01";

  const receivables = await all<Recv>(
    `SELECT so.id, so.so_no, so.invoice_no, so.due_date, so.total, so.paid, c.name customer, c.email
     FROM sales_orders so JOIN customers c ON c.id = so.customer_id
     WHERE so.invoice_no IS NOT NULL AND so.status != 'batal' AND so.paid < so.total ORDER BY so.due_date`,
  );
  const overdue = receivables.filter((r) => r.due_date && r.due_date < t);
  const outstanding = receivables.reduce((s, r) => s + r.total - r.paid, 0);

  // Umur piutang
  const aging = [
    { label: "Belum jatuh tempo", test: (d: number) => d >= 0 },
    { label: "Telat 1–30 hari", test: (d: number) => d < 0 && d >= -30 },
    { label: "Telat 31–60 hari", test: (d: number) => d < -30 && d >= -60 },
    { label: "Telat > 60 hari", test: (d: number) => d < -60 },
  ].map((b) => ({
    label: b.label,
    value: receivables.filter((r) => b.test(r.due_date ? daysUntil(r.due_date) : 0)).reduce((s, r) => s + r.total - r.paid, 0),
  }));

  const revenueMonth = (await get<{ v: number }>(
    "SELECT COALESCE(SUM(total),0) v FROM sales_orders WHERE status NOT IN ('draft','batal') AND order_date >= ?",
    monthStart,
  ))!.v;
  const cashMonth = (await get<{ v: number }>("SELECT COALESCE(SUM(amount),0) v FROM payments WHERE pay_date >= ?", monthStart))!.v;
  const purchaseMonth = (await get<{ v: number }>(
    "SELECT COALESCE(SUM(total),0) v FROM purchase_orders WHERE status IN ('dipesan','diterima') AND order_date >= ?",
    monthStart,
  ))!.v;
  const payments = await all<{ id: number; so_id: number; so_no: string; customer: string; pay_date: string; amount: number; method: string; note: string }>(
    `SELECT p.*, so.so_no, c.name customer FROM payments p JOIN sales_orders so ON so.id = p.so_id JOIN customers c ON c.id = so.customer_id
     WHERE p.pay_date >= ? ORDER BY p.pay_date DESC, p.id DESC LIMIT 30`,
    addDays(t, -90),
  );

  return (
    <>
      <PageHeader
        title="Keuangan"
        subtitle="Piutang, pembayaran masuk, dan arus kas. Hanya bisa dilihat Founder."
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Omzet bulan ini" value={rupiah(revenueMonth)} href="/laporan?tab=keuangan" />
        <StatCard label="Kas masuk bulan ini" value={rupiah(cashMonth)} hint="Pembayaran pelanggan" />
        <StatCard label="Total piutang" value={rupiah(outstanding)} hint={`${receivables.length} invoice`} />
        <StatCard
          label="Lewat jatuh tempo"
          value={rupiah(overdue.reduce((s, r) => s + r.total - r.paid, 0))}
          hint={`${overdue.length} invoice`}
          tone={overdue.length ? "danger" : "default"}
        />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card title="Umur piutang">
          <ul className="divide-y divide-line text-sm">
            {aging.map((a) => (
              <li key={a.label} className="flex justify-between px-5 py-2.5">
                <span className="text-muted">{a.label}</span>
                <span className="font-medium tabular-nums">{rupiah(a.value)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-5">
            <form action={sendOverdueReminders}>
              <SubmitButton className="btn-secondary w-full" pendingText="Mengirim…" confirm={`Kirim email pengingat ke ${overdue.length} pelanggan yang telat bayar?`}>
                Kirim pengingat telat bayar ({overdue.length})
              </SubmitButton>
            </form>
            <p className="mt-2 text-xs text-muted">Invoice PDF ikut terlampir. Pembelian bulan ini: {rupiah(purchaseMonth)}.</p>
          </div>
        </Card>

        <Card title="Piutang per invoice" className="overflow-hidden lg:col-span-2" actions={<ExportMenu type="piutang" compact />}>
          {receivables.length ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Pelanggan</th>
                    <th>Jatuh tempo</th>
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
                        <td className="num font-semibold">{rupiah(r.total - r.paid)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Tidak ada piutang.</Empty>
          )}
        </Card>
      </div>

      <Card title="Pembayaran masuk · 90 hari" className="overflow-hidden" actions={<ExportMenu type="pembayaran" compact />}>
        {payments.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Pesanan</th>
                  <th>Pelanggan</th>
                  <th>Metode</th>
                  <th className="num">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{tanggal(p.pay_date)}</td>
                    <td>
                      <Link href={`/penjualan/${p.so_id}`} className="text-brand-700 hover:underline">
                        {p.so_no}
                      </Link>
                    </td>
                    <td>{p.customer}</td>
                    <td className="text-muted">
                      {p.method} {p.note && `· ${p.note}`}
                    </td>
                    <td className="num font-medium">{rupiah(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Belum ada pembayaran 90 hari terakhir.</Empty>
        )}
      </Card>
    </>
  );
}
