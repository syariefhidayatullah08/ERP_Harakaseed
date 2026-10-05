// Jenis penjualan. Kemasan = benih per kemasan (varietas + gramasi, memotong stok lot);
// bulky = benih curah per kg; label = label kemasan per lembar. Bulky & label tidak memotong stok lot.

export const CHANNELS = {
  kemasan: { label: "Kemasan", title: "Penjualan Kemasan", unit: "kemasan", short: "kms", hint: "Benih per kemasan: pilih varietas lalu gramasinya. Stok dipotong per lot saat dikirim." },
  bulky: { label: "Bulky", title: "Penjualan Bulky", unit: "kg", short: "kg", hint: "Benih curah per kilogram, tanpa gramasi kemasan." },
  label: { label: "Label", title: "Penjualan Label", unit: "lembar", short: "lbr", hint: "Label kemasan per lembar, per varietas dan gramasi." },
} as const;

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
  WHEN 'label' THEN trim('label kemasan ' || i.pack_size)
  ELSE trim('kemasan ' || i.pack_size) END) AS pack_size`;
