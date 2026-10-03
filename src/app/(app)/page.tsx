import Link from "next/link";
import { AlertTriangle, CalendarClock, Mail, PackageCheck } from "lucide-react";
import { all, get } from "@/lib/db";
import { lowStockProducts } from "@/lib/inventory";
import { rupiah, num, tanggal, today, addDays, daysUntil, SO_STATUS, PRD_STATUS, paymentStatus } from "@/lib/format";
import { Badge, Card, Empty, Flash, PageHeader, StatCard } from "@/components/ui";
import { BarChart, RankBars } from "@/components/bar-chart";
import { emailConfigured } from "@/lib/email";
import { requireUser } from "@/lib/session";
import { canAccess } from "@/lib/access";

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const user = await requireUser();
  // Peran tanpa akses penjualan (mis. gudang) melihat dasbor operasional saja.
  if (!canAccess(user.role, "penjualan")) return <OpsDashboard error={sp.error as string} />;
  const t = today();
  const monthStart = t.slice(0, 8) + "01";
  const lastMonthStart = (() => {
    const d = new Date(t + "T00:00:00");
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();

  const salesThis = (await get<{ v: number; n: number }>(
    "SELECT COALESCE(SUM(total),0) v, COUNT(*) n FROM sales_orders WHERE status NOT IN ('draft','batal') AND order_date >= ?",
    monthStart,
  ))!;
  const salesLast = (await get<{ v: number }>(
    "SELECT COALESCE(SUM(total),0) v FROM sales_orders WHERE status NOT IN ('draft','batal') AND order_date >= ? AND order_date < ?",
    lastMonthStart,
    monthStart,
  ))!;
  const receivable = (await get<{ v: number; overdue: number }>(
    `SELECT COALESCE(SUM(total - paid),0) v,
            COALESCE(SUM(CASE WHEN due_date < ? THEN total - paid ELSE 0 END),0) overdue
     FROM sales_orders WHERE invoice_no IS NOT NULL AND status != 'batal' AND paid < total`,
    t,
  ))!;
  const toShip = (await get<{ n: number }>("SELECT COUNT(*) n FROM sales_orders WHERE status = 'dikonfirmasi'"))!.n;
  const low = await lowStockProducts();
  const expiring = await all<{ id: number; lot_no: string; name: string; qty_available: number; expiry_date: string }>(
    `SELECT l.id, l.lot_no, p.name, l.qty_available, l.expiry_date FROM lots l JOIN products p ON p.id = l.product_id
     WHERE l.qty_available > 0 AND l.expiry_date BETWEEN ? AND ? ORDER BY l.expiry_date`,
    t,
    addDays(t, 90),
  );

  const windowStart = (() => {
    const d = new Date(t + "T00:00:00");
    d.setDate(1);
    d.setMonth(d.getMonth() - 11);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();
  const months = await all<{ m: string; v: number; n: number }>(
    `SELECT substr(order_date,1,7) m, SUM(total) v, COUNT(*) n FROM sales_orders
     WHERE status NOT IN ('draft','batal') AND order_date >= ?
     GROUP BY m`,
    windowStart,
  );
  const chart = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(t + "T00:00:00");
    d.setDate(1);
    d.setMonth(d.getMonth() - (11 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const row = months.find((r) => r.m === key);
    return {
      label: d.toLocaleDateString("id-ID", { month: "short" }),
      value: row?.v ?? 0,
      sub: `${row?.n ?? 0} pesanan · ${d.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`,
    };
  });

  const top = await all<{ name: string; crop: string; v: number }>(
    `SELECT p.name, p.crop, SUM(i.qty * i.price) v FROM so_items i
     JOIN sales_orders so ON so.id = i.so_id JOIN products p ON p.id = i.product_id
     WHERE so.status NOT IN ('draft','batal') AND so.order_date >= ?
     GROUP BY p.id ORDER BY v DESC LIMIT 6`,
    addDays(t, -90),
  );

  const recent = await all<{ id: number; so_no: string; customer: string; order_date: string; status: string; total: number; paid: number }>(
    `SELECT so.id, so.so_no, c.name customer, so.order_date, so.status, so.total, so.paid
     FROM sales_orders so JOIN customers c ON c.id = so.customer_id ORDER BY so.id DESC LIMIT 7`,
  );

  const inbox = await all<{ id: number; from_addr: string; subject: string; created_at: string; is_read: number }>(
    "SELECT id, from_addr, subject, created_at, is_read FROM emails WHERE direction = 'in' ORDER BY created_at DESC LIMIT 5",
  );

  const growth = salesLast.v > 0 ? ((salesThis.v - salesLast.v) / salesLast.v) * 100 : null;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Ringkasan operasional per ${tanggal(t)}`}
        actions={
          <>
            <Link href="/penjualan/baru" className="btn-primary">
              + Pesanan baru
            </Link>
          </>
        }
      />
      <Flash error={sp.error as string} />

      {!emailConfigured() && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Mail size={18} className="mt-0.5 shrink-0" />
          <div>
            Email belum terhubung: <code className="font-mono">EMAIL_PASS</code> (App Password Gmail) belum diisi di environment Vercel.{" "}
            <Link href="/pengaturan" className="font-semibold underline">
              Lihat panduan
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Penjualan bulan ini"
          value={rupiah(salesThis.v)}
          hint={
            <>
              {salesThis.n} pesanan
              {growth !== null && (
                <span className={growth >= 0 ? "text-brand-700" : "text-red-700"}>
                  {" "}
                  · {growth >= 0 ? "▲" : "▼"} {Math.abs(growth).toFixed(0)}% vs bln lalu
                </span>
              )}
            </>
          }
          href="/laporan"
        />
        <StatCard
          label="Piutang berjalan"
          value={rupiah(receivable.v)}
          hint={receivable.overdue > 0 ? <span className="text-red-700">{rupiah(receivable.overdue)} lewat jatuh tempo</span> : "Tidak ada yang jatuh tempo"}
          tone={receivable.overdue > 0 ? "warn" : "default"}
          href="/penjualan?tab=piutang"
        />
        <StatCard label="Siap dikirim" value={num(toShip)} hint="Pesanan dikonfirmasi" href="/penjualan?status=dikonfirmasi" />
        <StatCard
          label="Stok di bawah minimum"
          value={num(low.length)}
          hint={`${expiring.length} lot kadaluarsa ≤ 90 hari`}
          tone={low.length > 0 ? "danger" : "default"}
          href="/inventori"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Penjualan 12 bulan terakhir" className="lg:col-span-2">
          <div className="p-5">
            <BarChart data={chart} format={rupiah} height={220} />
          </div>
        </Card>
        <Card title="Varietas terlaris · 90 hari">
          <div className="p-5">
            {top.length ? (
              <RankBars rows={top.map((r) => ({ label: r.name, sub: r.crop, value: r.v }))} format={rupiah} />
            ) : (
              <Empty>Belum ada penjualan.</Empty>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card
          title="Pesanan terbaru"
          className="overflow-hidden lg:col-span-2"
          actions={
            <Link href="/penjualan" className="text-xs font-medium text-brand-700">
              Semua →
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Pelanggan</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th>Bayar</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => {
                  const ps = paymentStatus(o.total, o.paid);
                  return (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/penjualan/${o.id}`} className="font-medium text-brand-700 hover:underline">
                          {o.so_no}
                        </Link>
                      </td>
                      <td className="max-w-48 truncate">{o.customer}</td>
                      <td className="whitespace-nowrap text-muted">{tanggal(o.order_date)}</td>
                      <td>
                        <Badge tone={SO_STATUS[o.status]?.tone}>{SO_STATUS[o.status]?.label}</Badge>
                      </td>
                      <td>{o.status !== "draft" && o.status !== "batal" && <Badge tone={ps.tone}>{ps.label}</Badge>}</td>
                      <td className="num font-medium">{rupiah(o.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-5">
          <Card title={<span className="flex items-center gap-2"><AlertTriangle size={15} className="text-red-600" /> Stok rendah</span>}>
            {low.length ? (
              <ul className="divide-y divide-line text-sm">
                {low.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex justify-between px-5 py-2.5">
                    <span>
                      {p.name} <span className="text-muted">· {p.pack_size}</span>
                    </span>
                    <span className="tabular-nums">
                      <b className="text-red-700">{num(p.stock)}</b> <span className="text-muted">/ {num(p.min_stock)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                <PackageCheck className="mx-auto mb-1 text-brand-500" /> Semua stok aman.
              </Empty>
            )}
          </Card>
          <Card title={<span className="flex items-center gap-2"><CalendarClock size={15} className="text-amber-600" /> Lot mendekati kadaluarsa</span>}>
            {expiring.length ? (
              <ul className="divide-y divide-line text-sm">
                {expiring.slice(0, 5).map((l) => (
                  <li key={l.id} className="flex justify-between px-5 py-2.5">
                    <span>
                      <span className="font-mono text-xs">{l.lot_no}</span>
                      <div className="text-xs text-muted">
                        {l.name} · {num(l.qty_available)} pcs
                      </div>
                    </span>
                    <Badge tone={daysUntil(l.expiry_date) <= 30 ? "red" : "amber"}>{daysUntil(l.expiry_date)} hari</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Tidak ada lot yang segera kadaluarsa.</Empty>
            )}
          </Card>
          <Card
            title="Email masuk terbaru"
            actions={
              <Link href="/email" className="text-xs font-medium text-brand-700">
                Buka →
              </Link>
            }
          >
            {inbox.length ? (
              <ul className="divide-y divide-line text-sm">
                {inbox.map((m) => (
                  <li key={m.id}>
                    <Link href={`/email/${m.id}`} className="block px-5 py-2.5 hover:bg-brand-50/50">
                      <div className={`truncate ${m.is_read ? "" : "font-semibold"}`}>{m.subject}</div>
                      <div className="truncate text-xs text-muted">{m.from_addr}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Belum ada email. Sinkronkan di menu Email.</Empty>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

async function OpsDashboard({ error }: { error?: string }) {
  const t = today();
  const low = await lowStockProducts();
  const expiring = await all<{ id: number; lot_no: string; name: string; qty_available: number; expiry_date: string }>(
    `SELECT l.id, l.lot_no, p.name, l.qty_available, l.expiry_date FROM lots l JOIN products p ON p.id = l.product_id
     WHERE l.qty_available > 0 AND l.expiry_date BETWEEN ? AND ? ORDER BY l.expiry_date`,
    t,
    addDays(t, 90),
  );
  const batches = await all<{ id: number; code: string; name: string; status: string; est_harvest: string | null }>(
    `SELECT pr.id, pr.code, p.name, pr.status, pr.est_harvest FROM productions pr JOIN products p ON p.id = pr.product_id
     WHERE pr.status IN ('tanam','panen','prosesing','uji_lab') ORDER BY pr.id DESC LIMIT 8`,
  );
  const toShip = (await get<{ n: number }>("SELECT COUNT(*) n FROM sales_orders WHERE status = 'dikonfirmasi'"))!.n;
  const openPo = (await get<{ n: number }>("SELECT COUNT(*) n FROM purchase_orders WHERE status = 'dipesan'"))!.n;

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Operasional gudang & produksi per ${tanggal(t)}`} />
      <Flash error={error} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Stok di bawah minimum" value={num(low.length)} tone={low.length ? "danger" : "default"} href="/inventori" />
        <StatCard label="Lot kadaluarsa ≤ 90 hari" value={num(expiring.length)} tone={expiring.length ? "warn" : "default"} href="/inventori" />
        <StatCard label="Pesanan perlu disiapkan" value={num(toShip)} hint="Sudah dikonfirmasi sales" />
        <StatCard label="PO menunggu barang" value={num(openPo)} href="/pembelian" />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Batch produksi berjalan" className="overflow-hidden">
          {batches.length ? (
            <ul className="divide-y divide-line text-sm">
              {batches.map((b) => (
                <li key={b.id}>
                  <Link href={`/produksi/${b.id}`} className="flex items-center justify-between px-5 py-2.5 hover:bg-brand-50/50">
                    <span>
                      {b.name} <span className="text-xs text-muted">· {b.code}</span>
                    </span>
                    <Badge tone={PRD_STATUS[b.status]?.tone}>{PRD_STATUS[b.status]?.label}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Tidak ada batch berjalan.</Empty>
          )}
        </Card>
        <Card title="Stok rendah">
          {low.length ? (
            <ul className="divide-y divide-line text-sm">
              {low.map((p) => (
                <li key={p.id} className="flex justify-between px-5 py-2.5">
                  <span>{p.name}</span>
                  <span className="tabular-nums">
                    <b className="text-red-700">{num(p.stock)}</b> <span className="text-muted">/ {num(p.min_stock)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Semua stok aman.</Empty>
          )}
        </Card>
        <Card title="Lot mendekati kadaluarsa">
          {expiring.length ? (
            <ul className="divide-y divide-line text-sm">
              {expiring.map((l) => (
                <li key={l.id} className="flex justify-between px-5 py-2.5">
                  <Link href={`/inventori/${l.id}`} className="font-mono text-xs text-brand-700 hover:underline">
                    {l.lot_no}
                  </Link>
                  <Badge tone={daysUntil(l.expiry_date) <= 30 ? "red" : "amber"}>{daysUntil(l.expiry_date)} hari</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Tidak ada.</Empty>
          )}
        </Card>
      </div>
    </>
  );
}
