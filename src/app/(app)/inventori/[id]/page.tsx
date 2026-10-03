import Link from "next/link";
import { notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { daysUntil, num, tanggal } from "@/lib/format";
import { Badge, Card, DL, Empty, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { adjustLot } from "@/actions/inventory";
import { requireAccess } from "@/lib/session";

const KIND: Record<string, string> = { masuk: "green", keluar: "blue", penyesuaian: "amber", retur: "purple" };

export default async function LotDetail({ params, searchParams }: PageProps<"/inventori/[id]">) {
  await requireAccess("inventori");
  const { id } = await params;
  const sp = await searchParams;
  const lot = await get<{
    id: number; lot_no: string; product_id: number; name: string; crop: string; pack_size: string; qty_initial: number; qty_available: number;
    germination: number; purity: number; moisture: number; prod_date: string; expiry_date: string; location: string; production_id: number | null; prd_code: string | null; grower: string | null;
  }>(
    `SELECT l.*, p.name, p.crop, p.pack_size, pr.code prd_code, g.name grower FROM lots l
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

  return (
    <>
      <PageHeader
        title={<span className="font-mono">{lot.lot_no}</span>}
        subtitle={`${lot.name} · ${lot.crop} · ${lot.pack_size}`}
        back={{ href: "/inventori", label: "Inventori" }}
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
        </div>
      </div>
    </>
  );
}
