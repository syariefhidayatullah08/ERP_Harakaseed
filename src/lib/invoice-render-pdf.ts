import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { HARAKA_LOGO, KAN_LOGO } from "./doc-assets";
import { ddmmyyyy, rp, signers, tanggalPanjang, words, type InvoiceDoc } from "./invoice-doc";
import { embedSignature, fitSignature } from "./signature";

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

  // ---------------- Tabel (susunan kolom mengikuti doc.columns) ----------------
  const tx = 80;
  const tw = 435;
  const noW = 22;
  const share = doc.columns.reduce((a, c) => a + c.w, 0);
  const cols = [noW, ...doc.columns.map((c) => ((tw - noW) * c.w) / share)];
  const colX = cols.reduce<number[]>((a, w, i) => [...a, i === 0 ? tx : a[i - 1] + cols[i - 1]], []);
  const lastI = cols.length - 1;
  const rowH = 13;
  const fit = (t: string, maxW: number, font = times) => {
    // Teks panjang dikecilkan dulu, baru dipotong bila masih tidak muat.
    let str = clean(t);
    let size = 9.5;
    while (font.widthOfTextAtSize(str, size) > maxW && size > 7) size -= 0.5;
    while (font.widthOfTextAtSize(str, size) > maxW && str.length > 1) str = str.slice(0, -2) + "…";
    return { str, size };
  };
  const header = () => {
    ["No", ...doc.columns.map((c) => c.label)].forEach((h, i) => {
      rect(colX[i], y - rowH + 3, cols[i], rowH, PEACH);
      const { str, size } = fit(h, cols[i] - 4, timesB);
      text(str, colX[i] + cols[i] / 2, y - rowH + 6.5, { font: timesB, size, align: "center" });
    });
    y -= rowH;
  };
  const money = (x: number, w: number, amount: number, bold = false) => {
    const f = bold ? timesB : times;
    text("Rp", x + 3, y - rowH + 6.5, { font: f, size: 9.5 });
    text(rp(amount), x + w - 3, y - rowH + 6.5, { font: f, size: 9.5, align: "right" });
  };
  /** Baris berlabel: label rata kanan menjangkau semua kolom kecuali kolom terakhir (uang). */
  const labelRow = (label: string, amount: number, bold = false, fill?: RGB) => {
    rect(tx, y - rowH + 3, tw - cols[lastI], rowH, fill);
    text(label, fill ? tx + (tw - cols[lastI]) / 2 : colX[lastI] - 4, y - rowH + 6.5, { font: bold ? timesB : times, size: 9.5, align: fill ? "center" : "right" });
    rect(colX[lastI], y - rowH + 3, cols[lastI], rowH, fill);
    money(colX[lastI], cols[lastI], amount, bold);
    y -= rowH;
  };
  y -= 22;
  header();
  for (const b of doc.before) labelRow(b.label, b.amount, true, PEACH);

  doc.rows.forEach((r, i) => {
    if (y - rowH < 200) {
      page = pdf.addPage([W, H]);
      y = H - 60;
      header();
    }
    [String(i + 1), ...r].forEach((c, j) => {
      rect(colX[j], y - rowH + 3, cols[j], rowH);
      if (typeof c === "number") money(colX[j], cols[j], c);
      else {
        const { str, size } = fit(c, cols[j] - 6);
        text(str, colX[j] + cols[j] / 2, y - rowH + 6.5, { size, align: "center" });
      }
    });
    y -= rowH;
  });

  // Penyesuaian (subtotal/diskon/PPN) sebelum total
  for (const a of doc.adjustments) labelRow(a.label, a.amount);

  // Baris total: label menjangkau kolom sebelum kolom jumlah; jumlah kuantitas di kolom sumCol; nilai di sisa kolom.
  const sumI = doc.sumCol !== undefined ? doc.sumCol + 1 : -1;
  const labelEnd = sumI > 0 ? colX[sumI] : colX[lastI - 1];
  rect(tx, y - rowH + 3, labelEnd - tx, rowH, PEACH);
  text(doc.totalLabel, tx + (labelEnd - tx) / 2, y - rowH + 6.5, { font: timesB, size: 9.5, align: "center" });
  if (sumI > 0) {
    rect(colX[sumI], y - rowH + 3, cols[sumI], rowH, PEACH);
    text(doc.sumText, colX[sumI] + cols[sumI] / 2, y - rowH + 6.5, { font: timesB, size: 9.5, align: "center" });
  }
  const restX = sumI > 0 ? colX[sumI] + cols[sumI] : labelEnd;
  rect(restX, y - rowH + 3, tx + tw - restX, rowH, PEACH);
  text(`Rp${rp(doc.total)}`, tx + tw - 3, y - rowH + 6.5, { font: timesB, size: 9.5, align: "right" });
  y -= rowH;

  for (const a of doc.after) labelRow(a.label, a.amount, !!a.bold, a.label === "SISA DEPOSITO" ? PEACH : undefined);

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
  if (y - nH - 120 < 40) {
    page = pdf.addPage([W, H]);
    y = H - 60;
  }
  rect(tx, y - nH, 228, nH);
  noteLines.forEach((l, i) => text(l.t, tx + 3, y - 11 - i * 12, { font: l.bold ? timesB : times, size: 10 }));

  // Dua penanda tangan seperti template: kiri Direktur, kanan ADM & SDM (tempat & tanggal di atas yang kanan).
  const [left, right] = signers(doc.settings);
  const sy = y - nH - 14;
  text(`${s("invoice_city") || "Jember"}, ${tanggalPanjang(doc.date)}`, 455, sy, { size: 10.5, align: "center" });
  for (const [who, sx] of [[left, 160], [right, 455]] as const) {
    if (!who.name) continue;
    text(who.title, sx, sy - 14, { font: timesB, size: 10.5, align: "center" });
    const nameY = sy - 84;
    if (who.sig) {
      const d = fitSignature(who.sig, 175, 62);
      page.drawImage(await embedSignature(pdf, who.sig), { x: sx - d.width / 2, y: nameY + 3, ...d });
    }
    const nw = text(who.name, sx, nameY, { font: timesB, size: 10.5, align: "center" });
    page.drawLine({ start: { x: sx - nw / 2, y: nameY - 2 }, end: { x: sx + nw / 2, y: nameY - 2 }, thickness: 0.7, color: BLACK });
  }

  return pdf.save();
}
