import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type ITableCellBorders,
} from "docx";
import { HARAKA_LOGO, KAN_LOGO } from "./doc-assets";
import { ddmmyyyy, rp, signers, tanggalPanjang, words, type InvoiceDoc } from "./invoice-doc";
import { fitSignature, signatureBytes, type Signature } from "./signature";

const FONT = "Times New Roman";
const PEACH = "F4B183";
const ORANGE = "ED7D31";

// Ukuran dalam DXA (1/20 pt). Lebar isi A4 dengan margin 1,6 cm ≈ 9900.
const run = (t: string, o: { bold?: boolean; italics?: boolean; size?: number; font?: string; color?: string; underline?: boolean } = {}) =>
  new TextRun({ text: t, bold: o.bold, italics: o.italics, size: (o.size ?? 10) * 2, font: o.font ?? FONT, color: o.color, underline: o.underline ? {} : undefined });
const para = (children: (TextRun | ImageRun)[] | TextRun | ImageRun, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT, after = 0) =>
  new Paragraph({ children: Array.isArray(children) ? children : [children], alignment: align, spacing: { after, before: 0 } });

const line = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allBorders: ITableCellBorders = { top: line, bottom: line, left: line, right: line };
const noBorders: ITableCellBorders = { top: none, bottom: none, left: none, right: none };

function cell(content: Paragraph[] | Paragraph, width: number, o: { fill?: string; span?: number; borders?: ITableCellBorders; top?: boolean } = {}) {
  return new TableCell({
    children: Array.isArray(content) ? content : [content],
    width: { size: width, type: WidthType.DXA },
    columnSpan: o.span,
    borders: o.borders ?? allBorders,
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    verticalAlign: o.top ? VerticalAlign.TOP : VerticalAlign.CENTER,
    margins: { left: 60, right: 60, top: 20, bottom: 20 },
  });
}

