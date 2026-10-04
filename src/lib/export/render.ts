import "server-only";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { HARAKA_LOGO } from "../doc-assets";
import type { Col } from "./datasets";

type Row = Record<string, unknown>;
export type ExportMeta = { title: string; subtitle: string; company: string };

const DEFAULT_WIDTH: Record<string, number> = { money: 15, date: 12, number: 10, decimal: 11, pct: 11, text: 14 };
const widthOf = (c: Col) => c.width ?? DEFAULT_WIDTH[c.type ?? "text"];
const isNum = (c: Col) => ["money", "number", "decimal", "pct"].includes(c.type ?? "text");
const ddmmyyyy = (s: string) => (/^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s);

/** Nilai sel sebagai teks (untuk PDF/Word/CSV). */
export function display(c: Col, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  switch (c.type) {
    case "money":
      return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n))}`;
    case "number":
      return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
    case "decimal":
      return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
    case "pct":
      return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(n)}%`;
    case "date":
      return ddmmyyyy(String(v));
    default:
      return String(v);
  }
}

/* --------------------------------- Excel --------------------------------- */

export async function toXlsx(meta: ExportMeta, cols: Col[], rows: Row[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.company;
  wb.created = new Date();
  const ws = wb.addWorksheet(meta.title.slice(0, 31).replace(/[\\/?*[\]:]/g, " "), {
    pageSetup: { orientation: cols.length > 6 ? "landscape" : "portrait", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: "frozen", ySplit: 4 }],
  });
  ws.columns = cols.map((c) => ({ key: c.key, width: Math.max(widthOf(c), c.label.length + 2) }));

  ws.mergeCells(1, 1, 1, cols.length);
  ws.getCell(1, 1).value = `${meta.company.toUpperCase()} — ${meta.title}`;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FF005F87" } };
  ws.mergeCells(2, 1, 2, cols.length);
  ws.getCell(2, 1).value = meta.subtitle;
  ws.getCell(2, 1).font = { italic: true, size: 9, color: { argb: "FF5F6B76" } };

  const header = ws.getRow(4);
  cols.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true, color: { argb: "FF0B2A3F" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4B183" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });
  header.height = 22;

  rows.forEach((r, ri) => {
    const row = ws.getRow(5 + ri);
    cols.forEach((c, ci) => {
      const cell = row.getCell(ci + 1);
      const v = r[c.key];
      if (v === null || v === undefined || v === "") cell.value = null;
      else if (c.type === "date" && /^\d{4}-\d{2}-\d{2}/.test(String(v))) {
        const s = String(v);
        cell.value = new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))));
        cell.numFmt = "dd/mm/yyyy";
      } else if (isNum(c) && Number.isFinite(Number(v))) {
        cell.value = c.type === "pct" ? Number(v) / 100 : Number(v);
        cell.numFmt = c.type === "money" ? '"Rp" #,##0' : c.type === "pct" ? "0.0%" : c.type === "decimal" ? "#,##0.00" : "#,##0";
      } else cell.value = String(v);
      cell.border = { top: { style: "hair" }, bottom: { style: "hair" }, left: { style: "hair" }, right: { style: "hair" } };
      cell.alignment = { vertical: "top", wrapText: !isNum(c) && widthOf(c) >= 24 };
    });
  });

  // Baris total untuk kolom rupiah
  const moneyCols = cols.map((c, i) => ({ c, i })).filter((x) => x.c.type === "money");
  if (rows.length && moneyCols.length) {
    const tr = ws.getRow(5 + rows.length);
    tr.getCell(1).value = "TOTAL";
    tr.getCell(1).font = { bold: true };
    for (const { i } of moneyCols) {
      const col = ws.getColumn(i + 1).letter;
      const cell = tr.getCell(i + 1);
      cell.value = { formula: `SUM(${col}5:${col}${4 + rows.length})` };
      cell.numFmt = '"Rp" #,##0';
      cell.font = { bold: true };
    }
    for (let i = 1; i <= cols.length; i++) tr.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } };
  }
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + rows.length, column: cols.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ---------------------------------- PDF ---------------------------------- */

const clean = (s: string) => s.replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, "?");

