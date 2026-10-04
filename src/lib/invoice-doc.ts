import "server-only";
import { all, get, getSettings } from "./db";
import { terbilang } from "./terbilang";

/** Isi invoice yang dirender ke PDF maupun Word dengan tata letak template resmi Haraka. */
export type InvoiceDoc = {
  number: string;
  date: string; // YYYY-MM-DD
  customer: { name: string; address: string; city: string; phone: string };
  labels: { code: string; name: string; qty: string };
  qtyDecimals: number;
  rows: { code: string; name: string; qty: number; price: number }[];
  /** Baris tambahan sebelum JUMLAH TAGIHAN (mis. diskon, PPN). */
  adjustments: { label: string; amount: number }[];
  total: number;
  /** Baris informasi setelah total (mis. sudah dibayar, sisa). */
  after: { label: string; amount: number }[];
  notes: string;
  settings: Record<string, string>;
};

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export const ddmmyyyy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
export const tanggalPanjang = (d: string) => `${d.slice(8, 10)} ${BULAN[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
export const rp = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n));
export const qtyFmt = (n: number, decimals: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: decimals }).format(n);
export const sumQty = (doc: InvoiceDoc) => doc.rows.reduce((s, r) => s + r.qty, 0);
export const words = (doc: InvoiceDoc) => terbilang(doc.total);

/** Nomor format template: 181/INV/X/2026 */
export function invoiceNumber(seq: number, date: string) {
  return `${seq}/INV/${ROMAN[Number(date.slice(5, 7)) - 1]}/${date.slice(0, 4)}`;
}

export async function nextManualSeq() {
  const rows = await all<{ number: string }>("SELECT number FROM manual_invoices");
  const used = rows.map((r) => Number(r.number.split("/")[0])).filter(Number.isFinite);
  const start = Number((await get<{ value: string }>("SELECT value FROM settings WHERE key = 'manual_invoice_start'"))?.value ?? 1);
  return Math.max(start, ...used.map((n) => n + 1));
}

export async function manualInvoiceDoc(id: number): Promise<InvoiceDoc | null> {
  const inv = await get<{
    number: string; invoice_date: string; cust_name: string; cust_address: string; cust_city: string; cust_phone: string;
    label_code: string; label_name: string; label_qty: string; notes: string; total: number;
  }>("SELECT * FROM manual_invoices WHERE id = ?", id);
  if (!inv) return null;
  const rows = await all<{ code: string; name: string; qty: number; price: number }>(
    "SELECT code, name, qty, price FROM manual_invoice_items WHERE invoice_id = ? ORDER BY position, id",
    id,
  );
  return {
    number: inv.number,
    date: inv.invoice_date,
    customer: { name: inv.cust_name, address: inv.cust_address, city: inv.cust_city, phone: inv.cust_phone },
    labels: { code: inv.label_code, name: inv.label_name, qty: inv.label_qty },
    qtyDecimals: 2,
    rows,
    adjustments: [],
    total: inv.total,
    after: [],
    notes: inv.notes,
    settings: await getSettings(),
  };
}

/** Invoice dari pesanan penjualan, memakai tata letak yang sama. */
export async function orderInvoiceDoc(soId: number): Promise<InvoiceDoc | null> {
  const o = await get<{
    so_no: string; invoice_no: string | null; order_date: string; shipped_at: string | null; subtotal: number; discount_pct: number; tax_pct: number;
    total: number; paid: number; due_date: string | null; notes: string; customer: string; address: string; city: string; phone: string;
  }>(
    `SELECT so.*, c.name customer, c.address, c.city, c.phone FROM sales_orders so JOIN customers c ON c.id = so.customer_id WHERE so.id = ?`,
    soId,
  );
  if (!o) return null;
  const items = await all<{ sku: string; name: string; crop: string; pack_size: string; qty: number; price: number }>(
    "SELECT p.sku, p.name, p.crop, p.pack_size, i.qty, i.price FROM so_items i JOIN products p ON p.id = i.product_id WHERE i.so_id = ? ORDER BY i.id",
    soId,
  );
  const disc = o.subtotal * (o.discount_pct / 100);
  const tax = (o.subtotal - disc) * (o.tax_pct / 100);
  const adjustments = [
    ...(o.discount_pct ? [{ label: `Diskon ${o.discount_pct}%`, amount: -disc }] : []),
    ...(o.tax_pct ? [{ label: `PPN ${o.tax_pct}%`, amount: tax }] : []),
  ];
  const noteParts = [`Pesanan ${o.so_no}`, o.due_date ? `jatuh tempo ${ddmmyyyy(o.due_date)}` : "", o.notes].filter(Boolean);
  return {
    number: o.invoice_no ?? o.so_no,
    date: o.shipped_at ?? o.order_date,
    customer: { name: o.customer, address: o.address, city: o.city, phone: o.phone },
    labels: { code: "Kode", name: "Produk", qty: "Qty (kms)" },
    qtyDecimals: 0,
    rows: items.map((i) => ({ code: i.sku, name: `${i.name} ${i.pack_size ? `(${i.pack_size})` : ""}`.trim(), qty: i.qty, price: i.price })),
    adjustments: adjustments.length ? [{ label: "Subtotal", amount: o.subtotal }, ...adjustments] : [],
    total: o.total,
    after: o.paid > 0 ? [{ label: "Sudah dibayar", amount: o.paid }, { label: "Sisa tagihan", amount: o.total - o.paid }] : [],
    notes: noteParts.join(" · "),
    settings: await getSettings(),
  };
}

/** Nama file aman, mis. "181 INVOICE CV. NUSA HEULANG_04-10-2026" (meniru penamaan file template). */
export function invoiceFileBase(doc: InvoiceDoc) {
  const seq = doc.number.split("/")[0];
  return `${seq} INVOICE ${doc.customer.name.toUpperCase()}_${ddmmyyyy(doc.date).replace(/\//g, "-")}`.replace(/[\\/:*?"<>|]+/g, "").slice(0, 120);
}
