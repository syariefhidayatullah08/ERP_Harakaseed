// Sistem Manajemen Mutu (ISO 9001:2015): jenis audit, kategori temuan, status, jenis dokumen.

export const AUDIT_TYPES = ["Audit internal", "Audit eksternal (sertifikasi)", "Audit surveilan", "Audit resertifikasi", "Audit supplier", "Tinjauan manajemen"];

export const STANDARDS = ["ISO 9001:2015", "ISO 14001:2015", "ISO 45001:2018", "ISO/IEC 17025:2017", "Sertifikasi benih (BPSB)", "Lainnya"];

export const AUDIT_STATUS: Record<string, { label: string; tone: string }> = {
  rencana: { label: "Direncanakan", tone: "blue" },
  berlangsung: { label: "Berlangsung", tone: "amber" },
  selesai: { label: "Selesai", tone: "green" },
  batal: { label: "Batal", tone: "gray" },
};

export const FINDING_CATEGORY: Record<string, { label: string; tone: string; days: number }> = {
  mayor: { label: "Ketidaksesuaian mayor", tone: "red", days: 30 },
  minor: { label: "Ketidaksesuaian minor", tone: "amber", days: 60 },
  observasi: { label: "Observasi", tone: "blue", days: 90 },
  ofi: { label: "Peluang perbaikan (OFI)", tone: "gray", days: 90 },
};

/** terbuka → (divisi menjawab) ditanggapi → (Mutu memeriksa) diverifikasi/ditutup; Mutu bisa mengembalikan ke terbuka. */
export const FINDING_STATUS: Record<string, { label: string; tone: string }> = {
  terbuka: { label: "Terbuka", tone: "red" },
  ditanggapi: { label: "Ditanggapi divisi", tone: "amber" },
  ditutup: { label: "Ditutup (terverifikasi)", tone: "green" },
};

export const FINDING_SOURCE: Record<string, string> = {
  audit: "Audit",
  keluhan: "Keluhan pelanggan",
  proses: "Temuan proses / inspeksi",
  tinjauan: "Tinjauan manajemen",
};

export const ISO_9001_CLAUSES = [
  "4.1 Konteks organisasi",
  "4.4 Sistem manajemen mutu & prosesnya",
  "5.1 Kepemimpinan & komitmen",
  "5.2 Kebijakan mutu",
  "6.1 Risiko & peluang",
  "6.2 Sasaran mutu",
  "7.1.5 Sumber daya pemantauan & pengukuran",
  "7.2 Kompetensi",
  "7.5 Informasi terdokumentasi",
  "8.1 Perencanaan & pengendalian operasi",
  "8.2 Persyaratan produk",
  "8.4 Pengendalian penyedia eksternal",
  "8.5.1 Pengendalian produksi",
  "8.5.2 Identifikasi & mampu telusur",
  "8.6 Pelepasan produk",
  "8.7 Pengendalian output tidak sesuai",
  "9.1 Pemantauan & pengukuran",
  "9.2 Audit internal",
  "9.3 Tinjauan manajemen",
  "10.2 Ketidaksesuaian & tindakan korektif",
  "10.3 Peningkatan berkelanjutan",
];

export const DOC_TYPES = ["Manual mutu", "Kebijakan & sasaran mutu", "Prosedur (SOP)", "Instruksi kerja (IK)", "Formulir", "Spesifikasi produk", "Dokumen eksternal / standar"];

export const DOC_STATUS: Record<string, { label: string; tone: string }> = {
  draf: { label: "Draf", tone: "gray" },
  berlaku: { label: "Berlaku", tone: "green" },
  revisi: { label: "Sedang direvisi", tone: "amber" },
  kadaluarsa: { label: "Tidak berlaku", tone: "red" },
};
