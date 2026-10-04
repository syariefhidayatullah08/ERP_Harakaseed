import Link from "next/link";
import type { Metadata } from "next";
import { all, getSetting } from "@/lib/db";
import { daysUntil, num, tanggal, today } from "@/lib/format";
import { Badge, Card, Empty, Field, Flash, PageHeader, StatCard } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { labDecision, saveQcStandard } from "@/actions/qc";
import { requireAccess } from "@/lib/session";
import { ExportMenu } from "@/components/export-menu";

export const metadata: Metadata = { title: "Lab / QC" };

export default async function QcPage({ searchParams }: PageProps<"/qc">) {
  await requireAccess("qc");
  const sp = await searchParams;
  const tab = sp.tab === "lot" ? "lot" : "antrian";
  const minDk = Number(await getSetting("qc_min_germination", "85"));

  const queue = await all<{ id: number; code: string; name: string; crop: string; pack_size: string; harvest_kg: number | null; grower: string | null; plant_date: string; sku: string }>(
    `SELECT pr.id, pr.code, pr.harvest_kg, pr.plant_date, p.name, p.crop, p.pack_size, p.sku, g.name grower
     FROM productions pr JOIN products p ON p.id = pr.product_id LEFT JOIN growers g ON g.id = pr.grower_id
     WHERE pr.status = 'uji_lab' ORDER BY pr.id`,
  );
  const lots = await all<{ id: number; lot_no: string; name: string; qty_available: number; germination: number; purity: number; moisture: number; expiry_date: string; qc_status: string; last_test: string | null; tests: number }>(
    `SELECT l.id, l.lot_no, p.name, l.qty_available, l.germination, l.purity, l.moisture, l.expiry_date, l.qc_status,
            (SELECT MAX(test_date) FROM lot_tests t WHERE t.lot_id = l.id) last_test,
            (SELECT COUNT(*) FROM lot_tests t WHERE t.lot_id = l.id) tests
     FROM lots l JOIN products p ON p.id = l.product_id
     WHERE l.qty_available > 0 ORDER BY (l.qc_status = 'karantina') DESC, l.germination, l.expiry_date`,
  );
  const stats = (await all<{ total: number; lulus: number; avg_dk: number | null }>(
    `SELECT COUNT(*) total, COUNT(*) FILTER (WHERE result = 'lulus') lulus, AVG(germination) avg_dk FROM lot_tests WHERE test_date >= to_char(now() - interval '90 days', 'YYYY-MM-DD')`,
  ))[0];
  const below = lots.filter((l) => l.germination < minDk && l.qc_status !== "karantina");
  const quarantined = lots.filter((l) => l.qc_status === "karantina");

  return (
    <>
      <PageHeader title="Lab / QC" subtitle={`Uji laboratorium benih dan kelulusan lot · standar minimum daya kecambah ${minDk}%`} actions={<ExportMenu type="qc" />} />
      <Flash msg={sp.msg as string} error={sp.error as string} />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Menunggu uji" value={queue.length} tone={queue.length ? "warn" : "default"} />
        <StatCard label="Kelulusan 90 hari" value={stats.total ? `${Math.round((stats.lulus / stats.total) * 100)}%` : "—"} hint={`${stats.total} pengujian`} />
        <StatCard label="Rata-rata daya kecambah" value={stats.avg_dk ? `${stats.avg_dk.toFixed(1)}%` : "—"} hint="90 hari" />
        <StatCard label="Lot dikarantina" value={quarantined.length} tone={quarantined.length ? "danger" : "default"} hint={`${below.length} lot di bawah standar`} />
      </div>

      <div className="mb-4 flex gap-1 border-b border-line">
        {[
          ["antrian", `Antrian uji (${queue.length})`],
          ["lot", `Mutu lot di gudang (${lots.length})`],
        ].map(([k, label]) => (
          <Link
            key={k}
            href={k === "lot" ? "/qc?tab=lot" : "/qc"}
            className={`border-b-2 px-3 py-2 text-sm ${tab === k ? "border-brand-700 font-semibold text-brand-800" : "border-transparent text-muted hover:text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "antrian" ? (
        queue.length ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {queue.map((q) => (
              <Card key={q.id} title={`${q.code} · ${q.name}`} actions={<Badge tone="purple">Uji Lab</Badge>}>
                <div className="px-5 pt-4 text-xs text-muted">
                  {q.crop} · {q.grower ?? "Kebun sendiri"} · tanam {tanggal(q.plant_date)} {q.harvest_kg ? `· panen ${num(q.harvest_kg)} kg` : ""}
                </div>
                <form action={labDecision} className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
                  <input type="hidden" name="production_id" value={q.id} />
                  <Field label="Daya kecambah (%) *">
                    <input name="germination" type="number" step="0.1" min={0} max={100} required className="input" />
                  </Field>
                  <Field label="Kemurnian (%) *">
                    <input name="purity" type="number" step="0.1" min={0} max={100} required defaultValue={98} className="input" />
                  </Field>
                  <Field label="Kadar air (%) *">
                    <input name="moisture" type="number" step="0.1" min={0} max={100} required defaultValue={7} className="input" />
                  </Field>
                  <Field label={`Kemasan lulus${q.pack_size ? ` (${q.pack_size})` : ""}`}>
                    <input name="qty" type="number" min={1} className="input" placeholder="wajib bila lulus" />
                  </Field>
                  <Field label="No. lot (opsional)">
                    <input name="lot_no" className="input font-mono uppercase" placeholder="otomatis" />
                  </Field>
                  <Field label="Tanggal uji">
                    <input name="test_date" type="date" defaultValue={today()} className="input" />
                  </Field>
                  <Field label="Catatan lab" className="col-span-2 sm:col-span-3">
                    <input name="note" className="input" placeholder="Metode uji, nomor sampel, temuan…" />
                  </Field>
                  <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-3">
                    <SubmitButton name="decision" value="lulus" className="btn-primary flex-1" confirm="Nyatakan LULUS? Lot akan masuk stok gudang.">
                      Lulus → masuk stok
                    </SubmitButton>
                    <SubmitButton name="decision" value="gagal" className="btn-danger" confirm="Nyatakan TIDAK LULUS? Batch akan ditutup.">
                      Tidak lulus
                    </SubmitButton>
                  </div>
                  <p className="col-span-2 text-xs text-muted sm:col-span-3">Standar minimum daya kecambah: {minDk}%. Unggah sertifikat/hasil uji di halaman lot setelah lulus.</p>
                </form>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <Empty>Tidak ada batch yang menunggu uji. Batch masuk ke sini saat Produksi menandainya &ldquo;Uji Lab&rdquo;.</Empty>
          </Card>
        )
      ) : (
        <>
          <Card className="overflow-hidden">
            {lots.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Lot</th>
                      <th>Varietas</th>
                      <th className="num">Daya kecambah</th>
                      <th className="num">Kemurnian</th>
                      <th className="num">Kadar air</th>
                      <th>Uji terakhir</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((l) => {
                      const d = daysUntil(l.expiry_date);
                      return (
                        <tr key={l.id}>
                          <td>
                            <Link href={`/qc/lot/${l.id}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">
                              {l.lot_no}
                            </Link>
                            <div className="text-xs text-muted">
                              {num(l.qty_available)} kemasan · ED {tanggal(l.expiry_date)} {d <= 90 && <Badge tone={d < 0 ? "red" : "amber"}>{d < 0 ? "kadaluarsa" : `${d} hr`}</Badge>}
                            </div>
                          </td>
                          <td>{l.name}</td>
                          <td className={`num font-semibold ${l.germination < minDk ? "text-red-700" : ""}`}>{l.germination}%</td>
                          <td className="num">{l.purity}%</td>
                          <td className="num">{l.moisture}%</td>
                          <td className="text-xs text-muted">{l.last_test ? `${tanggal(l.last_test)} (${l.tests}×)` : "Belum pernah"}</td>
                          <td>
                            {l.qc_status === "karantina" ? (
                              <Badge tone="red">Karantina</Badge>
                            ) : l.germination < minDk ? (
                              <Badge tone="amber">Perlu uji ulang</Badge>
                            ) : (
                              <Badge tone="green">Lulus</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Belum ada lot di gudang.</Empty>
            )}
          </Card>
          <form action={saveQcStandard} className="card mt-5 flex flex-wrap items-end gap-3 p-4">
            <Field label="Standar minimum daya kecambah (%)">
              <input name="min_germination" type="number" step="0.5" min={1} max={100} defaultValue={minDk} className="input w-32" />
            </Field>
            <SubmitButton className="btn-secondary">Simpan standar</SubmitButton>
            <p className="text-xs text-muted">Lot di bawah standar ditandai &ldquo;Perlu uji ulang&rdquo;. Lot hanya dikarantina bila hasil uji ulang dinyatakan tidak lulus.</p>
          </form>
        </>
      )}
    </>
  );
}
