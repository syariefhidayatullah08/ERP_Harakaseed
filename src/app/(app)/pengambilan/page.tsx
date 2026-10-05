import Link from "next/link";
import type { Metadata } from "next";
import { Camera } from "lucide-react";
import { all, get } from "@/lib/db";
import { tanggal, today } from "@/lib/format";
import { Badge, Card, Empty, Flash, PageHeader, StatCard } from "@/components/ui";
import { requireAccess } from "@/lib/session";
import { ExportMenu } from "@/components/export-menu";
import { pickupStatus, type Pickup } from "@/lib/pickup";

export const metadata: Metadata = { title: "Pengambilan Benih" };

const kg = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n || 0);
const PAGE_SIZE = 60;

export default async function PickupsPage({ searchParams }: PageProps<"/pengambilan">) {
  const user = await requireAccess("pengambilan");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const mine = sp.saya === "1";
  const open = sp.status === "belum";
  const month = today().slice(0, 7);

  const where: string[] = [];
  const params: (string | number)[] = [];
  if (q) {
    where.push("(p.farmer ILIKE ? OR p.production_code ILIKE ? OR p.location ILIKE ? OR p.officer_name ILIKE ?)");
    params.push(...Array(4).fill(`%${q}%`));
  }
  if (mine) {
    where.push("p.officer_id = ?");
    params.push(user.id);
  }
  if (open) where.push("p.intake_id IS NULL");
  const rows = await all<Pickup & { photos: number; thumb: number | null }>(
    `SELECT p.*,
       (SELECT COUNT(*) FROM attachments a WHERE a.ref_type = 'pickup' AND a.ref_id = p.id) photos,
       (SELECT MIN(a.id) FROM attachments a WHERE a.ref_type = 'pickup' AND a.ref_id = p.id AND a.content_type LIKE 'image/%' AND a.content_type NOT LIKE '%hei%') thumb
     FROM seed_pickups p ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY p.pickup_date DESC, p.id DESC LIMIT ${PAGE_SIZE}`,
    ...params,
  );
  const stats = (await get<{ kg_month: number; n_month: number; open_n: number; open_kg: number; no_photo: number }>(
    `SELECT COALESCE(SUM(kg) FILTER (WHERE pickup_date >= ?), 0) kg_month, COUNT(*) FILTER (WHERE pickup_date >= ?) n_month,
            COUNT(*) FILTER (WHERE intake_id IS NULL) open_n, COALESCE(SUM(kg) FILTER (WHERE intake_id IS NULL), 0) open_kg,
            COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM attachments a WHERE a.ref_type = 'pickup' AND a.ref_id = seed_pickups.id)) no_photo
     FROM seed_pickups`,
    `${month}-01`,
    `${month}-01`,
  ))!;
  const filterLink = (label: string, href: string, active: boolean) => (
    <Link href={href} className={active ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Pengambilan Benih"
        subtitle="Benih yang diambil petugas produksi dari lahan petani: bobot (kg) dan foto buktinya"
        actions={
          <>
            <ExportMenu type="pengambilan" />
            <Link href="/pengambilan/baru" className="btn-accent">
              + Catat pengambilan
            </Link>
          </>
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Diambil bulan ini" value={`${kg(stats.kg_month)} kg`} hint={`${stats.n_month} pengambilan`} />
        <StatCard label="Belum masuk buku induk" value={`${kg(stats.open_kg)} kg`} hint={`${stats.open_n} pengambilan`} tone={stats.open_n ? "warn" : "default"} href="/pengambilan?status=belum" />
        <StatCard label="Belum ada foto" value={stats.no_photo} hint="Tambahkan foto sebagai bukti" tone={stats.no_photo ? "warn" : "default"} />
        <Link href="/pengambilan/baru" className="card flex flex-col items-center justify-center gap-1 bg-linear-to-br from-accent to-gold p-5 text-center font-semibold text-accent-ink transition hover:-translate-y-0.5">
          <Camera size={22} />
          Catat pengambilan
        </Link>
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Cari petani, kode produksi, lokasi, petugas…" className="input max-w-xs" />
        {mine && <input type="hidden" name="saya" value="1" />}
        {open && <input type="hidden" name="status" value="belum" />}
        <button className="btn-secondary">Cari</button>
        {filterLink("Semua", "/pengambilan", !mine && !open && !q)}
        {filterLink("Catatan saya", "/pengambilan?saya=1", mine)}
        {filterLink("Belum masuk buku induk", "/pengambilan?status=belum", open)}
      </form>

      <Card className="overflow-hidden">
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((p) => {
              const st = pickupStatus(p);
              return (
                <li key={p.id}>
                  <Link href={`/pengambilan/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-50/50 sm:px-5">
                    <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-canvas text-muted">
                      {p.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element -- file privat lewat route ber-auth, bukan aset statis
                        <img src={`/api/files/${p.thumb}`} alt="" loading="lazy" className="size-full object-cover" />
                      ) : (
                        <Camera size={18} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.farmer}</span>
                      <span className="block truncate text-xs text-muted">
                        {[p.production_code, p.location, tanggal(p.pickup_date), p.officer_name].filter(Boolean).join(" · ")}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        <Badge tone={p.photos ? "blue" : "red"}>{p.photos ? `${p.photos} foto` : "Belum ada foto"}</Badge>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-lg font-bold tabular-nums">{kg(p.kg)}</span>
                      <span className="block text-xs text-muted">kg{p.sacks ? ` · ${p.sacks} karung` : ""}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>{q || mine || open ? "Tidak ada pengambilan yang cocok." : "Belum ada pengambilan benih. Tekan “Catat pengambilan” saat mengambil benih di lahan."}</Empty>
        )}
      </Card>
      {rows.length === PAGE_SIZE && <p className="mt-3 text-sm text-muted">Menampilkan {PAGE_SIZE} pengambilan terbaru. Pakai kotak cari atau unduhan untuk melihat yang lebih lama.</p>}
    </>
  );
}
