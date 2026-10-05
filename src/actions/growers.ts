"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { all, get, run, tx } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";
import { farmerBase } from "@/lib/growers";

/**
 * Hubungkan baris buku induk & pengambilan benih yang belum punya petani mitra ke petani ini, berdasarkan nama
 * yang tertulis di sana (penanda urutan seperti "Abdullah 2" diabaikan). Lokasi opsional untuk membedakan nama sama.
 */
export async function linkGrowerRows(fd: FormData) {
  await requireAccess("mitra");
  const id = numf(fd, "id");
  const back = `/mitra/${id}`;
  const g = await get<{ name: string }>("SELECT name FROM growers WHERE id = ?", id);
  if (!g) redirect(withMsg("/mitra", "Petani tidak ditemukan.", "error"));
  const base = farmerBase(str(fd, "farmer") || g.name);
  const loc = str(fd, "location").toLowerCase();
  if (!base) redirect(withMsg(back, "Isi nama petani seperti tertulis di buku induk.", "error"));
  let n = 0;
  await tx(async () => {
    for (const table of ["seed_intakes", "seed_pickups"]) {
      const rows = await all<{ id: number; farmer: string; location: string }>(`SELECT id, farmer, location FROM ${table} WHERE grower_id IS NULL AND lower(farmer) LIKE ?`, `%${base}%`);
      const ids = rows.filter((r) => farmerBase(r.farmer) === base && (!loc || r.location.toLowerCase().includes(loc))).map((r) => r.id);
      if (ids.length) await run(`UPDATE ${table} SET grower_id = ? WHERE id = ANY(?::int[])`, id, `{${ids.join(",")}}`);
      n += ids.length;
    }
  });
  revalidatePath("/mitra");
  await logActivity("mitra", "Menghubungkan riwayat ke petani mitra", `${g.name} ← "${base}"${loc ? ` di ${loc}` : ""} · ${n} baris`);
  redirect(withMsg(back, n ? `${n} baris bernama "${base}" dihubungkan ke ${g.name}.` : `Tidak ada baris bernama "${base}"${loc ? ` di ${loc}` : ""} yang belum terhubung.`, n ? "msg" : "error"));
}

/** Gabungkan petani ini ke petani lain (data ganda): seluruh riwayatnya pindah, lalu data ini dihapus. */
export async function mergeGrower(fd: FormData) {
  await requireAccess("mitra");
  const id = numf(fd, "id");
  const targetId = numf(fd, "target_id");
  const [from, to] = await Promise.all([get<{ name: string }>("SELECT name FROM growers WHERE id = ?", id), get<{ name: string; village: string }>("SELECT name, village FROM growers WHERE id = ?", targetId)]);
  if (!from || !to || id === targetId) redirect(withMsg(`/mitra/${id}`, "Pilih petani tujuan penggabungan.", "error"));
  await tx(async () => {
    for (const table of ["seed_intakes", "seed_pickups", "productions"]) await run(`UPDATE ${table} SET grower_id = ? WHERE grower_id = ?`, targetId, id);
    await run("DELETE FROM growers WHERE id = ?", id);
  });
  revalidatePath("/mitra");
  await logActivity("mitra", "Menggabungkan petani mitra", `${from.name} → ${to.name} (${to.village})`);
  redirect(withMsg(`/mitra/${targetId}`, `${from.name} digabungkan ke ${to.name}.`));
}

/** Hapus petani mitra yang belum punya riwayat apa pun. */
export async function deleteGrower(fd: FormData) {
  await requireAccess("mitra");
  const id = numf(fd, "id");
  const g = await get<{ name: string; n: number }>(
    `SELECT name, (SELECT COUNT(*) FROM seed_intakes WHERE grower_id = g.id) + (SELECT COUNT(*) FROM seed_pickups WHERE grower_id = g.id) + (SELECT COUNT(*) FROM productions WHERE grower_id = g.id) n
     FROM growers g WHERE id = ?`, id);
  if (!g) redirect(withMsg("/mitra", "Petani tidak ditemukan.", "error"));
  if (g.n > 0) redirect(withMsg(`/mitra/${id}`, "Petani ini punya riwayat; gabungkan ke petani lain bila datanya ganda.", "error"));
  await run("DELETE FROM growers WHERE id = ?", id);
  revalidatePath("/mitra");
  await logActivity("mitra", "Menghapus petani mitra", g.name);
  redirect(withMsg("/mitra", `Petani ${g.name} dihapus.`));
}
