import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { all, get, getSettings } from "./db";
import { num, rupiah, tanggal } from "./format";
import { CHANNELS, ITEM_LABEL_SQL, ITEM_PACK_SQL, toChannel } from "./sales-channel";
import { LOGO_PNG_BASE64 } from "./logo-data";
import { invoiceFileBase, orderInvoiceDoc } from "./invoice-doc";
import { renderInvoicePdf } from "./invoice-render-pdf";

type Order = {
  id: number;
  so_no: string;
  channel: string;
  customer: string;
  contact_person: string;
  phone: string;
  address: string;
  city: string;
  order_date: string;
  subtotal: number;
  discount_pct: number;
  tax_pct: number;
  total: number;
  paid: number;
  invoice_no: string | null;
  due_date: string | null;
  shipped_at: string | null;
  courier: string;
  tracking_no: string;
  notes: string;
};

export type PdfDoc = "invoice" | "sj";

// Warna logo HARAKA: biru #0077a8 (versi gelap #00aeef agar terbaca), oranye #f08020
const BRAND = rgb(0, 0.467, 0.659);
const ORANGE = rgb(0.941, 0.502, 0.125);
const INK = rgb(0.106, 0.153, 0.2);
const MUTED = rgb(0.373, 0.42, 0.463);
const LINE = rgb(0.89, 0.91, 0.933);
const TINT = rgb(0.918, 0.969, 0.992);

// Font standar PDF hanya mendukung WinAnsi; ganti karakter di luar itu agar tidak error.
const clean = (s: string) =>
  s
    .replace(/[−‐‑]/g, "-")
    .replace(/[→]/g, "->")
    .replace(/[^\x20-\x7E -ÿ–—‘’“”•…€]/g, "?");

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of clean(text).split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

export async function loadOrderPdfData(soId: number) {
  const order = await get<Order>(
    `SELECT so.*, c.name customer, c.contact_person, c.phone, c.address, c.city FROM sales_orders so
     JOIN customers c ON c.id = so.customer_id WHERE so.id = ?`,
    soId,
  );
  if (!order) return null;
  const items = await all<{ id: number; name: string; crop: string; pack_size: string; qty: number; price: number }>(
    `SELECT i.id, i.qty, i.price, ${ITEM_LABEL_SQL} name, COALESCE(p.crop, '') crop, ${ITEM_PACK_SQL} FROM so_items i LEFT JOIN products p ON p.id = i.product_id WHERE i.so_id = ? ORDER BY i.id`,
    soId,
  );
  const lots = await all<{ so_item_id: number; lot_no: string; qty: number; expiry_date: string }>(
    `SELECT a.so_item_id, l.lot_no, a.qty, l.expiry_date FROM so_allocations a JOIN lots l ON l.id = a.lot_id
     JOIN so_items i ON i.id = a.so_item_id WHERE i.so_id = ? ORDER BY a.id`,
    soId,
  );
  return { order, items, lots, settings: await getSettings() };
}

