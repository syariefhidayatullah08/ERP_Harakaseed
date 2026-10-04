"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { get, insert, run, tx } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { rupiah, today } from "@/lib/format";
import { customEmail, sendEmail } from "@/lib/email";
import { invoiceFileBase, manualInvoiceDoc, tanggalPanjang } from "@/lib/invoice-doc";
import { renderInvoicePdf } from "@/lib/invoice-render-pdf";

type Row = { code: string; name: string; qty: number; price: number };

export async function saveManualInvoice(_: unknown, fd: FormData): Promise<{ error?: string }> {
  const user = await requireAccess("keuangan");
  const id = numf(fd, "id");
  const number = str(fd, "number");
  const date = str(fd, "invoice_date") || today();
  const name = str(fd, "cust_name");
  let rows: Row[] = [];
  try {
    rows = (JSON.parse(str(fd, "rows")) as Row[])
      .map((r) => ({ code: String(r.code ?? "").trim(), name: String(r.name ?? "").trim(), qty: Number(r.qty), price: Number(r.price) }))
      .filter((r) => (r.code || r.name) && Number.isFinite(r.qty) && Number.isFinite(r.price));
  } catch {
    return { error: "Data baris tidak valid." };
  }
  if (!/^\d+\/INV\/[IVX]+\/\d{4}$/.test(number)) return { error: "Format nomor invoice: 181/INV/X/2026." };
  if (!name) return { error: "Nama customer wajib diisi." };
  if (!rows.length) return { error: "Isi minimal satu baris." };
  if (rows.some((r) => r.qty <= 0 || r.price < 0)) return { error: "Bobot/qty harus lebih dari 0 dan harga tidak boleh negatif." };
  const dup = await get<{ id: number }>("SELECT id FROM manual_invoices WHERE number = ? AND id <> ?", number, id);
  if (dup) return { error: `Nomor ${number} sudah dipakai.` };

  // Total = jumlah per baris yang dibulatkan ke rupiah, sama seperti di template Excel.
  const total = rows.reduce((s, r) => s + Math.round(r.qty * r.price), 0);
  const fields = [
    number, date, numf(fd, "customer_id") || null, name, str(fd, "cust_address"), str(fd, "cust_city"), str(fd, "cust_phone"), str(fd, "cust_email").toLowerCase(),
    str(fd, "label_code") || "Kode Produksi", str(fd, "label_name") || "Nama Petani", str(fd, "label_qty") || "Bobot (Kg)", str(fd, "notes"), total,
  ] as const;

  const invoiceId = await tx(async () => {
    let invId = id;
    if (id) {
      await run(
        `UPDATE manual_invoices SET number=?, invoice_date=?, customer_id=?, cust_name=?, cust_address=?, cust_city=?, cust_phone=?, cust_email=?,
           label_code=?, label_name=?, label_qty=?, notes=?, total=? WHERE id=?`,
        ...fields,
        id,
      );
      await run("DELETE FROM manual_invoice_items WHERE invoice_id = ?", id);
    } else {
      invId = await insert(
        `INSERT INTO manual_invoices (number, invoice_date, customer_id, cust_name, cust_address, cust_city, cust_phone, cust_email,
           label_code, label_name, label_qty, notes, total, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ...fields,
        user.id,
      );
    }
    for (const [i, r] of rows.entries()) {
      await run("INSERT INTO manual_invoice_items (invoice_id, position, code, name, qty, price) VALUES (?,?,?,?,?,?)", invId, i + 1, r.code, r.name, r.qty, r.price);
    }
    return invId;
  });
  revalidatePath("/keuangan/invoice");
  redirect(withMsg(`/keuangan/invoice/${invoiceId}`, id ? "Invoice diperbarui." : `Invoice ${number} dibuat. Unduh PDF/Word lalu cetak.`));
}

export async function deleteManualInvoice(fd: FormData) {
  await requireAccess("keuangan");
  const id = numf(fd, "id");
  const inv = await get<{ number: string }>("SELECT number FROM manual_invoices WHERE id = ?", id);
  await run("DELETE FROM manual_invoices WHERE id = ?", id);
  revalidatePath("/keuangan/invoice");
  redirect(withMsg("/keuangan/invoice", `Invoice ${inv?.number ?? ""} dihapus.`));
}

export async function emailManualInvoice(fd: FormData) {
  await requireAccess("keuangan");
  const id = numf(fd, "id");
  const back = `/keuangan/invoice/${id}`;
  const to = str(fd, "to").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) redirect(withMsg(back, "Isi email tujuan yang valid.", "error"));
  const doc = await manualInvoiceDoc(id);
  if (!doc) redirect(withMsg("/keuangan/invoice", "Invoice tidak ditemukan.", "error"));
  const pdf = await renderInvoicePdf(doc);
  const mail = await customEmail(
    `Invoice ${doc.number} — ${doc.settings.company_name ?? "PT Benih Haraka Sejahtera"}`,
    `Yth. ${doc.customer.name},\n\nTerlampir invoice No. ${doc.number} tanggal ${tanggalPanjang(doc.date)} sebesar ${rupiah(doc.total)}.\n\nPembayaran melalui transfer ke:\n${doc.settings.bank_holder}\n${doc.settings.bank_name} · No. Rek ${doc.settings.bank_account}\n\nMohon kirimkan bukti transfer dengan membalas email ini. Terima kasih.`,
  );
  const res = await sendEmail({
    to,
    ...mail,
    refType: "manual_invoice",
    refId: id,
    attachments: [{ filename: `${invoiceFileBase(doc)}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" }],
  });
  if (res.ok) await run("UPDATE manual_invoices SET cust_email = ? WHERE id = ?", to, id);
  redirect(withMsg(back, res.ok ? `Invoice terkirim ke ${to} (PDF terlampir).` : `Gagal mengirim: ${res.error}`, res.ok ? "msg" : "error"));
}
