import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, Printer } from "lucide-react";
import { all, get } from "@/lib/db";
import { toId } from "@/lib/form";
import { num, SO_STATUS, tanggal, today } from "@/lib/format";
import { productStock } from "@/lib/inventory";
import { Badge, Card, DL, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { Attachments } from "@/components/attachments";
import { shipOrder } from "@/actions/sales";
import { requireAccess } from "@/lib/session";

export default async function ShippingDetail({ params, searchParams }: PageProps<"/pengiriman/[id]">) {
  await requireAccess("pengiriman");
  const { id } = await params;
  const sp = await searchParams;
  const o = await get<{
    id: number; so_no: string; status: string; order_date: string; shipped_at: string | null; courier: string; tracking_no: string; notes: string;
    customer: string; contact_person: string; phone: string; address: string; city: string;
  }>(
    `SELECT so.id, so.so_no, so.status, so.order_date, so.shipped_at, so.courier, so.tracking_no, so.notes,
            c.name customer, c.contact_person, c.phone, c.address, c.city
     FROM sales_orders so JOIN customers c ON c.id = so.customer_id WHERE so.id = ?`,
    toId(id),
  );
  if (!o || o.status === "draft") notFound();
  const items = await all<{ id: number; product_id: number; name: string; crop: string; pack_size: string; qty: number }>(
    "SELECT i.id, i.product_id, i.qty, p.name, p.crop, p.pack_size FROM so_items i JOIN products p ON p.id = i.product_id WHERE i.so_id = ? ORDER BY i.id",
    o.id,
  );
  const lots = await all<{ so_item_id: number; lot_id: number; lot_no: string; qty: number; expiry_date: string }>(
    `SELECT a.so_item_id, a.lot_id, l.lot_no, a.qty, l.expiry_date FROM so_allocations a JOIN lots l ON l.id = a.lot_id
     JOIN so_items i ON i.id = a.so_item_id WHERE i.so_id = ? ORDER BY a.id`,
    o.id,
  );
  const stock = new Map((await productStock()).map((p) => [p.id, p.stock]));
  const shortages = o.status === "dikonfirmasi" ? items.filter((i) => (stock.get(i.product_id) ?? 0) < i.qty) : [];

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {o.so_no} <Badge tone={SO_STATUS[o.status]?.tone}>{SO_STATUS[o.status]?.label}</Badge>
          </span>
        }
        subtitle={`Dipesan ${tanggal(o.order_date)}`}
        back={{ href: "/pengiriman", label: "Pengiriman" }}
        actions={
          o.shipped_at && (
            <>
              <Link href={`/cetak/pesanan/${o.id}?doc=sj`} target="_blank" className="btn-secondary">
                <Printer size={15} /> Cetak surat jalan
              </Link>
              <a href={`/api/pdf/${o.id}?doc=sj`} target="_blank" className="btn-secondary">
                <FileDown size={15} /> PDF
              </a>
            </>
          )
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Barang yang dikirim" className="overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th className="num">Qty</th>
                  <th>{o.shipped_at ? "Lot dikirim" : "Stok gudang"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const have = stock.get(i.product_id) ?? 0;
                  return (
                    <tr key={i.id}>
                      <td>
                        <div className="font-semibold">{i.name}</div>
                        <div className="text-xs text-muted">
                          {i.crop}
                          {i.pack_size && ` · ${i.pack_size}`}
                        </div>
                      </td>
                      <td className="num font-medium">{num(i.qty)}</td>
                      <td className="text-xs">
                        {o.shipped_at ? (
                          lots
                            .filter((l) => l.so_item_id === i.id)
                            .map((l) => (
                              <div key={l.lot_id} className="font-mono">
                                {l.lot_no} × {num(l.qty)} <span className="text-muted">· ED {tanggal(l.expiry_date)}</span>
                              </div>
                            ))
                        ) : (
                          <span className={have < i.qty ? "font-semibold text-red-700" : "text-muted"}>{num(have)} tersedia</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {o.notes && <div className="border-t border-line px-5 py-3 text-sm text-muted">Catatan: {o.notes}</div>}
          </Card>
          <Attachments refType="sales_order" refId={o.id} title="Bukti pengiriman (surat jalan ditandatangani, foto packing)" />
        </div>

        <div className="space-y-5">
          <Card title="Alamat tujuan">
            <div className="space-y-0.5 p-5 text-sm">
              <div className="font-semibold">{o.customer}</div>
              {o.contact_person && <div>u.p. {o.contact_person}</div>}
              {o.phone && <div className="text-muted">{o.phone}</div>}
              <div className="text-muted">{[o.address, o.city].filter(Boolean).join(", ") || "Alamat belum diisi"}</div>
            </div>
          </Card>
          <Card title={o.status === "dikonfirmasi" ? "Kirim barang" : "Info pengiriman"}>
            <div className="p-5">
              {o.status === "dikonfirmasi" ? (
                <form action={shipOrder} className="space-y-3">
                  <input type="hidden" name="id" value={o.id} />
                  {shortages.length > 0 && (
                    <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800">
                      Stok kurang: {shortages.map((s) => `${s.name} (butuh ${s.qty}, ada ${stock.get(s.product_id) ?? 0})`).join(", ")}
                    </div>
                  )}
                  <Field label="Tanggal kirim">
                    <input name="shipped_at" type="date" defaultValue={today()} className="input" />
                  </Field>
                  <Field label="Kurir / ekspedisi">
                    <input name="courier" className="input" placeholder="JNE, J&T Cargo, Indah Cargo…" />
                  </Field>
                  <Field label="No. resi">
                    <input name="tracking_no" className="input" />
                  </Field>
                  <SubmitButton className="btn-primary w-full" pendingText="Memproses…" confirm="Kirim barang sekarang? Stok akan dipotong per lot.">
                    Barang sudah dikirim
                  </SubmitButton>
                  <p className="text-xs text-muted">Stok dipotong otomatis dari lot yang paling dekat kadaluarsa (FEFO). Pelanggan menerima email info pengiriman.</p>
                </form>
              ) : (
                <DL
                  items={[
                    ["Dikirim", tanggal(o.shipped_at)],
                    ["Kurir", o.courier || "—"],
                    ["Resi", o.tracking_no || "—"],
                  ]}
                />
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
