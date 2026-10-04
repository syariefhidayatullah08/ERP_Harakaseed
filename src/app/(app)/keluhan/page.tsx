import Link from "next/link";
import type { Metadata } from "next";
import { all } from "@/lib/db";
import { tanggal, today } from "@/lib/format";
import { COMPLAINT_CATEGORIES, COMPLAINT_SEVERITY, COMPLAINT_STATUS } from "@/lib/keluhan";
import { Badge, Card, Empty, Field, Flash, PageHeader, StatCard } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { createComplaint } from "@/actions/keluhan";
import { requireAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Keluhan Pelanggan" };

export default async function ComplaintsPage({ searchParams }: PageProps<"/keluhan">) {
  await requireAccess("keluhan");
  const sp = await searchParams;
  const status = String(sp.status ?? "terbuka");
  const rows = await all<{ id: number; code: string; report_date: string; customer: string | null; product: string | null; lot_no: string | null; category: string; severity: string; status: string; closed_at: string | null }>(
    `SELECT k.id, k.code, k.report_date, k.category, k.severity, k.status, k.closed_at, c.name customer, p.name product, l.lot_no
     FROM complaints k LEFT JOIN customers c ON c.id = k.customer_id LEFT JOIN products p ON p.id = k.product_id LEFT JOIN lots l ON l.id = k.lot_id
     WHERE (? = 'semua' OR (? = 'terbuka' AND k.status <> 'selesai') OR k.status = ?)
     ORDER BY CASE k.severity WHEN 'tinggi' THEN 0 WHEN 'sedang' THEN 1 ELSE 2 END, k.report_date DESC`,
    status, status, status,
  );
  const counts = await all<{ status: string; n: number }>("SELECT status, COUNT(*) n FROM complaints GROUP BY status");
  const n = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;
  const open = counts.filter((c) => c.status !== "selesai").reduce((s, c) => s + c.n, 0);
  const customers = await all<{ id: number; name: string }>("SELECT id, name FROM customers ORDER BY name");
  const products = await all<{ id: number; name: string }>("SELECT id, name FROM products ORDER BY name");

  return (
    <>
      <PageHeader title="Keluhan Pelanggan" subtitle="Keluhan dari pelanggan, investigasi, penggantian, dan penelusuran lot" />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Keluhan terbuka" value={open} tone={open ? "warn" : "default"} />
        <StatCard label="Investigasi" value={n("investigasi")} />
        <StatCard label="Tindakan perbaikan" value={n("tindakan")} />
        <StatCard label="Selesai" value={n("selesai")} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex gap-1 overflow-x-auto border-b border-line">
            {[["terbuka", "Terbuka"], ...Object.entries(COMPLAINT_STATUS).map(([k, v]) => [k, v.label]), ["semua", "Semua"]].map(([k, label]) => (
              <Link
                key={k}
                href={`/keluhan?status=${k}`}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${status === k ? "border-brand-700 font-semibold text-brand-800" : "border-transparent text-muted hover:text-ink"}`}
              >
                {label}
              </Link>
            ))}
          </div>
          <Card className="overflow-hidden">
            {rows.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Keluhan</th>
                      <th>Pelanggan / produk</th>
                      <th>Tingkat</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Link href={`/keluhan/${r.id}`} className="font-medium text-brand-700 hover:underline">
                            {r.code}
                          </Link>
                          <div className="text-xs text-muted">
                            {tanggal(r.report_date)} · {r.category}
                          </div>
                        </td>
                        <td className="text-sm">
                          {r.customer ?? "—"}
                          <div className="text-xs text-muted">
                            {r.product ?? "—"} {r.lot_no && <span className="font-mono">· {r.lot_no}</span>}
                          </div>
                        </td>
                        <td>
                          <Badge tone={COMPLAINT_SEVERITY[r.severity]?.tone}>{COMPLAINT_SEVERITY[r.severity]?.label}</Badge>
                        </td>
                        <td>
                          <Badge tone={COMPLAINT_STATUS[r.status]?.tone}>{COMPLAINT_STATUS[r.status]?.label}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Tidak ada keluhan pada filter ini.</Empty>
            )}
          </Card>
        </div>
        <Card title="Catat keluhan baru">
          <form action={createComplaint} className="space-y-3 p-5">
            <Field label="Tanggal laporan">
              <input name="report_date" type="date" defaultValue={today()} className="input" />
            </Field>
            <Field label="Pelanggan">
              <select name="customer_id" defaultValue="" className="input">
                <option value="">— tidak diketahui —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="No. lot (dari kemasan, bila ada)">
              <input name="lot_no" className="input font-mono uppercase" placeholder="L2026001-KNT" />
            </Field>
            <Field label="Varietas (bila lot tidak diketahui)">
              <select name="product_id" defaultValue="" className="input">
                <option value="">—</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kategori *">
                <select name="category" required className="input">
                  {COMPLAINT_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tingkat">
                <select name="severity" defaultValue="sedang" className="input">
                  {Object.entries(COMPLAINT_SEVERITY).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Uraian keluhan *">
              <textarea name="description" rows={4} required className="input" placeholder="Apa yang dilaporkan pelanggan, lokasi tanam, luas, jumlah kemasan…" />
            </Field>
            <SubmitButton className="btn-primary w-full">Simpan keluhan</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
