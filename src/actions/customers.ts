"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { get, insert, nextNumber, run } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";

export async function saveCustomer(fd: FormData) {
  await requireAccess("pelanggan");
  const id = numf(fd, "id");
  const c = {
    name: str(fd, "name"),
    kind: str(fd, "kind") || "distributor",
    contact_person: str(fd, "contact_person"),
    email: str(fd, "email").toLowerCase(),
    phone: str(fd, "phone"),
    city: str(fd, "city"),
    address: str(fd, "address"),
    payment_terms: numf(fd, "payment_terms") || 0,
  };
  const back = id ? `/pelanggan/${id}` : "/pelanggan/baru";
  if (!c.name) redirect(withMsg(back, "Nama pelanggan wajib diisi.", "error"));
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) redirect(withMsg(back, "Format email tidak valid.", "error"));

  if (id) {
    await run(
      "UPDATE customers SET name=?, kind=?, contact_person=?, email=?, phone=?, city=?, address=?, payment_terms=? WHERE id=?",
      c.name, c.kind, c.contact_person, c.email, c.phone, c.city, c.address, c.payment_terms, id,
    );
    revalidatePath("/pelanggan");
    await logActivity("pelanggan", "Mengubah data pelanggan", c.name);
    redirect(withMsg(`/pelanggan/${id}`, "Data pelanggan diperbarui."));
  }
  const last = (await get<{ n: number }>("SELECT COUNT(*) n FROM customers"))!.n;
  let code = `CUST-${String(last + 1).padStart(3, "0")}`;
  while (await get("SELECT id FROM customers WHERE code = ?", code)) code = await nextNumber("CUST", "customers", "code");
  const newId = await insert(
    "INSERT INTO customers (code, name, kind, contact_person, email, phone, city, address, payment_terms) VALUES (?,?,?,?,?,?,?,?,?)",
    code, c.name, c.kind, c.contact_person, c.email, c.phone, c.city, c.address, c.payment_terms,
  );
  revalidatePath("/pelanggan");
  await logActivity("pelanggan", "Menambah pelanggan", `${code} · ${c.name}`);
  redirect(withMsg(`/pelanggan/${newId}`, `Pelanggan ${c.name} ditambahkan.`));
}
