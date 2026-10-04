"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { all, get, insert, nextNumber, run, tx } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";
import { purchaseOrderEmail, sendEmail } from "@/lib/email";
import { rupiah, today } from "@/lib/format";

/** Nomor PO untuk log aktivitas. */
const poNo = async (id: number) => (await get<{ po_no: string }>("SELECT po_no FROM purchase_orders WHERE id = ?", id))?.po_no ?? `#${id}`;

export async function saveSupplier(fd: FormData) {
  await requireAccess("pembelian");
  const name = str(fd, "name");
  if (!name) redirect(withMsg("/pembelian", "Nama supplier wajib diisi.", "error"));
  await run(
    "INSERT INTO suppliers (name, category, email, phone, address) VALUES (?,?,?,?,?)",
    name,
    str(fd, "category"),
    str(fd, "email").toLowerCase(),
    str(fd, "phone"),
    str(fd, "address"),
  );
  revalidatePath("/pembelian");
  await logActivity("pembelian", "Menambah supplier", name);
  redirect(withMsg("/pembelian", `Supplier ${name} ditambahkan.`));
}

export async function createPO(fd: FormData) {
  await requireAccess("pembelian");
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
  const id = await tx(async () => {
    const poId = await insert(
      "INSERT INTO purchase_orders (po_no, supplier_id, order_date, total, notes) VALUES (?,?,?,?,?)",
      await nextNumber("PO", "purchase_orders", "po_no"),
      supplierId,
      str(fd, "order_date") || today(),
      total,
      str(fd, "notes"),
    );
    for (const l of lines) await run("INSERT INTO po_items (po_id, description, qty, unit, price) VALUES (?,?,?,?,?)", poId, l.description, l.qty, l.unit, l.price);
    return poId;
  });
  revalidatePath("/pembelian");
  await logActivity("pembelian", "Membuat PO", `${await poNo(id)} · ${rupiah(total)}`);
  redirect(withMsg(`/pembelian/${id}`, "PO dibuat sebagai draft."));
}

export async function sendPO(fd: FormData) {
  await requireAccess("pembelian");
  const id = numf(fd, "id");
  const po = await get<{ po_no: string; order_date: string; supplier_name: string; email: string; total: number; notes: string; status: string }>(
    "SELECT po.*, s.name supplier_name, s.email FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?",
    id,
  );
  if (!po) redirect("/pembelian");
  const to = str(fd, "to") || po.email;
  if (!to) redirect(withMsg(`/pembelian/${id}`, "Supplier belum punya email.", "error"));
  const items = await all<{ description: string; qty: number; unit: string; price: number }>("SELECT * FROM po_items WHERE po_id = ?", id);
  const res = await sendEmail({ to, ...(await purchaseOrderEmail(po, items)), refType: "purchase_order", refId: id });
  if (res.ok) await run("UPDATE purchase_orders SET status = 'dipesan' WHERE id = ? AND status = 'draft'", id);
  revalidatePath("/pembelian");
  await logActivity("pembelian", "Mengirim PO ke supplier", `${po.po_no} → ${to}${res.ok ? "" : " (gagal)"}`);
  redirect(withMsg(`/pembelian/${id}`, res.ok ? `PO dikirim ke ${to}.` : `Gagal mengirim: ${res.error}`, res.ok ? "msg" : "error"));
}

export async function setPOStatus(fd: FormData) {
  await requireAccess("pembelian");
  const id = numf(fd, "id");
  const status = str(fd, "status");
  if (!["dipesan", "diterima", "batal"].includes(status)) redirect(`/pembelian/${id}`);
  await run(
    "UPDATE purchase_orders SET status = ?, received_at = CASE WHEN ? = 'diterima' THEN ? ELSE received_at END WHERE id = ?",
    status,
    status,
    today(),
    id,
  );
  revalidatePath("/pembelian");
  await logActivity("pembelian", "Mengubah status PO", `${await poNo(id)} → ${status}`);
  redirect(withMsg(`/pembelian/${id}`, "Status PO diperbarui."));
}
