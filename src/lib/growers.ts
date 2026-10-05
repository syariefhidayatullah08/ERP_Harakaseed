import "server-only";
import { all, insert } from "./db";

// Menghubungkan nama petani yang diketik di buku induk / pengambilan benih ke data Petani Mitra.

const SUFFIX = /\s+(\d+|i{1,3}|iv|v|[a-d])$/i;
const TITLE = /^((pak|bpk|bp|bapak|bu|ibu|mas|mbak|om|hj|h|p|b)\.?\s+)+/i;

/**
 * Nama dasar petani untuk dicocokkan: huruf kecil, spasi dirapikan, sapaan di depan ("Pak Salam", "H. Sutikno")
 * dan penanda lahan/urutan di belakang ("Abdullah 2", "Adit II", "Bahrawi B") dibuang.
 */
export const farmerBase = (name: string) => {
  const n = name.toLowerCase().replace(/\s+/g, " ").trim().replace(SUFFIX, "").trim();
  return n.replace(TITLE, "").trim() || n;
};

/**
 * Petani mitra untuk sebuah nama. Satu petani bernama sama → dia; beberapa → yang desanya memuat lokasi lahan;
 * tidak ada → dibuat baru bila `create`. Null berarti ragu (nama sama di beberapa desa dan lokasinya tidak menentukan).
 */
export async function resolveGrower(farmer: string, location: string, create: boolean): Promise<number | null> {
  const base = farmerBase(farmer);
  if (!base) return null;
  const same = (await all<{ id: number; name: string; village: string }>("SELECT id, name, village FROM growers WHERE lower(name) LIKE ? ORDER BY id", `%${base}%`)).filter((g) => farmerBase(g.name) === base);
  if (same.length === 1) return same[0].id;
  if (same.length > 1) {
    const loc = location.toLowerCase().replace(/[^a-z0-9]/g, "");
    const near = loc ? same.filter((g) => g.village.toLowerCase().replace(/[^a-z0-9]/g, "").includes(loc)) : [];
    return near.length === 1 ? near[0].id : null;
  }
  if (!create) return null;
  // Nama dicatat tanpa penanda urutan, dengan kapital seperti yang diketik.
  const display = farmer.replace(/\s+/g, " ").trim().replace(SUFFIX, "").trim();
  return insert("INSERT INTO growers (name, village) VALUES (?, ?)", display, location.trim());
}
