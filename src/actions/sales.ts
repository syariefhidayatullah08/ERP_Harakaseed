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
import { accountForMethod, salesCashCategory, toCashAccount } from "@/lib/cash";
import { deductBulkySale, setBulkMoves } from "@/lib/bulk-stock";
import { del } from "@vercel/blob";
import { addDays, rupiah, today } from "@/lib/format";
import { CHANNELS, freeName, GRAM_MAX, GRAM_MIN, gramPack, packGram, perKg, toChannel } from "@/lib/sales-channel";
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

type Line = { product_id: number | null; pack_size: string; qty: number; price: number; item_name: string; item_code: string; farmer_name: string; intake_id: number | null };

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
 * Email opsional: bila diisi, disimpan ke data pelanggan (dipakai untuk konfirmasi, invoice, dan pengingat).
 */
async function findOrCreateCustomer(name: string, email: string) {
  const found = await get<{ id: number }>("SELECT id FROM customers WHERE lower(trim(name)) = lower(?) ORDER BY id LIMIT 1", name);
  if (found) {
    if (email) await run("UPDATE customers SET email = ? WHERE id = ?", email, found.id);
    return found.id;
  }
  const last = (await get<{ n: number }>("SELECT COUNT(*) n FROM customers"))!.n;
  let code = `CUST-${String(last + 1).padStart(3, "0")}`;
  while (await get("SELECT id FROM customers WHERE code = ?", code)) code = await nextNumber("CUST", "customers", "code");
  return insert("INSERT INTO customers (code, name, kind, email) VALUES (?,?, 'umum', ?)", code, name, email);
}

type ParsedOrder = { channel: ReturnType<typeof toChannel>; customerName: string; customerEmail: string; invoiceManual: string; lines: Line[]; newPacks: Line[]; discountPct: number; taxPct: number; subtotal: number; total: number; orderDate: string; notes: string; deposit: number };

/** No. invoice diketik manual: dirapikan spasinya, maksimal 60 karakter. */
const cleanInvoiceNo = (v: string) => v.replace(/\s+/g, " ").trim().slice(0, 60);

/** No. invoice sudah dipakai pesanan lain (yang sudah terbit maupun yang baru disiapkan manual)? */
async function invoiceTaken(no: string, exceptId = 0) {
  const row = await get<{ so_no: string }>(
    "SELECT so_no FROM sales_orders WHERE id <> ? AND status <> 'batal' AND (lower(invoice_no) = lower(?) OR lower(invoice_manual) = lower(?)) LIMIT 1",
    exceptId, no, no,
  );
  return row?.so_no ?? null;
}

