import Link from "next/link";
import type { ReactNode } from "react";
import { addDays, rupiah, today } from "@/lib/format";
import { Badge } from "@/components/ui";
import { INTAKE_STATUS, intakeLedger, ledgerYears, type LedgerRow } from "@/lib/seed-payment";

// Tabel buku induk benih masuk dengan kolom & urutan persis seperti sheet INTERNAL / EKSTERNAL di
// "BUKU INDUK PEMBAYARAN BENIH PT BENIH HARAKA SEJAHTERA". Dipakai di Gudang & Lot dan Pembayaran Benih.

const ddmmyyyy = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");
const kg = (n: number | null) => (n === null || n === undefined ? "" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(n));
const rp = (n: number) => (n ? rupiah(n) : "Rp0");

/** Catatan hasil impor menyimpan "Sortir: …" dan "Posisi benih: …" di kolom catatan; pisahkan ke kolomnya sendiri. */
function splitNotes(notes: string) {
  const parts = notes.split(" · ").map((p) => p.trim()).filter(Boolean);
  const take = (prefix: string) => parts.find((p) => p.toLowerCase().startsWith(prefix))?.slice(prefix.length).trim() ?? "";
  return {
    sortir: take("sortir:"),
    position: take("posisi benih:"),
    rest: parts.filter((p) => !/^(sortir|posisi benih):/i.test(p)).join(" · "),
  };
}

type Col = { label: string; group?: string; num?: boolean; cell: (r: LedgerRow) => ReactNode };

/**
 * Tagihan invoice ke perusahaan: angka dari sheet bila baris hasil impor; selain itu bobot bersih fix × harga kontrak
 * (bobot fix kosong/0 → bobot terkirim).
 */
function invoiceBill(r: LedgerRow) {
  if (r.sheet_year !== null) return r.sheet_bill ? rupiah(r.sheet_bill) : "";
  const w = r.fix_kg ? r.fix_kg : r.shipped_kg;
  return w && r.contract_price ? rupiah(Math.round(w * r.contract_price)) : "";
}

