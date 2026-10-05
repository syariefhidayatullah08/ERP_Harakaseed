import Link from "next/link";
import type { Metadata } from "next";
import { all, get } from "@/lib/db";
import { addDays, num, rupiah, tanggal, today } from "@/lib/format";
import { Badge, Card, Empty, Flash, PageHeader, StatCard } from "@/components/ui";
import { requireAccess } from "@/lib/session";
import { SubmitButton } from "@/components/buttons";
import { deleteIntake } from "@/actions/seed-payment";
import { ExportMenu } from "@/components/export-menu";
import { INTAKE_KIND, INTAKE_STATUS, PB_STATUS, type Intake } from "@/lib/seed-payment";

export const metadata: Metadata = { title: "Pembayaran Benih Petani" };

const PAGE_SIZE = 100;
const kg = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);

export default async function SeedPaymentPage({ searchParams }: PageProps<"/pembayaran-benih">) {
  await requireAccess("pembayaran_benih");
  const sp = await searchParams;
  const tab = sp.tab === "pb" ? "pb" : "buku";
  const f = {
    kind: sp.kind === "eksternal" ? "eksternal" : sp.kind === "internal" ? "internal" : "",
    status: String(sp.status ?? "") in INTAKE_STATUS || sp.status === "belum" ? String(sp.status) : "",
    year: /^\d{4}$/.test(String(sp.year)) ? String(sp.year) : "",
    q: String(sp.q ?? "").trim(),
  };
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const t = today();

  const pbWaiting = (await get<{ n: number }>("SELECT COUNT(*) n FROM seed_pb WHERE status = 'diajukan'"))!.n;
  const stats = (await get<{ unpaid: number; unpaid_n: number; due_n: number; bad: number }>(
    `SELECT COALESCE(SUM(amount) FILTER (WHERE status IN ('proses_uji','diajukan')), 0) unpaid,
            COUNT(*) FILTER (WHERE status IN ('proses_uji','diajukan')) unpaid_n,
            COUNT(*) FILTER (WHERE status IN ('proses_uji','diajukan') AND due_date <= ?) due_n,
            COALESCE(SUM(bad_debt), 0) bad
     FROM seed_intakes`,
    addDays(t, 7),
  ))!;

  // "belum" = belum dibayar (proses uji + sudah diajukan PB).
  const where = `(? = '' OR kind = ?) AND (? = '' OR status = ? OR (? = 'belum' AND status IN ('proses_uji','diajukan')))
    AND (? = '' OR left(received_date, 4) = ?) AND (? = '' OR farmer ILIKE ? OR production_code ILIKE ? OR contract_no ILIKE ? OR location ILIKE ? OR company ILIKE ?)`;
  const like = `%${f.q}%`;
  const params = [f.kind, f.kind, f.status, f.status, f.status, f.year, f.year, f.q, like, like, like, like, like];
  const total = tab === "buku" ? (await get<{ n: number }>(`SELECT COUNT(*) n FROM seed_intakes WHERE ${where}`, ...params))!.n : 0;
  const rows =
    tab === "buku"
      ? await all<Intake & { pb_no: string | null }>(
          `SELECT i.*, (SELECT number FROM seed_pb WHERE id = i.pb_id) pb_no FROM seed_intakes i WHERE ${where}
           ORDER BY received_date DESC NULLS LAST, id DESC LIMIT ? OFFSET ?`,
          ...params,
          PAGE_SIZE,
          (page - 1) * PAGE_SIZE,
        )
      : [];
  const years = await all<{ y: string }>("SELECT DISTINCT left(received_date, 4) y FROM seed_intakes WHERE received_date IS NOT NULL ORDER BY 1 DESC");
  const pbs =
    tab === "pb"
      ? await all<{ id: number; number: string; kind: string; pb_date: string; status: string; paid_at: string | null; rows: number; total: number }>(
          `SELECT pb.*, COUNT(i.id) rows, COALESCE(SUM(i.amount), 0) total FROM seed_pb pb LEFT JOIN seed_intakes i ON i.pb_id = pb.id
           GROUP BY pb.id ORDER BY pb.pb_date DESC, pb.id DESC LIMIT 300`,
        )
      : [];

  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    if (p > 1) u.set("page", String(p));
    return `/pembayaran-benih${u.size ? `?${u}` : ""}`;
  };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Pembayaran Benih Petani"
        subtitle="Buku induk benih masuk dari petani (internal & eksternal) dan surat pengajuan pembayaran benih (PB)"
        actions={
          <>
            <ExportMenu type={tab === "pb" ? "surat-pb" : "pembayaran-benih"} />
            <Link href="/pembayaran-benih/pb/baru" className="btn-secondary">
              + Surat PB
            </Link>
            <Link href="/pembayaran-benih/baru" className="btn-accent">
              + Benih masuk
            </Link>
          </>
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Belum dibayar" value={rupiah(stats.unpaid)} hint={`${num(stats.unpaid_n)} baris`} href="/pembayaran-benih?status=belum" />
        <StatCard label="Jatuh tempo ≤ 7 hari" value={num(stats.due_n)} hint="Belum dibayar, termasuk yang sudah lewat" tone={stats.due_n ? "warn" : "default"} />
        <StatCard label="Kredit macet" value={rupiah(stats.bad)} hint="Pinjaman yang tidak tertutup hasil benih" tone={stats.bad ? "danger" : "default"} href="/pembayaran-benih?status=kredit_macet" />
        <StatCard label="Surat PB menunggu dibayar" value={num(pbWaiting)} href="/pembayaran-benih?tab=pb" />
      </div>
      <div className="mb-4 flex gap-1 border-b border-line">
        {[
          ["buku", "Buku induk", "/pembayaran-benih"],
          ["pb", "Surat pengajuan PB", "/pembayaran-benih?tab=pb"],
        ].map(([k, label, href]) => (
          <Link
            key={k}
            href={href}
            className={`border-b-2 px-3 py-2 text-sm ${tab === k ? "border-brand-700 font-semibold text-brand-800" : "border-transparent text-muted hover:text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "pb" ? (
        <Card className="overflow-hidden">
          {pbs.length ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nomor surat</th>
                    <th>Tanggal</th>
                    <th>Jenis</th>
                    <th className="num">Baris</th>
                    <th className="num">Total pembayaran</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pbs.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/pembayaran-benih/pb/${p.id}`} className="font-medium text-brand-700 hover:underline">
                          {p.number}
                        </Link>
                      </td>
                      <td className="text-muted">{tanggal(p.pb_date)}</td>
                      <td>{INTAKE_KIND[p.kind]}</td>
                      <td className="num">{num(p.rows)}</td>
                      <td className="num">{rupiah(p.total)}</td>
                      <td>
                        <Badge tone={PB_STATUS[p.status]?.tone}>{PB_STATUS[p.status]?.label ?? p.status}</Badge>
                        {p.paid_at && <div className="text-xs text-muted">{tanggal(p.paid_at)}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Belum ada surat pengajuan PB. Klik “+ Surat PB” untuk membuat dari baris buku induk.</Empty>
          )}
        </Card>
      ) : (
        <>
          <form className="mb-4 flex flex-wrap items-end gap-2">
            <input name="q" defaultValue={f.q} placeholder="Cari petani, kode produksi, no kontrak, lokasi…" className="input max-w-xs" />
            <select name="kind" defaultValue={f.kind} className="input w-auto" aria-label="Jenis">
              <option value="">Internal & eksternal</option>
              <option value="internal">Internal</option>
              <option value="eksternal">Eksternal</option>
            </select>
            <select name="status" defaultValue={f.status} className="input w-auto" aria-label="Status">
              <option value="">Semua status</option>
              <option value="belum">Belum dibayar</option>
              {Object.entries(INTAKE_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <select name="year" defaultValue={f.year} className="input w-auto" aria-label="Tahun">
              <option value="">Semua tahun</option>
              {years.map((y) => (
                <option key={y.y} value={y.y}>
                  {y.y}
                </option>
              ))}
            </select>
            <button className="btn-secondary">Saring</button>
            {Object.values(f).some(Boolean) && (
              <Link href="/pembayaran-benih" className="text-sm text-brand-700 hover:underline">
                Hapus saringan
              </Link>
            )}
          </form>
          <Card className="overflow-hidden">
            {rows.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Petani</th>
                      <th>Kode produksi</th>
                      <th>Benih masuk</th>
                      <th>Jatuh tempo</th>
                      <th className="num">Bobot bersih</th>
                      <th className="num">Harga</th>
                      <th className="num">Pinjaman</th>
                      <th className="num">Nilai pembayaran</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const unpaid = r.status === "proses_uji" || r.status === "diajukan";
                      return (
                        <tr key={r.id}>
                          <td>
                            <Link href={`/pembayaran-benih/${r.id}`} className="font-medium text-brand-700 hover:underline">
                              {r.farmer}
                            </Link>
                            <div className="text-xs text-muted">{[INTAKE_KIND[r.kind], r.company, r.location, r.officer].filter(Boolean).join(" · ")}</div>
                          </td>
                          <td>
                            {r.production_code || "—"}
                            <div className="text-xs text-muted">{r.contract_no && `Kontrak ${r.contract_no}`}</div>
                          </td>
                          <td className="whitespace-nowrap text-muted">{tanggal(r.received_date)}</td>
                          <td className={`whitespace-nowrap ${unpaid && r.due_date && r.due_date < t ? "font-medium text-red-700" : "text-muted"}`}>{tanggal(r.due_date)}</td>
                          <td className="num">{kg(r.net_kg)} kg</td>
                          <td className="num">{rupiah(r.price)}</td>
                          <td className="num">{r.loan ? rupiah(r.loan) : "—"}</td>
                          <td className="num font-medium">
                            {rupiah(r.amount)}
                            {r.bad_debt > 0 && <div className="text-xs font-normal text-red-700">macet {rupiah(r.bad_debt)}</div>}
                          </td>
                          <td>
                            <Badge tone={INTAKE_STATUS[r.status]?.tone}>{INTAKE_STATUS[r.status]?.label ?? r.status}</Badge>
                            {r.pb_no && (
                              <div className="text-xs">
                                <Link href={`/pembayaran-benih/pb/${r.pb_id}`} className="text-brand-700 hover:underline">
                                  {r.pb_no}
                                </Link>
                              </div>
                            )}
                          </td>
                          <td>
                            {/* Baris yang sudah lunas dihapus dari halaman rinciannya, supaya tidak terhapus tak sengaja. */}
                            {r.status !== "lunas" && (
                              <form action={deleteIntake}>
                                <input type="hidden" name="id" value={r.id} />
                                <SubmitButton
                                  className="btn-danger btn-sm"
                                  confirm={`Hapus data benih ${r.farmer} (${r.production_code || "tanpa kode"}, ${kg(r.net_kg)} kg)${r.pb_no ? ` dan keluarkan dari surat ${r.pb_no}` : ""}?`}
                                >
                                  Hapus
                                </SubmitButton>
                              </form>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Belum ada data benih masuk yang cocok.</Empty>
            )}
          </Card>
          <div className="mt-3 flex items-center justify-between text-sm text-muted">
            <span>
              {num(total)} baris · halaman {page} dari {pages}
            </span>
            <span className="flex gap-2">
              {page > 1 && (
                <Link href={qs(page - 1)} className="btn-secondary btn-sm">
                  ← Sebelumnya
                </Link>
              )}
              {page < pages && (
                <Link href={qs(page + 1)} className="btn-secondary btn-sm">
                  Berikutnya →
                </Link>
              )}
            </span>
          </div>
        </>
      )}
    </>
  );
}
