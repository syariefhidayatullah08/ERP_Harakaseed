import "server-only";
import { all, get, getDocSettings, run } from "./db";
import { today } from "./format";
import { ROMAN } from "./invoice-doc";

// Pembayaran benih petani: buku induk benih masuk (internal & eksternal) + surat pengajuan pembayaran (PB).
// Acuan: referensi/BUKU INDUK PEMBAYARAN BENIH … .xlsx dan referensi/Template PB Petani.xlsx.

export const INTAKE_KIND: Record<string, string> = { internal: "Internal", eksternal: "Eksternal" };

export const INTAKE_STATUS: Record<string, { label: string; tone: string }> = {
  proses_uji: { label: "Proses uji", tone: "amber" },
  diajukan: { label: "Diajukan PB", tone: "blue" },
  lunas: { label: "Lunas", tone: "green" },
  kredit_macet: { label: "Kredit macet", tone: "red" },
};

export const PB_STATUS: Record<string, { label: string; tone: string }> = {
  diajukan: { label: "Diajukan", tone: "amber" },
  dibayar: { label: "Dibayar", tone: "green" },
};

/** Lama jatuh tempo pembayaran sejak benih masuk (sheet "LAMA JATUH TEMPO PEMBAYARAN"). */
export const DUE_RULES = [
  { days: 40, label: "40 hari · terong OP, cabai, hibrida, dll (setelah hasil uji keluar)" },
  { days: 10, label: "10 hari · blewah, timun OP (setelah hasil uji keluar)" },
  { days: 7, label: "7 hari · buncis, kacang panjang (berdasarkan fisik & kadar air)" },
];

/**
 * Nilai pembayaran petani = bobot bersih × harga − pinjaman − potongan (sortir dll).
 * Kalau hasilnya minus, petani tidak dibayar dan selisihnya menjadi kredit macet.
 */
export function settle(netKg: number, price: number, loan: number, deduction: number) {
  const net = Math.round(netKg * price - loan - deduction);
  return { amount: Math.max(0, net), badDebt: Math.max(0, -net) };
}

/** Nomor surat format template: No/ADM/PB/Jenis/Bulan/Tahun, mis. 12/ADM/PB/INT/X/2026. Nomor urut berlanjut per tahun. */
export async function nextPbNumber(kind: string, date: string) {
  const year = date.slice(0, 4);
  const rows = await all<{ number: string }>("SELECT number FROM seed_pb WHERE number LIKE ?", `%/${year}`);
  const last = Math.max(0, ...rows.map((r) => Number(r.number.split("/")[0])).filter(Number.isFinite));
  return `${last + 1}/ADM/PB/${kind === "eksternal" ? "EKS" : "INT"}/${ROMAN[Number(date.slice(5, 7)) - 1]}/${year}`;
}

export type Intake = {
  id: number; kind: string; company: string; received_date: string | null; due_date: string | null; farmer: string; location: string; officer: string;
  contract_no: string; production_code: string; batch_no: string; gross_kg: number; net_kg: number; shipped_kg: number | null; fix_kg: number | null;
  ship_date: string | null; test_ka: string; test_km: string; test_db: string; loan: number; price: number; contract_price: number; deduction: number;
  deduction_note: string; amount: number; bad_debt: number; status: string; notes: string; pb_id: number | null;
};

export type Pb = { id: number; number: string; kind: string; pb_date: string; status: string; notes: string; paid_at: string | null };

/**
 * Samakan Buku Kas dengan satu surat PB: surat yang sudah dibayar punya satu baris pengeluaran sebesar totalnya,
 * surat yang belum dibayar (atau totalnya nol) tidak punya. Dipanggil setiap kali surat atau barisnya berubah.
 */