function columns(kind: "internal" | "eksternal"): Col[] {
  const sortir = (r: LedgerRow) => {
    const s = splitNotes(r.notes).sortir;
    return [r.deduction ? rupiah(r.deduction) : "", s].filter(Boolean).join(" · ");
  };
  const status = (r: LedgerRow) => (
    <>
      <Badge tone={INTAKE_STATUS[r.status]?.tone}>{INTAKE_STATUS[r.status]?.label ?? r.status}</Badge>
      {r.pb_no && <div className="mt-0.5 text-[11px] text-muted">{r.pb_no}</div>}
      {r.sold_no && (
        <div className="mt-0.5 text-[11px]">
          Terjual{" "}
          <Link href={`/penjualan/${r.sold_id}`} className="text-brand-700 hover:underline">
            {r.sold_no}
          </Link>
        </div>
      )}
    </>
  );
  const farmer = (r: LedgerRow) => (
    <Link href={`/pembayaran-benih/${r.id}`} className="font-medium text-brand-700 hover:underline">
      {r.farmer}
    </Link>
  );
  // Tanggal dari sheet untuk baris hasil impor; baris baru: maks pengajuan PB = sehari sebelum jatuh tempo,
  // maks pengiriman invoice (eksternal) = 5 hari sebelumnya.
  const before = (r: LedgerRow, sheet: string | null, days: number) =>
    r.sheet_year !== null ? ddmmyyyy(sheet) : r.due_date ? ddmmyyyy(addDays(r.due_date, -days)) : "";
  const maxPb = (r: LedgerRow) => before(r, r.sheet_max_pb, 1);
  const tests: Col[] = [
    { label: "KA", group: "Hasil Pengujian (%)", cell: (r) => r.test_ka },
    { label: "KM", group: "Hasil Pengujian (%)", cell: (r) => r.test_km },
    { label: "DB", group: "Hasil Pengujian (%)", cell: (r) => r.test_db },
  ];
  const tail: Col[] = [
    { label: "Status Benih", cell: status },
    { label: "Kredit Macet", group: "Keterangan Status", num: true, cell: (r) => (r.bad_debt ? rupiah(r.bad_debt) : "") },
    { label: "Sortir", group: "Keterangan Status", cell: sortir },
    { label: "Keterangan Tambahan", cell: (r) => splitNotes(r.notes).rest },
  ];
  if (kind === "internal") {
    return [
      { label: "Tgl Benih Masuk", cell: (r) => ddmmyyyy(r.received_date) },
      { label: "Tgl Jatuh Tempo", cell: (r) => ddmmyyyy(r.due_date) },
      { label: "Tgl Maks Pengajuan PB", cell: maxPb },
      { label: "Nama Petani", cell: farmer },
      { label: "Lokasi Lahan", cell: (r) => r.location },
      { label: "Petugas", cell: (r) => r.officer },
      { label: "No Kontrak", cell: (r) => r.contract_no },
      { label: "Kode Produksi", cell: (r) => r.production_code },
      { label: "No Batch", cell: (r) => r.batch_no },
      { label: "Bobot Awal (kg)", num: true, cell: (r) => kg(r.gross_kg) },
      { label: "Bobot bersih (kg)", num: true, cell: (r) => kg(r.net_kg) },
      ...tests,
      { label: "Nilai Pinjaman", num: true, cell: (r) => rp(r.loan) },
      { label: "Harga Kontrak", num: true, cell: (r) => rp(r.price) },
      { label: "Nilai Pembayaran Petani", num: true, cell: (r) => rp(r.amount) },
      ...tail,
    ];
  }
  return [
    { label: "Perusahaan", cell: (r) => r.company },
    { label: "Tgl Benih Masuk", cell: (r) => ddmmyyyy(r.received_date) },
    { label: "Tgl Jatuh Tempo", cell: (r) => ddmmyyyy(r.due_date) },
    { label: "Tgl Maks Pengiriman Invoice", cell: (r) => before(r, r.sheet_max_invoice, 5) },
    { label: "Tgl Maks Pengajuan PB", cell: maxPb },
    { label: "Nama Petani", cell: farmer },
    { label: "Lokasi Lahan", cell: (r) => r.location },
    { label: "Petugas", cell: (r) => r.officer },
    { label: "No Kontrak", cell: (r) => r.contract_no },
    { label: "Kode Produksi", cell: (r) => r.production_code },
    { label: "Bobot Awal (kg)", num: true, cell: (r) => kg(r.gross_kg) },
    { label: "Bobot Bersih Petani (kg)", num: true, cell: (r) => kg(r.net_kg) },
    { label: "Bobot Bersih Terkirim (kg)", num: true, cell: (r) => kg(r.shipped_kg) },
    { label: "Bobot Bersih Fix (kg)", num: true, cell: (r) => kg(r.fix_kg) },
    ...tests,
    { label: "Tgl Pengiriman Benih", cell: (r) => ddmmyyyy(r.ship_date) },
    { label: "Nilai Pinjaman (Rp)", num: true, cell: (r) => rp(r.loan) },
    { label: "Harga Kontrak (Rp)", num: true, cell: (r) => rp(r.contract_price) },
    { label: "Harga Petani (Rp)", num: true, cell: (r) => rp(r.price) },
    { label: "Tagihan Invoice (Rp)", num: true, cell: invoiceBill },
    { label: "Nilai Pembayaran Petani (Rp)", num: true, cell: (r) => rp(r.amount) },
    ...tail,
    { label: "Posisi Benih", cell: (r) => splitNotes(r.notes).position },
  ];
}

