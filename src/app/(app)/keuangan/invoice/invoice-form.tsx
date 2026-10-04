"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveManualInvoice } from "@/actions/manual-invoice";
import { terbilang } from "@/lib/terbilang";

type Customer = { id: number; name: string; address: string; city: string; phone: string; email: string };
type Row = { key: number; code: string; name: string; qty: string; price: string };
export type InvoiceFormValues = {
  id?: number;
  number: string;
  invoice_date: string;
  customer_id: number | null;
  cust_name: string;
  cust_address: string;
  cust_city: string;
  cust_phone: string;
  cust_email: string;
  label_code: string;
  label_name: string;
  label_qty: string;
  notes: string;
  rows: { code: string; name: string; qty: number; price: number }[];
};

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n));
/** Bobot/qty: "9,02" atau "9.02" → 9.02; "1.250,5" → 1250.5 */
const qtyNum = (s: string) => {
  const t = String(s).trim();
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
};
const priceNum = (s: string) => Number(String(s).replace(/[^\d]/g, ""));

/** Preset kolom: template resmi (per petani, kg) atau penjualan kemasan. */
const PRESETS = {
  petani: { label_code: "Kode Produksi", label_name: "Nama Petani", label_qty: "Bobot (Kg)" },
  produk: { label_code: "Kode", label_name: "Nama Barang", label_qty: "Qty" },
};

