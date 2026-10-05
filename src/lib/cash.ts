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
  lain: { label: "Biaya tetap & lainnya (gaji, BPJS, angsuran, pajak)", code: "" },
};

export const isCashCategory = (v: string) => v in CASH_CATEGORIES;
export const cashCategoryLabel = (v: string) => CASH_CATEGORIES[v]?.label ?? v;

export type CashEntry = { id: number; entry_date: string; description: string; category: string; amount_in: number; amount_out: number };
