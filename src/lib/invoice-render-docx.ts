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
import { ddmmyyyy, qtyFmt, rp, sumQty, tanggalPanjang, words, type InvoiceDoc } from "./invoice-doc";

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

/** "Rp" rata kiri + angka rata kanan dalam satu sel, seperti format akuntansi di template. */
const moneyPara = (n: number, bold = false) =>
  new Paragraph({
    tabStops: [{ type: "right", position: 1450 }],
    children: [run("Rp", { bold, size: 9.5 }), new TextRun({ text: `\t${rp(n)}`, bold, size: 19, font: FONT })],
  });

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

  // ---------------- Tabel item ----------------
  const W = [500, 1500, 1900, 1150, 1600, 1750]; // total 8400
  const center = (t: string, bold = false) => para(run(t, { bold, size: 9.5 }), AlignmentType.CENTER);
  const head = new TableRow({
    tableHeader: true,
    children: ["No", doc.labels.code, doc.labels.name, doc.labels.qty, "Harga (Rp)", "Total (Rp)"].map((h, i) => cell(center(h, true), W[i], { fill: PEACH })),
  });
  const body = doc.rows.map(
    (r, i) =>
      new TableRow({
        children: [
          cell(center(String(i + 1)), W[0]),
          cell(center(r.code), W[1]),
          cell(center(r.name), W[2]),
          cell(center(qtyFmt(r.qty, doc.qtyDecimals)), W[3]),
          cell(moneyPara(r.price), W[4]),
          cell(moneyPara(r.qty * r.price), W[5]),
        ],
      }),
  );
  const labelRow = (label: string, amount: number, bold = false) =>
    new TableRow({
      children: [
        cell(para(run(label, { bold, size: 9.5 }), AlignmentType.RIGHT), W[0] + W[1] + W[2] + W[3] + W[4], { span: 5 }),
        cell(moneyPara(amount, bold), W[5]),
      ],
    });
  const totalRow = new TableRow({
    children: [
      cell(center("JUMLAH TAGIHAN", true), W[0] + W[1] + W[2], { span: 3, fill: PEACH }),
      cell(center(doc.qtyDecimals ? qtyFmt(sumQty(doc), doc.qtyDecimals) : "", true), W[3], { fill: PEACH }),
      cell(para(run(`Rp${rp(doc.total)}`, { bold: true, size: 9.5 }), AlignmentType.RIGHT), W[4] + W[5], { span: 2, fill: PEACH }),
    ],
  });
  const items = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 8400, type: WidthType.DXA },
    columnWidths: W,
    indent: { size: 700, type: WidthType.DXA },
    rows: [head, ...body, ...doc.adjustments.map((a) => labelRow(a.label, a.amount)), totalRow, ...doc.after.map((a) => labelRow(a.label, a.amount, a.label.toLowerCase().includes("sisa")))],
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
    columnWidths: [4400, 400, 3600],
    indent: { size: 700, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          cell(note, 4400, { top: true }),
          cell(para(run("")), 400, { borders: noBorders }),
          cell(
            [
              para(run(" ")),
              para(run(" ")),
              para(run(" ")),
              para(run(`${s("invoice_city") || "Jember"}, ${tanggalPanjang(doc.date)}`, { bold: true, size: 10.5 }), AlignmentType.CENTER, 1100),
              para(run(s("signer_name"), { bold: true, size: 10.5, underline: true }), AlignmentType.CENTER),
            ],
            3600,
            { borders: noBorders },
          ),
        ],
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
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
}
