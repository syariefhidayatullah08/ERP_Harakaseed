import { currentUser } from "@/lib/session";
import { hasAny, type Module } from "@/lib/access";
import { today } from "@/lib/format";
import {
  complaintLines,
  findingLines,
  productionLines,
  qcLines,
  salesByCustomer,
  salesByProduct,
  salesLines,
  salesQtyLines,
  sdmLines,
  stockByLot,
  stockMovementReport,
  toCsv,
} from "@/lib/reports";

type Range = { from: string; to: string };

/** Jenis laporan CSV → modul yang wajib dimiliki. Data rupiah hanya lewat jenis "keuangan-*". */
const EXPORTS: Record<string, { need: Module | Module[]; build: (r: Range) => Promise<Record<string, unknown>[]> }> = {
  "keuangan-penjualan": { need: "keuangan", build: (r) => salesLines(r.from, r.to) },
  "keuangan-produk": { need: "keuangan", build: (r) => salesByProduct(r.from, r.to) },
  "keuangan-pelanggan": { need: "keuangan", build: (r) => salesByCustomer(r.from, r.to) },
  penjualan: { need: ["penjualan", "keuangan"], build: (r) => salesQtyLines(r.from, r.to) },
  stok: { need: ["inventori", "qc"], build: () => stockByLot() },
  "gudang-pergerakan": { need: "inventori", build: (r) => stockMovementReport(r.from, r.to) },
  produksi: { need: "produksi", build: (r) => productionLines(r.from, r.to) },
  qc: { need: "qc", build: (r) => qcLines(r.from, r.to) },
  mutu: { need: "mutu", build: (r) => findingLines(r.from, r.to) },
  keluhan: { need: "keluhan", build: (r) => complaintLines(r.from, r.to) },
  sdm: { need: "sdm", build: () => sdmLines() },
};

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "";
  const spec = EXPORTS[type];
  if (!spec) return new Response("Jenis laporan tidak dikenal", { status: 400 });
  if (!hasAny(user.modules, spec.need)) return new Response("Forbidden", { status: 403 });
  const valid = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const to = valid(url.searchParams.get("to")) ?? today();
  const from = valid(url.searchParams.get("from")) ?? `${to.slice(0, 4)}-01-01`;

  // BOM agar Excel membaca UTF-8 dengan benar
  const csv = "﻿" + toCsv(await spec.build({ from, to }));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-${from}_${to}.csv"`,
    },
  });
}
