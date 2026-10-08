// Daftar sheet dari dua file Excel benih sumber yang dijadikan Lembar Kerja Offline (posisi kolom & nomor baris sama
// dengan Excel). Dipakai oleh scripts/gen-benih-sumber.mjs (membuat definisi kolom) dan scripts/import-benih-sumber.mjs.
export const FILES = {
  bukuInduk: "referensi/BUKU INDUK MAMPU TELUSUR BENIH SUMBER 2026.xlsx",
  ketersediaan: "referensi/KETERSEDIAAN BENIH SUMBER DI GUDANG terbaru 2026.xlsx",
};

/**
 * key: kunci lembar di ERP · name: nama sheet di Excel (persis, termasuk spasi) · header: baris judul kolom (1 atau 2 baris)
 * dataStart: baris data pertama · module: hak akses · lastCol: paksa kolom terakhir (kolom samping tanpa judul tetap ikut).
 */
export const SHEETS = [
  { file: "bukuInduk", key: "ss-masuk-internal", name: "SS Masuk BENIH INTERNAL ", header: [5, 6], dataStart: 7, module: "produksi" },
  { file: "bukuInduk", key: "ss-keluar-internal", name: "SS KELUAR BENIH INTERNAL", header: [6], dataStart: 7, module: "produksi" },
  { file: "bukuInduk", key: "ss-masuk-nh", name: "SS MASUK NH", header: [5, 6], dataStart: 7, module: "produksi" },
  { file: "bukuInduk", key: "ss-keluar-nh", name: "SS Keluar NH", header: [7], dataStart: 8, module: "produksi" },
  { file: "bukuInduk", key: "ss-mtm", name: "SS MTM ", header: [3, 4], dataStart: 5, module: "produksi" },
  { file: "bukuInduk", key: "benih-masuk-mtm", name: "BENIH MASUK MTM ", header: [3], dataStart: 4, module: "produksi" },
  { file: "ketersediaan", key: "ketersediaan-ss", name: "Ketersediaan SS", header: [4, 5], dataStart: 6, module: "stok_bahan" },
  { file: "ketersediaan", key: "rincian-ss", name: "Rincian Ketersediaan SS", header: [2, 3], dataStart: 4, module: "stok_bahan" },
  { file: "ketersediaan", key: "rekap-rincian-ss", name: "Rekap Rincian Ketersediaan SS", header: [1], dataStart: 2, module: "stok_bahan" },
  { file: "ketersediaan", key: "uji-ss", name: "UJI SS", header: [3, 4], dataStart: 5, module: "stok_bahan" },
  { file: "ketersediaan", key: "uji-ss-2", name: "UJI SS (2)", header: [3, 4], dataStart: 5, module: "stok_bahan" },
  { file: "ketersediaan", key: "catatan-ss", name: "Catatan", header: [1], dataStart: 2, module: "stok_bahan" },
  { file: "ketersediaan", key: "ketersediaan-bs", name: "Ketersediaan BS", header: [3, 4], dataStart: 5, module: "stok_bahan" },
  { file: "ketersediaan", key: "plan-perbanyakan-ss", name: "Plan Perbanyakan SS", header: [2], dataStart: 3, module: "stok_bahan" },
];
