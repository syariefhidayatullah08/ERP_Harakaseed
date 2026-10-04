import { FileSpreadsheet, FileText, FileType2 } from "lucide-react";

/** Tombol unduh Excel / PDF / Word untuk satu jenis data (lihat lib/export/datasets.ts). */
export function ExportMenu({ type, from, to, compact = false }: { type: string; from?: string; to?: string; compact?: boolean }) {
  const qs = new URLSearchParams({ type, ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  const cls = compact ? "btn-secondary btn-sm" : "btn-secondary";
  const size = compact ? 13 : 15;
  return (
    <span className="inline-flex flex-wrap gap-1.5" aria-label="Unduh data">
      <a href={`/api/export?${qs}&format=xlsx`} className={cls} title="Unduh Excel (.xlsx)">
        <FileSpreadsheet size={size} className="text-emerald-700" /> Excel
      </a>
      <a href={`/api/export?${qs}&format=pdf`} target="_blank" className={cls} title="Buka PDF untuk dicetak">
        <FileText size={size} className="text-red-700" /> PDF
      </a>
      <a href={`/api/export?${qs}&format=docx`} className={cls} title="Unduh Word (.docx)">
        <FileType2 size={size} className="text-brand-700" /> Word
      </a>
    </span>
  );
}
