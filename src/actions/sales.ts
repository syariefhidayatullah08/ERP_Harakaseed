"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { all, get, getSetting, insert, nextNumber, run, tx } from "@/lib/db";
import { can, requireAccess } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";
import { allocateFefo, releaseAllocations } from "@/lib/inventory";
import { orderPdfAttachment, type PdfDoc } from "@/lib/invoice-pdf";
import { addDays, rupiah, today } from "@/lib/format";
import {
  invoiceEmail,
  loadOrderForEmail,
  orderConfirmationEmail,
  paymentReceiptEmail,
  reminderEmail,
  emailConfigured,
  sendEmail,
  shippingEmail,
} from "@/lib/email";

type Line = { product_id: number; qty: number; price: number };

/** Nomor pesanan untuk log aktivitas. */
const soNo = async (id: number) => (await get<{ so_no: string }>("SELECT so_no FROM sales_orders WHERE id = ?", id))?.so_no ?? `#${id}`;

function totals(lines: Line[], discountPct: number, taxPct: number) {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const afterDisc = subtotal * (1 - discountPct / 100);
  return { subtotal, total: Math.round(afterDisc * (1 + taxPct / 100)) };
}

export async function createOrder(_: unknown, fd: FormData): Promise<{ error?: string }> {
  await requireAccess("penjualan");
  const customerId = numf(fd, "customer_id");
  const intent = str(fd, "intent");
  let lines: Line[] = [];
  try {
    lines = (JSON.parse(str(fd, "lines")) as Line[]).filter((l) => l.product_id && l.qty > 0);
  } catch {
    return { error: "Data item tidak valid." };
  }
  if (!customerId) return { error: "Pilih pelanggan." };
  if (!lines.length) return { error: "Tambahkan minimal satu produk." };
  if (lines.some((l) => !Number.isInteger(l.product_id) || !Number.isFinite(l.qty) || !Number.isFinite(l.price) || l.price < 0)) {
    return { error: "Data item tidak valid." };
  }
  const known = await all<{ id: number }>("SELECT id FROM products WHERE active = 1 AND id = ANY(?::int[])", `{${lines.map((l) => l.product_id).join(",")}}`);
  if (known.length !== new Set(lines.map((l) => l.product_id)).size) return { error: "Ada produk yang tidak ditemukan atau sudah nonaktif. Muat ulang halaman." };
  if (!(await get("SELECT id FROM customers WHERE id = ?", customerId))) return { error: "Pelanggan tidak ditemukan." };

  const discountPct = numf(fd, "discount_pct");
  const taxPct = numf(fd, "tax_pct");
  const { subtotal, total } = totals(lines, discountPct, taxPct);
  const orderDate = str(fd, "order_date") || today();

  const soId = await tx(async () => {
    const soNo = await nextNumber("SO", "sales_orders", "so_no");
    const id = await insert(
      `INSERT INTO sales_orders (so_no, customer_id, order_date, status, discount_pct, tax_pct, subtotal, total, notes)
       VALUES (?,?,?, 'draft', ?,?,?,?,?)`,
      soNo,
      customerId,
      orderDate,
      discountPct,
      taxPct,
      subtotal,
      total,
      str(fd, "notes"),
    );
    for (const l of lines) await run("INSERT INTO so_items (so_id, product_id, qty, price) VALUES (?,?,?,?)", id, l.product_id, Math.round(l.qty), l.price);
    return id;
  });

  await logActivity("penjualan", "Membuat pesanan", `${await soNo(soId)} · ${rupiah(total)}`);
  if (intent === "confirm") {
    const note = await doConfirm(soId);
    redirect(withMsg(`/penjualan/${soId}`, `Pesanan dibuat & dikonfirmasi. ${note}`));
  }
  redirect(withMsg(`/penjualan/${soId}`, "Draft pesanan disimpan."));
}

async function autoEmail(settingKey: string, soId: number, build: typeof orderConfirmationEmail, refType = "sales_order", pdf?: PdfDoc) {
  if (await getSetting(settingKey) !== "1") return "";
  const data = await loadOrderForEmail(soId);
  if (!data) return "";
  if (!data.order.email) return "Pelanggan belum punya email — email tidak dikirim.";
  const mail = await build(data.order, data.items);
  const attachments = pdf && emailConfigured() ? await orderPdfAttachment(soId, pdf) : undefined;
  const res = await sendEmail({ to: data.order.email, ...mail, refType, refId: soId, attachments });
  return res.ok ? `Email terkirim ke ${data.order.email}.` : `Email gagal: ${res.error}`;
}

