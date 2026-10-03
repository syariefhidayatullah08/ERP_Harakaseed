import Image from "next/image";
import { notFound } from "next/navigation";
import { all, get, getSettings } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { num, rupiah, tanggal } from "@/lib/format";
import { PrintButton } from "@/components/buttons";

export const dynamic = "force-dynamic";

export default async function PrintOrder({ params, searchParams }: PageProps<"/cetak/pesanan/[id]">) {
  await requireAccess("penjualan");
  const { id } = await params;
  const sp = await searchParams;
  const deliveryNote = sp.doc === "sj";
  const o = await get<{
    id: number; so_no: string; customer: string; contact_person: string; phone: string; address: string; city: string; order_date: string;
    subtotal: number; discount_pct: number; tax_pct: number; total: number; paid: number; invoice_no: string | null; due_date: string | null;
    shipped_at: string | null; courier: string; tracking_no: string; notes: string;
  }>(
    `SELECT so.*, c.name customer, c.contact_person, c.phone, c.address, c.city FROM sales_orders so
     JOIN customers c ON c.id = so.customer_id WHERE so.id = ?`,
    Number(id),
  );
  if (!o) notFound();
  const items = await all<{ id: number; name: string; crop: string; pack_size: string; qty: number; price: number }>(
    "SELECT i.*, p.name, p.crop, p.pack_size FROM so_items i JOIN products p ON p.id = i.product_id WHERE i.so_id = ?",
    o.id,
  );
  const lots = await all<{ so_item_id: number; lot_no: string; qty: number; expiry_date: string }>(
    `SELECT a.so_item_id, l.lot_no, a.qty, l.expiry_date FROM so_allocations a JOIN lots l ON l.id = a.lot_id
     JOIN so_items i ON i.id = a.so_item_id WHERE i.so_id = ?`,
    o.id,
  );
  const settings = await getSettings();
  const s = (k: string) => settings[k] ?? "";
  const title = deliveryNote ? "SURAT JALAN" : o.invoice_no ? "INVOICE" : "PESANAN PENJUALAN";
  const docNo = deliveryNote ? `SJ/${o.so_no}` : o.invoice_no ?? o.so_no;
  const discount = o.subtotal * (o.discount_pct / 100);
  const tax = (o.subtotal - discount) * (o.tax_pct / 100);

  return (
    <div className="min-h-screen bg-canvas py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 px-4">
        <PrintButton />
      </div>
      <div className="mx-auto max-w-[210mm] bg-white p-10 text-sm shadow-sm print:p-0 print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-brand-700 pb-5">
          <div className="flex gap-3">
            <Image src="/logo-emblem.png" alt="Logo Haraka" width={52} height={53} />
            <div>
              <div className="text-lg font-bold tracking-wider text-brand-800">{s("company_brand")}</div>
              <div className="font-semibold">{s("company_name")}</div>
              <div className="max-w-xs text-xs text-muted">{s("company_address")}</div>
              <div className="text-xs text-muted">
                {s("company_phone")} · {s("company_email")}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-brand-800">{title}</div>
            <div className="font-mono">{docNo}</div>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-semibold uppercase text-muted">{deliveryNote ? "Dikirim kepada" : "Ditagihkan kepada"}</div>
            <div className="mt-1 font-semibold">{o.customer}</div>
            {o.contact_person && <div>u.p. {o.contact_person}</div>}
            <div className="text-muted">{[o.address, o.city].filter(Boolean).join(", ")}</div>
            {o.phone && <div className="text-muted">{o.phone}</div>}
          </div>
          <table className="ml-auto text-sm">
            <tbody>
              <tr>
                <td className="pr-4 text-muted">No. pesanan</td>
                <td className="font-medium">{o.so_no}</td>
              </tr>
              <tr>
                <td className="pr-4 text-muted">Tgl pesanan</td>
                <td>{tanggal(o.order_date)}</td>
              </tr>
              {o.shipped_at && (
                <tr>
                  <td className="pr-4 text-muted">Tgl kirim</td>
                  <td>{tanggal(o.shipped_at)}</td>
                </tr>
              )}
              {!deliveryNote && o.due_date && (
                <tr>
                  <td className="pr-4 text-muted">Jatuh tempo</td>
                  <td className="font-semibold">{tanggal(o.due_date)}</td>
                </tr>
              )}
              {deliveryNote && (
                <tr>
                  <td className="pr-4 text-muted">Kurir / resi</td>
                  <td>
                    {o.courier || "—"} {o.tracking_no && `/ ${o.tracking_no}`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-50 text-left">
              <th className="p-2">No</th>
              <th className="p-2">Produk</th>
              {deliveryNote && <th className="p-2">No. Lot / Kadaluarsa</th>}
              <th className="p-2 text-right">Qty</th>
              {!deliveryNote && <th className="p-2 text-right">Harga</th>}
              {!deliveryNote && <th className="p-2 text-right">Jumlah</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((i, n) => (
              <tr key={i.id} className="border-b border-line align-top">
                <td className="p-2">{n + 1}</td>
                <td className="p-2">
                  <div className="font-semibold">{i.name}</div>
                  <div className="text-xs text-muted">
                    Benih {i.crop} · kemasan {i.pack_size}
                  </div>
                </td>
                {deliveryNote && (
                  <td className="p-2 font-mono text-xs">
                    {lots
                      .filter((l) => l.so_item_id === i.id)
                      .map((l) => (
                        <div key={l.lot_no}>
                          {l.lot_no} ×{l.qty} · ED {tanggal(l.expiry_date)}
                        </div>
                      ))}
                  </td>
                )}
                <td className="p-2 text-right tabular-nums">{num(i.qty)}</td>
                {!deliveryNote && <td className="p-2 text-right tabular-nums">{rupiah(i.price)}</td>}
                {!deliveryNote && <td className="p-2 text-right tabular-nums">{rupiah(i.qty * i.price)}</td>}
              </tr>
            ))}
          </tbody>
        </table>

        {!deliveryNote && (
          <div className="mt-4 flex justify-end">
            <table className="w-72 text-sm">
              <tbody>
                <tr>
                  <td className="py-1 text-muted">Subtotal</td>
                  <td className="py-1 text-right tabular-nums">{rupiah(o.subtotal)}</td>
                </tr>
                {o.discount_pct > 0 && (
                  <tr>
                    <td className="py-1 text-muted">Diskon {o.discount_pct}%</td>
                    <td className="py-1 text-right tabular-nums">− {rupiah(discount)}</td>
                  </tr>
                )}
                {o.tax_pct > 0 && (
                  <tr>
                    <td className="py-1 text-muted">PPN {o.tax_pct}%</td>
                    <td className="py-1 text-right tabular-nums">{rupiah(tax)}</td>
                  </tr>
                )}
                <tr className="border-t border-ink font-bold">
                  <td className="py-1.5">Total</td>
                  <td className="py-1.5 text-right tabular-nums">{rupiah(o.total)}</td>
                </tr>
                {o.invoice_no && (
                  <>
                    <tr>
                      <td className="py-1 text-muted">Dibayar</td>
                      <td className="py-1 text-right tabular-nums">{rupiah(o.paid)}</td>
                    </tr>
                    <tr className="font-semibold">
                      <td className="py-1">Sisa tagihan</td>
                      <td className="py-1 text-right tabular-nums">{rupiah(o.total - o.paid)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!deliveryNote && o.invoice_no && (
          <div className="mt-6 rounded-lg bg-brand-50 p-4 text-sm">
            <div className="font-semibold">Pembayaran ditransfer ke:</div>
            <div>{s("bank_info")}</div>
          </div>
        )}
        {o.notes && <p className="mt-4 text-sm text-muted">Catatan: {o.notes}</p>}

        <div className="mt-14 grid grid-cols-2 gap-10 text-center text-sm">
          <div>
            <div>{deliveryNote ? "Penerima" : "Pelanggan"}</div>
            <div className="mt-16 border-t border-ink pt-1">( ................................ )</div>
          </div>
          <div>
            <div>Hormat kami,</div>
            <div className="mt-16 border-t border-ink pt-1">{s("company_name")}</div>
          </div>
        </div>
        <footer className="mt-10 border-t border-line pt-3 text-center text-xs text-muted">
          {s("company_tagline")} · {s("company_website")}
        </footer>
      </div>
    </div>
  );
}
