// Angka → kata dalam Bahasa Indonesia, untuk baris "Terbilang" di invoice.
const SATUAN = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];

function words(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} Belas`;
  if (n < 100) return `${SATUAN[Math.floor(n / 10)]} Puluh ${words(n % 10)}`;
  if (n < 200) return `Seratus ${words(n - 100)}`;
  if (n < 1000) return `${SATUAN[Math.floor(n / 100)]} Ratus ${words(n % 100)}`;
  if (n < 2000) return `Seribu ${words(n - 1000)}`;
  if (n < 1_000_000) return `${words(Math.floor(n / 1000))} Ribu ${words(n % 1000)}`;
  if (n < 1_000_000_000) return `${words(Math.floor(n / 1_000_000))} Juta ${words(n % 1_000_000)}`;
  if (n < 1_000_000_000_000) return `${words(Math.floor(n / 1_000_000_000))} Miliar ${words(n % 1_000_000_000)}`;
  return `${words(Math.floor(n / 1_000_000_000_000))} Triliun ${words(n % 1_000_000_000_000)}`;
}

/** 28816250 → "Dua Puluh Delapan Juta Delapan Ratus Enam Belas Ribu Dua Ratus Lima Puluh Rupiah" */
export function terbilang(amount: number) {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return "Nol Rupiah";
  return `${amount < 0 ? "Minus " : ""}${words(n).replace(/\s+/g, " ").trim()} Rupiah`;
}
