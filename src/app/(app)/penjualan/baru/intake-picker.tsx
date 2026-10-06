"use client";

import { useMemo, useState } from "react";

export type IntakeOption = { id: number; kind: string; company: string; received_date: string | null; farmer: string; location: string; production_code: string; batch_no: string; kg: number };

const fmtDate = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "—");
const fmtKg = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Kerjasama produksi: ambil baris dari buku induk benih masuk (rekap benih panen yang masuk gudang).
 * Baris terpilih mengisi varietas (kode produksi), nama petani, dan bobot; harga diketik manual.
 * Benih masuk eksternal milik perusahaan pelanggan ini ditampilkan paling atas.
 */
export function IntakePicker({ intakes, customer, used, onPick }: { intakes: IntakeOption[]; customer: string; used: number[]; onPick: (rows: IntakeOption[]) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const company = norm(customer);

  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const mine = (i: IntakeOption) => !!company && !!i.company && (norm(i.company).includes(company) || company.includes(norm(i.company)));
    return intakes
      .filter((i) => !used.includes(i.id))
      .filter((i) => words.every((w) => `${i.farmer} ${i.production_code} ${i.company} ${i.location} ${i.batch_no} ${i.kind}`.toLowerCase().includes(w)))
      .sort((a, b) => Number(mine(b)) - Number(mine(a)))
      .slice(0, 80);
  }, [intakes, used, q, company]);

  if (!open) {
    return (
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
        + Ambil dari buku induk benih masuk
      </button>
    );
  }
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <div className="space-y-2 rounded-lg border border-line bg-canvas p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input max-w-xs py-1 text-sm" placeholder="Cari petani, kode produksi, perusahaan…" autoFocus />
        <span className="text-xs text-muted">Centang lalu tambahkan; harga per kg diisi manual di tabel.</span>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-md border border-line bg-white">
        <table className="table text-xs">
          <thead className="sticky top-0 bg-white">
            <tr>
              <th />
              <th>Tgl masuk</th>
              <th>Sumber</th>
              <th>Nama petani</th>
              <th>Kode produksi</th>
              <th>Batch</th>
              <th className="num">Bobot (kg)</th>
            </tr>
          </thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id} onClick={() => toggle(i.id)} className="cursor-pointer hover:bg-canvas">
                <td>
                  <input type="checkbox" readOnly checked={picked.includes(i.id)} className="accent-brand-700" aria-label={`Pilih ${i.farmer}`} />
                </td>
                <td className="whitespace-nowrap">{fmtDate(i.received_date)}</td>
                <td>{i.kind === "eksternal" ? i.company || "Eksternal" : "Internal"}</td>
                <td>
                  {i.farmer}
                  {i.location && <span className="text-muted"> · {i.location}</span>}
                </td>
                <td>{i.production_code}</td>
                <td>{i.batch_no}</td>
                <td className="num">{fmtKg(i.kg)}</td>
              </tr>
            ))}
            {!list.length && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-muted">
                  Tidak ada benih masuk yang cocok (atau sudah dipakai di pesanan lain).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={!picked.length}
          onClick={() => {
            onPick(intakes.filter((i) => picked.includes(i.id)));
            setPicked([]);
            setOpen(false);
          }}
        >
          Tambahkan {picked.length || ""} baris
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(false)}>
          Tutup
        </button>
      </div>
    </div>
  );
}