/** Invoice atau surat jalan dalam format PDF (A4). */
export async function orderPdf(soId: number, doc: PdfDoc = "invoice"): Promise<{ bytes: Uint8Array; filename: string } | null> {
  // Invoice memakai template resmi perusahaan; surat jalan memakai tata letak di bawah.
  if (doc === "invoice") {
    const inv = await orderInvoiceDoc(soId);
    return inv ? { bytes: await renderInvoicePdf(inv), filename: `${invoiceFileBase(inv)}.pdf` } : null;
  }
  const data = await loadOrderPdfData(soId);
  if (!data) return null;
  const { order: o, items, lots, settings } = data;
  const s = (k: string) => clean(settings[k] ?? "");
  const isSj = doc === "sj";
  const qtyHead = `Qty (${CHANNELS[toChannel(o.channel)].unit})`;
  const title = isSj ? "SURAT JALAN" : o.invoice_no ? "INVOICE" : "PESANAN PENJUALAN";
  const docNo = isSj ? `SJ/${o.so_no}` : (o.invoice_no ?? o.so_no);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`${title} ${docNo}`);
  pdf.setAuthor(s("company_name"));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(Buffer.from(LOGO_PNG_BASE64, "base64"));

  const W = 595.28;
  const H = 841.89;
  const M = 40;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const text = (t: string, x: number, yy: number, opts: { size?: number; f?: PDFFont; color?: typeof INK; align?: "left" | "right" } = {}) => {
    const size = opts.size ?? 9;
    const f = opts.f ?? font;
    const str = clean(t);
    const dx = opts.align === "right" ? f.widthOfTextAtSize(str, size) : 0;
    page.drawText(str, { x: x - dx, y: yy, size, font: f, color: opts.color ?? INK });
  };
  const hline = (yy: number, color = LINE, thickness = 0.75) =>
    page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness, color });

  // ---- Kop ----
  page.drawImage(logo, { x: M, y: y - 46, width: 46, height: 46 });
  text(s("company_brand"), M + 56, y - 12, { size: 14, f: bold, color: BRAND });
  text(s("company_name"), M + 56, y - 25, { size: 9, f: bold });
  let ay = y - 36;
  for (const l of wrap(s("company_address"), font, 7.5, 260)) {
    text(l, M + 56, ay, { size: 7.5, color: MUTED });
    ay -= 9.5;
  }
  text(`${s("company_phone")}  ·  ${s("company_email")}`, M + 56, ay, { size: 7.5, color: MUTED });
  text(title, W - M, y - 14, { size: 18, f: bold, color: BRAND, align: "right" });
  text(docNo, W - M, y - 30, { size: 10, align: "right" });
  y = Math.min(ay, y - 46) - 12;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 2, color: BRAND });
  page.drawLine({ start: { x: M, y: y - 3 }, end: { x: W - M, y: y - 3 }, thickness: 1, color: ORANGE });
  y -= 22;

  // ---- Pelanggan & info dokumen ----
  text(isSj ? "DIKIRIM KEPADA" : "DITAGIHKAN KEPADA", M, y, { size: 7.5, f: bold, color: MUTED });
  let ly = y - 14;
  text(o.customer, M, ly, { size: 10.5, f: bold });
  ly -= 13;
  if (o.contact_person) {
    text(`u.p. ${o.contact_person}`, M, ly);
    ly -= 12;
  }
  for (const l of wrap([o.address, o.city].filter(Boolean).join(", "), font, 9, 250)) {
    if (!l) continue;
    text(l, M, ly, { color: MUTED });
    ly -= 12;
  }
  if (o.phone) {
    text(o.phone, M, ly, { color: MUTED });
    ly -= 12;
  }

  const meta: [string, string][] = [
    ["No. pesanan", o.so_no],
    ["Tgl pesanan", tanggal(o.order_date)],
  ];
  if (o.shipped_at) meta.push(["Tgl kirim", tanggal(o.shipped_at)]);
  if (!isSj && o.due_date) meta.push(["Jatuh tempo", tanggal(o.due_date)]);
  if (isSj) meta.push(["Kurir / resi", [o.courier || "-", o.tracking_no].filter(Boolean).join(" / ")]);
  let ry = y;
  for (const [k, v] of meta) {
    text(k, W - M - 170, ry, { color: MUTED });
    text(v, W - M, ry, { f: k === "Jatuh tempo" ? bold : font, align: "right" });
    ry -= 13;
  }
  y = Math.min(ly, ry) - 14;

  // ---- Tabel item ----
  const cols = isSj
    ? { no: M + 6, prod: M + 28, lot: M + 260, qty: W - M - 6 }
    : { no: M + 6, prod: M + 28, qty: M + 330, price: M + 420, amount: W - M - 6 };
  const header = () => {
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: TINT });
    text("No", cols.no, y, { f: bold, size: 8 });
    text("Produk", cols.prod, y, { f: bold, size: 8 });
    if (isSj) {
      text("No. Lot / Kadaluarsa", (cols as { lot: number }).lot, y, { f: bold, size: 8 });
      text(qtyHead, cols.qty, y, { f: bold, size: 8, align: "right" });
    } else {
      const c = cols as { qty: number; price: number; amount: number };
      text(qtyHead, c.qty, y, { f: bold, size: 8, align: "right" });
      text("Harga", c.price, y, { f: bold, size: 8, align: "right" });
      text("Jumlah", c.amount, y, { f: bold, size: 8, align: "right" });
    }
    y -= 22;
  };
  header();

  items.forEach((it, n) => {
    const itemLots = lots.filter((l) => l.so_item_id === it.id);
    const rowH = Math.max(26, isSj ? 12 + itemLots.length * 11 : 26);
    if (y - rowH < 150) {
      page = pdf.addPage([W, H]);
      y = H - M;
      header();
    }
    text(String(n + 1), cols.no, y);
    text(it.name, cols.prod, y, { f: bold });
    text(`${it.crop} · ${it.pack_size}`, cols.prod, y - 11, { size: 7.5, color: MUTED });
    if (isSj) {
      itemLots.forEach((l, i) =>
        text(`${l.lot_no}  x${num(l.qty)}  ·  ED ${tanggal(l.expiry_date)}`, (cols as { lot: number }).lot, y - i * 11, { size: 8 }),
      );
      text(num(it.qty), cols.qty, y, { align: "right" });
    } else {
      const c = cols as { qty: number; price: number; amount: number };
      text(num(it.qty), c.qty, y, { align: "right" });
      text(rupiah(it.price), c.price, y, { align: "right" });
      text(rupiah(it.qty * it.price), c.amount, y, { align: "right" });
    }
    y -= rowH;
    hline(y + 10);
  });

  // ---- Total ----
  if (!isSj) {
    const disc = o.subtotal * (o.discount_pct / 100);
    const tax = (o.subtotal - disc) * (o.tax_pct / 100);
    const rows: [string, string, boolean][] = [["Subtotal", rupiah(o.subtotal), false]];
    if (o.discount_pct) rows.push([`Diskon ${o.discount_pct}%`, `- ${rupiah(disc)}`, false]);
    if (o.tax_pct) rows.push([`PPN ${o.tax_pct}%`, rupiah(tax), false]);
    rows.push(["Total", rupiah(o.total), true]);
    if (o.invoice_no) {
      rows.push(["Dibayar", rupiah(o.paid), false]);
      rows.push(["Sisa tagihan", rupiah(o.total - o.paid), true]);
    }
    y -= 4;
    for (const [k, v, b] of rows) {
      text(k, W - M - 200, y, { f: b ? bold : font, color: b ? INK : MUTED, size: b ? 10 : 9 });
      text(v, W - M - 6, y, { f: b ? bold : font, size: b ? 10 : 9, align: "right" });
      y -= b ? 16 : 13;
    }
    if (o.invoice_no) {
      y -= 6;
      page.drawRectangle({ x: M, y: y - 22, width: W - 2 * M, height: 34, color: TINT });
      text("Pembayaran ditransfer ke:", M + 10, y, { f: bold, size: 8.5 });
      text(s("bank_info"), M + 10, y - 13, { size: 8.5 });
      y -= 40;
    }
  }
  if (o.notes) {
    for (const l of wrap(`Catatan: ${o.notes}`, font, 8.5, W - 2 * M)) {
      text(l, M, y, { size: 8.5, color: MUTED });
      y -= 11;
    }
  }

  // ---- Tanda tangan ----
  y -= 30;
  if (y < 110) {
    page = pdf.addPage([W, H]);
    y = H - M - 40;
  }
  const sig = (label: string, name: string, cx: number) => {
    text(label, cx, y, { align: "left" });
    page.drawLine({ start: { x: cx - 10, y: y - 52 }, end: { x: cx + 140, y: y - 52 }, thickness: 0.75, color: INK });
    text(name, cx, y - 64, { size: 8.5 });
  };
  sig(isSj ? "Penerima," : "Pelanggan,", "( ................................ )", M + 20);
  sig("Hormat kami,", s("company_name"), W - M - 170);

  // ---- Footer tiap halaman ----
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const footer = clean(`${s("company_tagline")}  ·  ${s("company_website")}`);
    p.drawText(footer, { x: M, y: 24, size: 7, font, color: MUTED });
    const pg = `Halaman ${i + 1} / ${pages.length}`;
    p.drawText(pg, { x: W - M - font.widthOfTextAtSize(pg, 7), y: 24, size: 7, font, color: MUTED });
  });

  const safe = docNo.replace(/[^\w-]+/g, "_");
  return { bytes: await pdf.save(), filename: `${isSj ? "SuratJalan" : o.invoice_no ? "Invoice" : "Pesanan"}_${safe}.pdf` };
}

/** Lampiran PDF untuk nodemailer. */
export async function orderPdfAttachment(soId: number, doc: PdfDoc = "invoice") {
  const pdf = await orderPdf(soId, doc);
  return pdf ? [{ filename: pdf.filename, content: Buffer.from(pdf.bytes), contentType: "application/pdf" }] : [];
}
