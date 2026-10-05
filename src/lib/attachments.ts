import type { Module } from "./access";

/**
 * Dokumen yang bisa diberi lampiran bukti. `module` = divisi mana saja yang boleh melihat/mengunggah
 * (cukup punya salah satu). `paths` = halaman yang perlu diperbarui setelah lampiran berubah.
 */
export const ATTACHMENT_REFS = {
  sales_order: { module: ["penjualan", "pengiriman", "keuangan"], paths: (id: number) => [`/penjualan/${id}`, `/pengiriman/${id}`] },
  customer: { module: ["pelanggan"], paths: (id: number) => [`/pelanggan/${id}`] },
  lot: { module: ["inventori", "qc"], paths: (id: number) => [`/inventori/${id}`, `/qc/lot/${id}`] },
  production: { module: ["produksi", "qc"], paths: (id: number) => [`/produksi/${id}`, `/qc`] },
  pickup: { module: ["pengambilan", "pembayaran_benih"], paths: (id: number) => [`/pengambilan/${id}`, `/pengambilan`] },
  purchase_order: { module: ["pembelian"], paths: (id: number) => [`/pembelian/${id}`] },
  complaint: { module: ["keluhan"], paths: (id: number) => [`/keluhan/${id}`] },
  employee: { module: ["sdm"], paths: (id: number) => [`/sdm/${id}`] },
  audit: { module: ["mutu"], paths: (id: number) => [`/mutu/audit/${id}`] },
  // Temuan: Mutu + divisi penanggung jawab (dicek tambahan di lib/attachment-access.ts).
  finding: { module: ["mutu"], paths: (id: number) => [`/temuan/${id}`, `/temuan`] },
  qdoc: { module: ["mutu"], paths: (id: number) => [`/mutu/dokumen/${id}`] },
} satisfies Record<string, { module: Module[]; paths: (id: number) => string[] }>;

export type AttachmentRef = keyof typeof ATTACHMENT_REFS;

export const isAttachmentRef = (v: unknown): v is AttachmentRef => typeof v === "string" && v in ATTACHMENT_REFS;

/** Kategori yang ditawarkan per jenis dokumen (pilihan pertama = default). */
export const ATTACHMENT_CATEGORIES: Record<AttachmentRef, string[]> = {
  sales_order: ["Bukti transfer", "Surat jalan ditandatangani", "Foto barang / packing", "PO dari pelanggan", "Lainnya"],
  customer: ["KTP / NPWP", "Kontrak / perjanjian", "Foto toko", "Lainnya"],
  lot: ["Hasil uji lab", "Sertifikat benih", "Foto kemasan", "Berita acara stock opname", "Lainnya"],
  production: ["Foto lapangan", "Hasil uji lab", "Berita acara panen", "Lainnya"],
  pickup: ["Foto benih", "Foto timbangan", "Foto petani / lahan", "Nota / tanda terima", "Lainnya"],
  purchase_order: ["Nota / faktur supplier", "Bukti transfer", "Foto barang diterima", "Lainnya"],
  complaint: ["Foto keluhan dari pelanggan", "Hasil investigasi", "Berita acara penggantian", "Lainnya"],
  employee: ["KTP", "Kontrak kerja", "Ijazah / sertifikat", "Lainnya"],
  audit: ["Rencana / jadwal audit", "Daftar periksa (checklist)", "Laporan audit", "Sertifikat ISO", "Daftar hadir", "Lainnya"],
  finding: ["Bukti ketidaksesuaian", "Analisis akar masalah", "Bukti tindakan perbaikan", "Bukti verifikasi", "Lainnya"],
  qdoc: ["Dokumen berlaku (PDF)", "File sumber (Word/Excel)", "Dokumen lama / revisi sebelumnya", "Lainnya"],
};

export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export type AttachmentRow = {
  id: number;
  ref_type: string;
  ref_id: number;
  category: string;
  note: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
  uploader: string | null;
};

export const formatBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;
