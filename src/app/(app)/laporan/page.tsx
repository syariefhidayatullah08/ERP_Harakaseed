import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { CUSTOMER_KIND, num, rupiah, today } from "@/lib/format";
import {
  complaintReport,
  mutuReport,
  productionReport,
  qcReport,
  salesByCity,
  salesByCustomer,
  salesByMonth,
  salesByProduct,
  sdmReport,
  stockMovementReport,
} from "@/lib/reports";
import { productStock } from "@/lib/inventory";
import { divisionLabel, hasAny, type Module } from "@/lib/access";
import { Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { BarChart, RankBars } from "@/components/bar-chart";
import { requireAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Laporan" };

const TABS: { key: string; label: string; need: Module | Module[] }[] = [
  { key: "keuangan", label: "Keuangan", need: "keuangan" },
  { key: "penjualan", label: "Penjualan", need: ["penjualan", "keuangan"] },
  { key: "produksi", label: "Produksi", need: "produksi" },
  { key: "qc", label: "Lab / QC", need: "qc" },
  { key: "gudang", label: "Gudang", need: "inventori" },
  { key: "mutu", label: "Mutu & Audit", need: "mutu" },
  { key: "keluhan", label: "Keluhan Pelanggan", need: "keluhan" },
  { key: "sdm", label: "SDM", need: "sdm" },
];

function Table({ head, rows, empty = "Tidak ada data pada periode ini." }: { head: string[]; rows: ReactNode[][]; empty?: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={i ? "num" : ""}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={j ? "num" : "font-medium"}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ReportsPage({ searchParams }: PageProps<"/laporan">) {
  const user = await requireAccess("laporan");
  const sp = await searchParams;
  const tabs = TABS.filter((t) => hasAny(user.modules, t.need));
  const tab = tabs.find((t) => t.key === sp.tab)?.key ?? tabs[0]?.key;
  const valid = (s: unknown) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const to = valid(sp.to) ?? today();
  const from = valid(sp.from) ?? `${to.slice(0, 4)}-01-01`;
  const qs = `from=${from}&to=${to}`;
  const exportLink = (type: string, label = "Unduh CSV") => (
    <a href={`/api/export?type=${type}&${qs}`} className="btn-secondary btn-sm">
      <Download size={13} /> {label}
    </a>
  );

  return (
    <>
      <PageHeader title="Laporan" subtitle={`Laporan ${divisionLabel(user.role)} · semua tabel bisa diunduh sebagai CSV (Excel)`} />
      {tabs.length === 0 ? (
        <Card>
          <Empty>Divisi Anda belum punya laporan yang bisa ditampilkan.</Empty>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={`/laporan?tab=${t.key}&${qs}`}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === t.key ? "border-brand-700 font-semibold text-brand-800" : "border-transparent text-muted hover:text-ink"}`}
              >
                {t.label}
              </Link>
            ))}
          </div>
          {tab !== "sdm" && (
            <form className="card mb-5 flex flex-wrap items-end gap-3 p-4">
              <input type="hidden" name="tab" value={tab} />
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
          )}
          {tab === "keuangan" && <FinanceReport from={from} to={to} exportLink={exportLink} />}
          {tab === "penjualan" && <SalesReport from={from} to={to} exportLink={exportLink} />}
          {tab === "produksi" && <ProductionReport from={from} to={to} exportLink={exportLink} />}
          {tab === "qc" && <QcReport from={from} to={to} exportLink={exportLink} />}
          {tab === "gudang" && <WarehouseReport from={from} to={to} exportLink={exportLink} />}
          {tab === "mutu" && <AuditReport from={from} to={to} exportLink={exportLink} />}
          {tab === "keluhan" && <MutuReport from={from} to={to} exportLink={exportLink} />}
          {tab === "sdm" && <SdmReport exportLink={exportLink} />}
        </>
      )}
    </>
  );
}

type P = { from: string; to: string; exportLink: (type: string, label?: string) => ReactNode };

async function FinanceReport({ from, to, exportLink }: P) {
  const byProduct = await salesByProduct(from, to);
  const byCustomer = await salesByCustomer(from, to);
  const byMonth = await salesByMonth(from, to);
  const byCity = await salesByCity(from, to);
  const revenue = byMonth.reduce((s, m) => s + m.revenue, 0);
  const orders = byMonth.reduce((s, m) => s + m.orders, 0);
  const paid = byMonth.reduce((s, m) => s + m.paid, 0);
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Omzet" value={rupiah(revenue)} />
        <StatCard label="Pesanan" value={num(orders)} />
        <StatCard label="Rata-rata per pesanan" value={rupiah(orders ? revenue / orders : 0)} />
        <StatCard label="Tertagih" value={rupiah(paid)} hint={revenue ? `${Math.round((paid / revenue) * 100)}% dari omzet` : undefined} />
      </div>
      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card title="Omzet per bulan" className="lg:col-span-2" actions={exportLink("keuangan-penjualan", "Detail CSV")}>
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
              <Empty>Tidak ada data.</Empty>
            )}
          </div>
        </Card>
        <Card title="Omzet per kota">
          <div className="p-5">
            {byCity.length ? <RankBars rows={byCity.slice(0, 8).map((c) => ({ label: c.city, sub: `${c.orders} pesanan`, value: c.revenue }))} format={rupiah} /> : <Empty>—</Empty>}
          </div>
        </Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Omzet per varietas" className="overflow-hidden" actions={exportLink("keuangan-produk")}>
          <Table
            head={["Varietas", "Qty", "Omzet", "Porsi"]}
            rows={byProduct.map((p) => [p.name, num(p.qty), rupiah(p.revenue), `${revenue ? ((p.revenue / revenue) * 100).toFixed(1) : 0}%`])}
          />
        </Card>
        <Card title="Omzet & piutang per pelanggan" className="overflow-hidden" actions={exportLink("keuangan-pelanggan")}>
          <Table
            head={["Pelanggan", "Pesanan", "Omzet", "Piutang"]}
            rows={byCustomer.map((c) => [
              <span key="n">
                {c.name}
                <div className="text-xs font-normal text-muted">{CUSTOMER_KIND[c.kind] ?? c.kind}</div>
              </span>,
              c.orders,
              rupiah(c.revenue),
              rupiah(c.outstanding),
            ])}
          />
        </Card>
      </div>
    </>
  );
}

/** Penjualan dalam jumlah kemasan (tanpa rupiah) untuk Marketing. */
async function SalesReport({ from, to, exportLink }: P) {
  const byProduct = await salesByProduct(from, to);
  const byCustomer = await salesByCustomer(from, to);
  const byMonth = await salesByMonth(from, to);
  const qty = byProduct.reduce((s, p) => s + p.qty, 0);
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Pesanan" value={num(byMonth.reduce((s, m) => s + m.orders, 0))} />
        <StatCard label="Kemasan terjual" value={num(qty)} />
        <StatCard label="Pelanggan aktif" value={num(byCustomer.length)} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Pesanan per bulan" actions={exportLink("penjualan", "Detail CSV")}>
          <div className="p-5">
            {byMonth.length ? (
              <BarChart
                data={byMonth.map((m) => ({ label: new Date(m.month + "-01T00:00:00").toLocaleDateString("id-ID", { month: "short", year: "2-digit" }), value: m.orders }))}
                format={(n) => `${num(n)} pesanan`}
                height={200}
              />
            ) : (
              <Empty>Tidak ada data.</Empty>
            )}
          </div>
        </Card>
        <Card title="Varietas terlaris (kemasan)">
          <div className="p-5">
            {byProduct.length ? <RankBars rows={[...byProduct].sort((a, b) => b.qty - a.qty).slice(0, 10).map((p) => ({ label: p.name, value: p.qty }))} format={(n) => `${num(n)} kms`} /> : <Empty>—</Empty>}
          </div>
        </Card>
        <Card title="Pelanggan teraktif" className="overflow-hidden lg:col-span-2">
          <Table head={["Pelanggan", "Kota", "Pesanan"]} rows={byCustomer.map((c) => [c.name, c.city || "—", c.orders])} />
        </Card>
      </div>
    </>
  );
}

async function ProductionReport({ from, to, exportLink }: P) {
  const rows = await productionReport(from, to);
  const t = rows.reduce((s, r) => ({ b: s.b + r.batches, l: s.l + r.lulus, g: s.g + r.gagal, kg: s.kg + r.harvest_kg }), { b: 0, l: 0, g: 0, kg: 0 });
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Batch (tanam di periode)" value={num(t.b)} />
        <StatCard label="Lulus" value={num(t.l)} />
        <StatCard label="Tingkat keberhasilan" value={t.l + t.g ? `${Math.round((t.l / (t.l + t.g)) * 100)}%` : "—"} hint="lulus ÷ (lulus + gagal)" />
        <StatCard label="Total panen" value={`${num(t.kg)} kg`} />
      </div>
      <Card title="Per varietas" className="overflow-hidden" actions={exportLink("produksi", "Detail batch CSV")}>
        <Table head={["Varietas", "Batch", "Berjalan", "Lulus", "Gagal", "Luas (ha)", "Panen (kg)"]} rows={rows.map((r) => [r.name, r.batches, r.berjalan, r.lulus, r.gagal, r.area_ha, num(r.harvest_kg)])} />
      </Card>
    </>
  );
}

async function QcReport({ from, to, exportLink }: P) {
  const rows = await qcReport(from, to);
  const tests = rows.reduce((s, r) => s + r.tests, 0);
  const pass = rows.reduce((s, r) => s + r.lulus, 0);
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Pengujian" value={num(tests)} />
        <StatCard label="Tingkat kelulusan" value={tests ? `${Math.round((pass / tests) * 100)}%` : "—"} />
        <StatCard label="Tidak lulus" value={num(tests - pass)} tone={tests - pass ? "warn" : "default"} />
      </div>
      <Card title="Hasil uji per varietas" className="overflow-hidden" actions={exportLink("qc", "Detail uji CSV")}>
        <Table head={["Varietas", "Uji", "Lulus", "Tidak lulus", "Rata-rata DK", "DK terendah"]} rows={rows.map((r) => [r.name, r.tests, r.lulus, r.gagal, `${r.avg_dk}%`, `${r.min_dk}%`])} />
      </Card>
    </>
  );
}

async function WarehouseReport({ from, to, exportLink }: P) {
  const moves = await stockMovementReport(from, to);
  const stock = (await productStock("p.active = 1")).filter((p) => p.stock > 0 || p.min_stock > 0);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Pergerakan stok per varietas (kemasan)" className="overflow-hidden" actions={exportLink("gudang-pergerakan")}>
        <Table head={["Varietas", "Masuk", "Keluar", "Penyesuaian", "Retur"]} rows={moves.map((m) => [m.name, num(m.masuk), num(m.keluar), num(m.penyesuaian), num(m.retur)])} />
      </Card>
      <Card title="Posisi stok saat ini" className="overflow-hidden" actions={exportLink("stok", "Stok per lot CSV")}>
        <Table
          head={["Varietas", "Stok", "Dipesan", "Minimum"]}
          rows={stock.map((p) => [p.name, <span key="s" className={p.min_stock > 0 && p.stock < p.min_stock ? "font-semibold text-red-700" : ""}>{num(p.stock)}</span>, num(p.reserved), num(p.min_stock)])}
          empty="Belum ada stok."
        />
      </Card>
    </div>
  );
}

/** Keluhan pelanggan (modul Keluhan). */
async function MutuReport({ from, to, exportLink }: P) {
  const { byCategory, byProduct } = await complaintReport(from, to);
  const total = byCategory.reduce((s, c) => s + c.total, 0);
  const open = byCategory.reduce((s, c) => s + c.terbuka, 0);
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Keluhan masuk" value={num(total)} />
        <StatCard label="Masih terbuka" value={num(open)} tone={open ? "warn" : "default"} />
        <StatCard label="Selesai" value={num(total - open)} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Per kategori" className="overflow-hidden" actions={exportLink("keluhan", "Detail keluhan CSV")}>
          <Table head={["Kategori", "Jumlah", "Terbuka", "Rata-rata selesai (hari)"]} rows={byCategory.map((c) => [c.category, c.total, c.terbuka, c.avg_days ?? "—"])} />
        </Card>
        <Card title="Varietas paling banyak dikeluhkan">
          <div className="p-5">{byProduct.length ? <RankBars rows={byProduct.map((p) => ({ label: p.name, value: p.total }))} format={(n) => `${n} keluhan`} /> : <Empty>—</Empty>}</div>
        </Card>
      </div>
    </>
  );
}

/** Sistem manajemen mutu: audit & temuan per divisi. */
async function AuditReport({ from, to, exportLink }: P) {
  const { audits, byDivision, byClause } = await mutuReport(from, to);
  const total = byDivision.reduce((s, d) => s + d.total, 0);
  const open = byDivision.reduce((s, d) => s + d.terbuka, 0);
  const late = byDivision.reduce((s, d) => s + d.telat, 0);
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Audit" value={num(audits.reduce((s, a) => s + a.total, 0))} />
        <StatCard label="Temuan" value={num(total)} hint={`${byDivision.reduce((s, d) => s + d.mayor, 0)} mayor`} />
        <StatCard label="Masih terbuka" value={num(open)} tone={open ? "warn" : "default"} />
        <StatCard label="Lewat tenggat" value={num(late)} tone={late ? "danger" : "default"} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Temuan per divisi" className="overflow-hidden lg:col-span-2" actions={exportLink("mutu", "Detail temuan CSV")}>
          <Table
            head={["Divisi", "Temuan", "Mayor", "Minor", "Terbuka", "Telat", "Rata-rata tutup (hari)"]}
            rows={byDivision.map((d) => [divisionLabel(d.division), d.total, d.mayor, d.minor, d.terbuka, d.telat, d.avg_days ?? "—"])}
          />
        </Card>
        <Card title="Audit per jenis" className="overflow-hidden">
          <Table head={["Jenis", "Jumlah", "Selesai"]} rows={audits.map((a) => [a.audit_type, a.total, a.selesai])} />
        </Card>
        <Card title="Klausul paling sering">
          <div className="p-5">{byClause.length ? <RankBars rows={byClause.map((c) => ({ label: c.clause, value: c.total }))} format={(n) => `${n} temuan`} /> : <Empty>—</Empty>}</div>
        </Card>
      </div>
    </>
  );
}

async function SdmReport({ exportLink }: { exportLink: P["exportLink"] }) {
  const rows = await sdmReport();
  return (
    <Card title="Karyawan & akun ERP per divisi" className="overflow-hidden" actions={exportLink("sdm", "Data karyawan CSV")}>
      <Table head={["Divisi", "Karyawan aktif", "Nonaktif", "Akun ERP aktif"]} rows={rows.map((r) => [divisionLabel(r.division), r.aktif, r.nonaktif, r.akun])} empty="Belum ada data karyawan." />
    </Card>
  );
}
