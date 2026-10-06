// Jenis penjualan. Kemasan = benih per kemasan (varietas + gramasi, memotong stok lot); bulky = benih curah per kg
// (nama varietas diketik bebas, memotong stok bahan baku bila varietasnya dikenal); label = label kemasan per lembar;
// kerjasama = benih hasil kerja sama produksi per kg (nama petani + kode produksi diketik bebas). Label & kerjasama tidak memotong stok.

export const CHANNELS = {
  kemasan: { label: "Kemasan", title: "Penjualan Kemasan", unit: "kemasan", short: "kms", hint: "Benih per kemasan: pilih varietas lalu gramasinya. Stok dipotong per lot saat dikirim." },
  bulky: { label: "Bulky", title: "Penjualan Bulky", unit: "kg", short: "kg", hint: "Benih curah per kilogram, tanpa gramasi kemasan." },
  label: { label: "Label", title: "Penjualan Label", unit: "lembar", short: "lbr", hint: "Label kemasan per lembar, per varietas dan gramasi." },
  kerjasama: { label: "Kerjasama Produksi", title: "Penjualan Kerjasama Produksi", unit: "kg", short: "kg", hint: "Benih hasil kerja sama produksi per kilogram: ketik nama petani/varietas dan kode produksinya per baris." },
} as const;

/** Dijual per kg (boleh desimal) dan namanya diketik bebas, tanpa gramasi. */
export const perKg = (c: Channel) => c === "bulky" || c === "kerjasama";
/** Memakai varietas dari daftar produk + gramasi. */
export const usesPack = (c: Channel) => c === "kemasan" || c === "label";

/** Nama, kode, dan komoditas baris pesanan: nama yang diketik bebas (bulky/kerjasama) menang atas data produk. Alias tabel: i & p. */
export const ITEM_NAME_SQL = "COALESCE(NULLIF(i.item_name, ''), p.name, '')";
export const ITEM_CODE_SQL = "COALESCE(NULLIF(i.item_code, ''), p.sku, '')";
export const ITEM_CROP_SQL = "COALESCE(p.crop, '')";

export type Channel = keyof typeof CHANNELS;

export const CHANNEL_KEYS = Object.keys(CHANNELS) as Channel[];

export const toChannel = (v: unknown): Channel => (typeof v === "string" && v in CHANNELS ? (v as Channel) : "kemasan");

/**
 * Keterangan baris pesanan untuk tampilan & dokumen ("kemasan 10 g", "curah per kg", "label kemasan 10 g").
 * Dipakai sebagai kolom `pack_size` pada query yang membaca so_items dengan alias `i`.
 */
/** Gramasi kemasan diisi sebagai angka 1–100 (gram) dan disimpan sebagai teks, mis. "10 g". */
export const GRAM_MIN = 1;
export const GRAM_MAX = 100;
/** Angka gram → teks gramasi; kosong bila bukan bilangan bulat 1–100. */
export const gramPack = (v: unknown) => {
  const n = Number(v);
  return v !== "" && v != null && Number.isInteger(n) && n >= GRAM_MIN && n <= GRAM_MAX ? `${n} g` : "";
};
/** Teks gramasi → angka gram; null untuk kemasan lama yang bukan gram (mis. "50 butir"). */
export const packGram = (pack: string) => {
  const m = /^(\d+) g$/.exec(pack);
  return m ? Number(m[1]) : null;
};

export const ITEM_PACK_SQL = `(CASE (SELECT channel FROM sales_orders WHERE id = i.so_id)
  WHEN 'bulky' THEN 'curah per kg'
  WHEN 'kerjasama' THEN 'kerjasama produksi per kg'
  WHEN 'label' THEN trim('label kemasan ' || i.pack_size)
  ELSE trim('kemasan ' || i.pack_size) END) AS pack_size`;