/** Baca & periksa isi form pesanan (dipakai saat membuat maupun mengubah). Mengembalikan pesan kesalahan bila tidak valid. */
async function parseOrder(fd: FormData): Promise<ParsedOrder | { error: string }> {
  const channel = toChannel(str(fd, "channel"));
  const customerName = str(fd, "customer_name").replace(/\s+/g, " ");
  const customerEmail = str(fd, "customer_email").toLowerCase();
  let lines: Line[] = [];
  try {
    const kg = perKg(channel);
    const free = freeName(channel);
    lines = (JSON.parse(str(fd, "lines")) as Partial<Line>[])
      .map((l) => ({
        product_id: Number(l.product_id) || null,
        pack_size: kg ? "" : String(l.pack_size ?? "").trim(),
        qty: Number(l.qty),
        price: Number(l.price),
        item_name: free ? String(l.item_name ?? "").replace(/\s+/g, " ").trim().slice(0, 120) : "",
        item_code: channel === "kerjasama" ? String(l.item_code ?? "").replace(/\s+/g, " ").trim().toUpperCase().slice(0, 40) : "",
        farmer_name: channel === "kerjasama" ? String(l.farmer_name ?? "").replace(/\s+/g, " ").trim().slice(0, 120) : "",
        intake_id: channel === "kerjasama" ? Number(l.intake_id) || null : null,
      }))
      .filter((l) => (free ? l.item_name : l.product_id) && l.qty > 0);
  } catch {
    return { error: "Data item tidak valid." };
  }
  if (!customerName) return { error: "Isi nama pelanggan." };
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return { error: "Format email pelanggan tidak valid." };
  const invoiceManual = cleanInvoiceNo(str(fd, "invoice_manual"));
  if (invoiceManual) {
    const taken = await invoiceTaken(invoiceManual, numf(fd, "order_id"));
    if (taken) return { error: `No. invoice ${invoiceManual} sudah dipakai pesanan ${taken}.` };
  }
  if (!lines.length) return { error: freeName(channel) ? "Isi nama pada minimal satu baris." : "Tambahkan minimal satu produk." };
  // Baris dari buku induk: benih masuknya harus ada, tidak dobel, dan belum terjual di pesanan lain.
  const intakeIds = lines.map((l) => l.intake_id).filter((v): v is number => v !== null);
  if (intakeIds.length) {
    if (new Set(intakeIds).size !== intakeIds.length || intakeIds.some((v) => !Number.isInteger(v))) return { error: "Ada benih masuk yang dipilih dua kali." };
    const found = await all<{ id: number }>("SELECT id FROM seed_intakes WHERE id = ANY(?::int[])", `{${intakeIds.join(",")}}`);
    if (found.length !== intakeIds.length) return { error: "Ada benih masuk yang sudah dihapus dari buku induk. Muat ulang halaman." };
    const taken = await get<{ so_no: string; farmer: string }>(
      `SELECT so.so_no, s.farmer FROM so_items i JOIN sales_orders so ON so.id = i.so_id JOIN seed_intakes s ON s.id = i.intake_id
       WHERE i.intake_id = ANY(?::int[]) AND so.status <> 'batal' AND so.id <> ? LIMIT 1`,
      `{${intakeIds.join(",")}}`, numf(fd, "order_id"),
    );
    if (taken) return { error: `Benih masuk ${taken.farmer} sudah dijual di pesanan ${taken.so_no}.` };
  }
  if (lines.some((l) => (l.product_id !== null && !Number.isInteger(l.product_id)) || !Number.isFinite(l.qty) || !Number.isFinite(l.price) || l.price < 0)) {
    return { error: "Data item tidak valid." };
  }
  // Kemasan & label dihitung satuan utuh; bulky & kerjasama per kg boleh desimal.
  if (!perKg(channel) && lines.some((l) => !Number.isInteger(l.qty))) return { error: `Qty ${CHANNELS[channel].unit} harus bilangan bulat.` };
  if (freeName(channel)) {
    // Nama bebas yang persis sama dengan varietas di menu Produk dipasangkan, supaya stok bahan baku bulky tetap terpotong
    // dan gramasi label baru ikut terdaftar di varietasnya.
    const products = await all<{ id: number; name: string }>("SELECT id, name FROM products WHERE active = 1");
    for (const l of lines) {
      const p = products.find((p) => p.name.toLowerCase() === l.item_name.toLowerCase());
      l.product_id = p?.id ?? null;
      if (p) l.item_name = p.name; // ejaan mengikuti menu Produk
    }
  }
  const ids = [...new Set(lines.map((l) => l.product_id).filter((v): v is number => v !== null))];
  const known = ids.length ? await all<{ id: number }>("SELECT id FROM products WHERE active = 1 AND id = ANY(?::int[])", `{${ids.join(",")}}`) : [];
  if (known.length !== ids.length) return { error: "Ada produk yang tidak ditemukan atau sudah nonaktif. Muat ulang halaman." };
  // Gramasi diketik sebagai angka gram. Yang belum terdaftar untuk varietasnya ikut didaftarkan saat pesanan disimpan.
  let newPacks: Line[] = [];
  if (!perKg(channel)) {
    const packs = await all<{ product_id: number; pack_size: string }>("SELECT product_id, pack_size FROM product_packs WHERE active = 1");
    // Label dengan nama di luar menu Produk tidak punya varietas untuk didaftarkan gramasinya, tapi gramasinya tetap diperiksa.
    const unregistered = lines.filter((l) => !packs.some((k) => k.product_id === l.product_id && k.pack_size === l.pack_size));
    newPacks = unregistered.filter((l) => l.product_id !== null);
    if (unregistered.some((l) => !l.pack_size || gramPack(packGram(l.pack_size)) !== l.pack_size)) {
      return { error: `Isi gramasi setiap varietas dengan angka ${GRAM_MIN}–${GRAM_MAX} (gram).` };
    }
  }

  const discountPct = numf(fd, "discount_pct");
  const taxPct = numf(fd, "tax_pct");
  const { subtotal, total } = totals(lines, discountPct, taxPct);
  return { channel, customerName, customerEmail, invoiceManual, lines, newPacks, discountPct, taxPct, subtotal, total, orderDate: str(fd, "order_date") || today(), notes: str(fd, "notes"), deposit: channel === "kerjasama" ? Math.max(0, numf(fd, "deposit")) : 0 };
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
    const customerId = await findOrCreateCustomer(customerName, o.customerEmail);
    const soNo = await nextNumber("SO", "sales_orders", "so_no");
    const id = await insert(
      `INSERT INTO sales_orders (so_no, channel, customer_id, order_date, status, discount_pct, tax_pct, subtotal, total, notes, deposit, invoice_manual)
       VALUES (?,?,?,?, 'draft', ?,?,?,?,?,?,?)`,
      soNo,
      channel,
      customerId,
      orderDate,
      discountPct,
      taxPct,
      subtotal,
      total,
      o.notes,
      o.deposit,
      o.invoiceManual,
    );
    await registerNewPacks(o);
    for (const l of lines) await run("INSERT INTO so_items (so_id, product_id, pack_size, qty, price, item_name, item_code, farmer_name, intake_id) VALUES (?,?,?,?,?,?,?,?,?)", id, l.product_id, l.pack_size, l.qty, l.price, l.item_name, l.item_code, l.farmer_name, l.intake_id);
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
    const customerId = await findOrCreateCustomer(o.customerName, o.customerEmail);
    await run(
      "UPDATE sales_orders SET customer_id = ?, order_date = ?, discount_pct = ?, tax_pct = ?, subtotal = ?, total = ?, notes = ?, deposit = ?, invoice_manual = ? WHERE id = ?",
      customerId, o.orderDate, o.discountPct, o.taxPct, o.subtotal, o.total, o.notes, o.deposit, o.invoiceManual, id,
    );
    await registerNewPacks(o);
    await run("DELETE FROM so_items WHERE so_id = ?", id);
    for (const l of o.lines) await run("INSERT INTO so_items (so_id, product_id, pack_size, qty, price, item_name, item_code, farmer_name, intake_id) VALUES (?,?,?,?,?,?,?,?,?)", id, l.product_id, l.pack_size, l.qty, l.price, l.item_name, l.item_code, l.farmer_name, l.intake_id);
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
  const so = await get<{ id: number; so_no: string; channel: string; status: string; customer_id: number; payment_terms: number; customer: string; invoice_manual: string }>(
    "SELECT so.*, c.payment_terms, c.name customer FROM sales_orders so JOIN customers c ON c.id = so.customer_id WHERE so.id = ?",
    id,
  );
  if (!so || so.status !== "dikonfirmasi") redirect(withMsg(back, "Hanya pesanan dikonfirmasi yang bisa dikirim.", "error"));

  const shipDate = str(fd, "shipped_at") || today();
  // No. invoice dari form kirim (terisi dari pesanan bila sudah diketik di sana); kosong = nomor otomatis.
  const manualNo = cleanInvoiceNo(fd.has("invoice_no") ? str(fd, "invoice_no") : so.invoice_manual);
  const takenBy = manualNo ? await invoiceTaken(manualNo, id) : null;
  if (takenBy) redirect(withMsg(back, `No. invoice ${manualNo} sudah dipakai pesanan ${takenBy}.`, "error"));
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
      const invoiceNo = manualNo || (await nextInvoiceNumber(shipDate, so.channel));
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

/** Ubah no. invoice yang sudah terbit (mis. menyesuaikan nomor di buku/arsip manual). */
export async function updateInvoiceNo(fd: FormData) {
  await requireAccess(["penjualan", "keuangan"]);
  const id = numf(fd, "id");
  const no = cleanInvoiceNo(str(fd, "invoice_no"));
  const so = await get<{ so_no: string; invoice_no: string | null }>("SELECT so_no, invoice_no FROM sales_orders WHERE id = ?", id);
  if (!so?.invoice_no) redirect(withMsg(`/penjualan/${id}`, "Invoice belum terbit; isi no. invoice lewat Ubah pesanan atau saat kirim barang.", "error"));
  if (!no) redirect(withMsg(`/penjualan/${id}`, "No. invoice tidak boleh kosong.", "error"));
  const taken = await invoiceTaken(no, id);
  if (taken) redirect(withMsg(`/penjualan/${id}`, `No. invoice ${no} sudah dipakai pesanan ${taken}.`, "error"));
  await run("UPDATE sales_orders SET invoice_no = ?, invoice_manual = ? WHERE id = ?", no, no, id);
  revalidatePath("/penjualan");
  await logActivity("penjualan", "Mengubah no. invoice", `${so.so_no}: ${so.invoice_no} → ${no}`);
  redirect(withMsg(`/penjualan/${id}`, `No. invoice diganti menjadi ${no}.`));
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
    const method = str(fd, "method") || "Transfer";
    const paymentId = await insert(
      "INSERT INTO payments (so_id, pay_date, amount, method, note) VALUES (?,?,?,?,?)",
      id,
      payDate,
      amount,
      method,
      str(fd, "note"),
    );
    // Uang masuk dari penjualan langsung tercatat di Buku Kas, di akun yang dipilih (tanpa pilihan: tunai → kas tunai, lainnya → Mandiri).
    await run(
      "INSERT INTO cash_entries (entry_date, description, category, amount_in, payment_id, account) VALUES (?,?,?,?,?,?)",
      payDate,
      `Pembayaran ${toChannel(so.channel) === "label" ? "Label" : toChannel(so.channel) === "kerjasama" ? "Benih Kerjasama Produksi" : `Benih ${CHANNELS[toChannel(so.channel)].label}`} ${so.customer} (${so.invoice_no ?? so.so_no})`,
      salesCashCategory(toChannel(so.channel), so.customer),
      amount,
      paymentId,
      fd.get("account") ? toCashAccount(str(fd, "account")) : accountForMethod(method),
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
