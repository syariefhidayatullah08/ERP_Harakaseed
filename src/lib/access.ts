// Hak akses per divisi. Dipakai di server (halaman, server action, API) dan sidebar (client).

export const MODULES = {
  penjualan: "Penjualan",
  pengiriman: "Pengiriman",
  keuangan: "Keuangan",
  kas: "Buku Kas",
  pelanggan: "Pelanggan",
  produk: "Produk / Varietas",
  inventori: "Gudang & Lot",
  stok_bahan: "Stok Bahan Baku",
  produksi: "Produksi Benih",
  mitra: "Petani Mitra",
  qc: "Lab / QC",
  mutu: "Mutu & Audit ISO",
  keluhan: "Keluhan Pelanggan",
  pembelian: "Pembelian",
  pembayaran_benih: "Pembayaran Benih Petani",
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
  kas: "Pemasukan & pengeluaran harian perusahaan, saldo kas (khusus Founder)",
  pelanggan: "Data distributor, toko, petani",
  produk: "Daftar varietas & spesifikasi",
  inventori: "Stok per lot, terima barang, penyesuaian stok",
  stok_bahan: "Stok bahan baku benih (kg) per kode produksi: belum uji, proses uji, siap jual",
  produksi: "Batch tanam → panen → prosesing",
  mitra: "Petani penangkar",
  qc: "Uji laboratorium, daya kecambah, kelulusan lot",
  mutu: "Audit ISO 9001, temuan & tindakan perbaikan (CAPA), pengendalian dokumen",
  keluhan: "Keluhan pelanggan, penggantian, penelusuran lot",
  pembelian: "Supplier & purchase order",
  pembayaran_benih: "Buku induk benih masuk dari petani & surat pengajuan pembayaran (PB)",
  sdm: "Data karyawan per divisi",
  pengguna: "Mengundang email & memberi hak akses per divisi (khusus Founder)",
  email: "Kotak masuk & kirim email perusahaan",
  laporan: "Laporan sesuai modul yang bisa diakses",
};

export const DIVISIONS = {
  owner: { label: "Founder & Moderator", description: "Mengatur seluruh ERP termasuk keuangan, mengundang pengguna, dan memberi hak akses tiap divisi" },
  produksi: { label: "Produksi", description: "Batch produksi benih & petani mitra" },
  lab_qc: { label: "Lab / QC", description: "Uji laboratorium & kelulusan lot" },
  warehouse: { label: "Warehouse", description: "Stok gudang, lot, dan pengiriman barang" },
  admin_sdm: { label: "Admin / SDM", description: "Karyawan, pembelian, pembayaran benih, administrasi" },
  mutu: { label: "Mutu", description: "Sistem manajemen mutu ISO: audit, temuan, dokumen" },
  marketing: { label: "Marketing", description: "Pesanan, pelanggan, komunikasi email" },
} as const;

export type Division = keyof typeof DIVISIONS;
export const isDivision = (v: unknown): v is Division => typeof v === "string" && v in DIVISIONS;

/** Modul yang hanya boleh dibuka Founder (kode peran 'owner'), tidak bisa diberikan ke divisi lain. */
export const OWNER_ONLY: Module[] = ["keuangan", "kas", "pengguna"];

/** Hak akses bawaan. Founder bisa mengubahnya di Pengaturan → Hak akses divisi (kecuali modul OWNER_ONLY). */
export const DEFAULT_ACCESS: Record<Exclude<Division, "owner">, Module[]> = {
  produksi: ["produksi", "mitra", "produk", "laporan"],
  lab_qc: ["qc", "stok_bahan", "produk", "laporan"],
  warehouse: ["inventori", "stok_bahan", "pengiriman", "produk", "laporan"],
  admin_sdm: ["sdm", "pembelian", "pembayaran_benih", "pelanggan", "email", "laporan"],
  mutu: ["mutu", "produk", "laporan"],
  marketing: ["penjualan", "pelanggan", "keluhan", "produk", "email", "laporan"],
};

export type AccessMatrix = Partial<Record<Division, Module[]>>;

/** Hak akses khusus satu orang (kolom users.modules, JSON). Null = mengikuti divisinya. */
export function parseModules(raw: string | null | undefined): Module[] | null {
  if (!raw) return null;
  try {
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) ? list.filter((m): m is Module => typeof m === "string" && m in MODULES) : null;
  } catch {
    return null;
  }
}

/**
 * Daftar modul efektif. Founder selalu semua; yang lain mengikuti divisinya, kecuali bila orang itu diberi
 * hak akses khusus (`custom`). Selain Founder tidak pernah mendapat modul OWNER_ONLY.
 */
export function resolveModules(role: string, matrix?: AccessMatrix | null, custom?: Module[] | null): Module[] {
  if (role === "owner") return [...ALL_MODULES];
  if (!isDivision(role)) return [];
  const list: Module[] = custom ?? matrix?.[role] ?? DEFAULT_ACCESS[role as Exclude<Division, "owner">];
  return list.filter((m) => m in MODULES && !OWNER_ONLY.includes(m));
}

/** Punya salah satu dari modul yang diminta? Null = halaman bebas (dashboard, akun saya). */
export function hasAny(modules: readonly Module[], need: Module | readonly Module[] | null) {
  if (!need) return true;
  return (Array.isArray(need) ? need : [need]).some((m) => modules.includes(m));
}

/** Modul yang menaungi sebuah path, mis. "/penjualan/12" → "penjualan", "/pembayaran-benih" → "pembayaran_benih". */
export function moduleForPath(pathname: string): Module | null {
  const seg = (pathname.split("/")[1] ?? "").replace(/-/g, "_");
  return seg in MODULES ? (seg as Module) : null;
}

export const divisionLabel = (role: string) => (isDivision(role) ? DIVISIONS[role].label : role);
