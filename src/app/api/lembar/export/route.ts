import ExcelJS from "exceljs";
import { all } from "@/lib/db";
import { can, currentUser } from "@/lib/session";
import { sheetByKey, sheetFamily, SHEETS, WORKBOOKS, type CellStyle, type SheetDef } from "@/lib/sheets";
import { Evaluator, isError, parseNumber, type CellValue, type SheetSource } from "@/lib/sheet-formula";

/** Gaya ringkas lembar (CellStyle) → gaya sel ExcelJS. */
function applyStyle(cell: ExcelJS.Cell, st?: CellStyle) {
  if (!st) return;
  const argb = (hex: string) => `FF${hex.slice(1)}`;
  if (st.b || st.i || st.u || st.z || st.c) {
    cell.font = { name: "Calibri", size: st.z ?? 11, ...(st.b ? { bold: true } : {}), ...(st.i ? { italic: true } : {}), ...(st.u ? { underline: true } : {}), ...(st.c ? { color: { argb: argb(st.c) } } : {}) };
  }
  if (st.f) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(st.f) } };
  if (st.h || st.v || st.w) {
    cell.alignment = {
      ...(st.h ? { horizontal: st.h as ExcelJS.Alignment["horizontal"] } : {}),
      ...(st.v ? { vertical: st.v as ExcelJS.Alignment["vertical"] } : {}),
      ...(st.w ? { wrapText: true } : {}),
    };
  }
  if (st.bd) {
    const side = (ch: string) => (st.bd!.includes(ch.toUpperCase()) ? { style: "medium" as const } : st.bd!.includes(ch) ? { style: "thin" as const } : undefined);
    cell.border = { top: side("t"), right: side("r"), bottom: side("b"), left: side("l") };
  }
}

