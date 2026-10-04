import Link from "next/link";
import type { Metadata } from "next";
import { all } from "@/lib/db";
import { PRD_STATUS, num, tanggal, today } from "@/lib/format";
import { Badge, Card, Empty, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { createProduction } from "@/actions/production";
import { requireAccess } from "@/lib/session";
import { ExportMenu } from "@/components/export-menu";

export const metadata: Metadata = { title: "Produksi Benih" };

const STAGES = ["tanam", "panen", "prosesing", "uji_lab"];

export default async function ProductionPage({ searchParams }: PageProps<"/produksi">) {
  await requireAccess("produksi");
  const sp = await searchParams;
  const rows = await all<{
    id: number; code: string; name: string; crop: string; grower: string | null; area_ha: number; plant_date: string; est_harvest: string | null;
    harvest_kg: number | null; status: string;
  }>(
    `SELECT pr.*, p.name, p.crop, g.name grower FROM productions pr JOIN products p ON p.id = pr.product_id
     LEFT JOIN growers g ON g.id = pr.grower_id ORDER BY pr.id DESC`,
  );
  const products = await all<{ id: number; name: string; crop: string }>("SELECT id, name, crop FROM products WHERE active = 1 ORDER BY name");
  const growers = await all<{ id: number; name: string; village: string }>("SELECT id, name, village FROM growers ORDER BY name");
  const active = rows.filter((r) => STAGES.includes(r.status));
  const done = rows.filter((r) => !STAGES.includes(r.status));

  return (
    <>
      <PageHeader title="Produksi Benih" subtitle="Alur: tanam → panen → prosesing → uji lab → lulus (masuk stok sebagai lot)" actions={<ExportMenu type="produksi" />} />
      <Flash msg={sp.msg as string} error={sp.error as string} />

      <div className="mb-5 grid gap-4 md:grid-cols-4">
        {STAGES.map((s) => {
          const list = active.filter((r) => r.status === s);
          return (
            <div key={s} className="card min-h-40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <Badge tone={PRD_STATUS[s].tone}>{PRD_STATUS[s].label}</Badge>
                <span className="text-xs text-muted">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.map((r) => (
                  <Link key={r.id} href={`/produksi/${r.id}`} className="block rounded-lg border border-line p-3 hover:border-brand-300 hover:bg-brand-50/50">
                    <div className="text-sm font-semibold">{r.name}</div>
                    <div className="text-xs text-muted">
                      {r.code} · {r.grower ?? "Kebun sendiri"}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {r.area_ha} ha · {r.status === "tanam" ? `panen ±${tanggal(r.est_harvest)}` : r.harvest_kg ? `${num(r.harvest_kg)} kg` : ""}
                    </div>
                  </Link>
                ))}
                {!list.length && <div className="py-4 text-center text-xs text-muted">—</div>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Batch selesai / gagal" className="overflow-hidden lg:col-span-2">
          {done.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Varietas</th>
                  <th>Petani</th>
                  <th className="num">Panen</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {done.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/produksi/${r.id}`} className="font-medium text-brand-700 hover:underline">
                        {r.code}
                      </Link>
                    </td>
                    <td>{r.name}</td>
                    <td className="text-muted">{r.grower ?? "—"}</td>
                    <td className="num">{r.harvest_kg ? `${num(r.harvest_kg)} kg` : "—"}</td>
                    <td>
                      <Badge tone={PRD_STATUS[r.status]?.tone}>{PRD_STATUS[r.status]?.label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>Belum ada batch yang selesai.</Empty>
          )}
        </Card>
        <Card title="Mulai batch produksi">
          <form action={createProduction} className="space-y-3 p-5">
            <Field label="Varietas *">
              <select name="product_id" required defaultValue="" className="input">
                <option value="" disabled>
                  Pilih…
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.crop}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Petani mitra">
              <select name="grower_id" defaultValue="" className="input">
                <option value="">Kebun sendiri</option>
                {growers.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} — {g.village}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Luas (ha)">
                <input name="area_ha" type="number" step="0.1" min={0} className="input" />
              </Field>
              <Field label="Tanggal tanam *">
                <input name="plant_date" type="date" required defaultValue={today()} className="input" />
              </Field>
            </div>
            <Field label="Perkiraan panen">
              <input name="est_harvest" type="date" className="input" />
            </Field>
            <Field label="Catatan">
              <textarea name="notes" rows={2} className="input" />
            </Field>
            <SubmitButton className="btn-primary w-full">Buat batch</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
