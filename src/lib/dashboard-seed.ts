import { all, get } from "@/lib/db";
import { addDays, today } from "@/lib/format";
import { sheetFamily } from "@/lib/sheets";
import { Evaluator, isError, parseNumber, type SheetSource } from "@/lib/sheet-formula";

/* ------------------------------ Stock seed (benih sumber) ------------------------------ */

export type StockSeedRow = { product: string; note: string; code: string; male: number | null; female: number | null };
export type StockSeedSummary = { rows: StockSeedRow[]; male: number; female: number; empty: number; updated: string | null };

const SHEET = "ketersediaan-ss";

/**
 * Sisa stock seed per kode produksi, dihitung persis seperti sheet "Ketersediaan SS" (kolom H/I = SUMIF ke Rincian),
 * dari isi Lembar Kerja Offline yang sudah terkirim ke ERP.
 */
export async function stockSeedSummary(): Promise<StockSeedSummary> {
  const family = sheetFamily(SHEET);
  const keys = family.map((s) => s.key);
  const [rows, last] = await Promise.all([
    all<{ sheet: string; data: Record<string, string>; position: number }>(
      "SELECT sheet, data, position FROM sheet_rows WHERE sheet = ANY(?::text[]) AND NOT deleted ORDER BY position, rev",
      `{${keys.join(",")}}`,
    ),
    get<{ at: string | null }>("SELECT MAX(updated_at)::text at FROM sheet_rows WHERE sheet = ANY(?::text[])", `{${keys.join(",")}}`),
  ]);
  const byName = new Map<string, SheetSource>();
  const srcs = new Map<string, SheetSource>();
  const dataOf = new Map<string, Map<number, Record<string, string>>>();
  for (const f of family) {
    const m = new Map(rows.filter((r) => r.sheet === f.key).map((r) => [r.position, r.data]));
    dataOf.set(f.key, m);
    const positions = [...m.keys()].sort((a, b) => a - b);
    const head = new Map(Object.entries(f.head?.cells ?? {}).map(([a, c]) => [a, c.f ?? c.t ?? ""]));
    const src: SheetSource = {
      raw: (col, row) => m.get(row)?.[col] ?? (row < (f.dataStart ?? 1) ? (head.get(`${col}${row}`) ?? "") : ""),
      rows: () => positions,
      computed: (col) => f.columns.find((c) => c.key === col)?.computed,
    };
    srcs.set(f.key, src);
    byName.set((f.excelName ?? f.title).trim().toLowerCase(), src);
  }
  const ev = new Evaluator({ sheet: (name) => byName.get(name.trim().toLowerCase()) ?? null });
  const src = srcs.get(SHEET)!;
  const value = (col: string, row: number) => {
    const raw = dataOf.get(SHEET)!.get(row)?.[col] ?? "";
    if (!raw) return null;
    const v = raw.startsWith("=") ? ev.value(src, col, row) : (parseNumber(raw) ?? raw);
    return typeof v === "number" && !isError(v) ? v : null;
  };

  const out: StockSeedRow[] = [];
  for (const [pos, data] of [...dataOf.get(SHEET)!.entries()].sort((a, b) => a[0] - b[0])) {
    const code = data.C?.trim();
    if (!code) continue;
    // Nama varietas hanya ada di sebagian baris (seperti di Excel); baris lain ditampilkan dengan keterangannya.
    out.push({ product: data.B?.trim() ?? "", note: data.G?.trim() ?? "", code, male: value("H", pos), female: value("I", pos) });
  }
  const sum = (k: "male" | "female") => out.reduce((s, r) => s + (r[k] ?? 0), 0);
  return {
    rows: out,
    male: sum("male"),
    female: sum("female"),
    empty: out.filter((r) => !(r.male ?? 0) && !(r.female ?? 0)).length,
    updated: last?.at ?? null,
  };
}

/* ------------------------------ Pembayaran ke petani ------------------------------ */

export type FarmerPayables = {
  notSubmitted: { n: number; v: number };
  submitted: { n: number; v: number };
  badDebt: { n: number; v: number };
  overdue: { n: number; v: number };
  paidThisMonth: { n: number; v: number };
  due: { id: number; farmer: string; production_code: string; kind: string; due_date: string; amount: number; status: string }[];
};

/** Benih panen yang belum dibayar ke petani (internal + eksternal), kredit macet, dan yang mendekati jatuh tempo. */
export async function farmerPayables(): Promise<FarmerPayables> {
  const t = today();
  const nv = (sql: string, ...p: (string | number)[]) => get<{ n: number; v: number }>(sql, ...p).then((r) => ({ n: Number(r?.n ?? 0), v: Number(r?.v ?? 0) }));
  const [notSubmitted, submitted, badDebt, overdue, paidThisMonth, due] = await Promise.all([
    nv("SELECT COUNT(*) n, COALESCE(SUM(amount),0) v FROM seed_intakes WHERE status = 'proses_uji'"),
    nv("SELECT COUNT(*) n, COALESCE(SUM(amount),0) v FROM seed_intakes WHERE status = 'diajukan'"),
    nv("SELECT COUNT(*) n, COALESCE(SUM(bad_debt),0) v FROM seed_intakes WHERE status = 'kredit_macet'"),
    nv("SELECT COUNT(*) n, COALESCE(SUM(amount),0) v FROM seed_intakes WHERE status IN ('proses_uji','diajukan') AND due_date IS NOT NULL AND due_date < ?", t),
    nv(
      `SELECT COUNT(*) n, COALESCE(SUM(i.amount),0) v FROM seed_intakes i JOIN seed_pb pb ON pb.id = i.pb_id
       WHERE pb.status = 'dibayar' AND pb.paid_at >= ?`,
      t.slice(0, 8) + "01",
    ),
    all<FarmerPayables["due"][number]>(
      `SELECT id, farmer, production_code, kind, due_date, amount, status FROM seed_intakes
       WHERE status IN ('proses_uji','diajukan') AND due_date IS NOT NULL AND due_date <= ? AND amount > 0
       ORDER BY due_date, id LIMIT 8`,
      addDays(t, 14),
    ),
  ]);
  return { notSubmitted, submitted, badDebt, overdue, paidThisMonth, due };
}
