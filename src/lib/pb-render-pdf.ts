import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { HARAKA_LOGO } from "./doc-assets";
import { ddmmyyyy, qtyFmt, rp, signers, tanggalPanjang } from "./invoice-doc";
import type { PbDoc } from "./seed-payment";

const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.85, 0.85, 0.85);
// Font standar PDF hanya mendukung WinAnsi
const clean = (s: string) => s.replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, "?");

function wrap(text: string, font: PDFFont, size: number, max: number) {
  const out: string[] = [];
  let line = "";
  for (const w of clean(text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > max && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** Surat Pengajuan Pembayaran Benih, mengikuti tata letak referensi/Template PB Petani.xlsx. */
export async function renderPbPdf(doc: PbDoc): Promise<Uint8Array> {
  const s = (k: string) => clean(doc.settings[k] ?? "");
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Surat Pengajuan Pembayaran Benih ${doc.pb.number}`);
  pdf.setAuthor(s("company_name"));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(Buffer.from(HARAKA_LOGO.base64, "base64"));

  const W = 595.28;
  const H = 841.89;
  const M = 36;
  let page: PDFPage = pdf.addPage([W, H]);
  const text = (t: string, x: number, y: number, o: { f?: PDFFont; size?: number; align?: "left" | "center" | "right" } = {}) => {
    const f = o.f ?? font;
    const size = o.size ?? 8.5;
    const str = clean(t);
    const w = f.widthOfTextAtSize(str, size);
    page.drawText(str, { x: x - (o.align === "center" ? w / 2 : o.align === "right" ? w : 0), y, size, font: f, color: BLACK });
    return w;
  };

  // ---------------- Kop: logo kiri, nama & alamat perusahaan rata kanan ----------------
  const top = H - 34;
  const logoW = 140;
  const logoH = (logoW * HARAKA_LOGO.height) / HARAKA_LOGO.width;
  page.drawImage(logo, { x: M, y: top - logoH - 4, width: logoW, height: logoH });
  let hy = top - 10;
  text(s("company_name").toUpperCase(), W - M, hy, { f: bold, size: 12, align: "right" });
  for (const l of wrap(s("company_address"), font, 9, 250)) {
    hy -= 12;
    text(l, W - M, hy, { size: 9, align: "right" });
  }
  hy -= 12;
  text(`No. HP./WA ${s("company_phone").replace(/-/g, "")}`, W - M, hy, { size: 9, align: "right" });
  let y = Math.min(hy, top - logoH - 4) - 10;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.2, color: BLACK });

  // ---------------- Judul ----------------
  y -= 24;
  text("SURAT PENGAJUAN PEMBAYARAN BENIH", W / 2, y, { f: bold, size: 12, align: "center" });
  y -= 13;
  text(`No. ${doc.pb.number}`, W / 2, y, { size: 9.5, align: "center" });
  y -= 18;

  // ---------------- Tabel ----------------
  const cols = [
    { h: "No", w: 20 },
    { h: "Kode Produksi", w: 60 },
    { h: "Tgl JT", w: 50 },
    { h: "No Kontrak", w: 54 },
    { h: "Bobot (Kg)", w: 46 },
    { h: "Nilai Pinjaman", w: 54 },
    { h: "Harga (Rp)", w: 50 },
    { h: "Kredit Macet", w: 48 },
    { h: "Keterangan", w: 81 },
    { h: "Total (Rp)", w: 60 },
  ];
  const xs = cols.reduce<number[]>((a, c, i) => [...a, i === 0 ? M : a[i - 1] + cols[i - 1].w], []);
  const tw = cols.reduce((a, c) => a + c.w, 0);
  const box = (x: number, yTop: number, w: number, h: number, fill = false) =>
    page.drawRectangle({ x, y: yTop - h, width: w, height: h, borderColor: BLACK, borderWidth: 0.6, color: fill ? GRAY : undefined });
  const header = () => {
    cols.forEach((c, i) => {
      box(xs[i], y, c.w, 22, true);
      const lines = c.h === "Nilai Pinjaman" || c.h === "Kode Produksi" || c.h === "Kredit Macet" ? c.h.split(" ") : [c.h];
      lines.forEach((l, k) => text(l, xs[i] + c.w / 2, y - (lines.length === 1 ? 14 : 9.5 + k * 9), { f: bold, size: 8, align: "center" }));
    });
    y -= 22;
  };
  header();

  doc.rows.forEach((r, n) => {
    const note = wrap([r.farmer, r.location, r.deduction ? `potongan ${r.deduction_note || "sortir"} Rp ${rp(r.deduction)}` : "", r.notes].filter(Boolean).join(" · "), font, 7.5, cols[8].w - 6);
    const h = Math.max(15, note.length * 9 + 6);
    if (y - h < 150) {
      page = pdf.addPage([W, H]);
      y = H - 50;
      header();
    }
    cols.forEach((c, i) => box(xs[i], y, c.w, h));
    const by = y - 10.5;
    const right = (i: number, t: string) => text(t, xs[i] + cols[i].w - 3, by, { align: "right" });
    text(String(n + 1), xs[0] + cols[0].w / 2, by, { align: "center" });
    text(r.production_code, xs[1] + 3, by, { size: font.widthOfTextAtSize(clean(r.production_code), 8.5) > cols[1].w - 6 ? 7 : 8.5 });
    text(r.due_date ? ddmmyyyy(r.due_date) : "-", xs[2] + cols[2].w / 2, by, { align: "center" });
    text(r.contract_no || "-", xs[3] + cols[3].w / 2, by, { align: "center" });
    right(4, qtyFmt(r.net_kg, 2));
    right(5, rp(r.loan));
    right(6, rp(r.price));
    right(7, r.bad_debt ? rp(r.bad_debt) : "-");
    note.forEach((l, k) => text(l, xs[8] + 3, y - 9.5 - k * 9, { size: 7.5 }));
    right(9, rp(r.amount));
    y -= h;
  });

  box(M, y, tw - cols[9].w, 16, true);
  box(xs[9], y, cols[9].w, 16, true);
  text("TOTAL", M + (tw - cols[9].w) / 2, y - 11, { f: bold, size: 9, align: "center" });
  text(rp(doc.total), xs[9] + cols[9].w - 3, y - 11, { f: bold, size: 9, align: "right" });
  y -= 16;

  // ---------------- Tanda tangan: kiri Direktur, kanan ADM & SDM ----------------
  const [left, right] = signers(doc.settings);
  y -= 26;
  text(`${s("invoice_city") || "Jember"}, ${tanggalPanjang(doc.pb.pb_date)}`, W - M - 110, y, { size: 9.5, align: "center" });
  y -= 14;
  for (const [who, sx] of [[left, M + 110], [right, W - M - 110]] as const) {
    text(who.title, sx, y, { size: 9.5, align: "center" });
    const nw = text(who.name, sx, y - 68, { f: bold, size: 9.5, align: "center" });
    page.drawLine({ start: { x: sx - nw / 2, y: y - 70 }, end: { x: sx + nw / 2, y: y - 70 }, thickness: 0.6, color: BLACK });
  }

  return pdf.save();
}
