export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

export const num = (n: number) => new Intl.NumberFormat("id-ID").format(n || 0);

// Server Vercel berjalan di UTC; tanggal bisnis selalu mengikuti WIB (Asia/Jakarta).
const TZ = "Asia/Jakarta";

/** Tanggal "YYYY-MM-DD" atau waktu "YYYY-MM-DD HH:MM:SS" (sudah WIB) → "2 Okt 2026". */
export const tanggal = (s?: string | null) =>
  s
    ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
        new Date(s.slice(0, 10) + "T00:00:00Z"),
      )
    : "—";

export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

/** Waktu sekarang di WIB, format "YYYY-MM-DD HH:MM:SS". */
export const nowWib = (d = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d);

export const addDays = (date: string, days: number) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const daysUntil = (date: string) =>
  Math.round((new Date(date + "T00:00:00Z").getTime() - new Date(today() + "T00:00:00Z").getTime()) / 86400000);

export const SO_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "gray" },
  dikonfirmasi: { label: "Dikonfirmasi", tone: "blue" },
  dikirim: { label: "Dikirim", tone: "amber" },
  selesai: { label: "Selesai", tone: "green" },
  batal: { label: "Batal", tone: "red" },
};

export const PRD_STATUS: Record<string, { label: string; tone: string }> = {
  tanam: { label: "Tanam", tone: "green" },
  panen: { label: "Panen", tone: "amber" },
  prosesing: { label: "Prosesing", tone: "blue" },
  uji_lab: { label: "Uji Lab", tone: "purple" },
  lulus: { label: "Lulus → Stok", tone: "green" },
  gagal: { label: "Gagal", tone: "red" },
};

export const PO_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "gray" },
  dipesan: { label: "Dipesan", tone: "blue" },
  diterima: { label: "Diterima", tone: "green" },
  batal: { label: "Batal", tone: "red" },
};

export const CUSTOMER_KIND: Record<string, string> = {
  distributor: "Distributor",
  toko: "Toko / Kios Tani",
  petani: "Petani / Kelompok Tani",
  ekspor: "Ekspor",
  instansi: "Instansi / Proyek",
};

export function paymentStatus(total: number, paid: number) {
  if (total <= 0) return { label: "—", tone: "gray" };
  if (paid >= total) return { label: "Lunas", tone: "green" };
  if (paid > 0) return { label: "Sebagian", tone: "amber" };
  return { label: "Belum bayar", tone: "red" };
}
