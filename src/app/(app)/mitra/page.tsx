import Link from "next/link";
import type { Metadata } from "next";
import { all, get } from "@/lib/db";
import { num, rupiah } from "@/lib/format";
import { Card, Empty, Field, Flash, PageHeader, StatCard } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { saveGrower } from "@/actions/production";
import { can, requireAccess } from "@/lib/session";
import { ExportMenu } from "@/components/export-menu";

export const metadata: Metadata = { title: "Petani Mitra" };

const kg = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(n || 0);
const PAGE_SIZE = 100;

export default async function GrowersPage({ searchParams }: PageProps<"/mitra">) {
  const user = await requireAccess("mitra");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const sort = sp.urut === "nama" ? "nama" : "kg";
  // Nilai pembayaran & pinjaman hanya untuk yang berhak melihat pembayaran benih.
  const money = can(user, ["pembayaran_benih", "keuangan"]);

  const rows = await all<{ id: number; name: string; village: string; phone: string; n: number; kg: number; paid: number; bad: number; last: string | null; pickups: number }>(
    `SELECT g.id, g.name, g.village, g.phone,
       COALESCE(i.n, 0) n, COALESCE(i.kg, 0) kg, COALESCE(i.paid, 0) paid, COALESCE(i.bad, 0) bad, i.last,
       (SELECT COUNT(*) FROM seed_pickups p WHERE p.grower_id = g.id) pickups
     FROM growers g
     LEFT JOIN (SELECT grower_id, COUNT(*) n, SUM(net_kg) kg, SUM(amount) FILTER (WHERE status = 'lunas') paid, SUM(bad_debt) bad, MAX(received_date) last
                FROM seed_intakes WHERE grower_id IS NOT NULL GROUP BY 1) i ON i.grower_id = g.id
     ${q ? "WHERE g.name ILIKE ? OR g.village ILIKE ?" : ""}
     ORDER BY ${sort === "nama" ? "g.name" : "COALESCE(i.kg, 0) DESC, g.name"} LIMIT ${PAGE_SIZE}`,
    ...(q ? [`%${q}%`, `%${q}%`] : []),
  );
  const stats = (await get<{ growers: number; linked: number; unlinked: number; unlinked_names: number }>(
    `SELECT (SELECT COUNT(*) FROM growers) growers,
            (SELECT COUNT(*) FROM seed_intakes WHERE grower_id IS NOT NULL) linked,
            (SELECT COUNT(*) FROM seed_intakes WHERE grower_id IS NULL) unlinked,
            (SELECT COUNT(DISTINCT lower(farmer)) FROM seed_intakes WHERE grower_id IS NULL) unlinked_names`,
  ))!;

  return (
    <>
      <PageHeader title="Petani Mitra" subtitle="Petani penangkar benih beserta riwayat benih masuk dari buku induk" actions={<ExportMenu type="mitra" />} />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Petani mitra" value={num(stats.growers)} />
        <StatCard label="Baris buku induk terhubung" value={num(stats.linked)} hint="Sudah masuk riwayat petani" />
        <StatCard label="Belum terhubung" value={num(stats.unlinked)} hint={stats.unlinked ? `${num(stats.unlinked_names)} nama sama di beberapa desa; hubungkan dari halaman petaninya` : "Semua baris sudah terhubung"} tone={stats.unlinked ? "warn" : "default"} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <form className="mb-4 flex flex-wrap items-center gap-2">
            <input name="q" defaultValue={q} placeholder="Cari nama petani atau desa…" className="input max-w-xs" />
            {sort === "nama" && <input type="hidden" name="urut" value="nama" />}
            <button className="btn-secondary">Cari</button>
            <Link href={`/mitra?${new URLSearchParams({ ...(q ? { q } : {}), ...(sort === "kg" ? { urut: "nama" } : {}) })}`} className="btn-secondary btn-sm">
              Urutkan: {sort === "kg" ? "benih terbanyak" : "nama"} ⇅
            </Link>
          </form>
          <Card className="overflow-hidden">
            {rows.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Desa / alamat</th>
                      <th className="num">Benih masuk</th>
                      {money && <th className="num">Sudah dibayar</th>}
                      {money && <th className="num">Kredit macet</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((g) => (
                      <tr key={g.id}>
                        <td>
                          <Link href={`/mitra/${g.id}`} className="font-medium text-brand-700 hover:underline">
                            {g.name}
                          </Link>
                          {g.phone && <div className="text-xs text-muted">{g.phone}</div>}
                        </td>
                        <td className="text-muted">{g.village || "—"}</td>
                        <td className="num">
                          {g.n ? `${kg(g.kg)} kg` : "—"}
                          {g.n > 0 && <div className="text-xs text-muted">{g.n} kali</div>}
                        </td>
                        {money && <td className="num">{g.paid ? rupiah(g.paid) : "—"}</td>}
                        {money && <td className="num text-red-700">{g.bad ? rupiah(g.bad) : ""}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>{q ? "Tidak ada petani yang cocok." : "Belum ada petani mitra."}</Empty>
            )}
          </Card>
          {rows.length === PAGE_SIZE && <p className="mt-3 text-sm text-muted">Menampilkan {PAGE_SIZE} petani pertama. Pakai kotak cari untuk menemukan yang lain.</p>}
        </div>
        <Card title="Tambah petani mitra" className="h-fit">
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
            <p className="text-xs text-muted">Petani baru juga otomatis terdaftar saat namanya pertama kali dicatat di buku induk atau pengambilan benih.</p>
          </form>
        </Card>
      </div>
    </>
  );
}