export function InvoiceForm({ values, customers }: { values: InvoiceFormValues; customers: Customer[] }) {
  const [state, action, pending] = useActionState(saveManualInvoice, null);
  const [cust, setCust] = useState({
    customer_id: values.customer_id ?? 0,
    cust_name: values.cust_name,
    cust_address: values.cust_address,
    cust_city: values.cust_city,
    cust_phone: values.cust_phone,
    cust_email: values.cust_email,
  });
  const [labels, setLabels] = useState({ label_code: values.label_code, label_name: values.label_name, label_qty: values.label_qty });
  const [rows, setRows] = useState<Row[]>(
    values.rows.length
      ? values.rows.map((r, i) => ({ key: i + 1, code: r.code, name: r.name, qty: String(r.qty).replace(".", ","), price: String(r.price) }))
      : [{ key: 1, code: "", name: "", qty: "", price: "" }],
  );

  const lineTotal = (r: Row) => (Number.isFinite(qtyNum(r.qty) * priceNum(r.price)) ? Math.round(qtyNum(r.qty) * priceNum(r.price)) : 0);
  const total = rows.reduce((s, r) => s + lineTotal(r), 0);
  const qtySum = rows.reduce((s, r) => s + (Number.isFinite(qtyNum(r.qty)) ? qtyNum(r.qty) : 0), 0);
  const payload = useMemo(
    () => JSON.stringify(rows.map((r) => ({ code: r.code, name: r.name, qty: qtyNum(r.qty), price: priceNum(r.price) }))),
    [rows],
  );
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () =>
    setRows((rs) => {
      const last = rs[rs.length - 1];
      // Baris baru meneruskan kode produksi & harga baris sebelumnya (sering sama, seperti di template).
      return [...rs, { key: Math.max(...rs.map((r) => r.key)) + 1, code: last?.code ?? "", name: "", qty: "", price: last?.price ?? "" }];
    });
  const pickCustomer = (id: number) => {
    const c = customers.find((x) => x.id === id);
    setCust(c ? { customer_id: c.id, cust_name: c.name, cust_address: c.address, cust_city: c.city, cust_phone: c.phone, cust_email: c.email } : { ...cust, customer_id: 0 });
  };

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-3">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <input type="hidden" name="rows" value={payload} />
      <input type="hidden" name="customer_id" value={cust.customer_id || ""} />

      <div className="space-y-5 lg:col-span-2">
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <label className="block">
            <span className="label">Nomor invoice *</span>
            <input name="number" required defaultValue={values.number} className="input font-mono" placeholder="181/INV/X/2026" />
          </label>
          <label className="block">
            <span className="label">Tanggal *</span>
            <input name="invoice_date" type="date" required defaultValue={values.invoice_date} className="input" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Ambil dari data pelanggan (opsional)</span>
            <select value={cust.customer_id || ""} onChange={(e) => pickCustomer(Number(e.target.value))} className="input">
              <option value="">— isi manual —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.city && `· ${c.city}`}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Nama customer *</span>
            <input name="cust_name" required value={cust.cust_name} onChange={(e) => setCust({ ...cust, cust_name: e.target.value })} className="input" placeholder="CV. NUSA HEULANG" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Alamat</span>
            <input name="cust_address" value={cust.cust_address} onChange={(e) => setCust({ ...cust, cust_address: e.target.value })} className="input" />
          </label>
          <label className="block">
            <span className="label">Kota</span>
            <input name="cust_city" value={cust.cust_city} onChange={(e) => setCust({ ...cust, cust_city: e.target.value })} className="input" placeholder="Purwakarta, Jawa Barat" />
          </label>
          <label className="block">
            <span className="label">No. telepon</span>
            <input name="cust_phone" value={cust.cust_phone} onChange={(e) => setCust({ ...cust, cust_phone: e.target.value })} className="input" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Email customer (untuk kirim invoice, opsional)</span>
            <input name="cust_email" type="email" value={cust.cust_email} onChange={(e) => setCust({ ...cust, cust_email: e.target.value })} className="input" />
          </label>
        </section>

        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
            <span className="text-sm font-semibold">Rincian tagihan</span>
            <span className="flex gap-1 text-xs">
              Kolom:
              <button type="button" className="text-brand-700 hover:underline" onClick={() => setLabels(PRESETS.petani)}>
                per petani (kg)
              </button>
              ·
              <button type="button" className="text-brand-700 hover:underline" onClick={() => setLabels(PRESETS.produk)}>
                per barang
              </button>
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10">No</th>
                  <th>
                    <input name="label_code" value={labels.label_code} onChange={(e) => setLabels({ ...labels, label_code: e.target.value })} className="input min-w-28 py-1 text-xs font-semibold normal-case tracking-normal" aria-label="Judul kolom kode" />
                  </th>
                  <th>
                    <input name="label_name" value={labels.label_name} onChange={(e) => setLabels({ ...labels, label_name: e.target.value })} className="input min-w-28 py-1 text-xs font-semibold normal-case tracking-normal" aria-label="Judul kolom nama" />
                  </th>
                  <th className="w-32">
                    <input name="label_qty" value={labels.label_qty} onChange={(e) => setLabels({ ...labels, label_qty: e.target.value })} className="input min-w-28 py-1 text-xs font-semibold normal-case tracking-normal" aria-label="Judul kolom jumlah" />
                  </th>
                  <th className="w-40">Harga (Rp)</th>
                  <th className="num">Total (Rp)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key}>
                    <td className="text-muted">{i + 1}</td>
                    <td>
                      <input value={r.code} onChange={(e) => update(r.key, { code: e.target.value })} className="input" placeholder="KE1085" />
                    </td>
                    <td>
                      <input value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} className="input" placeholder="Misdina" />
                    </td>
                    <td>
                      <input value={r.qty} onChange={(e) => update(r.key, { qty: e.target.value })} inputMode="decimal" className="input" placeholder="9,02" />
                    </td>
                    <td>
                      <input value={r.price} onChange={(e) => update(r.key, { price: e.target.value.replace(/[^\d]/g, "") })} inputMode="numeric" className="input" placeholder="725000" />
                    </td>
                    <td className="num whitespace-nowrap font-medium">{fmt(lineTotal(r))}</td>
                    <td>
                      <button type="button" aria-label="Hapus baris" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="text-muted hover:text-red-700 disabled:opacity-30">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3">
            <button type="button" className="btn-secondary btn-sm" onClick={addRow}>
              <Plus size={14} /> Tambah baris
            </button>
            <span className="ml-3 text-xs text-muted">Desimal pakai koma, mis. 9,02. Baris baru meneruskan kode & harga baris sebelumnya.</span>
          </div>
        </section>

        <section className="card p-5">
          <label className="block">
            <span className="label">Catatan tambahan (opsional, tampil di kotak Catatan)</span>
            <textarea name="notes" rows={2} defaultValue={values.notes} className="input" />
          </label>
        </section>
      </div>

      <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-6">
        <div className="text-sm font-semibold">Ringkasan</div>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Jumlah baris</dt>
            <dd>{rows.filter((r) => r.code || r.name).length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Total {labels.label_qty || "qty"}</dt>
            <dd className="tabular-nums">{new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(qtySum)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
            <dt>Jumlah tagihan</dt>
            <dd className="tabular-nums">Rp{fmt(total)}</dd>
          </div>
        </dl>
        <p className="rounded-lg bg-brand-50 p-3 text-xs italic leading-relaxed text-brand-900">{terbilang(total)}</p>
        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
        <button className="btn-accent w-full" disabled={pending}>
          {pending ? "Menyimpan…" : values.id ? "Simpan perubahan" : "Simpan & buat invoice"}
        </button>
        <p className="text-xs text-muted">Setelah disimpan, unduh sebagai PDF atau Word lalu cetak.</p>
      </aside>
    </form>
  );
}