function wrapCell(text: string, font: PDFFont, size: number, max: number, maxLines = 3) {
  const words = clean(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = cut[maxLines - 1].replace(/.{0,2}$/, "…");
    return cut;
  }
  // Satu kata yang lebih lebar dari sel: potong
  return lines.map((l) => {
    let s = l;
    while (font.widthOfTextAtSize(s, size) > max && s.length > 1) s = s.slice(0, -2) + "…";
    return s;
  });
}

export async function toPdf(meta: ExportMeta, cols: Col[], rows: Row[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(meta.title);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(Buffer.from(HARAKA_LOGO.base64, "base64"));
  const landscape = cols.length > 5;
  const W = landscape ? 841.89 : 595.28;
  const H = landscape ? 595.28 : 841.89;
  const M = 30;
  const avail = W - 2 * M;
  const total = cols.reduce((s, c) => s + widthOf(c), 0);
  const cw = cols.map((c) => (widthOf(c) / total) * avail);
  const size = cols.length > 9 ? 7 : 8;
  const ink = rgb(0.106, 0.153, 0.2);
  const peach = rgb(0.957, 0.694, 0.514);
  const zebra = rgb(0.973, 0.98, 0.988);

  let page: PDFPage;
  let y = 0;
  const pages: PDFPage[] = [];
  const newPage = () => {
    page = pdf.addPage([W, H]);
    pages.push(page);
    y = H - M;
    const lw = 110;
    page.drawImage(logo, { x: M, y: y - (lw * HARAKA_LOGO.height) / HARAKA_LOGO.width, width: lw, height: (lw * HARAKA_LOGO.height) / HARAKA_LOGO.width });
    page.drawText(clean(meta.title), { x: M + lw + 14, y: y - 12, size: 13, font: bold, color: rgb(0, 0.373, 0.529) });
    page.drawText(clean(`${meta.company} · ${meta.subtitle}`), { x: M + lw + 14, y: y - 25, size: 7.5, font, color: rgb(0.37, 0.42, 0.46) });
    y -= 36;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.2, color: ink });
    page.drawLine({ start: { x: M, y: y - 2.5 }, end: { x: W - M, y: y - 2.5 }, thickness: 1.5, color: rgb(0.929, 0.49, 0.192) });
    y -= 10;
    // Kepala tabel (diulang di setiap halaman)
    const heads = cols.map((c, i) => wrapCell(c.label, bold, size, cw[i] - 6, 2));
    const hh = Math.max(...heads.map((h) => h.length)) * (size + 2) + 6;
    let x = M;
    cols.forEach((c, i) => {
      page.drawRectangle({ x, y: y - hh, width: cw[i], height: hh, color: peach, borderColor: ink, borderWidth: 0.4 });
      const lines = heads[i];
      lines.forEach((t, li) => page.drawText(t, { x: x + 3, y: y - (size + 2) * (li + 1) - 1, size, font: bold, color: ink }));
      x += cw[i];
    });
    y -= hh;
  };
  newPage();

  rows.forEach((r, ri) => {
    const cells = cols.map((c, i) => wrapCell(display(c, r[c.key]), font, size, cw[i] - 6));
    const rh = Math.max(...cells.map((l) => l.length)) * (size + 2) + 5;
    if (y - rh < M + 14) newPage();
    let x = M;
    cols.forEach((c, i) => {
      page.drawRectangle({ x, y: y - rh, width: cw[i], height: rh, color: ri % 2 ? zebra : undefined, borderColor: rgb(0.85, 0.87, 0.9), borderWidth: 0.4 });
      cells[i].forEach((line, li) => {
        const tw = font.widthOfTextAtSize(line, size);
        page.drawText(line, { x: isNum(c) ? x + cw[i] - 3 - tw : x + 3, y: y - (size + 2) * (li + 1) + 0.5, size, font, color: ink });
      });
      x += cw[i];
    });
    y -= rh;
  });
  if (!rows.length) page!.drawText("Tidak ada data.", { x: M, y: y - 16, size: 9, font, color: ink });

  // Total kolom rupiah
  const moneyIdx = cols.map((c, i) => (c.type === "money" ? i : -1)).filter((i) => i >= 0);
  if (rows.length && moneyIdx.length) {
    const rh = size + 9;
    if (y - rh < M + 14) newPage();
    let x = M;
    cols.forEach((c, i) => {
      page.drawRectangle({ x, y: y - rh, width: cw[i], height: rh, color: rgb(0.988, 0.894, 0.839), borderColor: ink, borderWidth: 0.4 });
      const t = i === 0 ? "TOTAL" : moneyIdx.includes(i) ? display(c, rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0)) : "";
      if (t) {
        const tw = bold.widthOfTextAtSize(t, size);
        page.drawText(t, { x: i === 0 ? x + 3 : x + cw[i] - 3 - tw, y: y - rh + 5, size, font: bold, color: ink });
      }
      x += cw[i];
    });
  }
  pages.forEach((p, i) => {
    const t = `Halaman ${i + 1} / ${pages.length} · ${rows.length} baris`;
    p.drawText(t, { x: W - M - font.widthOfTextAtSize(t, 7), y: 14, size: 7, font, color: rgb(0.37, 0.42, 0.46) });
  });
  return pdf.save();
}

