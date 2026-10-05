import Link from "next/link";
import type { Metadata } from "next";
import { all } from "@/lib/db";
import { addDays, num, tanggal, today } from "@/lib/format";
import { packKey, stockByPack } from "@/lib/inventory";
import { CHANNELS, toChannel } from "@/lib/sales-channel";
import { Badge, Card, Empty, Flash, PageHeader, StatCard } from "@/components/ui";
import { requireAccess } from "@/lib/session";
import { ExportMenu } from "@/components/export-menu";

export const metadata: Metadata = { title: "Pengiriman" };

type Order = { id: number; so_no: string; channel: string; customer: string; city: string; order_date: string; shipped_at: string | null; courier: string; tracking_no: string; status: string };
type Item = { id: number; so_id: number; product_id: number; name: string; pack_size: string; qty: number };

export default async function ShippingPage({ searchParams }: PageProps<"/pengiriman">) {
  await requireAccess("pengiriman");
  const sp = await searchParams;
  const history = sp.tab === "riwayat";
  const orders = await all<Order>(
    `SELECT so.id, so.so_no, so.channel, so.order_date, so.shipped_at, so.courier, so.tracking_no, so.status, c.name customer, c.city
     FROM sales_orders so JOIN customers c ON c.id = so.customer_id
     WHERE ${history ? "so.status IN ('dikirim','selesai') AND so.shipped_at >= ?" : "so.status = 'dikonfirmasi' AND ? <> ''"}
     ORDER BY ${history ? "so.shipped_at DESC" : "so.order_date"} LIMIT 200`,
    addDays(today(), -90),
  );
  const items = orders.length
    ? await all<Item>(
        `SELECT i.id, i.so_id, i.product_id, p.name, i.pack_size, i.qty FROM so_items i JOIN products p ON p.id = i.product_id
         WHERE i.so_id = ANY(?::int[]) ORDER BY i.id`,
        `{${orders.map((o) => o.id).join(",")}}`,
      )
    : [];
  // Hanya penjualan kemasan yang menunggu stok lot; bulky & label selalu siap dikirim.
  const stock = await stockByPack();
  const ready = (o: Order) =>
    toChannel(o.channel) !== "kemasan" || items.filter((i) => i.so_id === o.id).every((i) => (stock.get(packKey(i.product_id, i.pack_size)) ?? 0) >= i.qty);
  const unit = (o: Order) => CHANNELS[toChannel(o.channel)].unit;
  const pending = history ? [] : orders;

  return (
    <>
      <PageHeader title="Pengiriman" subtitle="Pesanan yang sudah dikonfirmasi Marketing dan siap disiapkan gudang" actions={<ExportMenu type="pengiriman" />} />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      {!history && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard label="Perlu dikirim" value={pending.length} />
          <StatCard label="Stok cukup" value={pending.filter((o) => ready(o)).length} />
          <StatCard label="Stok kurang" value={pending.filter((o) => !ready(o)).length} tone={pending.some((o) => !ready(o)) ? "danger" : "default"} />
        </div>
      )}
      <div className="mb-4 flex gap-1 border-b border-line">
        {[
          ["", "Perlu dikirim"],
          ["riwayat", "Riwayat 90 hari"],
        ].map(([k, label]) => (
          <Link
            key={k}
            href={k ? `/pengiriman?tab=${k}` : "/pengiriman"}
            className={`border-b-2 px-3 py-2 text-sm ${(k === "riwayat") === history ? "border-brand-700 font-semibold text-brand-800" : "border-transparent text-muted hover:text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      <Card className="overflow-hidden">
        {orders.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Pesanan</th>
                  <th>Tujuan</th>
                  <th>Barang</th>
                  <th>{history ? "Dikirim" : "Status stok"}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/pengiriman/${o.id}`} className="font-medium text-brand-700 hover:underline">
                        {o.so_no}
                      </Link>
                      <div className="text-xs text-muted">Dipesan {tanggal(o.order_date)}</div>
                    </td>
                    <td>
                      {o.customer}
                      <div className="text-xs text-muted">{o.city}</div>
                    </td>
                    <td className="text-xs">
                      {items
                        .filter((i) => i.so_id === o.id)
                        .map((i) => (
                          <div key={i.id}>
                            {i.name} {i.pack_size} <span className="text-muted">× {num(i.qty)} {unit(o)}</span>
                          </div>
                        ))}
                    </td>
                    <td className="whitespace-nowrap text-xs">
                      {history ? (
                        <>
                          {tanggal(o.shipped_at)}
                          <div className="text-muted">
                            {o.courier || "—"} {o.tracking_no && `· ${o.tracking_no}`}
                          </div>
                        </>
                      ) : ready(o) ? (
                        <Badge tone="green">Siap kirim</Badge>
                      ) : (
                        <Badge tone="red">Stok kurang</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{history ? "Belum ada pengiriman dalam 90 hari terakhir." : "Tidak ada pesanan yang perlu dikirim."}</Empty>
        )}
      </Card>
    </>
  );
}
