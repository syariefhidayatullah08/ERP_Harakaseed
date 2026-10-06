import Link from "next/link";
import type { Metadata } from "next";
import { all, get } from "@/lib/db";
import { addDays, num, rupiah, tanggal, today } from "@/lib/format";
import { Badge, Card, Empty, Flash, PageHeader, StatCard } from "@/components/ui";
import { requireAccess } from "@/lib/session";
import { SubmitButton } from "@/components/buttons";
import { deleteIntake } from "@/actions/seed-payment";
import { ExportMenu } from "@/components/export-menu";
import { IntakeLedgerPanel } from "@/components/intake-ledger";
import { INTAKE_KIND, PB_STATUS } from "@/lib/seed-payment";

export const metadata: Metadata = { title: "Pembayaran Benih Petani" };

const kg = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);

export default async function SeedPaymentPage({ searchParams }: PageProps<"/pembayaran-benih">) {
  await requireAccess("pembayaran_benih");
  const sp = await searchParams;
  const tab = sp.tab === "pb" ? "pb" : "buku";
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

  const pbs =
    tab === "pb"
      ? await all<{ id: number; number: string; kind: string; pb_date: string; status: string; paid_at: string | null; rows: number; total: number }>(
          `SELECT pb.*, COUNT(i.id) rows, COALESCE(SUM(i.amount), 0) total FROM seed_pb pb LEFT JOIN seed_intakes i ON i.pb_id = pb.id
           GROUP BY pb.id ORDER BY pb.pb_date DESC, pb.id DESC LIMIT 300`,
        )
      : [];


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
        <Card className="overflow-hidden">
          <IntakeLedgerPanel
            path="/pembayaran-benih"
            sp={sp}
            action={(r) =>
              // Baris yang sudah lunas dihapus dari halaman rinciannya, supaya tidak terhapus tak sengaja.
              r.status !== "lunas" && (
                <form action={deleteIntake}>
                  <input type="hidden" name="id" value={r.id} />
                  <SubmitButton
                    className="btn-danger btn-sm"
                    confirm={`Hapus data benih ${r.farmer} (${r.production_code || "tanpa kode"}, ${kg(r.net_kg)} kg)${r.pb_no ? ` dan keluarkan dari surat ${r.pb_no}` : ""}?`}
                  >
                    Hapus
                  </SubmitButton>
                </form>
              )
            }
          />
        </Card>
      )}
    </>
  );
}