async function doConfirm(soId: number) {
  await run("UPDATE sales_orders SET status = 'dikonfirmasi' WHERE id = ? AND status = 'draft'", soId);
  return autoEmail("auto_email_order", soId, orderConfirmationEmail);
}

export async function confirmOrder(fd: FormData) {
  await requireAccess("penjualan");
  const id = numf(fd, "id");
  const note = await doConfirm(id);
  revalidatePath("/penjualan");
  await logActivity("penjualan", "Mengonfirmasi pesanan", await soNo(id));
  redirect(withMsg(`/penjualan/${id}`, `Pesanan dikonfirmasi. ${note}`));
}

export async function shipOrder(fd: FormData) {
  const user = await requireAccess("pengiriman");
  const id = numf(fd, "id");
  // Warehouse tidak membuka halaman penjualan; kembalikan ke halaman pengiriman.
  const back = can(user, "penjualan") ? `/penjualan/${id}` : `/pengiriman/${id}`;
  const so = await get<{ id: number; so_no: string; status: string; customer_id: number; payment_terms: number }>(
    "SELECT so.*, c.payment_terms FROM sales_orders so JOIN customers c ON c.id = so.customer_id WHERE so.id = ?",
    id,
  );
  if (!so || so.status !== "dikonfirmasi") redirect(withMsg(back, "Hanya pesanan dikonfirmasi yang bisa dikirim.", "error"));

  const shipDate = str(fd, "shipped_at") || today();
  try {
    await tx(async () => {
      const items = await all<{ id: number; product_id: number; qty: number }>("SELECT id, product_id, qty FROM so_items WHERE so_id = ?", id);
      for (const it of items) await allocateFefo(it.id, it.product_id, it.qty, so.so_no);
      const invoiceNo = await nextNumber("INV", "sales_orders", "invoice_no");
      await run(
        `UPDATE sales_orders SET status='dikirim', shipped_at=?, courier=?, tracking_no=?, invoice_no=?, due_date=? WHERE id=?`,
        shipDate,
        str(fd, "courier"),
        str(fd, "tracking_no"),
        invoiceNo,
        addDays(shipDate, so.payment_terms),
        id,
      );
    });
  } catch (e) {
    redirect(withMsg(back, e instanceof Error ? e.message : "Gagal memproses pengiriman.", "error"));
  }

  await logActivity("pengiriman", "Mengirim pesanan", [so.so_no, str(fd, "courier"), str(fd, "tracking_no")].filter(Boolean).join(" · "));
  const notes = [await autoEmail("auto_email_shipping", id, shippingEmail, "sales_order", "sj"), await autoEmail("auto_email_invoice", id, invoiceEmail, "invoice", "invoice")]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);
  revalidatePath("/penjualan");
  revalidatePath("/pengiriman");
  revalidatePath("/inventori");
  redirect(withMsg(back, `Barang dikirim, stok dipotong per lot (FEFO). ${notes.join(" ")}`));
}

export async function recordPayment(fd: FormData) {
  await requireAccess("keuangan");
  const id = numf(fd, "id");
  const amount = numf(fd, "amount");
  const so = await get<{ total: number; paid: number; status: string }>("SELECT total, paid, status FROM sales_orders WHERE id = ?", id);
  if (!so || amount <= 0) redirect(withMsg(`/penjualan/${id}`, "Nominal pembayaran tidak valid.", "error"));
  if (amount > so.total - so.paid + 0.5) redirect(withMsg(`/penjualan/${id}`, "Nominal melebihi sisa tagihan.", "error"));

  await tx(async () => {
    await run(
      "INSERT INTO payments (so_id, pay_date, amount, method, note) VALUES (?,?,?,?,?)",
      id,
      str(fd, "pay_date") || today(),
      amount,
      str(fd, "method") || "Transfer",
      str(fd, "note"),
    );
    await run("UPDATE sales_orders SET paid = paid + ? WHERE id = ?", amount, id);
    await run("UPDATE sales_orders SET status = 'selesai' WHERE id = ? AND status = 'dikirim' AND paid >= total", id);
  });

  await logActivity("keuangan", "Mencatat pembayaran", `${rupiah(amount)} · ${await soNo(id)} · ${str(fd, "method") || "Transfer"}`);
  let note = "";
  if (fd.get("send_receipt")) {
    const data = await loadOrderForEmail(id);
    if (data?.order.email) {
      const res = await sendEmail({ to: data.order.email, ...(await paymentReceiptEmail(data.order, amount)), refType: "sales_order", refId: id });
      note = res.ok ? `Tanda terima dikirim ke ${data.order.email}.` : `Email gagal: ${res.error}`;
    }
  }
  revalidatePath("/penjualan");
  redirect(withMsg(`/penjualan/${id}`, `Pembayaran dicatat. ${note}`));
}

