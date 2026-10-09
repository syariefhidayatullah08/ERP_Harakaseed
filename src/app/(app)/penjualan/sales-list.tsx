import Link from "next/link";
import { all } from "@/lib/db";
import { paymentStatus, rupiah, SO_STATUS, tanggal } from "@/lib/format";
import { Badge, Card, Empty, Flash, PageHeader } from "@/components/ui";
import { can, requireAccess } from "@/lib/session";
import { ExportMenu } from "@/components/export-menu";
import { SubmitButton } from "@/components/buttons";
import { deleteOrder } from "@/actions/sales";
import { CHANNELS, CHANNEL_KEYS, toChannel, type Channel } from "@/lib/sales-channel";

type Item = { so_id: number; name: string; pack_size: string; qty: number };
const MAX_ITEMS = 3;
const qtyFmt = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);

type Row = { id: number; so_no: string; channel: string; customer: string; city: string; order_date: string; status: string; total: number; paid: number; invoice_no: string | null };

type Search = Promise<Record<string, string | string[] | undefined>>;

/** Daftar pesanan; `channel` kosong = semua jenis penjualan. */
export async function SalesList({ channel, searchParams }: { channel?: Channel; searchParams: Search }) {
  const user = await requireAccess(["penjualan", "keuangan"]);
  const finance = can(user, "keuangan");
  const sales = can(user, "penjualan");
  const sp = await searchParams;
  const status = String(sp.status ?? "");
  const q = String(sp.q ?? "").trim();
  const base = channel ? `/penjualan/${channel}` : "/penjualan";
  const ch = channel ?? "";

  const rows = await all<Row>(
    `SELECT so.*, c.name customer, c.city FROM sales_orders so JOIN customers c ON c.id = so.customer_id
     WHERE (? = '' OR so.channel = ?) AND (? = '' OR so.status = ?)
       AND (so.so_no ILIKE ? OR c.name ILIKE ? OR COALESCE(so.invoice_no,'') ILIKE ?
            OR EXISTS (SELECT 1 FROM so_items i LEFT JOIN products p ON p.id = i.product_id
                       WHERE i.so_id = so.id AND (i.item_name ILIKE ? OR p.name ILIKE ?)))
     ORDER BY so.order_date DESC, so.id DESC LIMIT 300`,
    ch, ch, status, status, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`,
  );
  // Varietas yang dibeli di tiap pesanan (nama ketik manual didahulukan, lalu nama produk).
  const items = rows.length
    ? await all<Item>(
        `SELECT i.so_id, COALESCE(NULLIF(i.item_name, ''), p.name, '') name, i.pack_size, i.qty FROM so_items i
         LEFT JOIN products p ON p.id = i.product_id WHERE i.so_id = ANY(?::int[]) ORDER BY i.so_id, i.id`,
        `{${rows.map((r) => r.id).join(",")}}`,
      )
    : [];
  const itemsOf = new Map<number, Item[]>();
  for (const it of items) itemsOf.set(it.so_id, [...(itemsOf.get(it.so_id) ?? []), it]);
  const counts = await all<{ status: string; n: number }>("SELECT status, COUNT(*) n FROM sales_orders WHERE (? = '' OR channel = ?) GROUP BY status", ch, ch);
  const count = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;

  const tab = (st: string, label: string, n?: number) => (
    <Link
      key={st || "all"}
      href={st ? `${base}?status=${st}` : base}
      className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${status === st ? "border-brand-700 font-semibold text-brand-800" : "border-transparent text-muted hover:text-ink"}`}
    >
      {label} {n !== undefined && <span className="ml-1 rounded-full bg-canvas px-1.5 text-xs">{n}</span>}
    </Link>
  );
  const chip = (href: string, label: string, active: boolean) => (
    <Link key={href} href={href} className={`rounded-full px-3 py-1 text-xs font-medium ${active ? "bg-brand-700 text-white" : "bg-canvas text-muted hover:text-ink"}`}>
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader
        title={channel ? CHANNELS[channel].title : "Penjualan"}
        subtitle={channel ? CHANNELS[channel].hint : finance ? "Semua jenis penjualan. Piutang & pembayaran ada di menu Keuangan." : "Semua jenis penjualan dan status pengirimannya"}
        actions={
          <>
            <ExportMenu type="pesanan" />
            {can(user, "penjualan") && (
              <Link href={`/penjualan/baru?jenis=${channel ?? "kemasan"}`} className="btn-accent">
                + Pesanan {channel ? CHANNELS[channel].label.toLowerCase() : "baru"}
              </Link>
            )}
          </>
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />

      <div className="mb-3 flex flex-wrap gap-2">
        {chip("/penjualan", "Semua jenis", !channel)}
        {CHANNEL_KEYS.map((k) => chip(`/penjualan/${k}`, CHANNELS[k].label, channel === k))}
      </div>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {tab("", "Semua")}
        {tab("draft", "Draft", count("draft"))}
        {tab("dikonfirmasi", "Perlu dikirim", count("dikonfirmasi"))}
        {tab("dikirim", "Dikirim", count("dikirim"))}
        {tab("selesai", "Selesai", count("selesai"))}
        {tab("batal", "Batal", count("batal"))}
      </div>

      <form className="mb-4 flex gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Cari no. pesanan, pelanggan, varietas…" className="input max-w-sm" />
        <button className="btn-secondary">Cari</button>
      </form>
      <Card className="overflow-hidden">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>No. Pesanan</th>
                  {!channel && <th>Jenis</th>}
                  <th>Pelanggan</th>
                  <th>Varietas</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  {finance && <th>Pembayaran</th>}
                  <th className="num">Total</th>
                  {sales && <th />}
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const ps = paymentStatus(o.total, o.paid);
                  return (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/penjualan/${o.id}`} className="whitespace-nowrap font-medium text-brand-700 hover:underline">
                          {o.so_no}
                        </Link>
                        {finance && o.invoice_no && <div className="text-xs text-muted">{o.invoice_no}</div>}
                      </td>
                      {!channel && <td>{CHANNELS[toChannel(o.channel)].label}</td>}
                      <td>
                        {o.customer} <div className="text-xs text-muted">{o.city}</div>
                      </td>
                      <td className="min-w-48 text-sm">
                        {(() => {
                          const list = itemsOf.get(o.id) ?? [];
                          if (!list.length) return <span className="text-xs text-muted">—</span>;
                          const unit = CHANNELS[toChannel(o.channel)].short;
                          return (
                            <ul className="space-y-0.5">
                              {list.slice(0, MAX_ITEMS).map((it, i) => (
                                <li key={i} className="leading-tight">
                                  <span className="font-medium">{it.name || "—"}</span>
                                  <span className="text-xs text-muted">
                                    {it.pack_size ? ` · ${it.pack_size}` : ""} · {qtyFmt(it.qty)} {unit}
                                  </span>
                                </li>
                              ))}
                              {list.length > MAX_ITEMS && <li className="text-xs text-muted">+{list.length - MAX_ITEMS} varietas lain</li>}
                            </ul>
                          );
                        })()}
                      </td>
                      <td className="whitespace-nowrap text-muted">{tanggal(o.order_date)}</td>
                      <td>
                        <Badge tone={SO_STATUS[o.status]?.tone}>{SO_STATUS[o.status]?.label}</Badge>
                      </td>
                      {finance && (
                        <td>{o.invoice_no && o.status !== "batal" ? <Badge tone={ps.tone}>{ps.label}</Badge> : <span className="text-xs text-muted">—</span>}</td>
                      )}
                      <td className="num font-medium">{rupiah(o.total)}</td>
                      {sales && (
                        <td>
                          {/* Ubah hanya sebelum dikirim; hapus pesanan terkirim/dibayar hanya Founder (lihat actions/sales.ts). */}
                          <div className="flex justify-end gap-1.5">
                            {["draft", "dikonfirmasi"].includes(o.status) && (
                              <Link href={`/penjualan/${o.id}/ubah`} className="btn-secondary btn-sm">
                                Ubah
                              </Link>
                            )}
                            {(!(["dikirim", "selesai"].includes(o.status) || o.paid > 0) || user.role === "owner") && (
                              <form action={deleteOrder}>
                                <input type="hidden" name="id" value={o.id} />
                                <SubmitButton
                                  className="btn-danger btn-sm"
                                  confirm={`Hapus pesanan ${o.so_no} (${o.customer})?${["dikirim", "selesai"].includes(o.status) ? " Stok yang terpotong dikembalikan." : ""}${o.paid > 0 ? " Pembayaran dan baris Buku Kas-nya ikut terhapus." : ""} Tindakan ini tidak bisa dibatalkan.`}
                                >
                                  Hapus
                                </SubmitButton>
                              </form>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Belum ada pesanan{channel ? ` ${CHANNELS[channel].label.toLowerCase()}` : ""}.</Empty>
        )}
      </Card>
    </>
  );
}
