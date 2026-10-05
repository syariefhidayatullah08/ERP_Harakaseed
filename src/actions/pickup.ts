"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { all, get, insert, run } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";
import { today } from "@/lib/format";

const BASE = "/pengambilan";
const kgFmt = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);

/** Catat / ubah satu pengambilan benih di lahan. Foto ditambahkan setelahnya di halaman rinciannya. */
export async function savePickup(fd: FormData) {
  const user = await requireAccess("pengambilan");
  const id = numf(fd, "id");
  const back = id ? `${BASE}/${id}` : `${BASE}/baru`;
  const farmer = str(fd, "farmer").replace(/\s+/g, " ");
  const kg = Math.round(numf(fd, "kg") * 100) / 100;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(fd, "pickup_date")) ? str(fd, "pickup_date") : today();
  if (!farmer) redirect(withMsg(back, "Nama petani wajib diisi.", "error"));
  if (kg <= 0) redirect(withMsg(back, "Isi bobot benih yang diambil (kg).", "error"));
  const vals = [date, farmer, str(fd, "location"), str(fd, "production_code").toUpperCase().replace(/\s+/g, " "), str(fd, "contract_no"), kg, Math.max(0, Math.round(numf(fd, "sacks"))), str(fd, "notes")] as const;

  if (id) {
    const old = await get<{ intake_id: number | null }>("SELECT intake_id FROM seed_pickups WHERE id = ?", id);
    if (!old) redirect(withMsg(BASE, "Data tidak ditemukan.", "error"));
    if (old.intake_id && user.role !== "owner") redirect(withMsg(back, "Pengambilan ini sudah masuk buku induk; hanya Founder yang bisa mengubahnya.", "error"));
    await run("UPDATE seed_pickups SET pickup_date=?, farmer=?, location=?, production_code=?, contract_no=?, kg=?, sacks=?, notes=? WHERE id=?", ...vals, id);
    revalidatePath(BASE);
    await logActivity("pengambilan", "Mengubah pengambilan benih", `${farmer} · ${vals[3]} · ${kgFmt(kg)} kg`);
    redirect(withMsg(back, "Perubahan disimpan."));
  }
  const newId = await insert(
    "INSERT INTO seed_pickups (pickup_date, farmer, location, production_code, contract_no, kg, sacks, notes, officer_id, officer_name) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ...vals, user.id, user.name,
  );
  revalidatePath(BASE);
  await logActivity("pengambilan", "Mencatat pengambilan benih", `${farmer} · ${vals[3]} · ${kgFmt(kg)} kg`);
  redirect(withMsg(`${BASE}/${newId}`, `Tersimpan: ${kgFmt(kg)} kg dari ${farmer}. Sekarang tambahkan fotonya di bawah.`));
}

/** Hapus pengambilan yang salah catat beserta fotonya. Yang sudah masuk buku induk hanya bisa dihapus Founder. */
export async function deletePickup(fd: FormData) {
  const user = await requireAccess("pengambilan");
  const id = numf(fd, "id");
  const row = await get<{ farmer: string; production_code: string; kg: number; intake_id: number | null }>("SELECT farmer, production_code, kg, intake_id FROM seed_pickups WHERE id = ?", id);
  if (!row) redirect(withMsg(BASE, "Data tidak ditemukan.", "error"));
  if (row.intake_id && user.role !== "owner") redirect(withMsg(`${BASE}/${id}`, "Pengambilan ini sudah masuk buku induk; hanya Founder yang bisa menghapusnya.", "error"));
  const files = await all<{ pathname: string }>("SELECT pathname FROM attachments WHERE ref_type = 'pickup' AND ref_id = ?", id);
  await run("DELETE FROM attachments WHERE ref_type = 'pickup' AND ref_id = ?", id);
  await run("DELETE FROM seed_pickups WHERE id = ?", id);
  if (files.length) await del(files.map((f) => f.pathname)).catch(() => {});
  revalidatePath(BASE);
  await logActivity("pengambilan", "Menghapus pengambilan benih", `${row.farmer} · ${row.production_code} · ${kgFmt(row.kg)} kg · ${files.length} foto`);
  redirect(withMsg(BASE, `Pengambilan benih ${row.farmer} dihapus.`));
}
