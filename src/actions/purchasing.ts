"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { all, get, nextNumber, run, tx } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { purchaseOrderEmail, sendEmail } from "@/lib/email";
import { today } from "@/lib/format";

export async function saveSupplier(fd: FormData) {
  await requireUser();
  const name = str(fd, "name");
  if (!name) redirect(withMsg("/pembelian", "Nama supplier wajib diisi.", "error"));
  run(
    "INSERT INTO suppliers (name, category, email, phone, address) VALUES (?,?,?,?,?)",
    name,
    str(fd, "category"),
    str(fd, "email").toLowerCase(),
    str(fd, "phone"),
    str(fd, "address"),
  );
  revalidatePath("/pembelian");
  redirect(withMsg("/pembelian", `Supplier ${name} ditambahkan.`));
}

export async function createPO(fd: FormData) {
  await requireUser();
  const supplierId = numf(fd, "supplier_id");
  const descs = fd.getAll("description").map(String);
  const qtys = fd.getAll("qty").map(Number);
  const units = fd.getAll("unit").map(String);
  const prices = fd.getAll("price").map(Number);
  const lines = descs
    .map((d, i) => ({ description: d.trim(), qty: qtys[i] || 0, unit: units[i] || "pcs", price: prices[i] || 0 }))
    .filter((l) => l.description && l.qty > 0);
  if (!supplierId || !lines.length) redirect(withMsg("/pembelian/baru", "Pilih supplier dan isi minimal satu barang.", "error"));
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const id = tx(() => {
    const r = run(
      "INSERT INTO purchase_orders (po_no, supplier_id, order_date, total, notes) VALUES (?,?,?,?,?)",
      nextNumber("PO", "purchase_orders", "po_no"),
      supplierId,
      str(fd, "order_date") || today(),
      total,
      str(fd, "notes"),
    );
    const poId = Number(r.lastInsertRowid);
    for (const l of lines) run("INSERT INTO po_items (po_id, description, qty, unit, price) VALUES (?,?,?,?,?)", poId, l.description, l.qty, l.unit, l.price);
    return poId;
  });
  revalidatePath("/pembelian");
  redirect(withMsg(`/pembelian/${id}`, "PO dibuat sebagai draft."));
}

export async function sendPO(fd: FormData) {
  await requireUser();
  const id = numf(fd, "id");
  const po = get<{ po_no: string; order_date: string; supplier_name: string; email: string; total: number; notes: string; status: string }>(
    "SELECT po.*, s.name supplier_name, s.email FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?",
    id,
  );
  if (!po) redirect("/pembelian");
  const to = str(fd, "to") || po.email;
  if (!to) redirect(withMsg(`/pembelian/${id}`, "Supplier belum punya email.", "error"));
  const items = all<{ description: string; qty: number; unit: string; price: number }>("SELECT * FROM po_items WHERE po_id = ?", id);
  const res = await sendEmail({ to, ...purchaseOrderEmail(po, items), refType: "purchase_order", refId: id });
  if (res.ok) run("UPDATE purchase_orders SET status = 'dipesan' WHERE id = ? AND status = 'draft'", id);
  revalidatePath("/pembelian");
  redirect(withMsg(`/pembelian/${id}`, res.ok ? `PO dikirim ke ${to}.` : `Gagal mengirim: ${res.error}`, res.ok ? "msg" : "error"));
}

export async function setPOStatus(fd: FormData) {
  await requireUser();
  const id = numf(fd, "id");
  const status = str(fd, "status");
  if (!["dipesan", "diterima", "batal"].includes(status)) redirect(`/pembelian/${id}`);
  run(
    "UPDATE purchase_orders SET status = ?, received_at = CASE WHEN ? = 'diterima' THEN ? ELSE received_at END WHERE id = ?",
    status,
    status,
    today(),
    id,
  );
  revalidatePath("/pembelian");
  redirect(withMsg(`/pembelian/${id}`, "Status PO diperbarui."));
}
