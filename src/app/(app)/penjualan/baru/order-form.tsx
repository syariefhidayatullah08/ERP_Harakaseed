"use client";

import { useActionState, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { createOrder } from "@/actions/sales";

type P = { id: number; name: string; crop: string; pack_size: string; price: number; available: number };
type C = { id: number; name: string; city: string; email: string };
type Line = { key: number; product_id: number; qty: number; price: number };

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

export function OrderForm({ customers, products, defaultCustomer, today }: { customers: C[]; products: P[]; defaultCustomer?: number; today: string }) {
  const [state, action, pending] = useActionState(createOrder, null);
  const [customerId, setCustomerId] = useState<number>(defaultCustomer ?? 0);
  const [lines, setLines] = useState<Line[]>([{ key: 1, product_id: 0, qty: 1, price: 0 }]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);

  const customer = customers.find((c) => c.id === customerId);
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const afterDisc = subtotal * (1 - discount / 100);
  const total = Math.round(afterDisc * (1 + tax / 100));
  const payload = useMemo(() => JSON.stringify(lines.map(({ product_id, qty, price }) => ({ product_id, qty, price }))), [lines]);

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-3">
      <input type="hidden" name="lines" value={payload} />
      <div className="space-y-5 lg:col-span-2">
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <label className="block">
            <span className="label">Pelanggan *</span>
            <select name="customer_id" required value={customerId || ""} onChange={(e) => setCustomerId(Number(e.target.value))} className="input">
              <option value="" disabled>
                Pilih pelanggan…
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.city && `— ${c.city}`}
                </option>
              ))}
            </select>
            {customer && (
              <span className={`mt-1 block text-xs ${customer.email ? "text-muted" : "text-amber-700"}`}>
                {customer.email ? `Email: ${customer.email}` : "Pelanggan belum punya email — konfirmasi tidak akan terkirim."}
              </span>
            )}
          </label>
          <label className="block">
            <span className="label">Tanggal pesanan</span>
            <input name="order_date" type="date" defaultValue={today} className="input" />
          </label>
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5 text-sm font-semibold">Item pesanan</div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="min-w-56">Produk</th>
                  <th className="w-28">Qty</th>
                  <th className="w-40">Harga</th>
                  <th className="num">Jumlah</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const p = products.find((x) => x.id === l.product_id);
                  return (
                    <tr key={l.key}>
                      <td>
                        <select
                          value={l.product_id || ""}
                          onChange={(e) => {
                            const np = products.find((x) => x.id === Number(e.target.value));
                            update(l.key, { product_id: Number(e.target.value), price: np?.price ?? 0 });
                          }}
                          className="input"
                        >
                          <option value="" disabled>
                            Pilih varietas…
                          </option>
                          {products.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name} — {x.crop}{x.pack_size ? ` (${x.pack_size})` : ""}{x.price ? "" : " · harga belum diisi"}
                            </option>
                          ))}
                        </select>
                        {p && (
                          <div className={`mt-1 text-xs ${p.available < l.qty ? "text-red-700" : "text-muted"}`}>
                            Tersedia {p.available} kemasan{p.available < l.qty && " — stok kurang, perlu produksi"}
                          </div>
                        )}
                      </td>
                      <td>
                        <input type="number" min={1} value={l.qty} onChange={(e) => update(l.key, { qty: Number(e.target.value) })} className="input" />
                      </td>
                      <td>
                        <input type="number" min={0} value={l.price} onChange={(e) => update(l.key, { price: Number(e.target.value) })} className="input" />
                      </td>
                      <td className="num font-medium">{rupiah(l.qty * l.price)}</td>
                      <td>
                        <button
                          type="button"
                          aria-label="Hapus baris"
                          disabled={lines.length === 1}
                          onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                          className="text-muted hover:text-red-700 disabled:opacity-30"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3">
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setLines((ls) => [...ls, { key: Math.max(...ls.map((x) => x.key)) + 1, product_id: 0, qty: 1, price: 0 }])}
            >
              + Tambah produk
            </button>
          </div>
        </section>

        <section className="card p-5">
          <label className="block">
            <span className="label">Catatan pesanan</span>
            <textarea name="notes" rows={2} className="input" placeholder="mis. kirim via ekspedisi, alamat gudang cabang…" />
          </label>
        </section>
      </div>

      <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-6">
        <div className="text-sm font-semibold">Ringkasan</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Diskon %</span>
            <input name="discount_pct" type="number" min={0} max={100} step="0.5" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="input" />
          </label>
          <label className="block">
            <span className="label">PPN %</span>
            <input name="tax_pct" type="number" min={0} max={100} step="0.5" value={tax} onChange={(e) => setTax(Number(e.target.value))} className="input" />
          </label>
        </div>
        <dl className="space-y-1.5 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums">{rupiah(subtotal)}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Diskon</dt>
              <dd className="tabular-nums">− {rupiah(subtotal - afterDisc)}</dd>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">PPN</dt>
              <dd className="tabular-nums">{rupiah(total - afterDisc)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{rupiah(total)}</dd>
          </div>
        </dl>
        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
        <div className="space-y-2">
          <button name="intent" value="confirm" className="btn-primary w-full" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan & konfirmasi (kirim email)"}
          </button>
          <button name="intent" value="draft" className="btn-secondary w-full" disabled={pending}>
            Simpan sebagai draft
          </button>
        </div>
      </aside>
    </form>
  );
}
