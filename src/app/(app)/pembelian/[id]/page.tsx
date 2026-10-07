import { toId } from "@/lib/form";
import { notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { PO_STATUS, num, rupiah, tanggal, today } from "@/lib/format";
import { Badge, Card, DL, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { EmailList, type EmailRow } from "@/components/email-list";
import { sendPO, setPOPaid, setPOStatus } from "@/actions/purchasing";
import { requireAccess } from "@/lib/session";
import { Attachments } from "@/components/attachments";

export default async function PODetail({ params, searchParams }: PageProps<"/pembelian/[id]">) {
  await requireAccess("pembelian");
  const { id } = await params;
  const sp = await searchParams;
  const po = await get<{ id: number; po_no: string; supplier: string; email: string; phone: string; order_date: string; status: string; total: number; notes: string; received_at: string | null; paid_at: string | null }>(
    "SELECT po.*, s.name supplier, s.email, s.phone FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?",
    toId(id),
  );
  if (!po) notFound();
  const items = await all<{ id: number; description: string; qty: number; unit: string; price: number }>("SELECT * FROM po_items WHERE po_id = ?", po.id);
  const emails = await all<EmailRow>("SELECT * FROM emails WHERE ref_type = 'purchase_order' AND ref_id = ? ORDER BY id DESC", po.id);
  const st = PO_STATUS[po.status];

  const statusBtn = (status: string, label: string, cls = "btn-secondary w-full") => (
    <form action={setPOStatus}>
      <input type="hidden" name="id" value={po.id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton className={cls}>{label}</SubmitButton>
    </form>
  );

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {po.po_no} <Badge tone={st?.tone}>{st?.label}</Badge>
          </span>
        }
        subtitle={`${po.supplier} · ${tanggal(po.order_date)}`}
        back={{ href: "/pembelian", label: "Pembelian" }}
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Barang" className="overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Deskripsi</th>
                  <th className="num">Qty</th>
                  <th className="num">Harga</th>
                  <th className="num">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.description}</td>
                    <td className="num">
                      {num(i.qty)} {i.unit}
                    </td>
                    <td className="num">{rupiah(i.price)}</td>
                    <td className="num">{rupiah(i.qty * i.price)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} className="text-right font-bold">
                    Total
                  </td>
                  <td className="num font-bold">{rupiah(po.total)}</td>
                </tr>
              </tbody>
            </table>
            {po.notes && <div className="border-t border-line px-5 py-3 text-sm text-muted">Catatan: {po.notes}</div>}
          </Card>
          <Card title="Email ke supplier">
            <EmailList rows={emails} empty="PO ini belum dikirim via email." />
          </Card>
          <Attachments refType="purchase_order" refId={po.id} title="Nota & bukti pembelian" />
        </div>
        <div className="space-y-5">
          <Card title="Tindakan">
            <div className="space-y-3 p-5">
              {po.status !== "batal" && po.status !== "diterima" && (
                <form action={sendPO} className="space-y-2">
                  <input type="hidden" name="id" value={po.id} />
                  <Field label="Kirim PO ke email">
                    <input name="to" type="email" defaultValue={po.email} className="input" placeholder="email@supplier.com" />
                  </Field>
                  <SubmitButton className="btn-primary w-full" pendingText="Mengirim…">
                    {po.status === "draft" ? "Kirim PO via email" : "Kirim ulang PO"}
                  </SubmitButton>
                </form>
              )}
              {po.status === "draft" && statusBtn("dipesan", "Tandai dipesan (tanpa email)")}
              {po.status === "dipesan" && statusBtn("diterima", "Barang sudah diterima")}
              {(po.status === "draft" || po.status === "dipesan") && statusBtn("batal", "Batalkan PO", "btn-danger w-full")}
              {po.status === "diterima" && <DL items={[["Diterima", tanggal(po.received_at)]]} />}
            </div>
          </Card>
          {po.status !== "batal" && po.status !== "draft" && (
            <Card title="Pembayaran ke supplier">
              {po.paid_at ? (
                <form action={setPOPaid} className="space-y-3 p-5 text-sm">
                  <input type="hidden" name="id" value={po.id} />
                  <p>
                    Dibayar <b>{tanggal(po.paid_at)}</b> sebesar {rupiah(po.total)}. Sudah tercatat di Buku Kas.
                  </p>
                  <SubmitButton className="btn-secondary w-full" name="undo" value="1" confirm="Batalkan tanda dibayar? Barisnya dihapus dari Buku Kas.">
                    Batalkan tanda dibayar
                  </SubmitButton>
                </form>
              ) : (
                <form action={setPOPaid} className="space-y-3 p-5 text-sm">
                  <input type="hidden" name="id" value={po.id} />
                  <Field label="Tanggal dibayar">
                    <input name="paid_at" type="date" defaultValue={today()} className="input" />
                  </Field>
                  <label className="block">
                    <span className="label">Dibayar dari</span>
                    <select name="account" defaultValue="bank" className="input">
                      <option value="bank">Bank</option>
                      <option value="tunai">Kas tunai</option>
                    </select>
                  </label>
                  <SubmitButton className="btn-primary w-full" confirm={`Tandai ${po.po_no} dibayar ${rupiah(po.total)}? Otomatis masuk Buku Kas.`}>
                    Tandai dibayar
                  </SubmitButton>
                  <p className="text-xs text-muted">Pengeluaran sebesar total PO otomatis tercatat di Buku Kas.</p>
                </form>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
