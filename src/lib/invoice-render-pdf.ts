import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { HARAKA_LOGO, KAN_LOGO } from "./doc-assets";
import { ddmmyyyy, qtyFmt, rp, sumQty, tanggalPanjang, words, type InvoiceDoc } from "./invoice-doc";

// Warna mengikuti template invoice resmi
const BLACK = rgb(0, 0, 0);
const ORANGE = rgb(0.929, 0.49, 0.192); // garis kop
const PEACH = rgb(0.957, 0.694, 0.514); // isi kepala & total tabel
const LINK = rgb(0.067, 0.333, 0.8);

// Font standar PDF hanya mendukung WinAnsi
const clean = (s: string) => s.replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, "?");

function wrap(text: string, font: PDFFont, size: number, max: number) {
  const out: string[] = [];
  for (const para of clean(text).split("\n")) {
    let line = "";
    for (const w of para.split(" ")) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > max && line) {
        out.push(line);
        line = w;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

export async function renderInvoicePdf(doc: InvoiceDoc): Promise<Uint8Array> {
  const s = (k: string) => clean(doc.settings[k] ?? "");
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${doc.number}`);
  pdf.setAuthor(s("company_name"));
  const times = await pdf.embedFont(StandardFonts.TimesRoman);
  const timesB = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const timesBI = await pdf.embedFont(StandardFonts.TimesRomanBoldItalic);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(Buffer.from(HARAKA_LOGO.base64, "base64"));
  const kan = await pdf.embedPng(Buffer.from(KAN_LOGO.base64, "base64"));

  const W = 595.28;
  const H = 841.89;
  let page: PDFPage = pdf.addPage([W, H]);

  const text = (t: string, x: number, y: number, o: { font?: PDFFont; size?: number; align?: "left" | "center" | "right"; color?: RGB } = {}) => {
    const font = o.font ?? times;
    const size = o.size ?? 10;
    const str = clean(t);
    const w = font.widthOfTextAtSize(str, size);
    const dx = o.align === "center" ? -w / 2 : o.align === "right" ? -w : 0;
    page.drawText(str, { x: x + dx, y, size, font, color: o.color ?? BLACK });
    return w;
  };
  const rect = (x: number, y: number, w: number, h: number, fill?: RGB) =>
    page.drawRectangle({ x, y, width: w, height: h, borderColor: BLACK, borderWidth: 0.6, color: fill });

  // ---------------- Kop ----------------
  const top = H - 42;
  const logoW = 150;
  page.drawImage(logo, { x: 46, y: top - (logoW * HARAKA_LOGO.height) / HARAKA_LOGO.width - 10, width: logoW, height: (logoW * HARAKA_LOGO.height) / HARAKA_LOGO.width });
  const kanW = 92;
  const kanH = (kanW * KAN_LOGO.height) / KAN_LOGO.width;
  page.drawRectangle({ x: W - 46 - kanW - 6, y: top - kanH - 6, width: kanW + 6, height: kanH + 6, borderColor: ORANGE, borderWidth: 0.8 });
  page.drawImage(kan, { x: W - 46 - kanW - 3, y: top - kanH - 3, width: kanW, height: kanH });

  const cx = 315;
  let hy = top - 10;
  text(s("company_name").toUpperCase(), cx, hy, { font: helvB, size: 12, align: "center" });
  hy -= 13;
  for (const l of wrap(s("company_address"), helv, 8.5, 210)) {
    text(l, cx, hy, { font: helv, size: 8.5, align: "center" });
    hy -= 10.5;
  }
  text(`No.HP: ${s("company_phone").replace(/-/g, "")}`, cx, hy, { font: helv, size: 8.5, align: "center" });
  hy -= 10.5;
  const emailLabel = "Email: ";
  const email = s("company_email");
  const ew = helv.widthOfTextAtSize(emailLabel + email, 8.5);
  text(emailLabel, cx - ew / 2, hy, { font: helv, size: 8.5 });
  const lw = text(email, cx - ew / 2 + helv.widthOfTextAtSize(emailLabel, 8.5), hy, { font: helv, size: 8.5, color: LINK });
  page.drawLine({ start: { x: cx - ew / 2 + helv.widthOfTextAtSize(emailLabel, 8.5), y: hy - 1.5 }, end: { x: cx - ew / 2 + helv.widthOfTextAtSize(emailLabel, 8.5) + lw, y: hy - 1.5 }, thickness: 0.5, color: LINK });

  let y = Math.min(hy, top - kanH - 6) - 8;
  page.drawLine({ start: { x: 46, y }, end: { x: W - 46, y }, thickness: 1.6, color: BLACK });
  page.drawLine({ start: { x: 46, y: y - 3 }, end: { x: W - 46, y: y - 3 }, thickness: 2, color: ORANGE });

  // ---------------- Judul ----------------
  y -= 26;
  text("INVOICE", W / 2, y, { font: timesB, size: 15, align: "center" });
  y -= 13;
  text(`No. ${doc.number}`, W / 2, y, { size: 10, align: "center" });

  // ---------------- Pelanggan ----------------
  y -= 26;
  const lx = 50;
  const vx = 150;
  text("CUSTOMER", lx, y, { font: timesB });
  text(":", vx - 6, y, { font: timesB });
  text(`TANGGAL : ${ddmmyyyy(doc.date)}`, W - 80, y, { align: "right" });
  const fields: [string, string][] = [
    ["NAMA", doc.customer.name],
    ["ALAMAT", doc.customer.address],
    ["KOTA", doc.customer.city],
    ["NO TELPON", doc.customer.phone],
  ];
  for (const [k, v] of fields) {
    const lines = wrap(v || "-", times, 10, W - vx - 60);
    y -= 12.5;
    text(k, lx, y);
    text(":", vx - 6, y);
    text(lines[0], vx, y);
    for (const extra of lines.slice(1)) {
      y -= 12;
      text(extra, vx, y);
    }
  }

  // ---------------- Tabel ----------------
  const tx = 80;
  const cols = [24, 78, 96, 60, 80, 97]; // No, Kode, Nama, Qty, Harga, Total
  const colX = cols.reduce<number[]>((a, w, i) => [...a, i === 0 ? tx : a[i - 1] + cols[i - 1]], []);
  const tw = cols.reduce((a, b) => a + b, 0);
  const rowH = 13;

  const header = () => {
    const heads = ["No", doc.labels.code, doc.labels.name, doc.labels.qty, "Harga (Rp)", "Total (Rp)"];
    heads.forEach((h, i) => {
      rect(colX[i], y - rowH + 3, cols[i], rowH, PEACH);
      text(h, colX[i] + cols[i] / 2, y - rowH + 6.5, { font: timesB, size: 9.5, align: "center" });
    });
    y -= rowH;
  };
  y -= 22;
  header();

  const money = (x: number, w: number, amount: number, bold = false) => {
    const f = bold ? timesB : times;
    text("Rp", x + 3, y - rowH + 6.5, { font: f, size: 9.5 });
    text(rp(amount), x + w - 3, y - rowH + 6.5, { font: f, size: 9.5, align: "right" });
  };

  doc.rows.forEach((r, i) => {
    if (y - rowH < 200) {
      page = pdf.addPage([W, H]);
      y = H - 60;
      header();
    }
    const cells = [String(i + 1), r.code, r.name, qtyFmt(r.qty, doc.qtyDecimals)];
    cells.forEach((c, j) => {
      rect(colX[j], y - rowH + 3, cols[j], rowH);
      const maxW = cols[j] - 6;
      let str = clean(c);
      while (times.widthOfTextAtSize(str, 9.5) > maxW && str.length > 1) str = str.slice(0, -2) + "…";
      text(str, colX[j] + cols[j] / 2, y - rowH + 6.5, { size: 9.5, align: "center" });
    });
    rect(colX[4], y - rowH + 3, cols[4], rowH);
    rect(colX[5], y - rowH + 3, cols[5], rowH);
    money(colX[4], cols[4], r.price);
    money(colX[5], cols[5], r.qty * r.price);
    y -= rowH;
  });

  // Penyesuaian (subtotal/diskon/PPN) sebelum total
  for (const a of doc.adjustments) {
    rect(tx, y - rowH + 3, tw - cols[5], rowH);
    text(a.label, colX[5] - 4, y - rowH + 6.5, { size: 9.5, align: "right" });
    rect(colX[5], y - rowH + 3, cols[5], rowH);
    money(colX[5], cols[5], a.amount);
    y -= rowH;
  }

  // JUMLAH TAGIHAN
  const span1 = cols[0] + cols[1] + cols[2];
  rect(tx, y - rowH + 3, span1, rowH, PEACH);
  text("JUMLAH TAGIHAN", tx + span1 / 2, y - rowH + 6.5, { font: timesB, size: 9.5, align: "center" });
  rect(colX[3], y - rowH + 3, cols[3], rowH, PEACH);
  text(doc.qtyDecimals ? qtyFmt(sumQty(doc), doc.qtyDecimals) : "", colX[3] + cols[3] / 2, y - rowH + 6.5, { font: timesB, size: 9.5, align: "center" });
  rect(colX[4], y - rowH + 3, cols[4] + cols[5], rowH, PEACH);
  text(`Rp${rp(doc.total)}`, colX[5] + cols[5] - 3, y - rowH + 6.5, { font: timesB, size: 9.5, align: "right" });
  y -= rowH;

  for (const a of doc.after) {
    rect(tx, y - rowH + 3, tw - cols[5], rowH);
    text(a.label, colX[5] - 4, y - rowH + 6.5, { size: 9.5, align: "right" });
    rect(colX[5], y - rowH + 3, cols[5], rowH);
    money(colX[5], cols[5], a.amount, a.label.toLowerCase().includes("sisa"));
    y -= rowH;
  }

  // ---------------- Terbilang ----------------
  y -= 14;
  const tLines = wrap(words(doc), timesBI, 10.5, tw - 100);
  const tH = Math.max(28, tLines.length * 13 + 8);
  rect(tx, y - tH, tw, tH);
  page.drawLine({ start: { x: tx + 90, y }, end: { x: tx + 90, y: y - tH }, thickness: 0.6, color: BLACK });
  text("Terbilang :", tx + 4, y - 14, { font: timesB, size: 10.5 });
  tLines.forEach((l, i) => text(l, tx + 96, y - 14 - i * 13, { font: timesBI, size: 10.5 }));
  y -= tH;

  // ---------------- Catatan & tanda tangan ----------------
  y -= 16;
  const noteLines: { t: string; bold?: boolean }[] = [
    { t: "Catatan:" },
    { t: "Pembayaran melalui transfer, ditujukan kepada :" },
    { t: s("bank_holder") || s("company_name").toUpperCase(), bold: true },
    { t: s("bank_name"), bold: true },
    { t: `No Rek : ${s("bank_account")}`, bold: true },
    ...wrap(doc.notes, times, 9.5, 220).filter(Boolean).map((t) => ({ t })),
  ];
  const nH = noteLines.length * 12 + 6;
  if (y - nH - 90 < 40) {
    page = pdf.addPage([W, H]);
    y = H - 60;
  }
  rect(tx, y - nH, 228, nH);
  noteLines.forEach((l, i) => text(l.t, tx + 3, y - 11 - i * 12, { font: l.bold ? timesB : times, size: 10 }));

  const sx = 455;
  const sy = y - nH - 10;
  text(`${s("invoice_city") || "Jember"}, ${tanggalPanjang(doc.date)}`, sx, sy, { font: timesB, size: 10.5, align: "center" });
  const signer = s("signer_name");
  const nameY = sy - 70;
  const nw = text(signer, sx, nameY, { font: timesB, size: 10.5, align: "center" });
  page.drawLine({ start: { x: sx - nw / 2, y: nameY - 2 }, end: { x: sx + nw / 2, y: nameY - 2 }, thickness: 0.7, color: BLACK });

  return pdf.save();
}
