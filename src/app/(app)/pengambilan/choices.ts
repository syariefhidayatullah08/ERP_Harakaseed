import "server-only";
import { all } from "@/lib/db";

/** Saran isian form pengambilan: petani mitra, dan kode produksi yang pernah dipakai (stok bahan baku, buku induk, pengambilan). */
export async function pickupChoices() {
  const farmers = await all<{ name: string; village: string }>("SELECT name, village FROM growers ORDER BY name LIMIT 1500");
  const codes = (
    await all<{ c: string }>(
      `SELECT DISTINCT c FROM (
         SELECT upper(production_code) c FROM bulk_stock
         UNION SELECT upper(production_code) FROM seed_intakes
         UNION SELECT upper(production_code) FROM seed_pickups
       ) t WHERE c <> '' ORDER BY 1 LIMIT 500`,
    )
  ).map((r) => r.c);
  return { farmers, codes };
}