export async function renderInvoiceDocx(doc: InvoiceDoc): Promise<Buffer> {
  const s = (k: string) => doc.settings[k] ?? "";
  const logoW = 190;
  const kanW = 120;

  // ---------------- Kop ----------------
  const kop = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 9900, type: WidthType.DXA },
    columnWidths: [2900, 4900, 2100],
    rows: [
      new TableRow({
        children: [
          cell(
            para(new ImageRun({ type: "png", data: Buffer.from(HARAKA_LOGO.base64, "base64"), transformation: { width: logoW, height: Math.round((logoW * HARAKA_LOGO.height) / HARAKA_LOGO.width) } })),
            2900,
            { borders: noBorders },
          ),
          cell(
            [
              para(run(s("company_name").toUpperCase(), { bold: true, size: 12, font: "Arial" }), AlignmentType.CENTER),
              para(run(s("company_address"), { size: 8.5, font: "Arial" }), AlignmentType.CENTER),
              para(run(`No.HP: ${s("company_phone").replace(/-/g, "")}`, { size: 8.5, font: "Arial" }), AlignmentType.CENTER),
              para([run("Email: ", { size: 8.5, font: "Arial" }), run(s("company_email"), { size: 8.5, font: "Arial", color: "1155CC", underline: true })], AlignmentType.CENTER),
            ],
            4900,
            { borders: noBorders },
          ),
          cell(
            para(new ImageRun({ type: "png", data: Buffer.from(KAN_LOGO.base64, "base64"), transformation: { width: kanW, height: Math.round((kanW * KAN_LOGO.height) / KAN_LOGO.width) } }), AlignmentType.RIGHT),
            2100,
            { borders: noBorders },
          ),
        ],
      }),
    ],
  });
  // Garis hitam + oranye di bawah kop
  const kopLine = [
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 14, color: "000000", space: 1 } }, spacing: { after: 30 }, children: [] }),
    new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 18, color: ORANGE, space: 1 } }, spacing: { after: 180 }, children: [] }),
  ];

  // ---------------- Pelanggan ----------------
  const custRow = (k: string, v: string, right = "") =>
    new TableRow({
      children: [
        cell(para(run(k, { bold: k === "CUSTOMER" })), 1700, { borders: noBorders }),
        cell(para(run(`:  ${v}`, { bold: k === "CUSTOMER" })), 5600, { borders: noBorders }),
        cell(para(run(right), AlignmentType.RIGHT), 2600, { borders: noBorders }),
      ],
    });
  const customer = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 9900, type: WidthType.DXA },
    columnWidths: [1700, 5600, 2600],
    rows: [
      custRow("CUSTOMER", "", `TANGGAL : ${ddmmyyyy(doc.date)}`),
      custRow("NAMA", doc.customer.name),
      custRow("ALAMAT", doc.customer.address || "-"),
      custRow("KOTA", doc.customer.city || "-"),
      custRow("NO TELPON", doc.customer.phone || "-"),
    ],
  });

  // ---------------- Tabel item (susunan kolom mengikuti doc.columns) ----------------
  const TW = 8400;
  const noW = 450;
  const share = doc.columns.reduce((a, c) => a + c.w, 0);
  const W = [noW, ...doc.columns.map((c) => Math.round(((TW - noW) * c.w) / share))];
  const lastI = W.length - 1;
  const sum = (from: number, to: number) => W.slice(from, to).reduce((a, b) => a + b, 0);
  const center = (t: string, bold = false) => para(run(t, { bold, size: 9.5 }), AlignmentType.CENTER);
  // Kolom uang: posisi tab rata kanan menyesuaikan lebar selnya.
  const moneyIn = (w: number, n: number, bold = false) =>
    new Paragraph({ tabStops: [{ type: "right", position: w - 130 }], children: [run("Rp", { bold, size: 9.5 }), new TextRun({ text: `\t${rp(n)}`, bold, size: 19, font: FONT })] });
  const head = new TableRow({ tableHeader: true, children: ["No", ...doc.columns.map((c) => c.label)].map((h, i) => cell(center(h, true), W[i], { fill: PEACH })) });
  const body = doc.rows.map(
    (r, i) => new TableRow({ children: [String(i + 1), ...r].map((c, j) => cell(typeof c === "number" ? moneyIn(W[j], c) : center(c), W[j])) }),
  );
  const labelRow = (label: string, amount: number, bold = false, fill?: string) =>
    new TableRow({
      children: [
        cell(para(run(label, { bold, size: 9.5 }), fill ? AlignmentType.CENTER : AlignmentType.RIGHT), sum(0, lastI), { span: lastI, fill }),
        cell(moneyIn(W[lastI], amount, bold), W[lastI], { fill }),
      ],
    });
  const sumI = doc.sumCol !== undefined ? doc.sumCol + 1 : -1;
  const labelSpan = sumI > 0 ? sumI : lastI - 1;
  const totalRow = new TableRow({
    children: [
      cell(center(doc.totalLabel, true), sum(0, labelSpan), { span: labelSpan, fill: PEACH }),
      ...(sumI > 0 ? [cell(center(doc.sumText, true), W[sumI], { fill: PEACH })] : []),
      cell(para(run(`Rp${rp(doc.total)}`, { bold: true, size: 9.5 }), AlignmentType.RIGHT), sum(sumI > 0 ? sumI + 1 : labelSpan, W.length), { span: W.length - (sumI > 0 ? sumI + 1 : labelSpan), fill: PEACH }),
    ],
  });
  const items = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: TW, type: WidthType.DXA },
    columnWidths: W,
    indent: { size: 700, type: WidthType.DXA },
    rows: [
      head,
      ...doc.before.map((b) => labelRow(b.label, b.amount, true, PEACH)),
      ...body,
      ...doc.adjustments.map((a) => labelRow(a.label, a.amount)),
      totalRow,
      ...doc.after.map((a) => labelRow(a.label, a.amount, !!a.bold, a.label === "SISA DEPOSITO" ? PEACH : undefined)),
    ],
  });

  // ---------------- Terbilang ----------------
  const terbilang = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 8400, type: WidthType.DXA },
    columnWidths: [1500, 6900],
    indent: { size: 700, type: WidthType.DXA },
    rows: [new TableRow({ children: [cell(para(run("Terbilang :", { bold: true, size: 10.5 })), 1500), cell(para(run(words(doc), { bold: true, italics: true, size: 10.5 })), 6900)] })],
  });

  // ---------------- Catatan + tanda tangan ----------------
  const note = [
    para(run("Catatan:")),
    para(run("Pembayaran melalui transfer, ditujukan kepada :")),
    para(run(s("bank_holder") || s("company_name").toUpperCase(), { bold: true })),
    para(run(s("bank_name"), { bold: true })),
    para(run(`No Rek : ${s("bank_account")}`, { bold: true })),
    ...(doc.notes ? [para(run(doc.notes, { size: 9.5 }))] : []),
  ];
  const footer = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 8400, type: WidthType.DXA },
    columnWidths: [4400, 4000],
    indent: { size: 700, type: WidthType.DXA },
    rows: [new TableRow({ children: [cell(note, 4400, { top: true }), cell(para(run("")), 4000, { borders: noBorders })] })],
  });
  // Dua penanda tangan seperti template: kiri Direktur, kanan ADM & SDM (tempat & tanggal di atas yang kanan).
  const [left, right] = signers(doc.settings);
  // Ukuran gambar di Word dalam piksel (96 dpi); kotaknya sama dengan PDF (175 × 62 pt).
  const sigImage = (sig: Signature) => {
    const d = fitSignature(sig, (175 * 96) / 72, (62 * 96) / 72);
    return para(new ImageRun({ type: sig.type, data: signatureBytes(sig), transformation: { width: Math.round(d.width), height: Math.round(d.height) } }), AlignmentType.CENTER);
  };
  const signCell = (who: { title: string; name: string; sig: Signature | null }, place: string) =>
    cell(
      who.name
        ? [
            para(run(place || " ", { size: 10.5 }), AlignmentType.CENTER),
            para(run(who.title, { bold: true, size: 10.5 }), AlignmentType.CENTER, who.sig ? 40 : 1100),
            ...(who.sig ? [sigImage(who.sig)] : []),
            para(run(who.name, { bold: true, size: 10.5, underline: true }), AlignmentType.CENTER),
          ]
        : para(run("")),
      3600,
      { borders: noBorders },
    );
  const signatures = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 8400, type: WidthType.DXA },
    columnWidths: [3600, 1200, 3600],
    indent: { size: 700, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [signCell(left, ""), cell(para(run("")), 1200, { borders: noBorders }), signCell(right, `${s("invoice_city") || "Jember"}, ${tanggalPanjang(doc.date)}`)],
      }),
    ],
  });

  const gap = (after = 200) => new Paragraph({ spacing: { after }, children: [] });
  const document = new Document({
    creator: s("company_name"),
    title: `Invoice ${doc.number}`,
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 800, bottom: 800, left: 1000, right: 1000 } } },
        children: [
          kop,
          ...kopLine,
          para(run("INVOICE", { bold: true, size: 15 }), AlignmentType.CENTER),
          para(run(`No. ${doc.number}`), AlignmentType.CENTER, 240),
          customer,
          gap(),
          items,
          gap(),
          terbilang,
          gap(),
          footer,
          gap(),
          signatures,
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
}
