import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { rupiah, tanggal, today } from "@/lib/format";
import { toId } from "@/lib/form";
import { Badge, Card, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { requireAccess } from "@/lib/session";
import { deletePb, payPb } from "@/actions/seed-payment";
import { INTAKE_KIND, PB_STATUS, pbDoc } from "@/lib/seed-payment";
import { signers } from "@/lib/invoice-doc";

export const metadata: Metadata = { title: "Surat pengajuan PB" };

const kg = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);

export default async function PbPage({ params, searchParams }: PageProps<"/pembayaran-benih/pb/[id]">) {
  const user = await requireAccess("pembayaran_benih");
  const { id } = await params;
  const sp = await searchParams;
  const doc = await pbDoc(toId(id));
  if (!doc) notFound();
  const { pb, rows, total } = doc;
  const paid = pb.status === "dibayar";
  const [left, right] = signers(doc.settings);
  return (
    <>
      <PageHeader
        title={`Surat PB ${pb.number}`}
        subtitle={
          <>
            Benih {INTAKE_KIND[pb.kind]?.toLowerCase()} · {tanggal(pb.pb_date)} · <Badge tone={PB_STATUS[pb.status]?.tone}>{PB_STATUS[pb.status]?.label ?? pb.status}</Badge>
            {pb.paid_at && ` ${tanggal(pb.paid_at)}`}
          </>
        }
        back={{ href: "/pembayaran-benih?tab=pb", label: "Surat pengajuan PB" }}
        actions={
          <>
            <a href={`/api/pb/${pb.id}`} target="_blank" className="btn-primary">
              Cetak PDF
            </a>
            <a href={`/api/pb/${pb.id}?download`} className="btn-secondary">
              Unduh PDF
            </a>
          </>
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Isi surat" className="overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Petani</th>
                  <th>Kode produksi</th>
                  <th>Tgl JT</th>
                  <th className="num">Bobot</th>
                  <th className="num">Pinjaman</th>
                  <th className="num">Harga</th>
                  <th className="num">Kredit macet</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/pembayaran-benih/${r.id}`} className="font-medium text-brand-700 hover:underline">
                        {r.farmer}
                      </Link>
                      <div className="text-xs text-muted">{[r.location, r.contract_no && `Kontrak ${r.contract_no}`, r.deduction ? `potongan ${r.deduction_note || "sortir"} ${rupiah(r.deduction)}` : ""].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td>{r.production_code || "—"}</td>
                    <td className="whitespace-nowrap text-muted">{tanggal(r.due_date)}</td>
                    <td className="num">{kg(r.net_kg)} kg</td>
                    <td className="num">{r.loan ? rupiah(r.loan) : "—"}</td>
                    <td className="num">{rupiah(r.price)}</td>
                    <td className="num">{r.bad_debt ? rupiah(r.bad_debt) : "—"}</td>
                    <td className="num font-medium">{rupiah(r.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={7} className="text-right font-semibold">
                    TOTAL
                  </td>
                  <td className="num font-bold">{rupiah(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-5">
          <Card title="Tanda tangan di surat cetak">
            <div className="space-y-1 p-5 text-sm">
              <div>
                {left.title}: <span className="font-medium">{left.name || "—"}</span>
              </div>
              <div>
                {right.title}: <span className="font-medium">{right.name || "—"}</span>
              </div>
              <p className="pt-1 text-xs text-muted">Nama & jabatan diatur Owner di Pengaturan. {pb.notes && `Catatan: ${pb.notes}`}</p>
            </div>
          </Card>
          {!paid && (
            <Card title="Pembayaran">
              {user.role === "owner" ? (
                <form action={payPb} className="space-y-3 p-5 text-sm">
                  <input type="hidden" name="id" value={pb.id} />
                  <label className="block">
                    <span className="label">Tanggal dibayar</span>
                    <input name="paid_at" type="date" defaultValue={today()} className="input" />
                  </label>
                  <SubmitButton confirm={`Tandai ${pb.number} sudah dibayar ${rupiah(total)}?`}>Tandai sudah dibayar</SubmitButton>
                </form>
              ) : (
                <p className="p-5 text-sm text-muted">Menunggu Owner menandai surat ini sudah dibayar.</p>
              )}
            </Card>
          )}
          {(!paid || user.role === "owner") && (
            <Card title="Hapus surat">
              <form action={deletePb} className="space-y-3 p-5 text-sm">
                <input type="hidden" name="id" value={pb.id} />
                <p className="text-muted">Barisnya tidak ikut terhapus; kembali ke buku induk sebagai belum diajukan.</p>
                <SubmitButton className="btn-danger" confirm={`Hapus surat ${pb.number}?`}>
                  Hapus surat PB
                </SubmitButton>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
