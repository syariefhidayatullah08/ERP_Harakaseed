import Link from "next/link";
import type { Metadata } from "next";
import { all } from "@/lib/db";
import { rupiah, tanggal, today } from "@/lib/format";
import { Badge, Card, Empty, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { requireAccess } from "@/lib/session";
import { createPb } from "@/actions/seed-payment";
import { INTAKE_STATUS, nextPbNumber, type Intake } from "@/lib/seed-payment";

export const metadata: Metadata = { title: "Surat pengajuan PB baru" };

const kg = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);

export default async function NewPbPage({ searchParams }: PageProps<"/pembayaran-benih/pb/baru">) {
  await requireAccess("pembayaran_benih");
  const sp = await searchParams;
  const kind = sp.kind === "eksternal" ? "eksternal" : "internal";
  const t = today();
  // Yang bisa diajukan: belum masuk surat PB mana pun dan belum lunas. Jatuh tempo terdekat di atas.
  const number = await nextPbNumber(kind, t);
  const rows = await all<Intake>("SELECT * FROM seed_intakes WHERE kind = ? AND pb_id IS NULL AND status <> 'lunas' ORDER BY due_date NULLS LAST, id LIMIT 500", kind);
  return (
    <>
      <PageHeader title="Surat pengajuan pembayaran benih" subtitle="Pilih baris buku induk yang diajukan untuk dibayar" back={{ href: "/pembayaran-benih?tab=pb", label: "Surat pengajuan PB" }} />
      <Flash error={sp.error as string} />
      <div className="mb-4 flex gap-1 border-b border-line">
        {(["internal", "eksternal"] as const).map((k) => (
          <Link
            key={k}
            href={`/pembayaran-benih/pb/baru?kind=${k}`}
            className={`border-b-2 px-3 py-2 text-sm capitalize ${kind === k ? "border-brand-700 font-semibold text-brand-800" : "border-transparent text-muted hover:text-ink"}`}
          >
            Benih {k}
          </Link>
        ))}
      </div>
      <form action={createPb} className="space-y-5">
        <input type="hidden" name="kind" value={kind} />
        <Card>
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label="Nomor surat">
              <input name="number" defaultValue={number} className="input" />
            </Field>
            <Field label="Tanggal surat">
              <input name="pb_date" type="date" defaultValue={t} className="input" />
            </Field>
            <Field label="Catatan">
              <input name="notes" className="input" />
            </Field>
          </div>
        </Card>
        <Card title={`Benih ${kind} yang belum diajukan`} className="overflow-hidden">
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-10">Pilih</th>
                    <th>Petani</th>
                    <th>Kode produksi</th>
                    <th>Jatuh tempo</th>
                    <th className="num">Bobot bersih</th>
                    <th className="num">Pinjaman</th>
                    <th className="num">Nilai pembayaran</th>
                    <th>Hasil uji (KA / KM / DB)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <input type="checkbox" name="ids" value={r.id} aria-label={`Ajukan ${r.farmer}`} className="size-4" />
                      </td>
                      <td>
                        {r.farmer}
                        <div className="text-xs text-muted">{[r.company, r.location].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td>
                        {r.production_code || "—"}
                        <div className="text-xs text-muted">{r.contract_no && `Kontrak ${r.contract_no}`}</div>
                      </td>
                      <td className={`whitespace-nowrap ${r.due_date && r.due_date < t ? "font-medium text-red-700" : ""}`}>{tanggal(r.due_date)}</td>
                      <td className="num">{kg(r.net_kg)} kg</td>
                      <td className="num">{r.loan ? rupiah(r.loan) : "—"}</td>
                      <td className="num font-medium">
                        {rupiah(r.amount)}
                        {r.status === "kredit_macet" && (
                          <div>
                            <Badge tone="red">{INTAKE_STATUS.kredit_macet.label}</Badge>
                          </div>
                        )}
                      </td>
                      <td className="text-xs">{r.test_ka || r.test_km || r.test_db ? [r.test_ka, r.test_km, r.test_db].map((x) => x || "–").join(" / ") : <span className="text-muted">belum ada</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Tidak ada benih {kind} yang menunggu diajukan.</Empty>
          )}
        </Card>
        {rows.length > 0 && (
          <div className="flex justify-end">
            <SubmitButton>Buat surat pengajuan</SubmitButton>
          </div>
        )}
      </form>
    </>
  );
}
