import type { Module } from "./access";

/** Dokumen yang bisa diberi lampiran bukti, beserta modul yang mengatur hak aksesnya. */
export const ATTACHMENT_REFS = {
  sales_order: { module: "penjualan", path: (id: number) => `/penjualan/${id}` },
  customer: { module: "pelanggan", path: (id: number) => `/pelanggan/${id}` },
  lot: { module: "inventori", path: (id: number) => `/inventori/${id}` },
  production: { module: "produksi", path: (id: number) => `/produksi/${id}` },
  purchase_order: { module: "pembelian", path: (id: number) => `/pembelian/${id}` },
} satisfies Record<string, { module: Module; path: (id: number) => string }>;

export type AttachmentRef = keyof typeof ATTACHMENT_REFS;

export const isAttachmentRef = (v: unknown): v is AttachmentRef => typeof v === "string" && v in ATTACHMENT_REFS;

/** Kategori yang ditawarkan per jenis dokumen (pilihan pertama = default). */
export const ATTACHMENT_CATEGORIES: Record<AttachmentRef, string[]> = {
  sales_order: ["Bukti transfer", "Surat jalan ditandatangani", "Foto barang / packing", "PO dari pelanggan", "Lainnya"],
  customer: ["KTP / NPWP", "Kontrak / perjanjian", "Foto toko", "Lainnya"],
  lot: ["Hasil uji lab", "Sertifikat benih", "Foto kemasan", "Berita acara stock opname", "Lainnya"],
  production: ["Foto lapangan", "Hasil uji lab", "Berita acara panen", "Lainnya"],
  purchase_order: ["Nota / faktur supplier", "Bukti transfer", "Foto barang diterima", "Lainnya"],
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
