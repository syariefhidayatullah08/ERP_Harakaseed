// Buku kas: pemasukan & pengeluaran harian perusahaan. Acuan: referensi/Laporan Keuangan Bulan … .xlsx.
// Kategori mengikuti kolom KODE di laporan keuangan (1–10); transaksi tanpa kode masuk "Biaya tetap & lainnya".

export const CASH_CATEGORIES: Record<string, { label: string; code: string }> = {
  saldo_awal: { label: "Saldo awal", code: "" },
  pb_in: { label: "Pembayaran benih petani internal", code: "1" },
  pb_eks: { label: "Pembayaran benih petani eksternal", code: "2" },
  in_bulky: { label: "Pemasukan internal: bulky & label", code: "3" },
  in_kemasan: { label: "Pemasukan internal: kemasan", code: "4" },
  in_nh: { label: "Pemasukan eksternal: Nusa Heulang", code: "5" },
  in_mtm: { label: "Pemasukan eksternal: Muara Tirtamas", code: "6" },
  add: { label: "Operasional & tambahan", code: "7" },
  pinjaman: { label: "Pinjaman petani", code: "8" },
  gaji_gudang: { label: "Gaji gudang", code: "9" },
  pe: { label: "Pembelian benih eksternal", code: "10" },
  pindah: { label: "Pindah saldo antar akun", code: "" },
  penyesuaian: { label: "Penyesuaian saldo", code: "" },
  lain: { label: "Biaya tetap & lainnya (gaji, BPJS, angsuran, pajak)", code: "" },
};

export const isCashCategory = (v: string) => v in CASH_CATEGORIES;

/** Akun kas: rekening bank perusahaan dan uang tunai di kantor. Rekening utama (bawaan) = Mandiri. */
export const CASH_ACCOUNTS: Record<string, string> = { mandiri: "Bank Mandiri", bsi: "Bank BSI", bca: "Bank BCA", tunai: "Kas tunai" };
export const CASH_ACCOUNT_KEYS = Object.keys(CASH_ACCOUNTS);
export const DEFAULT_ACCOUNT = "mandiri";
export const toCashAccount = (v: unknown) => (typeof v === "string" && v in CASH_ACCOUNTS ? v : DEFAULT_ACCOUNT);
/** Pembayaran pesanan tanpa pilihan akun: tunai masuk kas tunai, selain itu (transfer, giro, QRIS) rekening utama. */
export const accountForMethod = (method: string) => (/tunai|cash/i.test(method) ? "tunai" : DEFAULT_ACCOUNT);
export const cashCategoryLabel = (v: string) => CASH_CATEGORIES[v]?.label ?? v;

/**
 * Kategori kas untuk pembayaran pesanan penjualan: mengikuti jenis penjualan (kemasan / bulky & label),
 * kecuali dua pelanggan kontrak eksternal yang punya kode sendiri di laporan keuangan.
 */
export function salesCashCategory(channel: string, customer: string) {
  if (/nusa\s*heulang/i.test(customer)) return "in_nh";
  if (/muara\s*tirta\s*mas/i.test(customer)) return "in_mtm";
  // Kerjasama produksi di luar NH/MTM ikut "bulky & label" karena sama-sama penjualan benih per kg.
  return channel === "kemasan" ? "in_kemasan" : "in_bulky";
}

export type CashEntry = { id: number; entry_date: string; description: string; category: string; amount_in: number; amount_out: number; account: string; transfer_ref: string | null; so_id: number | null; pb_id: number | null; po_id: number | null };
