"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { all, get, getSetting, insert, nextNumber, PACK_SUMMARY_SQL, run, tx } from "@/lib/db";
import { can, requireAccess } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";
import { allocateFefo, releaseAllocations } from "@/lib/inventory";
import { orderPdfAttachment, type PdfDoc } from "@/lib/invoice-pdf";
import { nextInvoiceNumber } from "@/lib/invoice-doc";
import { salesCashCategory } from "@/lib/cash";
import { deductBulkySale, setBulkMoves } from "@/lib/bulk-stock";
import { del } from "@vercel/blob";
import { addDays, rupiah, today } from "@/lib/format";
import { CHANNELS, GRAM_MAX, GRAM_MIN, gramPack, packGram, toChannel } from "@/lib/sales-channel";
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

type Line = { product_id: number; pack_size: string; qty: number; price: number };

/** Nomor pesanan untuk log aktivitas. */
const soNo = async (id: number) => (await get<{ so_no: string }>("SELECT so_no FROM sales_orders WHERE id = ?", id))?.so_no ?? `#${id}`;

function totals(lines: Line[], discountPct: number, taxPct: number) {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const afterDisc = subtotal * (1 - discountPct / 100);
  return { subtotal, total: Math.round(afterDisc * (1 + taxPct / 100)) };
}

/**
 * Pelanggan di form pesanan diketik bebas: nama yang sama dengan pelanggan terdaftar (mis. distributor utama)
 * memakai data itu; nama baru otomatis didaftarkan sebagai pelanggan umum agar invoice & piutangnya tetap tercatat.
 */
async function findOrCreateCustomer(name: string) {
  const found = await get<{ id: number }>("SELECT id FROM customers WHERE lower(trim(name)) = lower(?) ORDER BY id LIMIT 1", name);
  if (found) return found.id;
  const last = (await get<{ n: number }>("SELECT COUNT(*) n FROM customers"))!.n;
  let code = `CUST-${String(last + 1).padStart(3, "0")}`;
  while (await get("SELECT id FROM customers WHERE code = ?", code)) code = await nextNumber("CUST", "customers", "code");
  return insert("INSERT INTO customers (code, name, kind) VALUES (?,?, 'umum')", code, name);
}

type ParsedOrder = { channel: ReturnType<typeof toChannel>; customerName: string; lines: Line[]; newPacks: Line[]; discountPct: number; taxPct: number; subtotal: number; total: number; orderDate: string; notes: string };

/** Baca & periksa isi form pesanan (dipakai saat membuat maupun mengubah). Mengembalikan pesan kesalahan bila tidak valid. */
async function parseOrder(fd: FormData): Promise<ParsedOrder | { error: string }> {
  const channel = toChannel(str(fd, "channel"));
  const customerName = str(fd, "customer_name").replace(/\s+/g, " ");
  let lines: Line[] = [];
  try {
    lines = (JSON.parse(str(fd, "lines")) as Line[])
      .filter((l) => l.product_id && l.qty > 0)
      .map((l) => ({ product_id: l.product_id, pack_size: channel === "bulky" ? "" : String(l.pack_size ?? "").trim(), qty: Number(l.qty), price: Number(l.price) }));
  } catch {
    return { error: "Data item tidak valid." };
  }
  if (!customerName) return { error: "Isi nama pelanggan." };
  if (!lines.length) return { error: "Tambahkan minimal satu produk." };
  if (lines.some((l) => !Number.isInteger(l.product_id) || !Number.isFinite(l.qty) || !Number.isFinite(l.price) || l.price < 0)) {
    return { error: "Data item tidak valid." };
  }
  // Kemasan & label dihitung satuan utuh; bulky per kg boleh desimal.
  if (channel !== "bulky" && lines.some((l) => !Number.isInteger(l.qty))) return { error: `Qty ${CHANNELS[channel].unit} harus bilangan bulat.` };
  const known = await all<{ id: number }>("SELECT id FROM products WHERE active = 1 AND id = ANY(?::int[])", `{${lines.map((l) => l.product_id).join(",")}}`);
  if (known.length !== new Set(lines.map((l) => l.product_id)).size) return { error: "Ada produk yang tidak ditemukan atau sudah nonaktif. Muat ulang halaman." };
  // Gramasi diketik sebagai angka gram. Yang belum terdaftar untuk varietasnya ikut didaftarkan saat pesanan disimpan.
  let newPacks: Line[] = [];
  if (channel !== "bulky") {
    const packs = await all<{ product_id: number; pack_size: string }>("SELECT product_id, pack_size FROM product_packs WHERE active = 1");
    newPacks = lines.filter((l) => !packs.some((k) => k.product_id === l.product_id && k.pack_size === l.pack_size));
    if (newPacks.some((l) => !l.pack_size || gramPack(packGram(l.pack_size)) !== l.pack_size)) {
      return { error: `Isi gramasi setiap varietas dengan angka ${GRAM_MIN}–${GRAM_MAX} (gram).` };
    }
  }

  const discountPct = numf(fd, "discount_pct");
  const taxPct = numf(fd, "tax_pct");
  const { subtotal, total } = totals(lines, discountPct, taxPct);
  return { channel, customerName, lines, newPacks, discountPct, taxPct, subtotal, total, orderDate: str(fd, "order_date") || today(), notes: str(fd, "notes") };
}

