export const COMPLAINT_CATEGORIES = [
  "Daya kecambah rendah",
  "Benih tidak tumbuh seragam",
  "Varietas tidak sesuai (campur)",
  "Hasil panen tidak sesuai deskripsi",
  "Kemasan rusak / bocor",
  "Kadaluarsa / label salah",
  "Hama / penyakit terbawa benih",
  "Lainnya",
];

export const COMPLAINT_SEVERITY: Record<string, { label: string; tone: string }> = {
  rendah: { label: "Rendah", tone: "gray" },
  sedang: { label: "Sedang", tone: "amber" },
  tinggi: { label: "Tinggi", tone: "red" },
};

export const COMPLAINT_STATUS: Record<string, { label: string; tone: string }> = {
  baru: { label: "Baru", tone: "blue" },
  investigasi: { label: "Investigasi", tone: "amber" },
  tindakan: { label: "Tindakan perbaikan", tone: "purple" },
  selesai: { label: "Selesai", tone: "green" },
};
