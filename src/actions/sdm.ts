"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { insert, run } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";
import { isDivision } from "@/lib/access";

export async function saveEmployee(fd: FormData) {
  await requireAccess("sdm");
  const id = numf(fd, "id");
  const name = str(fd, "name");
  const division = str(fd, "division");
  const email = str(fd, "email").toLowerCase();
  const back = id ? `/sdm/${id}` : "/sdm";
  if (!name || !isDivision(division)) redirect(withMsg(back, "Nama dan divisi wajib diisi.", "error"));
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect(withMsg(back, "Format email tidak valid.", "error"));
  const values = [name, division, str(fd, "position"), email, str(fd, "phone"), str(fd, "join_date") || null, str(fd, "status") === "nonaktif" ? "nonaktif" : "aktif", str(fd, "note")] as const;
  if (id) {
    await run("UPDATE employees SET name=?, division=?, position=?, email=?, phone=?, join_date=?, status=?, note=? WHERE id=?", ...values, id);
    revalidatePath("/sdm");
    await logActivity("sdm", "Mengubah data karyawan", name);
    redirect(withMsg(back, "Data karyawan diperbarui."));
  }
  const newId = await insert("INSERT INTO employees (name, division, position, email, phone, join_date, status, note) VALUES (?,?,?,?,?,?,?,?)", ...values);
  revalidatePath("/sdm");
  await logActivity("sdm", "Menambah karyawan", `${name} · ${division}`);
  redirect(withMsg(`/sdm/${newId}`, `${name} ditambahkan.`));
}