export async function syncPbCash(pbId: number) {
  const pb = await get<{ number: string; kind: string; status: string; paid_at: string | null }>("SELECT number, kind, status, paid_at FROM seed_pb WHERE id = ?", pbId);
  await run("DELETE FROM cash_entries WHERE pb_id = ?", pbId);
  if (!pb || pb.status !== "dibayar") return;
  const total = (await get<{ t: number }>("SELECT COALESCE(SUM(amount), 0) t FROM seed_intakes WHERE pb_id = ?", pbId))!.t;
  if (total <= 0) return;
  await run(
    "INSERT INTO cash_entries (entry_date, description, category, amount_out, pb_id) VALUES (?,?,?,?,?)",
    pb.paid_at ?? today(),
    `Pembayaran Benih Petani ${INTAKE_KIND[pb.kind] ?? pb.kind} · Surat ${pb.number}`,
    pb.kind === "eksternal" ? "pb_eks" : "pb_in",
    total,
    pbId,
  );
}

export type PbDoc = { pb: Pb; rows: Intake[]; total: number; settings: Record<string, string> };

export async function pbDoc(id: number): Promise<PbDoc | null> {
  const pb = await get<Pb>("SELECT * FROM seed_pb WHERE id = ?", id);
  if (!pb) return null;
  const rows = await all<Intake>("SELECT * FROM seed_intakes WHERE pb_id = ? ORDER BY due_date, id", id);
  return { pb, rows, total: rows.reduce((s, r) => s + r.amount, 0), settings: await getDocSettings() };
}

/* ------------------------- Buku induk lengkap (tampilan seperti sheet referensi) ------------------------- */

export type LedgerRow = Intake & { no: number; pb_no: string | null; sold_id: number | null; sold_no: string | null };
export type LedgerFilter = { kind: "internal" | "eksternal"; status: string; year: string; q: string };

/** Tahun benih masuk yang punya data untuk satu jenis, terbaru dulu. */
export async function ledgerYears(kind: string) {
  return (await all<{ y: string }>("SELECT DISTINCT left(received_date, 4) y FROM seed_intakes WHERE kind = ? AND received_date IS NOT NULL ORDER BY 1 DESC", kind)).map((r) => r.y);
}

/**
 * Baris buku induk satu jenis, urut tanggal benih masuk seperti sheet INTERNAL/EKSTERNAL. Kolom "No" dihitung dari
 * seluruh baris jenis itu, jadi nomornya tetap sama walau disaring. `status` "belum" = proses uji + diajukan PB.
 */
export async function intakeLedger(f: LedgerFilter, page: number, pageSize: number) {
  const like = `%${f.q}%`;
  const where = `(? = '' OR status = ? OR (? = 'belum' AND status IN ('proses_uji','diajukan')))
    AND (? = '' OR left(received_date, 4) = ?)
    AND (? = '' OR farmer ILIKE ? OR production_code ILIKE ? OR contract_no ILIKE ? OR location ILIKE ? OR company ILIKE ? OR batch_no ILIKE ?)`;
  const params = [f.status, f.status, f.status, f.year, f.year, f.q, like, like, like, like, like, like];
  // Saringan dijalankan di CTE agar nama kolom (status, dll.) tidak bentrok dengan tabel yang di-join.
  const base = `WITH base AS (SELECT i.*, row_number() OVER (ORDER BY received_date NULLS LAST, id) no FROM seed_intakes i WHERE kind = ?),
    f AS (SELECT * FROM base WHERE ${where})`;
  const total = (await get<{ n: number }>(`${base} SELECT COUNT(*)::int n FROM f`, f.kind, ...params))!.n;
  const rows = await all<LedgerRow>(
    // sold_*: pesanan kerjasama produksi (tidak batal) yang menjual benih masuk ini.
    `${base}
     SELECT b.*, b.no::int no, pb.number pb_no, sold.sold_id, sold.sold_no
     FROM f b
     LEFT JOIN seed_pb pb ON pb.id = b.pb_id
     LEFT JOIN LATERAL (SELECT so.id sold_id, so.so_no sold_no FROM so_items si JOIN sales_orders so ON so.id = si.so_id WHERE si.intake_id = b.id AND so.status <> 'batal' LIMIT 1) sold ON true
     ORDER BY b.no LIMIT ? OFFSET ?`,
    f.kind,
    ...params,
    pageSize,
    (page - 1) * pageSize,
  );
  return { rows, total };
}
