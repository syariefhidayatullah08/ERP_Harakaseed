import "server-only";
import { all, get, getDocSettings, getSetting } from "./db";
import { parseSignature } from "./signature";
import { terbilang } from "./terbilang";
import { packGram, perKg, toChannel } from "./sales-channel";

/** Kolom tabel invoice setelah "No". `w` = lebar relatif; kolom uang ditulis "Rp … angka" rata kanan. */
export type InvoiceCol = { label: string; w: number; money?: boolean };

/**
 * Isi invoice yang dirender ke PDF maupun Word. Susunan kolomnya mengikuti template per jenis penjualan:
 * kemasan/label = Nama Produk | Jumlah | Isi (gr) | Harga | Total; bulky = Komoditas | Varietas | Bobot | Harga | Total;
 * kerjasama = Varietas | Nama Petani | Bobot Akhir | Harga | Keterangan | Total (dengan baris deposito bila ada).
 */
export type InvoiceDoc = {
  number: string;
  date: string; // YYYY-MM-DD
  customer: { name: string; address: string; city: string; phone: string };
  columns: InvoiceCol[];
  /** Sel per kolom (teks, atau angka untuk kolom uang); kolom terakhir = total baris. */
  rows: (string | number)[][];
  /** Baris berlabel sebelum tabel item (mis. DEPOSITO). */
  before: { label: string; amount: number }[];
  /** Baris tambahan sebelum baris total (mis. subtotal, diskon, PPN). */
  adjustments: { label: string; amount: number }[];
  totalLabel: string;
  /** Jumlah kuantitas yang ditampilkan di baris total pada kolom ke-`sumCol` (kosong = tidak ditampilkan). */
  sumCol?: number;
  sumText: string;
  total: number;
  /** Baris informasi setelah total (mis. sisa deposito, sudah dibayar, sisa tagihan). */
  after: { label: string; amount: number; bold?: boolean }[];
  notes: string;
  settings: Record<string, string>;
};

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export const ddmmyyyy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
export const tanggalPanjang = (d: string) => `${d.slice(8, 10)} ${BULAN[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
export const rp = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n));
export const qtyFmt = (n: number, decimals: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: decimals }).format(n);
export const words = (doc: InvoiceDoc) => terbilang(doc.total);

/** Dua penanda tangan dokumen cetak (invoice, surat pengajuan PB): kiri Direktur, kanan ADM & SDM. Nama, jabatan, dan gambar tanda tangan diatur di Pengaturan. */
export function signers(settings: Record<string, string>) {
  return [
    { title: settings.signer_title || "Direktur", name: settings.signer_name || "", sig: parseSignature(settings.signer_sig) },
    { title: settings.signer2_title || "ADM & SDM", name: settings.signer2_name || "", sig: parseSignature(settings.signer2_sig) },
  ] as const;
}

/**
 * Nomor invoice format template: No/INV/Bulan/Tahun, mis. 181/INV/X/2026. Ada dua urutan nomor yang berjalan sendiri-sendiri
 * seperti kebiasaan perusahaan: invoice kemasan & label (dibuat ADM) dan invoice bulky & kerjasama produksi (dibuat Direktur).
 * Pengaturan invoice_start_kemasan / invoice_start ("tahun:nomor") menyambung nomor dari sebelum memakai ERP.
 */
export async function nextInvoiceNumber(date: string, channel: string) {
  const year = date.slice(0, 4);
  const kemasan = !perKg(toChannel(channel));
  const rows = await all<{ invoice_no: string }>(
    `SELECT invoice_no FROM sales_orders WHERE invoice_no LIKE ? AND (channel IN ('kemasan', 'label')) = ?`,
    `%/INV/%/${year}`,
    kemasan ? 1 : 0,
  );
  const last = Math.max(0, ...rows.map((r) => Number(r.invoice_no.split("/")[0])).filter(Number.isFinite));
  const [startYear, startNo] = (await getSetting(kemasan ? "invoice_start_kemasan" : "invoice_start")).split(":");
  const seq = Math.max(last + 1, startYear === year ? Number(startNo) || 1 : 1);
  return `${seq}/INV/${ROMAN[Number(date.slice(5, 7)) - 1]}/${year}`;
}

/** Invoice dari pesanan penjualan, dengan tata letak referensi/TEMPLATE INVOICE.xlsx (Nama Produk | Varietas | Bobot/Qty | Harga | Total). */
export async function orderInvoiceDoc(soId: number): Promise<InvoiceDoc | null> {
  const o = await get<{
    so_no: string; channel: string; invoice_no: string | null; order_date: string; shipped_at: string | null; subtotal: number; discount_pct: number; tax_pct: number;
    total: number; paid: number; deposit: number; due_date: string | null; notes: string; customer: string; address: string; city: string; phone: string;
  }>(
    `SELECT so.*, c.name customer, c.address, c.city, c.phone FROM sales_orders so JOIN customers c ON c.id = so.customer_id WHERE so.id = ?`,
    soId,
  );
  if (!o) return null;
  const items = await all<{ sku: string; name: string; crop: string; pack_size: string; qty: number; price: number }>(
    `SELECT COALESCE(NULLIF(i.item_code, ''), p.sku, '') sku, COALESCE(NULLIF(i.item_name, ''), p.name, '') name, COALESCE(p.crop, '') crop, i.pack_size, i.qty, i.price FROM so_items i LEFT JOIN products p ON p.id = i.product_id WHERE i.so_id = ? ORDER BY i.id`,
    soId,
  );
  const disc = o.subtotal * (o.discount_pct / 100);
  const tax = (o.subtotal - disc) * (o.tax_pct / 100);
  const adjustments = [
    ...(o.discount_pct ? [{ label: `Diskon ${o.discount_pct}%`, amount: -disc }] : []),
    ...(o.tax_pct ? [{ label: `PPN ${o.tax_pct}%`, amount: tax }] : []),
  ];
  const channel = toChannel(o.channel);
  const noteParts = [`Pesanan ${o.so_no}`, o.due_date ? `jatuh tempo ${ddmmyyyy(o.due_date)}` : "", o.notes].filter(Boolean);
  const kgQty = items.reduce((s, i) => s + i.qty, 0);
  const money = (label: string, w: number): InvoiceCol => ({ label, w, money: true });
  // Susunan kolom per jenis, mengikuti contoh invoice resmi (193 kemasan, 181 bulky, 170 kerjasama).
  const layout =
    channel === "kerjasama"
      ? {
          columns: [{ label: "Varietas", w: 1.0 }, { label: "Nama Petani", w: 1.45 }, { label: "Bobot Akhir (Kg)", w: 1.3 }, money("Harga (Rp)", 1.15), { label: "Keterangan", w: 1.1 }, money("Total (Rp)", 1.5)],
          rows: items.map((i) => [i.sku, i.name, qtyFmt(i.qty, 2), i.price, "", i.qty * i.price]),
          totalLabel: "TOTAL",
          sumCol: undefined,
          sumText: "",
        }
      : channel === "bulky"
        ? {
            columns: [{ label: "Komoditas", w: 1.4 }, { label: "Varietas", w: 1.7 }, { label: "Bobot (Kg)", w: 0.9 }, money("Harga (Rp)", 1.3), money("Total (Rp)", 1.5)],
            rows: items.map((i) => [i.crop, i.name, qtyFmt(i.qty, 2), i.price, i.qty * i.price]),
            totalLabel: "JUMLAH TAGIHAN",
            sumCol: 2,
            sumText: qtyFmt(kgQty, 2),
          }
        : {
            columns: [{ label: channel === "label" ? "Nama Label" : "Nama Produk", w: 2.4 }, { label: `Jumlah (${channel === "label" ? "lbr" : "pcs"})`, w: 0.9 }, { label: "Isi (gr)", w: 0.8 }, money("Harga (Rp)", 1.3), money("Total (Rp)", 1.5)],
            rows: items.map((i) => [i.name, qtyFmt(i.qty, 0), String(packGram(i.pack_size) ?? i.pack_size), i.price, i.qty * i.price]),
            totalLabel: "JUMLAH TAGIHAN",
            sumCol: 1,
            sumText: qtyFmt(kgQty, 0),
          };
  // Kerjasama produksi dengan deposito: tagihan dipotong dari deposito pelanggan.
  const deposit = channel === "kerjasama" && o.deposit > 0 ? o.deposit : 0;
  return {
    number: o.invoice_no ?? o.so_no,
    date: o.shipped_at ?? o.order_date,
    customer: { name: o.customer, address: o.address, city: o.city, phone: o.phone },
    ...layout,
    before: deposit ? [{ label: "DEPOSITO", amount: deposit }] : [],
    adjustments: adjustments.length ? [{ label: "Subtotal", amount: o.subtotal }, ...adjustments] : [],
    total: o.total,
    after: [
      ...(deposit ? [{ label: "SISA DEPOSITO", amount: deposit - o.total, bold: true }] : []),
      ...(o.paid > 0 && !deposit ? [{ label: "Sudah dibayar", amount: o.paid }, { label: "Sisa tagihan", amount: o.total - o.paid, bold: true }] : []),
    ],
    notes: noteParts.join(" · "),
    settings: await getDocSettings(),
  };
}

/** Nama file aman, mis. "181 INVOICE CV. NUSA HEULANG_04-10-2026" (meniru penamaan file template). */
export function invoiceFileBase(doc: InvoiceDoc) {
  const seq = doc.number.split("/")[0];
  return `${seq} INVOICE ${doc.customer.name.toUpperCase()}_${ddmmyyyy(doc.date).replace(/\//g, "-")}`.replace(/[\\/:*?"<>|]+/g, "").slice(0, 120);
}
