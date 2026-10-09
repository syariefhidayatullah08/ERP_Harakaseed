import Link from "next/link";
import { notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { daysUntil, num, tanggal } from "@/lib/format";
import { Badge, Card, DL, Empty, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { adjustLot, deleteLot, updateLot } from "@/actions/inventory";
import { packStock } from "@/lib/inventory";
import { requireAccess } from "@/lib/session";
import { Attachments } from "@/components/attachments";

const KIND: Record<string, string> = { masuk: "green", keluar: "blue", penyesuaian: "amber", retur: "purple" };

export default async function LotDetail({ params, searchParams }: PageProps<"/inventori/[id]">) {
  await requireAccess("inventori");
  const { id } = await params;
  const sp = await searchParams;
  const lot = await get<{
    id: number; lot_no: string; product_id: number; name: string; crop: string; pack_size: string; qty_initial: number; qty_available: number;
    germination: number; purity: number; moisture: number; prod_date: string; expiry_date: string; location: string; production_id: number | null; prd_code: string | null; grower: string | null;
  }>(
    `SELECT l.*, p.name, p.crop, pr.code prd_code, g.name grower FROM lots l
     JOIN products p ON p.id = l.product_id
     LEFT JOIN productions pr ON pr.id = l.production_id
     LEFT JOIN growers g ON g.id = pr.grower_id
     WHERE l.id = ?`,
    Number(id),
  );
  if (!lot) notFound();

  const moves = await all<{ id: number; kind: string; qty: number; ref: string; note: string; created_at: string }>(
    "SELECT * FROM stock_moves WHERE lot_id = ? ORDER BY id DESC",
    lot.id,
  );
  const shipments = await all<{ so_id: number; so_no: string; customer: string; city: string; qty: number; shipped_at: string }>(
    `SELECT so.id so_id, so.so_no, c.name customer, c.city, a.qty, so.shipped_at FROM so_allocations a
     JOIN so_items i ON i.id = a.so_item_id JOIN sales_orders so ON so.id = i.so_id JOIN customers c ON c.id = so.customer_id
     WHERE a.lot_id = ? ORDER BY so.shipped_at DESC`,
    lot.id,
  );
  const d = daysUntil(lot.expiry_date);
  const [packs, products, attachments] = await Promise.all([
    packStock(),
    all<{ id: number; name: string; crop: string }>("SELECT id, name, crop FROM products WHERE active = 1 OR id = ? ORDER BY name", lot.product_id),
    get<{ n: number }>("SELECT COUNT(*) n FROM attachments WHERE ref_type = 'lot' AND ref_id = ?", lot.id),
  ]);
  // Varietas/gramasi hanya bisa diganti & lot hanya bisa dihapus selama belum dipakai pesanan.
  const used = shipments.length > 0 || !!(await get("SELECT 1 FROM so_allocations WHERE lot_id = ? LIMIT 1", lot.id));
  const packOptions = products.flatMap((p) => packs.filter((k) => k.product_id === p.id).map((k) => ({ value: `${p.id}|${k.pack_size}`, label: `${p.name} — ${p.crop} · ${k.pack_size}` })));
  const current = `${lot.product_id}|${lot.pack_size}`;
  if (!packOptions.some((o) => o.value === current)) packOptions.unshift({ value: current, label: `${lot.name} — ${lot.crop} · ${lot.pack_size}` });

  return (
    <>
      <PageHeader
        title={<span className="font-mono">{lot.lot_no}</span>}
        subtitle={`${lot.name} · ${lot.crop} · ${lot.pack_size}`}
        back={{ href: "/inventori/varietas", label: "Stok Varietas" }}
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Data lot & mutu">
          <div className="p-5">
            <DL
              items={[
                ["Sisa / awal", `${num(lot.qty_available)} / ${num(lot.qty_initial)} kemasan`],
                ["Daya kecambah", `${lot.germination}%`],
                ["Kemurnian fisik", `${lot.purity}%`],
                ["Kadar air", `${lot.moisture}%`],
                ["Tgl produksi", tanggal(lot.prod_date)],
                [
                  "Kadaluarsa",
                  <span key="e">
                    {tanggal(lot.expiry_date)} {d < 0 ? <Badge tone="red">Kadaluarsa</Badge> : <Badge tone={d <= 90 ? "amber" : "green"}>{d} hari lagi</Badge>}
                  </span>,
                ],
                ["Lokasi", lot.location],
                [
                  "Asal produksi",
                  lot.production_id ? (
                    <Link key="p" href={`/produksi/${lot.production_id}`} className="text-brand-700 hover:underline">
                      {lot.prd_code} {lot.grower && `· ${lot.grower}`}
                    </Link>
                  ) : (
                    "—"
                  ),
                ],
              ]}
            />
          </div>
          <form action={adjustLot} className="space-y-3 border-t border-line p-5">
            <input type="hidden" name="lot_id" value={lot.id} />
            <div className="text-sm font-semibold">Penyesuaian stok</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jumlah (+/−)">
                <input name="delta" type="number" required className="input" placeholder="-5" />
              </Field>
              <Field label="Alasan">
                <input name="reason" required className="input" placeholder="Stock opname, rusak…" />
              </Field>
            </div>
            <SubmitButton className="btn-secondary w-full">Simpan penyesuaian</SubmitButton>
          </form>
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <Card title="Ketertelusuran — dikirim ke" className="overflow-hidden">
            {shipments.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Pesanan</th>
                    <th>Pelanggan</th>
                    <th>Dikirim</th>
                    <th className="num">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((s, i) => (
                    <tr key={i}>
                      <td>
                        <Link href={`/penjualan/${s.so_id}`} className="text-brand-700 hover:underline">
                          {s.so_no}
                        </Link>
                      </td>
                      <td>
                        {s.customer} <span className="text-xs text-muted">· {s.city}</span>
                      </td>
                      <td className="text-muted">{tanggal(s.shipped_at)}</td>
                      <td className="num">{num(s.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>Lot ini belum dikirim ke pelanggan.</Empty>
            )}
          </Card>
          <Card title="Riwayat pergerakan stok" className="overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Jenis</th>
                  <th>Referensi</th>
                  <th>Keterangan</th>
                  <th className="num">Qty</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap text-muted">{tanggal(m.created_at)}</td>
                    <td>
                      <Badge tone={KIND[m.kind]}>{m.kind}</Badge>
                    </td>
                    <td className="font-mono text-xs">{m.ref}</td>
                    <td className="text-muted">{m.note}</td>
                    <td className={`num font-medium ${m.qty < 0 ? "text-red-700" : "text-brand-700"}`}>
                      {m.qty > 0 ? "+" : ""}
                      {num(m.qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Attachments refType="lot" refId={lot.id} title="Dokumen mutu & bukti" />
        </div>
      </div>

      <Card title="Ubah data lot" className="mt-5 scroll-mt-6">
        <form id="ubah" action={updateLot} className="grid scroll-mt-6 gap-4 p-5 sm:grid-cols-4">
          <input type="hidden" name="lot_id" value={lot.id} />
          <Field label="No. lot *">
            <input name="lot_no" required defaultValue={lot.lot_no} className="input font-mono uppercase" />
          </Field>
          <Field label={used ? "Varietas & gramasi (terkunci: sudah dipakai pesanan)" : "Varietas & gramasi"} className="sm:col-span-3">
            <select name="product_pack" defaultValue={current} disabled={used} className="input">
              {packOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Daya kecambah (%)">
            <input name="germination" type="number" step="0.1" min={0} max={100} defaultValue={lot.germination} className="input" />
          </Field>
          <Field label="Kemurnian fisik (%)">
            <input name="purity" type="number" step="0.1" min={0} max={100} defaultValue={lot.purity} className="input" />
          </Field>
          <Field label="Kadar air (%)">
            <input name="moisture" type="number" step="0.1" min={0} max={100} defaultValue={lot.moisture} className="input" />
          </Field>
          <Field label="Lokasi gudang">
            <input name="location" defaultValue={lot.location} className="input" />
          </Field>
          <Field label="Tanggal produksi/kemas *">
            <input name="prod_date" type="date" required defaultValue={lot.prod_date} className="input" />
          </Field>
          <Field label="Kadaluarsa *">
            <input name="expiry_date" type="date" required defaultValue={lot.expiry_date} className="input" />
          </Field>
          <p className="self-end text-xs text-muted sm:col-span-2">Jumlah stok diubah lewat Penyesuaian stok di atas, supaya tercatat di riwayat.</p>
          <div className="flex justify-end sm:col-span-4">
            <SubmitButton>Simpan perubahan</SubmitButton>
          </div>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-5 text-sm">
          <span className="text-muted">
            {used
              ? "Lot ini sudah dipakai pesanan/pengiriman, jadi tidak bisa dihapus (jejak telusur ke pelanggan harus tetap ada). Gunakan Penyesuaian stok untuk menghabiskannya."
              : attachments?.n
                ? "Hapus dulu dokumen yang terlampir di lot ini sebelum menghapus lot."
                : "Hapus lot ini bila salah input. Riwayat stok lot ikut terhapus."}
          </span>
          {!used && !attachments?.n && (
            <form action={deleteLot}>
              <input type="hidden" name="lot_id" value={lot.id} />
              <SubmitButton className="btn-danger" confirm={`Hapus lot ${lot.lot_no} (sisa ${lot.qty_available} kemasan)? Tidak bisa dibatalkan.`}>
                Hapus lot
              </SubmitButton>
            </form>
          )}
        </div>
      </Card>
    </>
  );
}