/* ---------------------------------- Word ---------------------------------- */

export async function toDocx(meta: ExportMeta, cols: Col[], rows: Row[]): Promise<Buffer> {
  const landscape = cols.length > 5;
  const pageW = landscape ? 16838 : 11906;
  const contentW = pageW - 1200;
  const total = cols.reduce((s, c) => s + widthOf(c), 0);
  const widths = cols.map((c) => Math.floor((widthOf(c) / total) * contentW));
  const size = cols.length > 9 ? 14 : 16; // half-points
  const border = { style: BorderStyle.SINGLE, size: 2, color: "BFC7CF" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (text: string, w: number, o: { bold?: boolean; fill?: string; right?: boolean } = {}) =>
    new TableCell({
      width: { size: w, type: WidthType.DXA },
      borders,
      shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
      margins: { left: 50, right: 50, top: 20, bottom: 20 },
      children: [new Paragraph({ alignment: o.right ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text, bold: o.bold, size, font: "Calibri" })] })],
    });

  const moneyIdx = cols.map((c, i) => (c.type === "money" ? i : -1)).filter((i) => i >= 0);
  const table = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: contentW, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: cols.map((c, i) => cell(c.label, widths[i], { bold: true, fill: "F4B183" })) }),
      ...rows.map((r) => new TableRow({ children: cols.map((c, i) => cell(display(c, r[c.key]), widths[i], { right: isNum(c) })) })),
      ...(rows.length && moneyIdx.length
        ? [
            new TableRow({
              children: cols.map((c, i) =>
                cell(i === 0 ? "TOTAL" : moneyIdx.includes(i) ? display(c, rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0)) : "", widths[i], {
                  bold: true,
                  fill: "FCE4D6",
                  right: i !== 0,
                }),
              ),
            }),
          ]
        : []),
    ],
  });
  const lw = 150;
  const doc = new Document({
    creator: meta.company,
    title: meta.title,
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838, orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
            margin: { top: 700, bottom: 700, left: 600, right: 600 },
          },
        },
        children: [
          new Paragraph({
            children: [new ImageRun({ type: "png", data: Buffer.from(HARAKA_LOGO.base64, "base64"), transformation: { width: lw, height: Math.round((lw * HARAKA_LOGO.height) / HARAKA_LOGO.width) } })],
          }),
          new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: meta.title, bold: true, size: 28, color: "005F87", font: "Calibri" })] }),
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "ED7D31", space: 4 } },
            spacing: { after: 200 },
            children: [new TextRun({ text: `${meta.company} · ${meta.subtitle}`, italics: true, size: 16, color: "5F6B76", font: "Calibri" })],
          }),
          rows.length ? table : new Paragraph({ children: [new TextRun({ text: "Tidak ada data.", size: 18 })] }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

/* ---------------------------------- CSV ---------------------------------- */

export function toCsvCols(cols: Col[], rows: Row[]) {
  const esc = (s: string) => (/[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [cols.map((c) => esc(c.label)).join(","), ...rows.map((r) => cols.map((c) => esc(c.type === "date" ? display(c, r[c.key]) : String(r[c.key] ?? ""))).join(","))].join("\r\n");
}
