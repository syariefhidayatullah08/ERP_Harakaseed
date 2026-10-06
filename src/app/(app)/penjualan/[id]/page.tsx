import { toId } from "@/lib/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, MessageCircle, Printer } from "lucide-react";
import { all, get, getSettings } from "@/lib/db";
import { daysUntil, num, paymentStatus, rupiah, SO_STATUS, tanggal, today } from "@/lib/format";
import { Badge, Card, DL, Empty, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { EmailList, type EmailRow } from "@/components/email-list";
import { cancelOrder, confirmOrder, deleteOrder, emailOrderDocument, recordPayment, shipOrder, updateInvoiceNo } from "@/actions/sales";
import { nextInvoiceNumber } from "@/lib/invoice-doc";
import { packKey, stockByPack } from "@/lib/inventory";
import { CHANNELS, ITEM_LABEL_SQL, ITEM_PACK_SQL, toChannel } from "@/lib/sales-channel";
import { orderWhatsappMessages, waLink } from "@/lib/whatsapp";
import { can, requireAccess } from "@/lib/session";
import { Attachments } from "@/components/attachments";

export default async function OrderDetail({ params, searchParams }: PageProps<"/penjualan/[id]">) {
  const user = await requireAccess(["penjualan", "keuangan"]);
  const finance = can(user, "keuangan");
  const sales = can(user, "penjualan");
  const { id } = await params;
  const sp = await searchParams;
  const o = await get<{
    id: number; so_no: string; channel: string; customer_id: number; customer: string; contact_person: string; email: string; phone: string; city: string; address: string;
    order_date: string; status: string; discount_pct: number; tax_pct: number; subtotal: number; total: number; paid: number;
    invoice_no: string | null; due_date: string | null; shipped_at: string | null; courier: string; tracking_no: string; notes: string; invoice_manual: string;
  }>(
    `SELECT so.*, c.name customer, c.contact_person, c.email, c.phone, c.city, c.address FROM sales_orders so
     JOIN customers c ON c.id = so.customer_id WHERE so.id = ?`,
    toId(id),
  );
  if (!o) notFound();

  const channel = toChannel(o.channel);
  const ch = CHANNELS[channel];
  // Perkiraan nomor otomatis untuk petunjuk di form kirim barang.
  const autoInvoice = o.status === "dikonfirmasi" ? await nextInvoiceNumber(today(), o.channel) : "";
  const items = await all<{ id: number; product_id: number; name: string; crop: string; pack: string; pack_size: string; qty: number; price: number; item_code: string }>(
    `SELECT i.id, i.product_id, i.qty, i.price, i.pack_size pack, ${ITEM_LABEL_SQL} name, COALESCE(p.crop, '') crop, i.item_code, ${ITEM_PACK_SQL} FROM so_items i LEFT JOIN products p ON p.id = i.product_id WHERE i.so_id = ? ORDER BY i.id`,
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
  // Email invoice/pengingat berisi tagihan → hanya untuk keuangan.
  const emails = await all<EmailRow>(
    `SELECT * FROM emails WHERE ref_type IN ${finance ? "('sales_order','invoice')" : "('sales_order')"} AND ref_id = ? ORDER BY id DESC`,
    o.id,
  );
  // Hanya penjualan kemasan yang memotong stok lot (per varietas + gramasi).
  const checkStock = channel === "kemasan" && o.status === "dikonfirmasi";
  const stock = checkStock ? await stockByPack() : new Map<string, number>();
  const shortages = items
    .map((i) => ({ name: `${i.name} ${i.pack}`.trim(), need: i.qty, have: stock.get(packKey(i.product_id, i.pack)) ?? 0 }))
    .filter((s) => checkStock && s.have < s.need);

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
            {o.so_no} <Badge tone="brand">{ch.label}</Badge> <Badge tone={st?.tone}>{st?.label}</Badge>
            {finance && o.invoice_no && o.status !== "batal" && <Badge tone={ps.tone}>{ps.label}</Badge>}
          </span>
        }
        subtitle={`${tanggal(o.order_date)}${finance && o.invoice_no ? ` · Invoice ${o.invoice_no}` : ""}`}
        back={sales ? { href: `/penjualan/${channel}`, label: ch.title } : { href: "/keuangan", label: "Keuangan" }}
        actions={
          <>
            {(finance || !o.invoice_no) && (
              <Link href={`/cetak/pesanan/${o.id}`} target="_blank" className="btn-secondary">
                <Printer size={15} /> {o.invoice_no ? "Invoice" : "Pesanan"}
              </Link>
            )}
            {o.shipped_at && (
              <Link href={`/cetak/pesanan/${o.id}?doc=sj`} target="_blank" className="btn-secondary">
                <Printer size={15} /> Surat jalan
              </Link>
            )}
            {finance && o.invoice_no && (
              <>
                <a href={`/api/pdf/${o.id}`} target="_blank" className="btn-accent">
                  <FileDown size={15} /> Invoice PDF
                </a>
                <a href={`/api/pdf/${o.id}?format=docx`} className="btn-secondary">
                  <FileDown size={15} /> Invoice Word
                </a>
              </>
            )}
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
                    <th className="num">Qty ({ch.unit})</th>
                    <th className="num">Harga / {ch.unit}</th>
                    <th className="num">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <div className="font-semibold">{i.name}</div>
                        <div className="text-xs text-muted">
                          {[i.item_code, i.crop, i.pack_size].filter(Boolean).join(" · ")}
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

          {finance && o.invoice_no && (
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

          <Attachments refType="sales_order" refId={o.id} title="Bukti & lampiran pesanan" />
        </div>

        <div className="space-y-5">
          <Card title="Langkah berikutnya">
            <div className="space-y-3 p-5">
              {sales && o.status === "draft" && (
                <>
                  <form action={confirmOrder}>
                    <input type="hidden" name="id" value={o.id} />
                    <SubmitButton className="btn-primary w-full">Konfirmasi pesanan</SubmitButton>
                  </form>
                  <p className="text-xs text-muted">Pelanggan akan menerima email konfirmasi pesanan (bila diaktifkan di Pengaturan).</p>
                </>
              )}
              {sales && ["draft", "dikonfirmasi"].includes(o.status) && (
                <Link href={`/penjualan/${o.id}/ubah`} className="btn-secondary w-full">
                  Ubah pesanan
                </Link>
              )}
              {o.status === "dikonfirmasi" && !can(user, "pengiriman") && (
                <p className="text-sm text-muted">Pesanan sudah dikonfirmasi dan menunggu divisi Warehouse untuk dikirim.</p>
              )}
              {o.status === "dikonfirmasi" && can(user, "pengiriman") && (
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
                  <Field label="No. invoice">
                    <input name="invoice_no" defaultValue={o.invoice_manual} autoComplete="off" className="input" placeholder={`Kosongkan = otomatis (${autoInvoice})`} />
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
                      ...(finance
                        ? ([
                            ["Jatuh tempo", <span key="d">{tanggal(o.due_date)} {due > 0 && o.due_date && daysUntil(o.due_date) < 0 && <Badge tone="red">Telat</Badge>}</span>],
                            ["Sisa tagihan", <b key="s">{rupiah(due)}</b>],
                          ] as [string, React.ReactNode][])
                        : []),
                    ]}
                  />
                  {o.invoice_no && (finance || sales) && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-brand-700">Ubah no. invoice ({o.invoice_no})</summary>
                      <form action={updateInvoiceNo} className="mt-2 flex items-end gap-2">
                        <input type="hidden" name="id" value={o.id} />
                        <Field label="No. invoice" className="flex-1">
                          <input name="invoice_no" required defaultValue={o.invoice_no} autoComplete="off" className="input" />
                        </Field>
                        <SubmitButton className="btn-secondary">Simpan</SubmitButton>
                      </form>
                    </details>
                  )}
                </div>
              )}
              {o.status === "batal" && <p className="text-sm text-muted">Pesanan dibatalkan.</p>}
              {/* Hapus: salah input. Pesanan yang sudah dikirim / dibayar hanya oleh Founder (stok & kas ikut dikembalikan). */}
              {sales && (!(["dikirim", "selesai"].includes(o.status) || o.paid > 0) || user.role === "owner") && (
                <form action={deleteOrder} className="border-t border-line pt-3">
                  <input type="hidden" name="id" value={o.id} />
                  <SubmitButton
                    className="btn-danger btn-sm w-full"
                    confirm={`Hapus pesanan ${o.so_no}?${["dikirim", "selesai"].includes(o.status) ? " Stok yang terpotong dikembalikan." : ""}${o.paid > 0 ? " Pembayaran dan baris Buku Kas-nya ikut terhapus." : ""} Tindakan ini tidak bisa dibatalkan.`}
                  >
                    Hapus pesanan
                  </SubmitButton>
                </form>
              )}
              {sales && ["dikonfirmasi", "dikirim"].includes(o.status) && o.paid === 0 && (
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
                  {orderWhatsappMessages(o, settings.company_brand ?? "HARAKA SEED", settings.bank_info ?? "").filter((m) => finance || m.key !== "invoice").map((m) => (
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
                  <select name="kind" className="input" defaultValue={finance && o.invoice_no ? (due > 0 ? "pengingat" : "invoice") : "konfirmasi"}>
                    <option value="konfirmasi">Konfirmasi pesanan</option>
                    {o.shipped_at && <option value="pengiriman">Info pengiriman</option>}
                    {finance && o.invoice_no && <option value="invoice">Invoice</option>}
                    {finance && o.invoice_no && due > 0 && <option value="pengingat">Pengingat pembayaran</option>}
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
