import Link from "next/link";
import { Sprout, Wallet } from "lucide-react";
import { Badge, Card, Empty } from "@/components/ui";
import { daysUntil, rupiah, tanggal } from "@/lib/format";
import { INTAKE_STATUS } from "@/lib/seed-payment";
import type { FarmerPayables, StockSeedSummary } from "@/lib/dashboard-seed";

const gr = (n: number | null) => (n === null ? "–" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(n));
const kgOf = (g: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(g / 1000);

/** Sisa stock seed (benih sumber) dari Lembar Kerja Offline "Ketersediaan SS": total & kode yang paling sedikit / habis. */
export function StockSeedCard({ data, className = "" }: { data: StockSeedSummary; className?: string }) {
  // Paling sedikit dulu (jumlah Male + Female), yang habis paling atas.
  const lowest = [...data.rows].sort((a, b) => (a.male ?? 0) + (a.female ?? 0) - ((b.male ?? 0) + (b.female ?? 0))).slice(0, 8);
  return (
    <Card
      className={className}
      title={
        <span className="flex items-center gap-2">
          <Sprout size={15} className="text-brand-600" /> Stock seed (benih sumber)
        </span>
      }
      actions={
        <Link href="/lembar/ketersediaan-ss" className="text-xs font-medium text-brand-700">
          Ketersediaan SS →
        </Link>
      }
    >
      {data.rows.length ? (
        <>
          <div className="grid grid-cols-3 gap-3 border-b border-line px-5 py-4 text-center">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted">Male</div>
              <div className="text-lg font-bold tabular-nums">{kgOf(data.male)} kg</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted">Female</div>
              <div className="text-lg font-bold tabular-nums">{kgOf(data.female)} kg</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted">Kode habis</div>
              <div className={`text-lg font-bold tabular-nums ${data.empty ? "text-red-700" : ""}`}>
                {data.empty} <span className="text-xs font-normal text-muted">/ {data.rows.length}</span>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th>Paling sedikit</th>
                  <th>Kode</th>
                  <th className="num">Male (gr)</th>
                  <th className="num">Female (gr)</th>
                </tr>
              </thead>
              <tbody>
                {lowest.map((r, i) => {
                  const empty = !(r.male ?? 0) && !(r.female ?? 0);
                  return (
                    <tr key={i}>
                      <td className="max-w-44 truncate">{r.product || <span className="text-muted">{r.note || "–"}</span>}</td>
                      <td className="whitespace-nowrap">
                        {r.code} {empty && <Badge tone="red">Habis</Badge>}
                      </td>
                      <td className={`num ${!(r.male ?? 0) ? "text-red-700" : ""}`}>{gr(r.male)}</td>
                      <td className={`num ${!(r.female ?? 0) ? "text-red-700" : ""}`}>{gr(r.female)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.updated && <p className="border-t border-line px-5 py-2 text-[11px] text-muted">Dari Lembar Kerja Offline · terakhir diisi {tanggal(data.updated.slice(0, 10))}</p>}
        </>
      ) : (
        <Empty>Lembar Ketersediaan SS belum berisi data.</Empty>
      )}
    </Card>
  );
}

/** Kewajiban bayar benih ke petani: belum diajukan, sudah diajukan PB, kredit macet, dan yang mendekati jatuh tempo. */
export function FarmerPayablesCard({ data, className = "" }: { data: FarmerPayables; className?: string }) {
  const totalOpen = data.notSubmitted.v + data.submitted.v;
  const stat = (label: string, x: { n: number; v: number }, tone = "", href?: string) => {
    const body = (
      <>
        <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
        <div className={`font-bold tabular-nums ${tone}`}>{rupiah(x.v)}</div>
        <div className="text-[11px] text-muted">{x.n} baris</div>
      </>
    );
    return href ? (
      <Link href={href} className="rounded-lg p-2 hover:bg-brand-50/60">
        {body}
      </Link>
    ) : (
      <div className="p-2">{body}</div>
    );
  };
  return (
    <Card
      className={className}
      title={
        <span className="flex items-center gap-2">
          <Wallet size={15} className="text-amber-600" /> Pembayaran benih ke petani
        </span>
      }
      actions={
        <Link href="/pembayaran-benih" className="text-xs font-medium text-brand-700">
          Pembayaran Benih →
        </Link>
      }
    >
      <div className="border-b border-line px-5 pt-4">
        <div className="text-[11px] uppercase tracking-wide text-muted">Belum dibayar ke petani</div>
        <div className="text-2xl font-bold tabular-nums">{rupiah(totalOpen)}</div>
        {data.overdue.n > 0 ? (
          <div className="text-xs text-red-700">
            {rupiah(data.overdue.v)} sudah lewat jatuh tempo ({data.overdue.n} baris)
          </div>
        ) : (
          <div className="text-xs text-muted">Tidak ada yang lewat jatuh tempo</div>
        )}
        <div className="-mx-2 mt-3 grid grid-cols-2 gap-1 pb-3 text-sm sm:grid-cols-4">
          {stat("Belum diajukan PB", data.notSubmitted, "", "/pembayaran-benih?status=proses_uji&tahun=semua")}
          {stat("Diajukan, belum dibayar", data.submitted, "text-sky-800", "/pembayaran-benih?status=diajukan&tahun=semua")}
          {stat("Kredit macet", data.badDebt, data.badDebt.v ? "text-red-700" : "", "/pembayaran-benih?status=kredit_macet&tahun=semua")}
          {stat("Dibayar bulan ini", data.paidThisMonth, "text-emerald-700")}
        </div>
      </div>
      {data.due.length ? (
        <ul className="divide-y divide-line text-sm">
          {data.due.map((r) => {
            const d = daysUntil(r.due_date);
            return (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="min-w-0">
                  <Link href={`/pembayaran-benih/${r.id}`} className="font-medium text-brand-700 hover:underline">
                    {r.farmer}
                  </Link>
                  <div className="truncate text-xs text-muted">
                    {r.production_code || "tanpa kode"} · {r.kind === "eksternal" ? "Eksternal" : "Internal"} · {INTAKE_STATUS[r.status]?.label}
                  </div>
                </span>
                <span className="shrink-0 text-right">
                  <b className="tabular-nums">{rupiah(r.amount)}</b>
                  <div>
                    <Badge tone={d < 0 ? "red" : d <= 3 ? "amber" : "gray"}>{d < 0 ? `lewat ${-d} hari` : d === 0 ? "hari ini" : `${d} hari lagi`}</Badge>
                  </div>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>Tidak ada pembayaran petani yang jatuh tempo dalam 14 hari.</Empty>
      )}
    </Card>
  );
}
