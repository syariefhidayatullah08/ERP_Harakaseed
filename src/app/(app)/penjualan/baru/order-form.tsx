"use client";

import { useActionState, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { createOrder, updateOrder } from "@/actions/sales";
import { CHANNELS, GRAM_MAX, GRAM_MIN, gramPack, packGram, type Channel } from "@/lib/sales-channel";

type P = { id: number; name: string; crop: string };
type K = { product_id: number; pack_size: string; price: number; available: number };
type C = { name: string; city: string; email: string };
type Line = { key: number; product_id: number; pack_size: string; qty: number; price: number };

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

type Initial = { id: number; customer: string; order_date: string; discount_pct: number; tax_pct: number; notes: string; lines: Omit<Line, "key">[] };

/** Form pesanan baru; dengan `initial` menjadi form ubah pesanan yang sudah ada (sebelum dikirim). */
export function OrderForm({
  channel,
  customers,
  products,
  packs,
  defaultCustomer = "",
  today,
  initial,
}: {
  channel: Channel;
  customers: C[];
  products: P[];
  packs: K[];
  defaultCustomer?: string;
  today: string;
  initial?: Initial;
}) {
  const ch = CHANNELS[channel];
  const usesPack = channel !== "bulky";
  const [state, action, pending] = useActionState(initial ? updateOrder : createOrder, null);
  const [customerName, setCustomerName] = useState(initial?.customer ?? defaultCustomer);
  const [lines, setLines] = useState<Line[]>(initial?.lines.length ? initial.lines.map((l, i) => ({ ...l, key: i + 1 })) : [{ key: 1, product_id: 0, pack_size: "", qty: 1, price: 0 }]);
  const [discount, setDiscount] = useState(initial?.discount_pct ?? 0);
  const [tax, setTax] = useState(initial?.tax_pct ?? 0);

  const customer = customers.find((c) => same(c.name, customerName));
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const afterDisc = subtotal * (1 - discount / 100);
  const total = Math.round(afterDisc * (1 + tax / 100));
  const payload = useMemo(() => JSON.stringify(lines.map(({ product_id, pack_size, qty, price }) => ({ product_id, pack_size, qty, price }))), [lines]);

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const packsOf = (productId: number) => packs.filter((k) => k.product_id === productId);
  // Harga kemasan mengikuti gramasi yang sudah terdaftar; gramasi baru, bulky & label diisi manual.
  const packPatch = (k?: K): Partial<Line> => ({ pack_size: k?.pack_size ?? "", ...(channel === "kemasan" ? { price: k?.price ?? 0 } : {}) });
  // Gramasi diketik sebagai angka gram dan disimpan sebagai teks "10 g".
  const gramPatch = (options: K[], value: string): Partial<Line> => {
    const pack = value === "" ? "" : `${Number(value)} g`;
    const k = options.find((x) => x.pack_size === pack);
    return k ? packPatch(k) : { pack_size: pack };
  };

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-3">
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="lines" value={payload} />
      {initial && <input type="hidden" name="order_id" value={initial.id} />}
      <div className="space-y-5 lg:col-span-2">
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <label className="block">
            <span className="label">Pelanggan *</span>
            <input
              name="customer_name"
              required
              autoComplete="off"
              list="daftar-pelanggan"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="input"
              placeholder="Ketik nama, atau pilih distributor…"
            />
            <datalist id="daftar-pelanggan">
              {customers.map((c, i) => (
                <option key={i} value={c.name}>
                  {c.city}
                </option>
              ))}
            </datalist>
            {customerName.trim() && (
              <span className={`mt-1 block text-xs ${customer?.email ? "text-muted" : "text-amber-700"}`}>
                {customer
                  ? customer.email
                    ? `Pelanggan terdaftar${customer.city ? ` · ${customer.city}` : ""} · ${customer.email}`
                    : "Pelanggan terdaftar, belum punya email — konfirmasi tidak akan terkirim."
                  : "Nama baru — otomatis disimpan sebagai pelanggan. Tanpa email, konfirmasi tidak terkirim."}
              </span>
            )}
          </label>
          <label className="block">
            <span className="label">Tanggal pesanan</span>
            <input name="order_date" type="date" defaultValue={initial?.order_date ?? today} className="input" />
          </label>
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5 text-sm font-semibold">Item pesanan · {ch.label.toLowerCase()}</div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="min-w-52">Varietas</th>
                  {usesPack && <th className="min-w-28">Gramasi (gram)</th>}
                  <th className="w-28">Qty ({ch.unit})</th>
                  <th className="w-36">Harga / {ch.unit}</th>
                  <th className="num">Jumlah</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const options = packsOf(l.product_id);
                  const pack = options.find((k) => k.pack_size === l.pack_size);
                  return (
                    <tr key={l.key}>
                      <td>
                        <select
                          value={l.product_id || ""}
                          onChange={(e) => {
                            const id = Number(e.target.value);
                            const ks = packsOf(id);
                            update(l.key, { product_id: id, ...(usesPack ? packPatch(ks.length === 1 ? ks[0] : undefined) : {}) });
                          }}
                          className="input"
                        >
                          <option value="" disabled>
                            Pilih varietas…
                          </option>
                          {products.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name} — {x.crop}
                            </option>
                          ))}
                        </select>
                        {channel === "kemasan" && pack && (
                          <div className={`mt-1 text-xs ${pack.available < l.qty ? "text-red-700" : "text-muted"}`}>
                            Tersedia {pack.available} kemasan {pack.pack_size}
                            {pack.available < l.qty && " — stok kurang, perlu produksi"}
                          </div>
                        )}
                        {usesPack && l.product_id > 0 && l.pack_size && !pack && (
                          <div className={`mt-1 text-xs ${gramPack(packGram(l.pack_size)) ? "text-amber-700" : "text-red-700"}`}>
                            {gramPack(packGram(l.pack_size))
                              ? `Gramasi ${l.pack_size} baru untuk varietas ini — otomatis ditambahkan ke Produk${channel === "kemasan" ? "; isi harganya, stoknya masih kosong" : ""}.`
                              : `Gramasi diisi angka ${GRAM_MIN}–${GRAM_MAX} gram.`}
                          </div>
                        )}
                      </td>
                      {usesPack && (
                        <td>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={GRAM_MIN}
                              step={1}
                              list={`gramasi-${l.key}`}
                              value={packGram(l.pack_size) ?? ""}
                              disabled={!l.product_id}
                              onChange={(e) => update(l.key, gramPatch(options, e.target.value))}
                              className="input"
                              placeholder={`${GRAM_MIN}–${GRAM_MAX}`}
                              aria-label="Gramasi (gram)"
                            />
                            <span className="text-xs text-muted">g</span>
                            <datalist id={`gramasi-${l.key}`}>
                              {options.map((k) => packGram(k.pack_size)).filter((g) => g !== null).map((g) => (
                                <option key={g} value={g} />
                              ))}
                            </datalist>
                          </div>
                        </td>
                      )}
                      <td>
                        <input
                          type="number"
                          min={channel === "bulky" ? 0.01 : 1}
                          step={channel === "bulky" ? 0.01 : 1}
                          value={l.qty}
                          onChange={(e) => update(l.key, { qty: Number(e.target.value) })}
                          className="input"
                        />
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
              onClick={() => setLines((ls) => [...ls, { key: Math.max(...ls.map((x) => x.key)) + 1, product_id: 0, pack_size: "", qty: 1, price: 0 }])}
            >
              + Tambah varietas
            </button>
          </div>
        </section>

        <section className="card p-5">
          <label className="block">
            <span className="label">Catatan pesanan</span>
            <textarea name="notes" rows={2} defaultValue={initial?.notes} className="input" placeholder="mis. kirim via ekspedisi, alamat gudang cabang…" />
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
        {initial ? (
          <button name="intent" value="save" className="btn-primary w-full" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan perubahan"}
          </button>
        ) : (
          <div className="space-y-2">
            <button name="intent" value="confirm" className="btn-primary w-full" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan & konfirmasi (kirim email)"}
            </button>
            <button name="intent" value="draft" className="btn-secondary w-full" disabled={pending}>
              Simpan sebagai draft
            </button>
          </div>
        )}
      </aside>
    </form>
  );
}
