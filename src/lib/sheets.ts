// Lembar kerja offline: tabel seperti Excel yang tetap bisa diisi tanpa internet. Isinya tersimpan dulu di laptop
// (IndexedDB) lalu otomatis terkirim ke ERP saat online (lihat src/lib/sheet-store.ts & /api/lembar/sync).
// Setiap lembar menempel ke modul yang sudah ada, jadi hak aksesnya mengikuti modul itu.
import type { Module } from "./access";

export type SheetColumn = {
  key: string;
  label: string;
  /** "date" & "number" hanya memengaruhi tampilan/perataan; isi tetap disimpan apa adanya seperti yang diketik. */
  type?: "text" | "number" | "date";
  /** Pilihan tetap (mis. status); tetap boleh diketik bebas seperti di Excel. */
  options?: string[];
  width?: number;
};

export type SheetDef = { key: string; title: string; module: Module; description: string; columns: SheetColumn[]; provisional?: boolean };

/**
 * Kolom sementara (`provisional`) sampai file Excel yang dipakai sekarang diterima; setelah itu kolom & urutannya
 * disamakan persis dengan file. Kunci kolom (key) jangan diganti setelah dipakai karena data disimpan per kunci.
 */
export const SHEETS: SheetDef[] = [
  {
    key: "penanaman",
    title: "Pengajuan Penanaman Kontrak Petani",
    module: "produksi",
    description: "Pengajuan tanam benih kontrak per petani: lahan, varietas, kebutuhan benih, rencana tanam.",
    provisional: true,
    columns: [
      { key: "tgl_pengajuan", label: "Tgl Pengajuan", type: "date", width: 110 },
      { key: "petani", label: "Nama Petani", width: 160 },
      { key: "lokasi", label: "Lokasi Lahan", width: 130 },
      { key: "petugas", label: "Petugas", width: 80 },
      { key: "no_kontrak", label: "No Kontrak", width: 100 },
      { key: "kode_produksi", label: "Kode Produksi", width: 100 },
      { key: "varietas", label: "Varietas", width: 120 },
      { key: "luas", label: "Luas Lahan (m²)", type: "number", width: 110 },
      { key: "benih_gr", label: "Kebutuhan Benih (gr)", type: "number", width: 130 },
      { key: "tgl_tanam", label: "Rencana Tgl Tanam", type: "date", width: 120 },
      { key: "est_panen", label: "Perkiraan Panen", type: "date", width: 120 },
      { key: "status", label: "Status", options: ["Diajukan", "Disetujui", "Ditolak", "Ditanam"], width: 100 },
      { key: "ket", label: "Keterangan", width: 200 },
    ],
  },
  {
    key: "stock-seed",
    title: "Rekap Stock Seed",
    module: "stok_bahan",
    description: "Rekap benih induk (stock seed jantan/betina): masuk, keluar, dan sisa per kode produksi.",
    provisional: true,
    columns: [
      { key: "tanggal", label: "Tanggal", type: "date", width: 110 },
      { key: "kode_produksi", label: "Kode Produksi", width: 110 },
      { key: "varietas", label: "Varietas", width: 120 },
      { key: "jenis", label: "Jenis", options: ["Male", "Female"], width: 80 },
      { key: "no_batch", label: "No Batch", width: 90 },
      { key: "masuk_kg", label: "Masuk (kg)", type: "number", width: 100 },
      { key: "keluar_kg", label: "Keluar (kg)", type: "number", width: 100 },
      { key: "sisa_kg", label: "Sisa (kg)", type: "number", width: 100 },
      { key: "lokasi", label: "Lokasi Simpan", width: 120 },
      { key: "ket", label: "Keterangan", width: 200 },
    ],
  },
  {
    key: "iso",
    title: "Catatan ISO",
    module: "mutu",
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
