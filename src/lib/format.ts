export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

export const num = (n: number) => new Intl.NumberFormat("id-ID").format(n || 0);

export const tanggal = (s?: string | null) =>
  s
    ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(s.length === 10 ? s + "T00:00:00" : s.replace(" ", "T")),
      )
    : "—";

export const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const addDays = (date: string, days: number) => {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const daysUntil = (date: string) =>
  Math.round((new Date(date + "T00:00:00").getTime() - new Date(today() + "T00:00:00").getTime()) / 86400000);

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
