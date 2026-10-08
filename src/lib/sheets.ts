// Lembar kerja offline: tabel seperti Excel yang tetap bisa diisi tanpa internet. Isinya tersimpan dulu di laptop
// (IndexedDB) lalu otomatis terkirim ke ERP saat online (lihat src/lib/sheet-store.ts & /api/lembar/sync).
// Setiap lembar menempel ke modul yang sudah ada, jadi hak aksesnya mengikuti modul itu.
// Isi sel boleh rumus seperti Excel ("=L7/1000*N7*120%", "=SUMIF(...)") — lihat src/lib/sheet-formula.ts.
import type { Module } from "./access";
import { BENIH_SUMBER_SHEETS } from "./sheets-benih-sumber";

export type SheetColumn = {
  /** Kunci penyimpanan. Untuk lembar dari Excel = huruf kolom Excel (A, B, …), sehingga posisinya sama persis. */
  key: string;
  label: string;
  /** Judul tingkat atas (judul kolom 2 baris di Excel, mis. "Stock Seed Tersedia (gr)" di atas Male/Female). */
  group?: string;
  /** "date" & "number" hanya memengaruhi tampilan/perataan; isi tetap disimpan apa adanya seperti yang diketik. */
  type?: "text" | "number" | "date";
  /** Pilihan tetap (mis. status); tetap boleh diketik bebas seperti di Excel. */
  options?: string[];
  width?: number;
  /** Rumus standar kolom ({r} = nomor baris): otomatis diisikan ke baris baru, seperti menarik rumus ke bawah di Excel. */
  formula?: string;
  /** Kolom otomatis ({r} = nomor baris): selalu dihitung, tidak disimpan & tidak bisa diketik. */
  computed?: string;
};

export type SheetNote = { cell: string; text: string; formula?: string; bg?: string };

export type SheetDef = {
  key: string;
  title: string;
  module: Module;
  description?: string;
  columns: SheetColumn[];
  provisional?: boolean;
  /** Lembar dari file Excel: nama sheet asli, kelompok file, baris judul & baris data pertama, catatan di atas tabel. */
  excelName?: string;
  workbook?: string;
  headerRows?: number[];
  dataStart?: number;
  notes?: SheetNote[];
};

/** Kelompok lembar (satu file Excel = satu buku kerja). Rumus boleh merujuk lembar lain dalam keluarga yang sama. */
export const WORKBOOKS: Record<string, { title: string; description: string }> = {
  bukuInduk: {
    title: "Buku Induk Mampu Telusur Benih Sumber 2026",
    description: "Benih sumber (stock seed) masuk & keluar: internal, NH, dan MTM.",
  },
  ketersediaan: {
    title: "Ketersediaan Benih Sumber di Gudang 2026",
    description: "Stok benih sumber per kode produksi & per LOT, uji, dan rencana perbanyakan.",
  },
  lain: { title: "Lembar lainnya", description: "" },
};

/**
 * Kolom sementara (`provisional`) sampai file Excel yang dipakai sekarang diterima; setelah itu kolom & urutannya
 * disamakan persis dengan file. Kunci kolom (key) jangan diganti setelah dipakai karena data disimpan per kunci.
 */
export const SHEETS: SheetDef[] = [
  ...BENIH_SUMBER_SHEETS,
  {
    key: "iso",
    title: "Catatan ISO",
    module: "mutu",
    workbook: "lain",
    description: "Catatan/rekaman formulir ISO 9001 yang selama ini diisi di Excel.",
    provisional: true,
    columns: [
      { key: "tanggal", label: "Tanggal", type: "date", width: 110 },
      { key: "no_form", label: "No Formulir", width: 120 },
      { key: "nama_form", label: "Nama Formulir / Rekaman", width: 200 },
      { key: "bagian", label: "Bagian", width: 110 },
      { key: "uraian", label: "Uraian", width: 260 },
      { key: "pic", label: "PIC", width: 110 },
      { key: "status", label: "Status", options: ["Terbuka", "Proses", "Selesai"], width: 90 },
      { key: "ket", label: "Keterangan", width: 200 },
    ],
  },
];

export const sheetByKey = (key: string) => SHEETS.find((s) => s.key === key);

/**
 * Lembar yang saling terhubung lewat rumus: kedua file benih sumber dihitung bersama (Rincian Ketersediaan merujuk
 * Buku Induk per LOT), lembar lain berdiri sendiri.
 */
export const sheetFamily = (key: string) => {
  const s = sheetByKey(key);
  if (!s) return [];
  if (s.workbook === "bukuInduk" || s.workbook === "ketersediaan") return SHEETS.filter((x) => x.workbook === "bukuInduk" || x.workbook === "ketersediaan");
  return [s];
};

/** Kunci data yang boleh disimpan untuk sebuah lembar: kolom yang bisa diketik + warna selnya ("A#bg"). */
export const storableKeys = (s: SheetDef) => new Set(s.columns.filter((c) => !c.computed).flatMap((c) => [c.key, `${c.key}#bg`]));
