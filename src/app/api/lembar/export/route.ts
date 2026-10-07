import ExcelJS from "exceljs";
import { all } from "@/lib/db";
import { can, currentUser } from "@/lib/session";
import { sheetByKey } from "@/lib/sheets";

/** Unduh isi lembar kerja offline sebagai file Excel (yang sudah terkirim ke ERP). */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return new Response("Silakan login.", { status: 401 });
  const sheet = sheetByKey(new URL(request.url).searchParams.get("sheet") ?? "");
  if (!sheet) return new Response("Lembar tidak dikenal.", { status: 404 });
  if (!can(user, sheet.module)) return new Response("Tidak punya akses.", { status: 403 });
  const rows = await all<{ data: Record<string, string> }>("SELECT data FROM sheet_rows WHERE sheet = ? AND NOT deleted ORDER BY position, rev", sheet.key);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheet.title.slice(0, 31));
  ws.columns = [{ header: "No", key: "_no", width: 6 }, ...sheet.columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(10, Math.round((c.width ?? 120) / 7)) }))];
  ws.getRow(1).font = { bold: true };
  rows.forEach((r, i) => ws.addRow({ _no: i + 1, ...r.data }));
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(sheet.title)}.xlsx`,
    },
  });
}
