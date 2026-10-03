import type { Metadata } from "next";
import { Download } from "lucide-react";
import { CUSTOMER_KIND, num, rupiah, today } from "@/lib/format";
import { salesByCity, salesByCustomer, salesByMonth, salesByProduct } from "@/lib/reports";
import { Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { BarChart, RankBars } from "@/components/bar-chart";
import { requireAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Laporan" };

export default async function ReportsPage({ searchParams }: PageProps<"/laporan">) {
  await requireAccess("laporan");
  const sp = await searchParams;
  const to = String(sp.to ?? today());
  const from = String(sp.from ?? `${to.slice(0, 4)}-01-01`);
  const byProduct = await salesByProduct(from, to);
  const byCustomer = await salesByCustomer(from, to);
  const byMonth = await salesByMonth(from, to);
  const byCity = await salesByCity(from, to);
  const revenue = byMonth.reduce((s, m) => s + m.revenue, 0);
  const orders = byMonth.reduce((s, m) => s + m.orders, 0);
  const paid = byMonth.reduce((s, m) => s + m.paid, 0);
  const qs = `from=${from}&to=${to}`;
  const exportLink = (type: string, label: string) => (
    <a href={`/api/export?type=${type}&${qs}`} className="btn-secondary btn-sm">
      <Download size={13} /> {label}
    </a>
  );

  return (
    <>
      <PageHeader
        title="Laporan"
        subtitle="Analisis penjualan per periode. Semua tabel dapat diunduh sebagai CSV (Excel)."
        actions={
          <>
            {exportLink("penjualan", "Detail penjualan")}
            {exportLink("stok", "Stok per lot")}
          </>
        }
      />
      <form className="card mb-5 flex flex-wrap items-end gap-3 p-4">
        <label>
          <span className="label">Dari</span>
          <input type="date" name="from" defaultValue={from} className="input" />
        </label>
        <label>
          <span className="label">Sampai</span>
          <input type="date" name="to" defaultValue={to} className="input" />
        </label>
        <button className="btn-primary">Terapkan</button>
      </form>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Omzet" value={rupiah(revenue)} />
        <StatCard label="Pesanan" value={num(orders)} />
        <StatCard label="Rata-rata per pesanan" value={rupiah(orders ? revenue / orders : 0)} />
        <StatCard label="Tertagih (sudah dibayar)" value={rupiah(paid)} hint={revenue ? `${Math.round((paid / revenue) * 100)}% dari omzet` : undefined} />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card title="Omzet per bulan" className="lg:col-span-2">
          <div className="p-5">
            {byMonth.length ? (
              <BarChart
                data={byMonth.map((m) => ({
                  label: new Date(m.month + "-01T00:00:00").toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
                  value: m.revenue,
                  sub: `${m.orders} pesanan`,
                }))}
                format={rupiah}
                height={220}
              />
            ) : (
              <Empty>Tidak ada data pada periode ini.</Empty>
            )}
          </div>
        </Card>
        <Card title="Omzet per kota">
          <div className="p-5">
            {byCity.length ? (
              <RankBars rows={byCity.slice(0, 8).map((c) => ({ label: c.city, sub: `${c.orders} pesanan`, value: c.revenue }))} format={rupiah} />
            ) : (
              <Empty>—</Empty>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Per varietas" actions={exportLink("produk", "CSV")} className="overflow-hidden">
          {byProduct.length ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Varietas</th>
                    <th className="num">Qty</th>
                    <th className="num">Omzet</th>
                    <th className="num">Porsi</th>
                  </tr>
                </thead>
                <tbody>
                  {byProduct.map((p) => (
                    <tr key={p.sku}>
                      <td>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted">{p.crop}</div>
                      </td>
                      <td className="num">{num(p.qty)}</td>
                      <td className="num">{rupiah(p.revenue)}</td>
                      <td className="num text-muted">{revenue ? ((p.revenue / revenue) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>—</Empty>
          )}
        </Card>
        <Card title="Per pelanggan" actions={exportLink("pelanggan", "CSV")} className="overflow-hidden">
          {byCustomer.length ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Pelanggan</th>
                    <th className="num">Pesanan</th>
                    <th className="num">Omzet</th>
                    <th className="num">Piutang</th>
                  </tr>
                </thead>
                <tbody>
                  {byCustomer.map((c) => (
                    <tr key={c.code}>
                      <td>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted">
                          {CUSTOMER_KIND[c.kind] ?? c.kind} · {c.city}
                        </div>
                      </td>
                      <td className="num">{c.orders}</td>
                      <td className="num">{rupiah(c.revenue)}</td>
                      <td className={`num ${c.outstanding > 0 ? "text-amber-700" : "text-muted"}`}>{rupiah(c.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>—</Empty>
          )}
        </Card>
      </div>
    </>
  );
}
