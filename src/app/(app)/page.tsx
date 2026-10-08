import Link from "next/link";
import { AlertTriangle, CalendarClock, Mail, PackageCheck, ShieldAlert } from "lucide-react";
import { all, get } from "@/lib/db";
import { lowStockProducts } from "@/lib/inventory";
import { rupiah, num, tanggal, today, addDays, daysUntil, SO_STATUS, PRD_STATUS, paymentStatus } from "@/lib/format";
import { Badge, Card, Empty, Flash, PageHeader, StatCard } from "@/components/ui";
import { BarChart, RankBars } from "@/components/bar-chart";
import { emailConfigured } from "@/lib/email";
import { can, requireUser, type SessionUser } from "@/lib/session";
import { divisionLabel } from "@/lib/access";
import { COMPLAINT_SEVERITY, COMPLAINT_STATUS } from "@/lib/keluhan";
import { FINDING_CATEGORY, FINDING_STATUS } from "@/lib/mutu";
import { farmerPayables, stockSeedSummary } from "@/lib/dashboard-seed";
import { FarmerPayablesCard, StockSeedCard } from "@/components/dashboard-seed";

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const user = await requireUser();
  // Peran tanpa akses penjualan (mis. gudang) melihat dasbor operasional saja.
  // Founder melihat ringkasan perusahaan; divisi lain melihat dasbor sesuai modulnya.
  if (user.role !== "owner") return <DivisionDashboard user={user} msg={sp.msg as string} error={sp.error as string} />;
  const t = today();
  const monthStart = t.slice(0, 8) + "01";
  const lastMonthStart = (() => {
    const d = new Date(t + "T00:00:00");
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();

  const windowStart = (() => {
    const d = new Date(t + "T00:00:00");
    d.setDate(1);
    d.setMonth(d.getMonth() - 11);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();

  // Semua ringkasan tidak saling bergantung → dijalankan bersamaan, bukan menunggu satu per satu.
  const [salesThis, salesLast, receivable, toShipRow, low, expiring, months, top, recent, inbox, otpRow, stockSeed, payables] = await Promise.all([
    get<{ v: number; n: number }>(
      "SELECT COALESCE(SUM(total),0) v, COUNT(*) n FROM sales_orders WHERE status NOT IN ('draft','batal') AND order_date >= ?",
      monthStart,
    ).then((r) => r!),
    get<{ v: number }>(
      "SELECT COALESCE(SUM(total),0) v FROM sales_orders WHERE status NOT IN ('draft','batal') AND order_date >= ? AND order_date < ?",
      lastMonthStart,
      monthStart,
    ).then((r) => r!),
    get<{ v: number; overdue: number }>(
      `SELECT COALESCE(SUM(total - paid),0) v,
              COALESCE(SUM(CASE WHEN due_date < ? THEN total - paid ELSE 0 END),0) overdue
       FROM sales_orders WHERE invoice_no IS NOT NULL AND status != 'batal' AND paid < total`,
      t,
    ).then((r) => r!),
    get<{ n: number }>("SELECT COUNT(*) n FROM sales_orders WHERE status = 'dikonfirmasi'"),
    lowStockProducts(),
    all<{ id: number; lot_no: string; name: string; qty_available: number; expiry_date: string }>(
      `SELECT l.id, l.lot_no, p.name, l.qty_available, l.expiry_date FROM lots l JOIN products p ON p.id = l.product_id
       WHERE l.qty_available > 0 AND l.expiry_date BETWEEN ? AND ? ORDER BY l.expiry_date`,
      t,
      addDays(t, 90),
    ),
    all<{ m: string; v: number; n: number }>(
      `SELECT substr(order_date,1,7) m, SUM(total) v, COUNT(*) n FROM sales_orders
       WHERE status NOT IN ('draft','batal') AND order_date >= ?
       GROUP BY m`,
      windowStart,
    ),
    all<{ name: string; crop: string; v: number }>(
      `SELECT COALESCE(NULLIF(i.item_name, ''), p.name, '') name, COALESCE(p.crop, '') crop, SUM(i.qty * i.price) v FROM so_items i
       JOIN sales_orders so ON so.id = i.so_id LEFT JOIN products p ON p.id = i.product_id
       WHERE so.status NOT IN ('draft','batal') AND so.order_date >= ?
       GROUP BY 1, 2 ORDER BY v DESC LIMIT 6`,
      addDays(t, -90),
    ),
    all<{ id: number; so_no: string; customer: string; order_date: string; status: string; total: number; paid: number }>(
      `SELECT so.id, so.so_no, c.name customer, so.order_date, so.status, so.total, so.paid
       FROM sales_orders so JOIN customers c ON c.id = so.customer_id ORDER BY so.id DESC LIMIT 7`,
    ),
    all<{ id: number; from_addr: string; subject: string; created_at: string; is_read: number }>(
      "SELECT id, from_addr, subject, created_at, is_read FROM emails WHERE direction = 'in' ORDER BY created_at DESC LIMIT 5",
    ),
    get<{ totp_secret: string | null }>("SELECT totp_secret FROM users WHERE id = ?", user.id),
    stockSeedSummary(),
    farmerPayables(),
  ]);
  const toShip = toShipRow!.n;
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

  const growth = salesLast.v > 0 ? ((salesThis.v - salesLast.v) / salesLast.v) * 100 : null;
  const otpOff = !otpRow?.totp_secret;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Ringkasan operasional per ${tanggal(t)}`}
        actions={
          <>
            <Link href="/penjualan/baru" className="btn-accent">
              + Pesanan baru
            </Link>
          </>
        }
      />
      <Flash error={sp.error as string} />

      {otpOff && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <div>
            <b>Akun Founder belum memakai verifikasi dua langkah.</b> Akun ini bisa membuka semua data; bila kata sandinya bocor, orang lain bisa masuk.{" "}
            <Link href="/pengaturan#keamanan" className="font-medium underline">
              Aktifkan OTP sekarang
            </Link>{" "}
            (± 2 menit, perlu aplikasi Google Authenticator di HP).
          </div>
        </div>
      )}

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

      {/* Inti bisnis benih: sisa benih sumber & kewajiban bayar ke petani. */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <StockSeedCard data={stockSeed} />
        <FarmerPayablesCard data={payables} />
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
                        <Link href={`/penjualan/${o.id}`} className="whitespace-nowrap font-medium text-brand-700 hover:underline">
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


/** Dasbor untuk divisi selain Founder: hanya kartu & daftar dari modul yang boleh diakses. Tanpa angka keuangan. */
async function DivisionDashboard({ user, msg, error }: { user: SessionUser; msg?: string; error?: string }) {
  const t = today();
  const has = (m: Parameters<typeof can>[1]) => can(user, m);
  const count = (sql: string, ...p: (string | number)[]) => get<{ n: number }>(sql, ...p).then((r) => r?.n ?? 0);
  const none = <T,>(): Promise<T[]> => Promise.resolve([]);

  // Semua query dasbor dijalankan bersamaan (modul yang tidak diakses = kosong tanpa query), bukan satu per satu.
  // Dimulai bersamaan dengan query lain di bawah.
  const seedP = Promise.all([has("stok_bahan") ? stockSeedSummary() : null, has("pembayaran_benih") ? farmerPayables() : null]);
  const [monthOrders, drafts, toShip, low, expiring, batches, quarantine, complaints, findings, audits, toVerify, po, employees, neverLogin, unreadMail] = await Promise.all([
    has("penjualan") ? count("SELECT COUNT(*) n FROM sales_orders WHERE status NOT IN ('draft','batal') AND order_date >= ?", t.slice(0, 8) + "01") : 0,
    has("penjualan") ? count("SELECT COUNT(*) n FROM sales_orders WHERE status = 'draft'") : 0,
    has("pengiriman") || has("penjualan") ? count("SELECT COUNT(*) n FROM sales_orders WHERE status = 'dikonfirmasi'") : 0,
    has("inventori") ? lowStockProducts() : none<Awaited<ReturnType<typeof lowStockProducts>>[number]>(),
    has("inventori") || has("qc")
      ? all<{ id: number; lot_no: string; name: string; qty_available: number; expiry_date: string }>(
          `SELECT l.id, l.lot_no, p.name, l.qty_available, l.expiry_date FROM lots l JOIN products p ON p.id = l.product_id
           WHERE l.qty_available > 0 AND l.expiry_date BETWEEN ? AND ? ORDER BY l.expiry_date LIMIT 8`,
          t,
          addDays(t, 90),
        )
      : none<{ id: number; lot_no: string; name: string; qty_available: number; expiry_date: string }>(),
    has("produksi") || has("qc")
      ? all<{ id: number; code: string; name: string; status: string }>(
          `SELECT pr.id, pr.code, p.name, pr.status FROM productions pr JOIN products p ON p.id = pr.product_id
           WHERE pr.status IN ('tanam','panen','prosesing','uji_lab') ORDER BY pr.id DESC LIMIT 8`,
        )
      : none<{ id: number; code: string; name: string; status: string }>(),
    has("qc") ? count("SELECT COUNT(*) n FROM lots WHERE qc_status = 'karantina' AND qty_available > 0") : 0,
    has("keluhan")
      ? all<{ id: number; code: string; category: string; severity: string; status: string }>(
          "SELECT id, code, category, severity, status FROM complaints WHERE status <> 'selesai' ORDER BY CASE severity WHEN 'tinggi' THEN 0 WHEN 'sedang' THEN 1 ELSE 2 END, id DESC LIMIT 8",
        )
      : none<{ id: number; code: string; category: string; severity: string; status: string }>(),
    // Temuan audit: Mutu melihat semua, divisi lain hanya yang ditujukan ke divisinya.
    all<{ id: number; code: string; category: string; status: string; due_date: string | null; description: string }>(
      `SELECT id, code, category, status, due_date, description FROM findings
       WHERE status <> 'ditutup' AND (? = 1 OR division = ?) ORDER BY due_date LIMIT 8`,
      has("mutu") ? 1 : 0,
      user.role,
    ),
    has("mutu") ? count("SELECT COUNT(*) n FROM audits WHERE status = 'rencana' AND start_date >= ?", t) : 0,
    has("mutu") ? count("SELECT COUNT(*) n FROM findings WHERE status = 'ditanggapi'") : 0,
    has("pembelian") ? count("SELECT COUNT(*) n FROM purchase_orders WHERE status = 'dipesan'") : 0,
    has("sdm") ? count("SELECT COUNT(*) n FROM employees WHERE status = 'aktif'") : 0,
    has("pengguna") ? count("SELECT COUNT(*) n FROM users WHERE active = 1 AND last_login IS NULL") : 0,
    has("email") ? count("SELECT COUNT(*) n FROM emails WHERE direction = 'in' AND is_read = 0") : 0,
  ]);

  const [stockSeed, payables] = await seedP;

  const cards: { label: string; value: number | string; hint?: string; href: string; tone?: "default" | "warn" | "danger" }[] = [];
  if (has("penjualan")) {
    cards.push({ label: "Pesanan bulan ini", value: monthOrders, href: "/penjualan" });
    cards.push({ label: "Draft belum dikonfirmasi", value: drafts, href: "/penjualan?status=draft" });
  }
  if (has("pengiriman") || has("penjualan")) {
    cards.push({ label: "Perlu dikirim", value: toShip, href: has("pengiriman") ? "/pengiriman" : "/penjualan?status=dikonfirmasi", tone: toShip ? "warn" : "default" });
  }
  if (has("inventori")) {
    cards.push({ label: "Stok di bawah minimum", value: low.length, href: "/inventori", tone: low.length ? "danger" : "default" });
    cards.push({ label: "Lot kadaluarsa ≤ 90 hari", value: expiring.length, href: "/inventori", tone: expiring.length ? "warn" : "default" });
  }
  if (has("produksi")) cards.push({ label: "Batch produksi berjalan", value: batches.length, href: "/produksi" });
  if (has("qc")) {
    const queue = batches.filter((b) => b.status === "uji_lab").length;
    cards.push({ label: "Menunggu uji lab", value: queue, href: "/qc", tone: queue ? "warn" : "default" });
    cards.push({ label: "Lot dikarantina", value: quarantine, href: "/qc?tab=lot", tone: quarantine ? "danger" : "default" });
  }
  if (has("mutu")) {
    cards.push({ label: "Audit terjadwal", value: audits, href: "/mutu" });
    cards.push({ label: "Temuan menunggu verifikasi", value: toVerify, href: "/mutu?tab=temuan" });
  }
  if (findings.length) {
    const late = findings.filter((f) => f.due_date && f.due_date < t).length;
    cards.push({ label: has("mutu") ? "Temuan terbuka" : "Temuan audit untuk divisi Anda", value: findings.length, hint: late ? `${late} lewat tenggat` : undefined, href: "/temuan", tone: late ? "danger" : "warn" });
  }
  if (has("keluhan")) cards.push({ label: "Keluhan pelanggan terbuka", value: complaints.length, href: "/keluhan", tone: complaints.some((c) => c.severity === "tinggi") ? "danger" : complaints.length ? "warn" : "default" });
  if (has("pembelian")) cards.push({ label: "PO menunggu barang", value: po, href: "/pembelian" });
  if (has("sdm")) cards.push({ label: "Karyawan aktif", value: employees, href: "/sdm" });
  if (has("pengguna")) cards.push({ label: "Akun belum pernah login", value: neverLogin, href: "/pengguna" });
  if (has("email")) cards.push({ label: "Email belum dibaca", value: unreadMail, href: "/email" });

  return (
    <>
      <PageHeader title={`Halo, ${user.name}`} subtitle={`Dasbor ${divisionLabel(user.role)} · ${tanggal(t)}`} />
      <Flash msg={msg} error={error} />
      {cards.length ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map((c) => (
            <StatCard key={c.label} label={c.label} value={typeof c.value === "number" ? num(c.value) : c.value} hint={c.hint} tone={c.tone} href={c.href} />
          ))}
        </div>
      ) : (
        <Card>
          <Empty>Divisi Anda belum diberi akses modul apa pun. Hubungi Founder.</Empty>
        </Card>
      )}

      {(stockSeed || payables) && (
        <div className={`mt-5 grid gap-5 ${stockSeed && payables ? "lg:grid-cols-2" : ""}`}>
          {stockSeed && <StockSeedCard data={stockSeed} />}
          {payables && <FarmerPayablesCard data={payables} />}
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {batches.length > 0 && (
          <Card title="Batch produksi berjalan">
            <ul className="divide-y divide-line text-sm">
              {batches.map((b) => (
                <li key={b.id}>
                  <Link href={has("produksi") ? `/produksi/${b.id}` : "/qc"} className="flex items-center justify-between px-5 py-2.5 hover:bg-brand-50/50">
                    <span>
                      {b.name} <span className="text-xs text-muted">· {b.code}</span>
                    </span>
                    <Badge tone={PRD_STATUS[b.status]?.tone}>{PRD_STATUS[b.status]?.label}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {low.length > 0 && (
          <Card title={<span className="flex items-center gap-2"><AlertTriangle size={15} className="text-red-600" /> Stok rendah</span>}>
            <ul className="divide-y divide-line text-sm">
              {low.slice(0, 8).map((p) => (
                <li key={p.id} className="flex justify-between px-5 py-2.5">
                  <span>{p.name}</span>
                  <span className="tabular-nums">
                    <b className="text-red-700">{num(p.stock)}</b> <span className="text-muted">/ {num(p.min_stock)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {expiring.length > 0 && (
          <Card title={<span className="flex items-center gap-2"><CalendarClock size={15} className="text-amber-600" /> Lot mendekati kadaluarsa</span>}>
            <ul className="divide-y divide-line text-sm">
              {expiring.map((l) => (
                <li key={l.id} className="flex justify-between px-5 py-2.5">
                  <Link href={has("inventori") ? `/inventori/${l.id}` : `/qc/lot/${l.id}`} className="font-mono text-xs text-brand-700 hover:underline">
                    {l.lot_no}
                  </Link>
                  <Badge tone={daysUntil(l.expiry_date) <= 30 ? "red" : "amber"}>{daysUntil(l.expiry_date)} hari</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {complaints.length > 0 && (
          <Card title="Keluhan pelanggan terbuka">
            <ul className="divide-y divide-line text-sm">
              {complaints.map((c) => (
                <li key={c.id}>
                  <Link href={`/keluhan/${c.id}`} className="flex items-center justify-between gap-2 px-5 py-2.5 hover:bg-brand-50/50">
                    <span className="min-w-0">
                      <span className="font-medium">{c.code}</span> <span className="truncate text-xs text-muted">· {c.category}</span>
                    </span>
                    <span className="flex shrink-0 gap-1">
                      <Badge tone={COMPLAINT_SEVERITY[c.severity]?.tone}>{COMPLAINT_SEVERITY[c.severity]?.label}</Badge>
                      <Badge tone={COMPLAINT_STATUS[c.status]?.tone}>{COMPLAINT_STATUS[c.status]?.label}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {findings.length > 0 && (
          <Card title="Temuan audit yang harus ditindaklanjuti">
            <ul className="divide-y divide-line text-sm">
              {findings.map((f) => (
                <li key={f.id}>
                  <Link href={`/temuan/${f.id}`} className="block px-5 py-2.5 hover:bg-brand-50/50">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{f.code}</span>
                      <Badge tone={FINDING_CATEGORY[f.category]?.tone}>{FINDING_CATEGORY[f.category]?.label}</Badge>
                      <Badge tone={FINDING_STATUS[f.status]?.tone}>{FINDING_STATUS[f.status]?.label}</Badge>
                    </div>
                    <div className="truncate text-xs text-muted">
                      tenggat {tanggal(f.due_date)} · {f.description}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {has("laporan") && (
          <Card title="Laporan divisi">
            <div className="p-5 text-sm text-muted">
              Lihat rekap dan unduh CSV untuk divisi Anda.
              <Link href="/laporan" className="btn-secondary btn-sm mt-3 flex w-fit">
                Buka laporan
              </Link>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
