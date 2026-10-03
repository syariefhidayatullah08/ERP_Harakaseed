import Link from "next/link";
import { notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { PRD_STATUS, num, tanggal, today } from "@/lib/format";
import { Badge, Card, DL, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { advanceProduction } from "@/actions/production";
import { requireAccess } from "@/lib/session";

const FLOW = ["tanam", "panen", "prosesing", "uji_lab", "lulus"];

export default async function ProductionDetail({ params, searchParams }: PageProps<"/produksi/[id]">) {
  await requireAccess("produksi");
  const { id } = await params;
  const sp = await searchParams;
  const p = await get<{
    id: number; code: string; product_id: number; name: string; crop: string; pack_size: string; grower: string | null; village: string | null;
    area_ha: number; plant_date: string; est_harvest: string | null; harvest_kg: number | null; status: string; notes: string; sku: string;
  }>(
    `SELECT pr.*, p.name, p.crop, p.pack_size, p.sku, g.name grower, g.village FROM productions pr
     JOIN products p ON p.id = pr.product_id LEFT JOIN growers g ON g.id = pr.grower_id WHERE pr.id = ?`,
    Number(id),
  );
  if (!p) notFound();
  const lots = await all<{ id: number; lot_no: string; qty_initial: number; germination: number }>("SELECT * FROM lots WHERE production_id = ?", p.id);
  const idx = FLOW.indexOf(p.status);
  const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {p.code} <Badge tone={PRD_STATUS[p.status]?.tone}>{PRD_STATUS[p.status]?.label}</Badge>
          </span>
        }
        subtitle={`${p.name} · ${p.crop}`}
        back={{ href: "/produksi", label: "Produksi" }}
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />

      <ol className="card mb-5 flex overflow-x-auto p-2">
        {FLOW.map((s, i) => {
          const reached = p.status !== "gagal" && i <= idx;
          return (
            <li key={s} className="flex flex-1 items-center gap-2 px-3 py-2">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${reached ? "bg-brand-700 text-white" : "bg-canvas text-muted"}`}
              >
                {i + 1}
              </span>
              <span className={`whitespace-nowrap text-sm ${reached ? "font-semibold" : "text-muted"}`}>{PRD_STATUS[s].label}</span>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Detail batch">
          <div className="p-5">
            <DL
              items={[
                ["Varietas", `${p.name} (${p.sku})`],
                ["Petani mitra", p.grower ? `${p.grower} · ${p.village}` : "Kebun sendiri"],
                ["Luas", `${p.area_ha} ha`],
                ["Tanggal tanam", tanggal(p.plant_date)],
                ["Perkiraan panen", tanggal(p.est_harvest)],
                ["Hasil panen", p.harvest_kg ? `${num(p.harvest_kg)} kg benih` : "—"],
                [
                  "Lot dihasilkan",
                  lots.length
                    ? lots.map((l) => (
                        <Link key={l.id} href={`/inventori/${l.id}`} className="mr-2 font-mono text-brand-700 hover:underline">
                          {l.lot_no} ({num(l.qty_initial)} kms, DK {l.germination}%)
                        </Link>
                      ))
                    : "—",
                ],
              ]}
            />
            {p.notes && <p className="mt-4 whitespace-pre-line text-sm text-muted">{p.notes}</p>}
          </div>
        </Card>

        {next && p.status !== "gagal" && (
          <Card title={`Lanjut ke: ${PRD_STATUS[next].label}`}>
            <form action={advanceProduction} className="space-y-3 p-5">
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="next" value={next} />
              {next === "panen" && (
                <Field label="Berat benih hasil panen (kg) *">
                  <input name="harvest_kg" type="number" step="0.1" min={0} required className="input" />
                </Field>
              )}
              {next === "lulus" && (
                <>
                  <p className="text-sm text-muted">Masukkan hasil uji lab. Lot baru akan otomatis masuk ke stok.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={`Jumlah kemasan (${p.pack_size}) *`}>
                      <input name="qty" type="number" min={1} required className="input" />
                    </Field>
                    <Field label="No. lot (opsional)">
                      <input name="lot_no" className="input font-mono uppercase" placeholder="otomatis" />
                    </Field>
                    <Field label="Daya kecambah (%) *">
                      <input name="germination" type="number" step="0.1" min={0} max={100} required className="input" />
                    </Field>
                    <Field label="Kemurnian (%)">
                      <input name="purity" type="number" step="0.1" min={0} max={100} defaultValue={98} className="input" />
                    </Field>
                    <Field label="Kadar air (%)">
                      <input name="moisture" type="number" step="0.1" min={0} max={100} defaultValue={7} className="input" />
                    </Field>
                    <Field label="Tanggal kemas">
                      <input name="prod_date" type="date" defaultValue={today()} className="input" />
                    </Field>
                  </div>
                </>
              )}
              <SubmitButton className="btn-primary w-full">Tandai {PRD_STATUS[next].label}</SubmitButton>
            </form>
            <form action={advanceProduction} className="flex gap-2 border-t border-line p-5">
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="next" value="gagal" />
              <input name="reason" className="input" placeholder="Alasan gagal (mis. DK di bawah standar)" />
              <SubmitButton className="btn-danger" confirm="Tandai batch ini gagal?">
                Gagal
              </SubmitButton>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
