import type { Metadata } from "next";
import { all } from "@/lib/db";
import { num } from "@/lib/format";
import { Card, Empty, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { saveGrower } from "@/actions/production";

export const metadata: Metadata = { title: "Petani Mitra" };

export default async function GrowersPage({ searchParams }: PageProps<"/mitra">) {
  const sp = await searchParams;
  const rows = await all<{ id: number; name: string; village: string; phone: string; area_ha: number; batches: number; active: number; harvest: number }>(
    `SELECT g.*,
       (SELECT COUNT(*) FROM productions p WHERE p.grower_id = g.id) batches,
       (SELECT COUNT(*) FROM productions p WHERE p.grower_id = g.id AND p.status IN ('tanam','panen','prosesing','uji_lab')) active,
       (SELECT COALESCE(SUM(harvest_kg),0) FROM productions p WHERE p.grower_id = g.id) harvest
     FROM growers g ORDER BY g.name`,
  );
  return (
    <>
      <PageHeader title="Petani Mitra" subtitle="Petani penangkar benih yang bermitra dengan Haraka Seed" />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          {rows.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Desa / Kecamatan</th>
                  <th>Telepon</th>
                  <th className="num">Lahan</th>
                  <th className="num">Batch aktif</th>
                  <th className="num">Total panen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id}>
                    <td className="font-medium">{g.name}</td>
                    <td className="text-muted">{g.village}</td>
                    <td className="text-muted">{g.phone}</td>
                    <td className="num">{g.area_ha} ha</td>
                    <td className="num">
                      {g.active} / {g.batches}
                    </td>
                    <td className="num">{num(g.harvest)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>Belum ada petani mitra.</Empty>
          )}
        </Card>
        <Card title="Tambah petani mitra">
          <form action={saveGrower} className="space-y-3 p-5">
            <Field label="Nama *">
              <input name="name" required className="input" />
            </Field>
            <Field label="Desa / Kecamatan">
              <input name="village" className="input" />
            </Field>
            <Field label="Telepon">
              <input name="phone" className="input" />
            </Field>
            <Field label="Luas lahan (ha)">
              <input name="area_ha" type="number" step="0.1" min={0} className="input" />
            </Field>
            <SubmitButton className="btn-primary w-full">Simpan</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
