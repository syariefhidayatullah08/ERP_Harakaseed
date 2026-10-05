import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { rupiah, tanggal } from "@/lib/format";
import { toId } from "@/lib/form";
import { Badge, Card, Empty, Field, Flash, PageHeader, StatCard } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { saveGrower } from "@/actions/production";
import { deleteGrower, linkGrowerRows, mergeGrower } from "@/actions/growers";
import { can, requireAccess } from "@/lib/session";
import { INTAKE_KIND, INTAKE_STATUS } from "@/lib/seed-payment";
import { farmerBase } from "@/lib/growers";

export const metadata: Metadata = { title: "Petani mitra" };

const kg = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n || 0);

export default async function GrowerPage({ params, searchParams }: PageProps<"/mitra/[id]">) {
  const user = await requireAccess("mitra");
  const { id } = await params;
  const sp = await searchParams;
  const g = await get<{ id: number; name: string; village: string; phone: string; area_ha: number }>("SELECT * FROM growers WHERE id = ?", toId(id));
  if (!g) notFound();
  const money = can(user, ["pembayaran_benih", "keuangan"]);
  const openIntake = can(user, "pembayaran_benih");

  const sum = (await get<{ n: number; kg: number; paid: number; unpaid: number; loan: number; bad: number }>(
    `SELECT COUNT(*) n, COALESCE(SUM(net_kg), 0) kg, COALESCE(SUM(amount) FILTER (WHERE status = 'lunas'), 0) paid,
            COALESCE(SUM(amount) FILTER (WHERE status IN ('proses_uji', 'diajukan')), 0) unpaid, COALESCE(SUM(loan), 0) loan, COALESCE(SUM(bad_debt), 0) bad
     FROM seed_intakes WHERE grower_id = ?`,
    g.id,
  ))!;
  const intakes = await all<{ id: number; kind: string; received_date: string | null; production_code: string; location: string; net_kg: number; price: number; loan: number; amount: number; bad_debt: number; status: string }>(
    "SELECT id, kind, received_date, production_code, location, net_kg, price, loan, amount, bad_debt, status FROM seed_intakes WHERE grower_id = ? ORDER BY received_date DESC NULLS LAST, id DESC LIMIT 100",
    g.id,
  );
  const pickups = await all<{ id: number; pickup_date: string; production_code: string; kg: number; officer_name: string; intake_id: number | null }>(
    "SELECT id, pickup_date, production_code, kg, officer_name, intake_id FROM seed_pickups WHERE grower_id = ? ORDER BY pickup_date DESC, id DESC LIMIT 30",
    g.id,
  );
  const batches = await all<{ id: number; code: string; name: string; status: string; plant_date: string; harvest_kg: number | null }>(
    "SELECT pr.id, pr.code, p.name, pr.status, pr.plant_date, pr.harvest_kg FROM productions pr JOIN products p ON p.id = pr.product_id WHERE pr.grower_id = ? ORDER BY pr.id DESC LIMIT 30",
    g.id,
  );
  const byCode = await all<{ code: string; n: number; kg: number }>(
    "SELECT COALESCE(NULLIF(production_code, ''), '(tanpa kode)') code, COUNT(*) n, SUM(net_kg) kg FROM seed_intakes WHERE grower_id = ? GROUP BY 1 ORDER BY 3 DESC LIMIT 12",
    g.id,
  );
  // Baris bernama sama yang belum terhubung (biasanya karena ada beberapa petani bernama sama di desa berbeda).
  const base = farmerBase(g.name);
  const loose = (await all<{ farmer: string; location: string }>("SELECT farmer, location FROM seed_intakes WHERE grower_id IS NULL AND lower(farmer) LIKE ?", `%${base}%`)).filter((r) => farmerBase(r.farmer) === base);
  const looseLocs = [...new Set(loose.map((r) => r.location || "(tanpa lokasi)"))];
  const others = await all<{ id: number; name: string; village: string }>("SELECT id, name, village FROM growers WHERE id <> ? ORDER BY name LIMIT 2000", g.id);
  const hasHistory = sum.n + pickups.length + batches.length > 0;

  return (
    <>
      <PageHeader title={g.name} subtitle={[g.village || "Desa belum diisi", g.phone, g.area_ha ? `${g.area_ha} ha` : ""].filter(Boolean).join(" · ")} back={{ href: "/mitra", label: "Petani Mitra" }} />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Benih masuk" value={`${kg(sum.kg)} kg`} hint={`${sum.n} kali`} />
        {money ? (
          <>
            <StatCard label="Sudah dibayar" value={rupiah(sum.paid)} />
            <StatCard label="Belum dibayar" value={rupiah(sum.unpaid)} tone={sum.unpaid ? "warn" : "default"} />
            <StatCard label="Kredit macet" value={rupiah(sum.bad)} hint={`Total pinjaman ${rupiah(sum.loan)}`} tone={sum.bad ? "danger" : "default"} />
          </>
        ) : (
          <>
            <StatCard label="Pengambilan di lahan" value={pickups.length} />
            <StatCard label="Batch produksi" value={batches.length} />
          </>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title={`Riwayat benih masuk (${sum.n})`} className="overflow-hidden">
            {intakes.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Kode produksi</th>
                      <th className="num">Bobot bersih</th>
                      {money && <th className="num">Harga</th>}
                      {money && <th className="num">Pinjaman</th>}
                      {money && <th className="num">Pembayaran</th>}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intakes.map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap text-muted">{tanggal(r.received_date)}</td>
                        <td>
                          {openIntake ? (
                            <Link href={`/pembayaran-benih/${r.id}`} className="font-medium text-brand-700 hover:underline">
                              {r.production_code || "tanpa kode"}
                            </Link>
                          ) : (
                            r.production_code || "tanpa kode"
                          )}
                          <div className="text-xs text-muted">{[INTAKE_KIND[r.kind], r.location].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td className="num">{kg(r.net_kg)} kg</td>
                        {money && <td className="num">{rupiah(r.price)}</td>}
                        {money && <td className="num">{r.loan ? rupiah(r.loan) : "—"}</td>}
                        {money && (
                          <td className="num font-medium">
                            {rupiah(r.amount)}
                            {r.bad_debt > 0 && <div className="text-xs font-normal text-red-700">macet {rupiah(r.bad_debt)}</div>}
                          </td>
                        )}
                        <td>
                          <Badge tone={INTAKE_STATUS[r.status]?.tone}>{INTAKE_STATUS[r.status]?.label ?? r.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Belum ada benih masuk yang terhubung ke petani ini.</Empty>
            )}
            {sum.n > intakes.length && <p className="border-t border-line px-5 py-3 text-xs text-muted">Menampilkan {intakes.length} baris terbaru dari {sum.n}.</p>}
          </Card>

          {pickups.length > 0 && (
            <Card title={`Pengambilan di lahan (${pickups.length})`} className="overflow-hidden">
              <ul className="divide-y divide-line text-sm">
                {pickups.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span>
                      {can(user, "pengambilan") ? (
                        <Link href={`/pengambilan/${p.id}`} className="font-medium text-brand-700 hover:underline">
                          {tanggal(p.pickup_date)}
                        </Link>
                      ) : (
                        tanggal(p.pickup_date)
                      )}{" "}
                      <span className="text-muted">· {[p.production_code, p.officer_name].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={p.intake_id ? "green" : "amber"}>{p.intake_id ? "Di buku induk" : "Belum masuk"}</Badge>
                      <b className="tabular-nums">{kg(p.kg)} kg</b>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {batches.length > 0 && (
            <Card title={`Batch produksi (${batches.length})`} className="overflow-hidden">
              <ul className="divide-y divide-line text-sm">
                {batches.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span>
                      {can(user, "produksi") ? (
                        <Link href={`/produksi/${b.id}`} className="font-medium text-brand-700 hover:underline">
                          {b.code}
                        </Link>
                      ) : (
                        b.code
                      )}{" "}
                      <span className="text-muted">
                        · {b.name} · tanam {tanggal(b.plant_date)}
                      </span>
                    </span>
                    <span className="text-muted">{b.harvest_kg ? `${kg(b.harvest_kg)} kg` : b.status}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {byCode.length > 0 && (
            <Card title="Per kode produksi" className="overflow-hidden">
              <ul className="divide-y divide-line text-sm">
                {byCode.map((c) => (
                  <li key={c.code} className="flex justify-between px-5 py-2">
                    <span>
                      {c.code} <span className="text-xs text-muted">· {c.n} kali</span>
                    </span>
                    <b className="tabular-nums">{kg(c.kg)} kg</b>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Data petani">
            <form action={saveGrower} className="space-y-3 p-5">
              <input type="hidden" name="id" value={g.id} />
              <Field label="Nama *">
                <input name="name" required defaultValue={g.name} className="input" />
              </Field>
              <Field label="Desa / alamat">
                <input name="village" defaultValue={g.village} className="input" />
              </Field>
              <Field label="Telepon">
                <input name="phone" defaultValue={g.phone} className="input" />
              </Field>
              <Field label="Luas lahan (ha)">
                <input name="area_ha" type="number" step="0.1" min={0} defaultValue={g.area_ha || ""} className="input" />
              </Field>
              <SubmitButton className="btn-secondary w-full">Simpan perubahan</SubmitButton>
            </form>
          </Card>

          <Card title="Hubungkan riwayat dari buku induk">
            <form action={linkGrowerRows} className="space-y-3 p-5 text-sm">
              <input type="hidden" name="id" value={g.id} />
              {loose.length > 0 ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                  Ada <b>{loose.length} baris</b> bernama “{g.name}” yang belum terhubung, di: {looseLocs.slice(0, 8).join(", ")}
                  {looseLocs.length > 8 && ", …"}.
                </p>
              ) : (
                <p className="text-muted">Dipakai bila petani ini tertulis dengan nama lain di buku induk, atau namanya sama dengan petani di desa lain.</p>
              )}
              <Field label="Nama seperti tertulis di buku induk">
                <input name="farmer" defaultValue={g.name} className="input" />
              </Field>
              <Field label="Hanya lokasi (kosongkan = semua lokasi)">
                <input name="location" list="lokasi-lepas" className="input" placeholder="mis. Tlogosari" />
                <datalist id="lokasi-lepas">
                  {looseLocs.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </Field>
              <SubmitButton className="btn-secondary w-full">Hubungkan ke petani ini</SubmitButton>
            </form>
          </Card>

          <Card title="Data ganda">
            <form action={mergeGrower} className="space-y-3 p-5 text-sm">
              <input type="hidden" name="id" value={g.id} />
              <p className="text-muted">Kalau petani ini sama dengan petani lain yang sudah terdaftar, gabungkan: seluruh riwayatnya pindah ke petani tujuan dan data ini dihapus.</p>
              <select name="target_id" required defaultValue="" className="input">
                <option value="" disabled>
                  Pilih petani tujuan…
                </option>
                {others.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.village ? ` — ${o.village}` : ""}
                  </option>
                ))}
              </select>
              <SubmitButton className="btn-secondary w-full" confirm={`Gabungkan ${g.name} ke petani yang dipilih? Data ${g.name} akan dihapus.`}>
                Gabungkan
              </SubmitButton>
            </form>
            {!hasHistory && (
              <form action={deleteGrower} className="flex items-center justify-between gap-3 border-t border-line p-5 text-sm">
                <input type="hidden" name="id" value={g.id} />
                <span className="text-muted">Belum punya riwayat.</span>
                <SubmitButton className="btn-danger" confirm={`Hapus petani ${g.name}?`}>
                  Hapus
                </SubmitButton>
              </form>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
