import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, MessageCircle, Printer } from "lucide-react";
import { all, get, getSettings } from "@/lib/db";
import { daysUntil, num, paymentStatus, rupiah, SO_STATUS, tanggal, today } from "@/lib/format";
import { Badge, Card, DL, Empty, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { EmailList, type EmailRow } from "@/components/email-list";
import { cancelOrder, confirmOrder, deleteDraft, emailOrderDocument, recordPayment, shipOrder } from "@/actions/sales";
import { productStock } from "@/lib/inventory";
import { orderWhatsappMessages, waLink } from "@/lib/whatsapp";
import { requireAccess } from "@/lib/session";

export default async function OrderDetail({ params, searchParams }: PageProps<"/penjualan/[id]">) {
  await requireAccess("penjualan");
  const { id } = await params;
  const sp = await searchParams;
  const o = await get<{
    id: number; so_no: string; customer_id: number; customer: string; contact_person: string; email: string; phone: string; city: string; address: string;
    order_date: string; status: string; discount_pct: number; tax_pct: number; subtotal: number; total: number; paid: number;
    invoice_no: string | null; due_date: string | null; shipped_at: string | null; courier: string; tracking_no: string; notes: string;
  }>(
    `SELECT so.*, c.name customer, c.contact_person, c.email, c.phone, c.city, c.address FROM sales_orders so
     JOIN customers c ON c.id = so.customer_id WHERE so.id = ?`,
    Number(id),
  );
  if (!o) notFound();

  const items = await all<{ id: number; product_id: number; name: string; crop: string; pack_size: string; qty: number; price: number }>(
    "SELECT i.*, p.name, p.crop, p.pack_size FROM so_items i JOIN products p ON p.id = i.product_id WHERE i.so_id = ?",
    o.id,
  );
  const allocs = await all<{ so_item_id: number; lot_id: number; lot_no: string; qty: number }>(
    `SELECT a.so_item_id, a.lot_id, l.lot_no, a.qty FROM so_allocations a JOIN lots l ON l.id = a.lot_id
     JOIN so_items i ON i.id = a.so_item_id WHERE i.so_id = ?`,
    o.id,
  );
  const payments = await all<{ id: number; pay_date: string; amount: number; method: string; note: string }>(
    "SELECT * FROM payments WHERE so_id = ? ORDER BY pay_date",
    o.id,
  );
  const settings = await getSettings();
  const emails = await all<EmailRow>("SELECT * FROM emails WHERE ref_type IN ('sales_order','invoice') AND ref_id = ? ORDER BY id DESC", o.id);
  const stock = o.status === "dikonfirmasi" ? await productStock() : [];
  const shortages = items
    .map((i) => ({ name: i.name, need: i.qty, have: stock.find((s) => s.id === i.product_id)?.stock ?? 0 }))
    .filter((s) => o.status === "dikonfirmasi" && s.have < s.need);

  const st = SO_STATUS[o.status];
  const ps = paymentStatus(o.total, o.paid);
  const due = o.total - o.paid;
  const discount = o.subtotal * (o.discount_pct / 100);
  const tax = (o.subtotal - discount) * (o.tax_pct / 100);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {o.so_no} <Badge tone={st?.tone}>{st?.label}</Badge>
            {o.invoice_no && o.status !== "batal" && <Badge tone={ps.tone}>{ps.label}</Badge>}
          </span>
        }
        subtitle={`${tanggal(o.order_date)}${o.invoice_no ? ` · Invoice ${o.invoice_no}` : ""}`}
        back={{ href: "/penjualan", label: "Penjualan" }}
        actions={
          <>
            <Link href={`/cetak/pesanan/${o.id}`} target="_blank" className="btn-secondary">
              <Printer size={15} /> {o.invoice_no ? "Invoice" : "Pesanan"}
            </Link>
            {o.shipped_at && (
              <Link href={`/cetak/pesanan/${o.id}?doc=sj`} target="_blank" className="btn-secondary">
                <Printer size={15} /> Surat jalan
              </Link>
            )}
            <a href={`/api/pdf/${o.id}`} target="_blank" className="btn-secondary">
              <FileDown size={15} /> PDF
            </a>
          </>
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Item" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th className="num">Qty</th>
                    <th className="num">Harga</th>
                    <th className="num">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <div className="font-semibold">{i.name}</div>
                        <div className="text-xs text-muted">
                          {i.crop} · {i.pack_size}
                        </div>
                        {allocs
                          .filter((a) => a.so_item_id === i.id)
                          .map((a) => (
                            <Link key={a.lot_id} href={`/inventori/${a.lot_id}`} className="mr-2 inline-block font-mono text-[11px] text-brand-700 hover:underline">
                              Lot {a.lot_no} ×{a.qty}
                            </Link>
                          ))}
                      </td>
                      <td className="num">{num(i.qty)}</td>
                      <td className="num">{rupiah(i.price)}</td>
                      <td className="num font-medium">{rupiah(i.qty * i.price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="text-sm">
                  <tr>
                    <td colSpan={3} className="px-4 py-1.5 text-right text-muted">
                      Subtotal
                    </td>
                    <td className="num px-4 py-1.5">{rupiah(o.subtotal)}</td>
                  </tr>
                  {o.discount_pct > 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-1.5 text-right text-muted">
                        Diskon {o.discount_pct}%
                      </td>
                      <td className="num px-4 py-1.5">− {rupiah(discount)}</td>
                    </tr>
                  )}
                  {o.tax_pct > 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-1.5 text-right text-muted">
                        PPN {o.tax_pct}%
                      </td>
                      <td className="num px-4 py-1.5">{rupiah(tax)}</td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right font-bold">
                      Total
                    </td>
                    <td className="num px-4 py-2 text-base font-bold">{rupiah(o.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {o.notes && <div className="border-t border-line px-5 py-3 text-sm text-muted">Catatan: {o.notes}</div>}
          </Card>

          {o.invoice_no && (
            <Card title="Pembayaran" className="overflow-hidden">
              {payments.length ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Metode</th>
                      <th>Catatan</th>
                      <th className="num">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>{tanggal(p.pay_date)}</td>
                        <td>{p.method}</td>
                        <td className="text-muted">{p.note}</td>
                        <td className="num">{rupiah(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Empty>Belum ada pembayaran.</Empty>
              )}
              {due > 0 && o.status !== "batal" && (
                <form action={recordPayment} className="grid gap-3 border-t border-line p-5 sm:grid-cols-4">
                  <input type="hidden" name="id" value={o.id} />
                  <Field label="Jumlah">
                    <input name="amount" type="number" min={1} max={due} defaultValue={due} required className="input" />
                  </Field>
                  <Field label="Tanggal">
                    <input name="pay_date" type="date" defaultValue={today()} className="input" />
                  </Field>
                  <Field label="Metode">
                    <select name="method" className="input">
                      <option>Transfer</option>
                      <option>Tunai</option>
                      <option>Giro</option>
                      <option>QRIS</option>
                    </select>
                  </Field>
                  <Field label="Catatan">
                    <input name="note" className="input" placeholder="Ref. transfer" />
                  </Field>
                  <label className="flex items-center gap-2 text-sm sm:col-span-3">
                    <input type="checkbox" name="send_receipt" defaultChecked={!!o.email} disabled={!o.email} className="accent-brand-700" />
                    Kirim tanda terima ke {o.email || "(pelanggan tanpa email)"}
                  </label>
                  <SubmitButton>Catat pembayaran</SubmitButton>
                </form>
              )}
            </Card>
          )}

          <Card title="Email terkait pesanan ini">
            <EmailList rows={emails} empty="Belum ada email untuk pesanan ini." />
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Langkah berikutnya">
            <div className="space-y-3 p-5">
              {o.status === "draft" && (
                <>
                  <form action={confirmOrder}>
                    <input type="hidden" name="id" value={o.id} />
                    <SubmitButton className="btn-primary w-full">Konfirmasi pesanan</SubmitButton>
                  </form>
                  <p className="text-xs text-muted">Pelanggan akan menerima email konfirmasi pesanan (bila diaktifkan di Pengaturan).</p>
                  <form action={deleteDraft}>
                    <input type="hidden" name="id" value={o.id} />
                    <SubmitButton className="btn-danger w-full" confirm="Hapus draft ini?">
                      Hapus draft
                    </SubmitButton>
                  </form>
                </>
              )}
              {o.status === "dikonfirmasi" && (
                <form action={shipOrder} className="space-y-3">
                  <input type="hidden" name="id" value={o.id} />
                  {shortages.length > 0 && (
                    <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800">
                      Stok kurang: {shortages.map((s) => `${s.name} (butuh ${s.need}, ada ${s.have})`).join(", ")}
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
                  <SubmitButton className="btn-primary w-full" pendingText="Memproses…">
                    Kirim barang & terbitkan invoice
                  </SubmitButton>
                  <p className="text-xs text-muted">Stok dipotong otomatis per lot (FEFO). Email pengiriman & invoice dikirim ke pelanggan.</p>
                </form>
              )}
              {(o.status === "dikirim" || o.status === "selesai") && (
                <div className="text-sm">
                  <DL
                    items={[
                      ["Dikirim", tanggal(o.shipped_at)],
                      ["Kurir", o.courier || "—"],
                      ["Resi", o.tracking_no || "—"],
                      ["Jatuh tempo", <span key="d">{tanggal(o.due_date)} {due > 0 && o.due_date && daysUntil(o.due_date) < 0 && <Badge tone="red">Telat</Badge>}</span>],
                      ["Sisa tagihan", <b key="s">{rupiah(due)}</b>],
                    ]}
                  />
                </div>
              )}
              {o.status === "batal" && <p className="text-sm text-muted">Pesanan dibatalkan.</p>}
              {["dikonfirmasi", "dikirim"].includes(o.status) && o.paid === 0 && (
                <form action={cancelOrder} className="border-t border-line pt-3">
                  <input type="hidden" name="id" value={o.id} />
                  <SubmitButton className="btn-danger btn-sm w-full" confirm="Batalkan pesanan ini? Stok yang sudah dikirim akan dikembalikan.">
                    Batalkan pesanan
                  </SubmitButton>
                </form>
              )}
            </div>
          </Card>

          {o.status !== "draft" && o.status !== "batal" && (
            <Card title={<span className="flex items-center gap-2"><MessageCircle size={15} className="text-[#25D366]" /> Kirim via WhatsApp</span>}>
              {waLink(o.phone, "x") ? (
                <div className="space-y-2 p-5">
                  {orderWhatsappMessages(o, settings.company_brand ?? "HARAKA SEED", settings.bank_info ?? "").map((m) => (
                    <a key={m.key} href={waLink(o.phone, m.text)} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full justify-start">
                      <MessageCircle size={15} className="text-[#25D366]" /> {m.label}
                    </a>
                  ))}
                  <p className="text-xs text-muted">Membuka WhatsApp ke {o.phone} dengan pesan siap kirim. Invoice & surat jalan berupa tautan PDF yang bisa dibuka pelanggan tanpa login.</p>
                </div>
              ) : (
                <Empty>Isi nomor telepon/WA pelanggan untuk mengirim via WhatsApp.</Empty>
              )}
            </Card>
          )}

          <Card title="Pelanggan">
            <div className="p-5 text-sm">
              <Link href={`/pelanggan/${o.customer_id}`} className="font-semibold text-brand-800 hover:underline">
                {o.customer}
              </Link>
              <div className="mt-1 space-y-0.5 text-muted">
                {o.contact_person && <div>{o.contact_person}</div>}
                <div className={o.email ? "" : "text-amber-700"}>{o.email || "Email belum diisi"}</div>
                {o.phone && <div>{o.phone}</div>}
                <div>{[o.address, o.city].filter(Boolean).join(", ")}</div>
              </div>
            </div>
          </Card>

          {o.status !== "draft" && o.status !== "batal" && (
            <Card title="Kirim dokumen via email">
              <form action={emailOrderDocument} className="space-y-3 p-5">
                <input type="hidden" name="id" value={o.id} />
                <Field label="Dokumen">
                  <select name="kind" className="input" defaultValue={o.invoice_no ? (due > 0 ? "pengingat" : "invoice") : "konfirmasi"}>
                    <option value="konfirmasi">Konfirmasi pesanan</option>
                    {o.shipped_at && <option value="pengiriman">Info pengiriman</option>}
                    {o.invoice_no && <option value="invoice">Invoice</option>}
                    {o.invoice_no && due > 0 && <option value="pengingat">Pengingat pembayaran</option>}
                  </select>
                </Field>
                <Field label="Kepada">
                  <input name="to" type="email" defaultValue={o.email} className="input" placeholder="email@pelanggan.com" />
                </Field>
                <SubmitButton className="btn-secondary w-full" pendingText="Mengirim…">
                  Kirim email
                </SubmitButton>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