export async function cancelOrder(fd: FormData) {
  await requireAccess("penjualan");
  const id = numf(fd, "id");
  const so = await get<{ so_no: string; status: string; paid: number }>("SELECT so_no, status, paid FROM sales_orders WHERE id = ?", id);
  if (!so || so.status === "batal" || so.status === "selesai") redirect(withMsg(`/penjualan/${id}`, "Pesanan ini tidak bisa dibatalkan.", "error"));
  if (so.paid > 0) redirect(withMsg(`/penjualan/${id}`, "Pesanan sudah ada pembayaran — selesaikan refund dahulu.", "error"));
  await tx(async () => {
    if (so.status === "dikirim") await releaseAllocations(id, so.so_no);
    await run("UPDATE sales_orders SET status = 'batal' WHERE id = ?", id);
  });
  revalidatePath("/penjualan");
  await logActivity("penjualan", "Membatalkan pesanan", so.so_no);
  redirect(withMsg(`/penjualan/${id}`, so.status === "dikirim" ? "Pesanan dibatalkan dan stok dikembalikan." : "Pesanan dibatalkan."));
}

export async function deleteDraft(fd: FormData) {
  await requireAccess("penjualan");
  const id = numf(fd, "id");
  await logActivity("penjualan", "Menghapus draft pesanan", await soNo(id));
  await run("DELETE FROM sales_orders WHERE id = ? AND status = 'draft'", id);
  revalidatePath("/penjualan");
  redirect(withMsg("/penjualan", "Draft dihapus."));
}

export async function emailOrderDocument(fd: FormData) {
  const id = numf(fd, "id");
  const kind = str(fd, "kind");
  // Invoice & pengingat berisi tagihan → keuangan; konfirmasi & pengiriman → penjualan.
  await requireAccess(kind === "invoice" || kind === "pengingat" ? "keuangan" : ["penjualan", "keuangan"]);
  const data = await loadOrderForEmail(id);
  if (!data) redirect("/penjualan");
  const to = str(fd, "to") || data.order.email;
  if (!to) redirect(withMsg(`/penjualan/${id}`, "Pelanggan belum punya email. Isi alamat tujuan.", "error"));
  const builders = {
    konfirmasi: () => orderConfirmationEmail(data.order, data.items),
    pengiriman: () => shippingEmail(data.order, data.items),
    invoice: () => invoiceEmail(data.order, data.items),
    pengingat: () => reminderEmail(data.order),
  } as const;
  const build = builders[kind as keyof typeof builders];
  if (!build) redirect(withMsg(`/penjualan/${id}`, "Jenis dokumen tidak dikenal.", "error"));
  const pdf: PdfDoc | null = kind === "invoice" || kind === "pengingat" ? "invoice" : kind === "pengiriman" ? "sj" : null;
  const attachments = pdf && emailConfigured() ? await orderPdfAttachment(id, pdf) : undefined;
  const res = await sendEmail({ to, ...(await build()), refType: pdf === "invoice" ? "invoice" : "sales_order", refId: id, attachments });
  await logActivity("penjualan", `Mengirim email ${kind}`, `${await soNo(id)} → ${to}${res.ok ? "" : " (gagal)"}`);
  redirect(withMsg(`/penjualan/${id}`, res.ok ? `Email ${kind} terkirim ke ${to}.` : `Gagal mengirim: ${res.error}`, res.ok ? "msg" : "error"));
}

/** Kirim pengingat ke semua invoice yang lewat jatuh tempo. */
export async function sendOverdueReminders() {
  await requireAccess("keuangan");
  const overdue = await all<{ id: number }>(
    "SELECT so.id FROM sales_orders so WHERE so.invoice_no IS NOT NULL AND so.status != 'batal' AND so.paid < so.total AND so.due_date < ?",
    today(),
  );
  let ok = 0;
  let fail = 0;
  for (const o of overdue) {
    const data = await loadOrderForEmail(o.id);
    if (!data?.order.email) {
      fail++;
      continue;
    }
    const res = await sendEmail({ to: data.order.email, ...(await reminderEmail(data.order)), refType: "invoice", refId: o.id, attachments: emailConfigured() ? await orderPdfAttachment(o.id) : undefined });
    if (res.ok) ok++;
    else fail++;
  }
  await logActivity("keuangan", "Mengirim pengingat telat bayar", `${ok} terkirim, ${fail} gagal/tanpa email`);
  redirect(withMsg("/keuangan", `Pengingat terkirim: ${ok}. Gagal/tanpa email: ${fail}.`, fail && !ok ? "error" : "msg"));
}
