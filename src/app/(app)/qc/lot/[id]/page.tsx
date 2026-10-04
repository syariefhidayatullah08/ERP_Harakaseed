import { notFound } from "next/navigation";
import { all, get, getSetting } from "@/lib/db";
import { toId } from "@/lib/form";
import { num, tanggal, today } from "@/lib/format";
import { Badge, Card, DL, Empty, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { Attachments } from "@/components/attachments";
import { retestLot } from "@/actions/qc";
import { requireAccess } from "@/lib/session";

export default async function QcLotPage({ params, searchParams }: PageProps<"/qc/lot/[id]">) {
  await requireAccess("qc");
  const { id } = await params;
  const sp = await searchParams;
  const lot = await get<{ id: number; lot_no: string; name: string; crop: string; qty_available: number; qty_initial: number; germination: number; purity: number; moisture: number; prod_date: string; expiry_date: string; qc_status: string; prd_code: string | null }>(
    `SELECT l.*, p.name, p.crop, pr.code prd_code FROM lots l JOIN products p ON p.id = l.product_id
     LEFT JOIN productions pr ON pr.id = l.production_id WHERE l.id = ?`,
    toId(id),
  );
  if (!lot) notFound();
  const tests = await all<{ id: number; test_date: string; germination: number; purity: number; moisture: number; result: string; note: string; tester: string | null }>(
    "SELECT t.*, u.name tester FROM lot_tests t LEFT JOIN users u ON u.id = t.tested_by WHERE t.lot_id = ? ORDER BY t.test_date DESC, t.id DESC",
    lot.id,
  );
  const minDk = Number(await getSetting("qc_min_germination", "85"));

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3 font-mono">
            {lot.lot_no} {lot.qc_status === "karantina" ? <Badge tone="red">Karantina</Badge> : <Badge tone="green">Lulus</Badge>}
          </span>
        }
        subtitle={`${lot.name} · ${lot.crop}`}
        back={{ href: "/qc?tab=lot", label: "Lab / QC" }}
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5">
          <Card title="Data mutu terkini">
            <div className="p-5">
              <DL
                items={[
                  ["Daya kecambah", <span key="g" className={lot.germination < minDk ? "text-red-700" : ""}>{lot.germination}% (standar {minDk}%)</span>],
                  ["Kemurnian", `${lot.purity}%`],
                  ["Kadar air", `${lot.moisture}%`],
                  ["Sisa di gudang", `${num(lot.qty_available)} / ${num(lot.qty_initial)} kemasan`],
                  ["Tanggal produksi", tanggal(lot.prod_date)],
                  ["Kadaluarsa", tanggal(lot.expiry_date)],
                  ["Batch produksi", lot.prd_code ?? "—"],
                ]}
              />
            </div>
          </Card>
          <Card title="Uji ulang">
            <form action={retestLot} className="grid grid-cols-2 gap-3 p-5">
              <input type="hidden" name="lot_id" value={lot.id} />
              <Field label="Daya kecambah (%)">
                <input name="germination" type="number" step="0.1" min={0} max={100} required className="input" />
              </Field>
              <Field label="Kemurnian (%)">
                <input name="purity" type="number" step="0.1" min={0} max={100} required defaultValue={lot.purity} className="input" />
              </Field>
              <Field label="Kadar air (%)">
                <input name="moisture" type="number" step="0.1" min={0} max={100} required defaultValue={lot.moisture} className="input" />
              </Field>
              <Field label="Tanggal uji">
                <input name="test_date" type="date" defaultValue={today()} className="input" />
              </Field>
              <Field label="Catatan" className="col-span-2">
                <input name="note" className="input" placeholder="Alasan uji ulang, metode…" />
              </Field>
              <div className="col-span-2 flex gap-2">
                <SubmitButton name="result" value="lulus" className="btn-primary flex-1">
                  Simpan · lulus
                </SubmitButton>
                <SubmitButton name="result" value="gagal" className="btn-danger" confirm="Tidak lulus: lot akan dikarantina dan tidak bisa dijual. Lanjutkan?">
                  Tidak lulus · karantina
                </SubmitButton>
              </div>
            </form>
          </Card>
        </div>
        <div className="space-y-5 lg:col-span-2">
          <Card title={`Riwayat uji (${tests.length})`} className="overflow-hidden">
            {tests.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th className="num">DK</th>
                    <th className="num">Kemurnian</th>
                    <th className="num">KA</th>
                    <th>Hasil</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((t) => (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap">
                        {tanggal(t.test_date)}
                        <div className="text-xs text-muted">{t.tester ?? "—"}</div>
                      </td>
                      <td className="num font-medium">{t.germination}%</td>
                      <td className="num">{t.purity}%</td>
                      <td className="num">{t.moisture}%</td>
                      <td>{t.result === "lulus" ? <Badge tone="green">Lulus</Badge> : <Badge tone="red">Tidak lulus</Badge>}</td>
                      <td className="text-xs text-muted">{t.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>Belum ada riwayat uji untuk lot ini.</Empty>
            )}
          </Card>
          <Attachments refType="lot" refId={lot.id} title="Sertifikat & hasil uji lab" />
        </div>
      </div>
    </>
  );
}
