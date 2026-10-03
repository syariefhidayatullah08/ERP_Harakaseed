// Hak akses per peran. Dipakai di sidebar (client), layout, dan server actions.

export const MODULES = {
  penjualan: "Penjualan",
  pelanggan: "Pelanggan",
  inventori: "Inventori & Lot",
  produksi: "Produksi Benih",
  mitra: "Petani Mitra",
  pembelian: "Pembelian",
  produk: "Produk / Varietas",
  email: "Email",
  laporan: "Laporan",
} as const;

export type Module = keyof typeof MODULES;

export const ROLES: Record<string, { label: string; description: string; modules: Module[] | "all" }> = {
  admin: { label: "Admin", description: "Semua modul + pengaturan perusahaan & pengguna", modules: "all" },
  staff: { label: "Staf umum", description: "Semua modul operasional, tanpa pengaturan perusahaan", modules: "all" },
  sales: {
    label: "Sales",
    description: "Penjualan, pelanggan, email, laporan, produk & stok",
    modules: ["penjualan", "pelanggan", "email", "laporan", "produk", "inventori"],
  },
  gudang: {
    label: "Gudang & Produksi",
    description: "Inventori, produksi, petani mitra, pembelian, produk",
    modules: ["inventori", "produksi", "mitra", "pembelian", "produk", "email"],
  },
};

export function canAccess(role: string, mod: Module | null) {
  if (!mod) return true;
  const r = ROLES[role];
  if (!r) return false;
  return r.modules === "all" || r.modules.includes(mod);
}

/** Modul yang menaungi sebuah path, mis. "/penjualan/12" → "penjualan". Null = bebas (dashboard, pengaturan). */
export function moduleForPath(pathname: string): Module | null {
  const seg = pathname.split("/")[1] ?? "";
  return seg in MODULES ? (seg as Module) : null;
}
