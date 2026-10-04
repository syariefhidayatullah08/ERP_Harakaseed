// Hak akses per divisi. Dipakai di server (halaman, server action, API) dan sidebar (client).

export const MODULES = {
  penjualan: "Penjualan",
  pengiriman: "Pengiriman",
  keuangan: "Keuangan",
  pelanggan: "Pelanggan",
  produk: "Produk / Varietas",
  inventori: "Gudang & Lot",
  produksi: "Produksi Benih",
  mitra: "Petani Mitra",
  qc: "Lab / QC",
  mutu: "Mutu & Audit ISO",
  keluhan: "Keluhan Pelanggan",
  pembelian: "Pembelian",
  sdm: "SDM / Karyawan",
  pengguna: "Akun Pengguna",
  email: "Email Perusahaan",
  laporan: "Laporan",
} as const;

export type Module = keyof typeof MODULES;
export const ALL_MODULES = Object.keys(MODULES) as Module[];

export const MODULE_HINT: Record<Module, string> = {
  penjualan: "Pesanan, harga jual, konfirmasi ke pelanggan",
  pengiriman: "Siapkan & kirim barang, surat jalan (tanpa harga)",
  keuangan: "Pembayaran, piutang, invoice, omzet, laporan keuangan",
  pelanggan: "Data distributor, toko, petani",
  produk: "Daftar varietas & spesifikasi",
  inventori: "Stok per lot, terima barang, penyesuaian stok",
  produksi: "Batch tanam → panen → prosesing",
  mitra: "Petani penangkar",
  qc: "Uji laboratorium, daya kecambah, kelulusan lot",
  mutu: "Audit ISO 9001, temuan & tindakan perbaikan (CAPA), pengendalian dokumen",
  keluhan: "Keluhan pelanggan, penggantian, penelusuran lot",
  pembelian: "Supplier & purchase order",
  sdm: "Data karyawan per divisi",
  pengguna: "Membuat & mengelola akun login ERP",
  email: "Kotak masuk & kirim email perusahaan",
  laporan: "Laporan sesuai modul yang bisa diakses",
};

export const DIVISIONS = {
  owner: { label: "Owner (Keuangan)", description: "Melihat & mengatur seluruh ERP, termasuk keuangan" },
  produksi: { label: "Produksi", description: "Batch produksi benih & petani mitra" },
  lab_qc: { label: "Lab / QC", description: "Uji laboratorium & kelulusan lot" },
  warehouse: { label: "Warehouse", description: "Stok gudang, lot, dan pengiriman barang" },
  admin_sdm: { label: "Admin / SDM", description: "Karyawan, akun pengguna, pembelian, administrasi" },
  mutu: { label: "Mutu", description: "Sistem manajemen mutu ISO: audit, temuan, dokumen" },
  marketing: { label: "Marketing", description: "Pesanan, pelanggan, komunikasi email" },
} as const;

export type Division = keyof typeof DIVISIONS;
export const isDivision = (v: unknown): v is Division => typeof v === "string" && v in DIVISIONS;

/** Modul yang hanya boleh dibuka Owner, tidak bisa diberikan ke divisi lain. */
export const OWNER_ONLY: Module[] = ["keuangan"];

/** Hak akses bawaan. Owner bisa mengubahnya di Pengaturan → Hak akses divisi (kecuali modul OWNER_ONLY). */
export const DEFAULT_ACCESS: Record<Exclude<Division, "owner">, Module[]> = {
  produksi: ["produksi", "mitra", "produk", "laporan"],
  lab_qc: ["qc", "produk", "laporan"],
  warehouse: ["inventori", "pengiriman", "produk", "laporan"],
  admin_sdm: ["sdm", "pengguna", "pembelian", "pelanggan", "email", "laporan"],
  mutu: ["mutu", "produk", "laporan"],
  marketing: ["penjualan", "pelanggan", "keluhan", "produk", "email", "laporan"],
};

export type AccessMatrix = Partial<Record<Division, Module[]>>;

/** Daftar modul efektif untuk sebuah divisi. Owner selalu semua; divisi lain tidak pernah mendapat modul OWNER_ONLY. */
export function resolveModules(role: string, matrix?: AccessMatrix | null): Module[] {
  if (role === "owner") return [...ALL_MODULES];
  if (!isDivision(role)) return [];
  const list: Module[] = matrix?.[role] ?? DEFAULT_ACCESS[role as Exclude<Division, "owner">];
  return list.filter((m) => m in MODULES && !OWNER_ONLY.includes(m));
}

/** Punya salah satu dari modul yang diminta? Null = halaman bebas (dashboard, akun saya). */
export function hasAny(modules: readonly Module[], need: Module | readonly Module[] | null) {
  if (!need) return true;
  return (Array.isArray(need) ? need : [need]).some((m) => modules.includes(m));
}

/** Modul yang menaungi sebuah path, mis. "/penjualan/12" → "penjualan". */
export function moduleForPath(pathname: string): Module | null {
  const seg = pathname.split("/")[1] ?? "";
  return seg in MODULES ? (seg as Module) : null;
}

export const divisionLabel = (role: string) => (isDivision(role) ? DIVISIONS[role].label : role);