/** Daftarkan gramasi baru yang dipakai pesanan (panggil di dalam tx). Harga hanya ikut dari penjualan kemasan. */
async function registerNewPacks(o: ParsedOrder) {
  for (const l of o.newPacks) {
    await run(
      "INSERT INTO product_packs (product_id, pack_size, price) VALUES (?,?,?) ON CONFLICT (product_id, pack_size) DO UPDATE SET active = 1",
      l.product_id, l.pack_size, o.channel === "kemasan" ? l.price : 0,
    );
    await run(`${PACK_SUMMARY_SQL} WHERE p.id = ?`, l.product_id);
  }
}

export async function createOrder(_: unknown, fd: FormData): Promise<{ error?: string }> {
  await requireAccess("penjualan");
  const intent = str(fd, "intent");
  const o = await parseOrder(fd);
  if ("error" in o) return o;
  const { channel, customerName, lines, discountPct, taxPct, subtotal, total, orderDate } = o;

  const soId = await tx(async () => {
    const customerId = await findOrCreateCustomer(customerName);
    const soNo = await nextNumber("SO", "sales_orders", "so_no");
    const id = await insert(
      `INSERT INTO sales_orders (so_no, channel, customer_id, order_date, status, discount_pct, tax_pct, subtotal, total, notes)
       VALUES (?,?,?,?, 'draft', ?,?,?,?,?)`,
      soNo,
      channel,
      customerId,
      orderDate,
      discountPct,
      taxPct,
      subtotal,
      total,
      o.notes,
    );
    await registerNewPacks(o);
    for (const l of lines) await run("INSERT INTO so_items (so_id, product_id, pack_size, qty, price) VALUES (?,?,?,?,?)", id, l.product_id, l.pack_size, l.qty, l.price);
    return id;
  });

  await logActivity("penjualan", "Membuat pesanan", `${await soNo(soId)} · ${CHANNELS[channel].label} · ${customerName} · ${rupiah(total)}`);
  if (intent === "confirm") {
    const note = await doConfirm(soId);
    redirect(withMsg(`/penjualan/${soId}`, `Pesanan dibuat & dikonfirmasi. ${note}`));
  }
  redirect(withMsg(`/penjualan/${soId}`, "Draft pesanan disimpan."));
}