/** Tabel buku induk satu jenis. `action`: kolom tambahan paling kanan (mis. tombol hapus) bila diperlukan. */
export function IntakeLedger({ kind, rows, action }: { kind: "internal" | "eksternal"; rows: LedgerRow[]; action?: (r: LedgerRow) => ReactNode }) {
  const cols = columns(kind);
  const span = cols.length + 1 + (action ? 1 : 0);
  // Header dua baris: kolom bergrup (Hasil Pengujian, Keterangan Status) seperti di sheet.
  const top: { label: string; span: number; group: boolean }[] = [];
  for (const c of cols) {
    const last = top[top.length - 1];
    if (c.group && last?.group && last.label === c.group) last.span++;
    else top.push({ label: c.group ?? c.label, span: 1, group: !!c.group });
  }
  const yearOf = (r?: LedgerRow) => r?.section || "Tanpa tanggal";
  return (
    <div className="overflow-x-auto">
      <table className="table whitespace-nowrap text-xs [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2">
        <thead>
          <tr>
            <th rowSpan={2} className="text-center">
              {kind === "internal" ? "." : "NO"}
            </th>
            {top.map((t, i) =>
              t.group ? (
                <th key={i} colSpan={t.span} className="text-center">
                  {t.label}
                </th>
              ) : (
                <th key={i} rowSpan={2} className={cols.find((c) => c.label === t.label)?.num ? "num" : ""}>
                  {t.label}
                </th>
              ),
            )}
            {action && <th rowSpan={2} />}
          </tr>
          <tr>
            {cols
              .filter((c) => c.group)
              .map((c) => (
                <th key={c.label} className={c.num ? "num" : "text-center"}>
                  {c.label}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((r, i) => {
            const y = yearOf(r);
            const out: ReactNode[] = [];
            // Baris pemisah "TAHUN 2025" seperti di sheet, setiap kali bagian tahun berganti.
            if (i === 0 || y !== yearOf(rows[i - 1])) {
              out.push(
                <tr key={`y-${y}-${r.id}`} className="bg-canvas">
                  <td colSpan={span} className="font-bold">
                    {/^\d{4}$/.test(y) ? `TAHUN ${y}` : y}
                  </td>
                </tr>,
              );
            }
            out.push(
              <tr key={r.id}>
                <td className="text-center text-muted">{r.no}</td>
                {cols.map((c) => (
                  <td key={c.label} className={c.num ? "num" : ""}>
                    {c.cell(r)}
                  </td>
                ))}
                {action && <td>{action(r)}</td>}
              </tr>,
            );
            return out;
          })}
        </tbody>
      </table>
    </div>
  );
}

type Sp = Record<string, string | string[] | undefined>;
const PAGE_SIZE = 200;

/**
 * Buku induk lengkap dengan tab Internal/Eksternal, saringan tahun/status/cari, dan halaman. Parameter URL:
 * jenis, tahun ("semua" = semua tahun; kosong = tahun terbaru), status, cari, hal. `keep` = parameter halaman induk yang dipertahankan.
 */
export async function IntakeLedgerPanel({ path, sp, keep = {}, action }: { path: string; sp: Sp; keep?: Record<string, string>; action?: (r: LedgerRow) => ReactNode }) {
  const one = (k: string) => String((Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "").trim();
  const kind = one("jenis") === "eksternal" ? "eksternal" : "internal";
  const years = await ledgerYears(kind);
  const cari = one("cari");
  const tahunParam = one("tahun");
  const status = one("status") in INTAKE_STATUS || one("status") === "belum" ? one("status") : "";
  // Tanpa pilihan tahun: tampilkan tahun terbaru yang tidak melewati tahun ini (ada tanggal salah ketik, mis. 2028);
  // pencarian atau saringan status = semua tahun.
  const thisYear = today().slice(0, 4);
  const year = /^\d{4}$/.test(tahunParam) ? tahunParam : tahunParam === "semua" || cari || status ? "" : (years.find((y) => y <= thisYear) ?? years[0] ?? "");
  const page = Math.max(1, Math.floor(Number(one("hal"))) || 1);
  const { rows, total } = await intakeLedger({ kind, year, status, q: cari }, page, PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...keep, jenis: kind, tahun: year || "semua", status, cari, ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `${path}?${p}#buku-induk`;
  };
  return (
    <div id="buku-induk" className="scroll-mt-6">
      <div className="flex flex-wrap items-end gap-2 border-b border-line px-4 py-3">
        <div className="mr-2 flex gap-1">
          {(["internal", "eksternal"] as const).map((k) => (
            <Link
              key={k}
              href={href({ jenis: k, tahun: "", hal: "" })}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${kind === k ? "bg-brand-700 text-white" : "bg-canvas text-muted hover:text-ink"}`}
            >
              {k === "internal" ? "INTERNAL" : "EKSTERNAL"}
            </Link>
          ))}
        </div>
        <form action={`${path}#buku-induk`} className="flex flex-wrap items-end gap-2">
          {Object.entries(keep).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input type="hidden" name="jenis" value={kind} />
          <input name="cari" defaultValue={cari} placeholder="Cari petani, kode produksi, no kontrak, batch…" className="input w-64 py-1 text-sm" />
          <select name="tahun" defaultValue={year || "semua"} className="input w-auto py-1 text-sm" aria-label="Tahun">
            <option value="semua">Semua tahun</option>
            {years.map((y) => (
              <option key={y} value={y}>
                Tahun {y}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status} className="input w-auto py-1 text-sm" aria-label="Status benih">
            <option value="">Semua status</option>
            <option value="belum">Belum dibayar</option>
            {Object.entries(INTAKE_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <button className="btn-secondary btn-sm">Saring</button>
        </form>
      </div>
      {rows.length ? <IntakeLedger kind={kind} rows={rows} action={action} /> : <p className="p-6 text-center text-sm text-muted">Belum ada data benih masuk yang cocok.</p>}
      <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-muted">
        <span>
          {new Intl.NumberFormat("id-ID").format(total)} baris {kind}
          {year ? ` · tahun ${year}` : ""} · halaman {page} dari {pages}
        </span>
        <span className="flex gap-2">
          {page > 1 && (
            <Link href={href({ hal: String(page - 1) })} className="btn-secondary btn-sm">
              ← Sebelumnya
            </Link>
          )}
          {page < pages && (
            <Link href={href({ hal: String(page + 1) })} className="btn-secondary btn-sm">
              Berikutnya →
            </Link>
          )}
        </span>
      </div>
    </div>
  );
}
