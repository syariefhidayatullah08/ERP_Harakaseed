import { currentUser } from "@/lib/session";
import { hasAny } from "@/lib/access";
import { getSettings } from "@/lib/db";
import { nowWib, today } from "@/lib/format";
import { DATASETS } from "@/lib/export/datasets";
import { toCsvCols, toDocx, toPdf, toXlsx } from "@/lib/export/render";

const FORMATS = {
  xlsx: { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" },
  pdf: { type: "application/pdf", ext: "pdf" },
  docx: { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" },
  csv: { type: "text/csv; charset=utf-8", ext: "csv" },
} as const;
type Format = keyof typeof FORMATS;

/**
 * Unduh data ERP: /api/export?type=<dataset>&format=xlsx|pdf|docx|csv[&from=YYYY-MM-DD&to=YYYY-MM-DD]
 * Hak akses dicek per dataset; tanpa periode, data berperiode diambil seluruhnya.
 */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "";
  const ds = DATASETS[type];
  if (!ds) return new Response("Jenis data tidak dikenal", { status: 400 });
  if (!hasAny(user.modules, ds.need)) return new Response("Forbidden", { status: 403 });
  const fmtParam = url.searchParams.get("format") ?? "csv";
  const format: Format = fmtParam in FORMATS ? (fmtParam as Format) : "csv";

  const valid = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const to = valid(url.searchParams.get("to")) ?? today();
  const from = valid(url.searchParams.get("from")) ?? "2000-01-01";
  const cols = ds.columns(user);
  const rows = await ds.rows({ from, to }, user);

  const settings = await getSettings();
  const period = ds.range ? (from === "2000-01-01" ? `Semua data s.d. ${to.split("-").reverse().join("/")}` : `Periode ${from.split("-").reverse().join("/")} – ${to.split("-").reverse().join("/")}`) : "";
  const meta = {
    title: ds.title,
    company: settings.company_name || "PT Benih Haraka Sejahtera",
    subtitle: [period, `Diunduh ${nowWib().slice(0, 10).split("-").reverse().join("/")} pukul ${nowWib().slice(11, 16)} oleh ${user.name}`].filter(Boolean).join(" · "),
  };

  let body: Uint8Array;
  if (format === "xlsx") body = new Uint8Array(await toXlsx(meta, cols, rows));
  else if (format === "pdf") body = await toPdf(meta, cols, rows);
  else if (format === "docx") body = new Uint8Array(await toDocx(meta, cols, rows));
  else body = new TextEncoder().encode("﻿" + toCsvCols(cols, rows)); // BOM agar Excel membaca UTF-8

  const name = `${ds.title.replace(/[^\w\s-]+/g, "").replace(/\s+/g, "-")}_${ds.range && from !== "2000-01-01" ? `${from}_${to}` : today()}.${FORMATS[format].ext}`;
  return new Response(Buffer.from(body), {
    headers: {
      "Content-Type": FORMATS[format].type,
      "Content-Disposition": `${format === "pdf" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