/** Ubah pesanan yang salah input. Hanya sebelum dikirim; setelah dikirim, batalkan atau hapus lalu buat ulang. */
export async function updateOrder(_: unknown, fd: FormData): Promise<{ error?: string }> {
  await requireAccess("penjualan");
  const id = numf(fd, "order_id");
  const so = await get<{ so_no: string; status: string; channel: string }>("SELECT so_no, status, channel FROM sales_orders WHERE id = ?", id);
  if (!so) return { error: "Pesanan tidak ditemukan." };
  if (!["draft", "dikonfirmasi"].includes(so.status)) return { error: "Pesanan yang sudah dikirim tidak bisa diubah. Batalkan atau hapus pesanan, lalu buat ulang." };
  const o = await parseOrder(fd);
  if ("error" in o) return o;
  if (o.channel !== toChannel(so.channel)) return { error: "Jenis penjualan tidak bisa diganti." };
  await tx(async () => {
    const customerId = await findOrCreateCustomer(o.customerName);
    await run(
      "UPDATE sales_orders SET customer_id = ?, order_date = ?, discount_pct = ?, tax_pct = ?, subtotal = ?, total = ?, notes = ? WHERE id = ?",
      customerId, o.orderDate, o.discountPct, o.taxPct, o.subtotal, o.total, o.notes, id,
    );
    await registerNewPacks(o);
    await run("DELETE FROM so_items WHERE so_id = ?", id);
    for (const l of o.lines) await run("INSERT INTO so_items (so_id, product_id, pack_size, qty, price) VALUES (?,?,?,?,?)", id, l.product_id, l.pack_size, l.qty, l.price);
  });
  revalidatePath("/penjualan");
  await logActivity("penjualan", "Mengubah pesanan", `${so.so_no} · ${o.customerName} · ${rupiah(o.total)}`);
  redirect(withMsg(`/penjualan/${id}`, "Pesanan diperbarui."));
}

/**
 * Hapus pesanan yang salah input beserta item, pembayaran, baris kas, dan lampirannya. Pesanan yang sudah dikirim
 * atau sudah ada pembayaran hanya bisa dihapus Founder; stok yang terpotong dikembalikan.
 */