/**
 * Unduh lembar kerja offline sebagai file Excel (isi yang sudah terkirim ke ERP). Lembar dari file Excel diunduh
 * bersama semua sheet dari file asalnya, di baris & kolom yang sama, dengan rumus tetap berupa rumus Excel.
 */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return new Response("Silakan login.", { status: 401 });
  const sheet = sheetByKey(new URL(request.url).searchParams.get("sheet") ?? "");
  if (!sheet) return new Response("Lembar tidak dikenal.", { status: 404 });
  if (!can(user, sheet.module)) return new Response("Tidak punya akses.", { status: 403 });

  // Semua lembar keluarga dibaca agar rumus antar-sheet bisa dihitung; yang ditulis ke file = lembar dari file yang sama.
  const family = sheetFamily(sheet.key).filter((s) => can(user, s.module));
  const keys = family.map((s) => s.key);
  const rows = await all<{ sheet: string; data: Record<string, string>; position: number }>(
    "SELECT sheet, data, position FROM sheet_rows WHERE sheet = ANY(?::text[]) AND NOT deleted ORDER BY position, rev",
    `{${keys.join(",")}}`,
  );
  const byName = new Map<string, SheetSource>();
  const srcs = new Map<string, SheetSource>();
  const dataOf = new Map<string, Map<number, Record<string, string>>>();
  for (const f of family) {
    const m = new Map(rows.filter((r) => r.sheet === f.key).map((r) => [r.position, r.data]));
    dataOf.set(f.key, m);
    const positions = [...m.keys()].sort((a, b) => a - b);
    const notes = new Map((f.notes ?? []).map((n) => [n.cell, n.formula ?? n.text]));
    const src: SheetSource = {
      raw: (col, row) => m.get(row)?.[col] ?? (row < (f.dataStart ?? 1) ? (notes.get(`${col}${row}`) ?? "") : ""),
      rows: () => positions,
      computed: (col) => f.columns.find((c) => c.key === col)?.computed,
    };
    srcs.set(f.key, src);
    byName.set((f.excelName ?? f.title).trim().toLowerCase(), src);
  }
  const ev = new Evaluator({ sheet: (name) => byName.get(name.trim().toLowerCase()) ?? null });
  const result = (v: CellValue) => (isError(v) ? { error: v.error } : v);

  const targets: SheetDef[] = sheet.workbook && sheet.workbook !== "lain" ? SHEETS.filter((s) => s.workbook === sheet.workbook && keys.includes(s.key)) : [sheet];
  const wb = new ExcelJS.Workbook();
  for (const s of targets) {
    const ws = wb.addWorksheet((s.excelName ?? s.title).slice(0, 31));
    const src = srcs.get(s.key)!;
    const header = s.headerRows ?? [1];
    const start = s.dataStart ?? header[header.length - 1] + 1;
    const styleAt = (i?: number) => (i === undefined ? undefined : s.styles?.[i]);
    s.columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.width = s.head ? Math.max(0, ((c.width ?? 64) - 5) / 7) : Math.round((c.width ?? 120) / 7.5);
      if (c.hidden) col.hidden = true;
    });
    if (s.freeze) ws.views = [{ state: "frozen", xSplit: s.freeze.x, ySplit: s.freeze.y }];
    if (s.head) {
      // Judul & judul kolom persis seperti file asal: isi, gaya, sel gabungan, tinggi baris.
      for (const [addr, h] of Object.entries(s.head.cells)) {
        const cell = ws.getCell(addr);
        const col = addr.replace(/\d+$/, "");
        const row = Number(addr.slice(col.length));
        if (h.f) cell.value = { formula: h.f.slice(1), result: result(ev.value(src, col, row)) } as ExcelJS.CellValue;
        else if (h.t) cell.value = parseNumber(h.t) ?? h.t;
        applyStyle(cell, styleAt(h.s));
      }
      for (const m of s.head.merges ?? []) ws.mergeCells(m);
      for (const [r, px] of Object.entries(s.head.heights ?? {})) ws.getRow(Number(r)).height = (px * 3) / 4;
    }
    for (const n of s.head ? [] : (s.notes ?? [])) {
      const cell = ws.getCell(n.cell);
      cell.value = n.formula ? { formula: n.formula.slice(1), result: result(ev.value(src, n.cell.replace(/\d+$/, ""), Number(n.cell.match(/\d+$/)![0]))) } as ExcelJS.CellValue : n.text;
      if (n.bg) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${n.bg.slice(1)}` } };
    }
    // Judul kolom di baris yang sama dengan file asal (dua baris bila ada kelompok).
    if (!s.head) s.columns.forEach((c, i) => {
      const top = ws.getRow(header[0]).getCell(i + 1);
      top.value = c.group ?? c.label;
      top.font = { bold: true };
      if (header[1]) {
        const bottom = ws.getRow(header[1]).getCell(i + 1);
        bottom.value = c.label;
        bottom.font = { bold: true };
      }
    });
    for (const [pos, data] of [...dataOf.get(s.key)!.entries()].sort((a, b) => a[0] - b[0])) {
      if (pos < start) continue;
      const row = ws.getRow(pos);
      s.columns.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        const raw = data[c.key] ?? "";
        applyStyle(cell, styleAt(c.s));
        if (c.fmt) cell.numFmt = c.fmt;
        if (c.computed) {
          // Kolom otomatis ERP (merujuk file lain) ditulis sebagai angka.
          const v = ev.value(src, c.key, pos);
          cell.value = isError(v) ? v.error : v;
        } else if (raw.startsWith("=")) {
          cell.value = { formula: raw.slice(1), result: result(ev.value(src, c.key, pos)) } as ExcelJS.CellValue;
        } else if (raw) {
          const d = c.type === "date" ? raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) : null;
          cell.value = d ? new Date(Date.UTC(Number(d[3]), Number(d[2]) - 1, Number(d[1]))) : (parseNumber(raw) ?? raw);
          if (d) cell.numFmt = "dd/mm/yyyy";
        }
        const bg = data[`${c.key}#bg`];
        if (bg) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${bg.slice(1)}` } };
      });
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  const name = sheet.workbook && WORKBOOKS[sheet.workbook] && sheet.workbook !== "lain" ? WORKBOOKS[sheet.workbook].title : sheet.title;
  return new Response(buf, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}.xlsx`,
    },
  });
}