export async function deleteOrder(fd: FormData) {
  const user = await requireAccess("penjualan");
  const id = numf(fd, "id");
  const so = await get<{ so_no: string; status: string; channel: string; paid: number; invoice_no: string | null }>("SELECT so_no, status, channel, paid, invoice_no FROM sales_orders WHERE id = ?", id);
  if (!so) redirect(withMsg("/penjualan", "Pesanan tidak ditemukan.", "error"));
  const sensitive = ["dikirim", "selesai"].includes(so.status) || so.paid > 0;
  if (sensitive && user.role !== "owner") redirect(withMsg(`/penjualan/${id}`, "Pesanan yang sudah dikirim atau sudah dibayar hanya bisa dihapus Founder.", "error"));
  const files = await all<{ pathname: string }>("SELECT pathname FROM attachments WHERE ref_type = 'sales_order' AND ref_id = ?", id);
  await tx(async () => {
    if (["dikirim", "selesai"].includes(so.status)) {
      await releaseAllocations(id, so.so_no);
      await setBulkMoves("so", id, []);
    }
    await run("DELETE FROM attachments WHERE ref_type = 'sales_order' AND ref_id = ?", id);
    await run("DELETE FROM sales_orders WHERE id = ?", id); // item, alokasi, pembayaran, dan baris kasnya ikut terhapus
  });
  if (files.length) await del(files.map((f) => f.pathname)).catch(() => {});
  revalidatePath("/penjualan");
  revalidatePath("/pengiriman");
  revalidatePath("/inventori");
  revalidatePath("/stok-bahan");
  revalidatePath("/kas");
  await logActivity("penjualan", "Menghapus pesanan", `${so.so_no}${so.invoice_no ? ` · ${so.invoice_no}` : ""} · ${SO_LABEL[so.status] ?? so.status}${so.paid ? ` · pembayaran ${rupiah(so.paid)} ikut dihapus` : ""}`);
  redirect(withMsg(`/penjualan/${toChannel(so.channel)}`, `Pesanan ${so.so_no} dihapus${so.paid ? " beserta pembayaran dan baris Buku Kas-nya" : ""}.`));
}
const SO_LABEL: Record<string, string> = { draft: "draft", dikonfirmasi: "dikonfirmasi", dikirim: "sudah dikirim", selesai: "selesai", batal: "batal" };

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
  const so = await get<{ id: number; so_no: string; channel: string; status: string; customer_id: number; payment_terms: number; customer: string }>(
    "SELECT so.*, c.payment_terms, c.name customer FROM sales_orders so JOIN customers c ON c.id = so.customer_id WHERE so.id = ?",
    id,
  );
  if (!so || so.status !== "dikonfirmasi") redirect(withMsg(back, "Hanya pesanan dikonfirmasi yang bisa dikirim.", "error"));

  const shipDate = str(fd, "shipped_at") || today();
  let stockNotes: string[] = [];
  try {
    await tx(async () => {
      // Hanya penjualan kemasan yang memotong stok lot (per varietas + gramasi).
      if (toChannel(so.channel) === "kemasan") {
        const items = await all<{ id: number; product_id: number; pack_size: string; qty: number }>("SELECT id, product_id, pack_size, qty FROM so_items WHERE so_id = ?", id);
        for (const it of items) await allocateFefo(it.id, it.product_id, it.pack_size, it.qty, so.so_no);
      }
      // Penjualan bulky mengurangi Stok Bahan Baku (siap jual) varietasnya.
      if (toChannel(so.channel) === "bulky") stockNotes = await deductBulkySale(id, so.so_no, so.customer, shipDate);
      const invoiceNo = await nextInvoiceNumber(shipDate);
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
  revalidatePath("/stok-bahan");
  const stockMsg = toChannel(so.channel) === "kemasan" ? ", stok dipotong per lot (FEFO)" : toChannel(so.channel) === "bulky" ? ", stok bahan baku dikurangi" : "";
  redirect(withMsg(back, `Barang dikirim${stockMsg}. ${[...stockNotes, ...notes].join(" ")}`));
}

export async function recordPayment(fd: FormData) {
  await requireAccess("keuangan");
  const id = numf(fd, "id");
  const amount = numf(fd, "amount");
  const so = await get<{ total: number; paid: number; status: string; so_no: string; invoice_no: string | null; channel: string; customer: string }>(
    "SELECT so.total, so.paid, so.status, so.so_no, so.invoice_no, so.channel, c.name customer FROM sales_orders so JOIN customers c ON c.id = so.customer_id WHERE so.id = ?", id);
  if (!so || amount <= 0) redirect(withMsg(`/penjualan/${id}`, "Nominal pembayaran tidak valid.", "error"));
  if (amount > so.total - so.paid + 0.5) redirect(withMsg(`/penjualan/${id}`, "Nominal melebihi sisa tagihan.", "error"));

  const payDate = str(fd, "pay_date") || today();
  await tx(async () => {
    const paymentId = await insert(
      "INSERT INTO payments (so_id, pay_date, amount, method, note) VALUES (?,?,?,?,?)",
      id,
      payDate,
      amount,
      str(fd, "method") || "Transfer",
      str(fd, "note"),
    );
    // Uang masuk dari penjualan langsung tercatat di Buku Kas.
    await run(
      "INSERT INTO cash_entries (entry_date, description, category, amount_in, payment_id) VALUES (?,?,?,?,?)",
      payDate,
      `Pembayaran ${toChannel(so.channel) === "label" ? "Label" : `Benih ${CHANNELS[toChannel(so.channel)].label}`} ${so.customer} (${so.invoice_no ?? so.so_no})`,
      salesCashCategory(toChannel(so.channel), so.customer),
      amount,
      paymentId,
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
  revalidatePath("/kas");
  redirect(withMsg(`/penjualan/${id}`, `Pembayaran dicatat dan masuk Buku Kas. ${note}`));
}

export async function cancelOrder(fd: FormData) {
  await requireAccess("penjualan");
  const id = numf(fd, "id");
  const so = await get<{ so_no: string; status: string; paid: number }>("SELECT so_no, status, paid FROM sales_orders WHERE id = ?", id);
  if (!so || so.status === "batal" || so.status === "selesai") redirect(withMsg(`/penjualan/${id}`, "Pesanan ini tidak bisa dibatalkan.", "error"));
  if (so.paid > 0) redirect(withMsg(`/penjualan/${id}`, "Pesanan sudah ada pembayaran — selesaikan refund dahulu.", "error"));
  await tx(async () => {
    if (so.status === "dikirim") {
      await releaseAllocations(id, so.so_no);
      await setBulkMoves("so", id, []); // penjualan bulky: kembalikan stok bahan baku
    }
    await run("UPDATE sales_orders SET status = 'batal' WHERE id = ?", id);
  });
  revalidatePath("/penjualan");
  revalidatePath("/stok-bahan");
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
