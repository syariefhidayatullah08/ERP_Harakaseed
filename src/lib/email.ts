import "server-only";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { all, get, getSetting, getSettings, run } from "./db";
import { nowWib, num, rupiah, tanggal } from "./format";
import { CHANNELS, ITEM_PACK_SQL, toChannel } from "./sales-channel";

/*
 * Koneksi email memakai SMTP (kirim) dan IMAP (kotak masuk).
 * Default-nya Gmail: isi EMAIL_USER dan EMAIL_PASS (App Password Google) di .env.local.
 * Untuk provider lain (Zoho, hosting cPanel, Outlook) isi SMTP_* dan IMAP_*.
 */
const cfg = {
  user: process.env.EMAIL_USER ?? "",
  pass: process.env.EMAIL_PASS ?? "",
  from: process.env.EMAIL_FROM ?? "",
  smtpHost: process.env.SMTP_HOST ?? "smtp.gmail.com",
  smtpPort: Number(process.env.SMTP_PORT ?? 465),
  imapHost: process.env.IMAP_HOST ?? "imap.gmail.com",
  imapPort: Number(process.env.IMAP_PORT ?? 993),
};

/** URL publik aplikasi, dipakai untuk gambar logo di email (klien email tidak bisa memuat file lokal). */
const APP_URL =
  process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");

export function emailConfigured() {
  return Boolean(cfg.user && cfg.pass);
}

export function emailInfo() {
  return {
    configured: emailConfigured(),
    user: cfg.user,
    smtp: `${cfg.smtpHost}:${cfg.smtpPort}`,
    imap: `${cfg.imapHost}:${cfg.imapPort}`,
  };
}

function transporter() {
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpPort === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

export type SendInput = {
  to: string;
  subject: string;
  html: string;
  refType?: string;
  refId?: number;
  attachments?: { filename: string; content: string | Buffer; contentType?: string }[];
};

export type SendResult = { ok: boolean; status: string; error?: string };

/** Kirim email dan catat ke tabel emails, berhasil maupun gagal. */
export async function sendEmail(input: SendInput): Promise<SendResult> {
  const brand = await getSetting("company_brand", "HARAKA SEED");
  const from = cfg.from || `${brand} <${cfg.user}>`;
  const text = htmlToText(input.html);

  let status = "terkirim";
  let error = "";
  let messageId: string | null = null;

  if (!input.to) {
    status = "gagal";
    error = "Alamat email tujuan kosong.";
  } else if (!emailConfigured()) {
    status = "gagal";
    error = "Email belum dikonfigurasi (EMAIL_USER / EMAIL_PASS di .env.local).";
  } else {
    try {
      const info = await transporter().sendMail({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text,
        attachments: input.attachments,
      });
      messageId = info.messageId ?? null;
    } catch (e) {
      status = "gagal";
      error = e instanceof Error ? e.message : String(e);
    }
  }

  await run(
    `INSERT INTO emails (direction, message_id, from_addr, to_addr, subject, body_html, body_text, status, error, ref_type, ref_id, is_read)
     VALUES ('out', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    messageId,
    from,
    input.to,
    input.subject,
    input.html,
    text,
    status,
    error,
    input.refType ?? null,
    input.refId ?? null,
  );

  return { ok: status === "terkirim", status, error };
}

export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: "EMAIL_USER / EMAIL_PASS belum diisi." };
  try {
    await transporter().verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Ambil email terbaru dari INBOX lewat IMAP dan simpan ke database (tanpa duplikat). */
export async function syncInbox(limit = 40): Promise<{ ok: boolean; added: number; error?: string }> {
  if (!emailConfigured()) return { ok: false, added: 0, error: "Email belum dikonfigurasi." };
  const client = new ImapFlow({
    host: cfg.imapHost,
    port: cfg.imapPort,
    secure: true,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  });
  let added = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const mailbox = client.mailbox;
      const total = mailbox && typeof mailbox === "object" ? mailbox.exists : 0;
      if (total > 0) {
        const start = Math.max(1, total - limit + 1);
        for await (const msg of client.fetch(`${start}:*`, { source: true, envelope: true, flags: true })) {
          if (!msg.source) continue;
          const parsed = await simpleParser(msg.source);
          const messageId = parsed.messageId ?? `uid-${msg.uid}@${cfg.imapHost}`;
          if (await get("SELECT id FROM emails WHERE message_id = ?", messageId)) continue;
          const fromAddr = parsed.from?.value?.[0]?.address ?? "";
          const fromName = parsed.from?.value?.[0]?.name ?? "";
          const customer = fromAddr
            ? await get<{ id: number }>("SELECT id FROM customers WHERE lower(email) = lower(?)", fromAddr)
            : undefined;
          await run(
            `INSERT INTO emails (direction, message_id, from_addr, to_addr, subject, body_html, body_text, status, ref_type, ref_id, is_read, created_at)
             VALUES ('in', ?, ?, ?, ?, ?, ?, 'diterima', ?, ?, ?, ?)`,
            messageId,
            fromName ? `${fromName} <${fromAddr}>` : fromAddr,
            cfg.user,
            parsed.subject ?? "(tanpa subjek)",
            typeof parsed.html === "string" ? parsed.html : "",
            parsed.text ?? "",
            customer ? "customer" : null,
            customer?.id ?? null,
            msg.flags?.has("\\Seen") ? 1 : 0,
            nowWib(parsed.date ?? new Date()),
          );
          added++;
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
    return { ok: true, added };
  } catch (e) {
    try {
      await client.logout();
    } catch {}
    return { ok: false, added, error: e instanceof Error ? e.message : String(e) };
  }
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/* ------------------------------ Template email ------------------------------ */

async function layout(title: string, body: string) {
  const settings = await getSettings();
  const s = (k: string) => escapeHtml(settings[k] ?? "");
  return `<!doctype html><html><body style="margin:0;background:#eef6fb;font-family:Segoe UI,Arial,sans-serif;color:#1b2733">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #dbe7ef">
    <tr><td style="background:#fff;padding:20px 28px;border-bottom:4px solid #00aeef">
      ${
        APP_URL
          ? `<img src="${APP_URL}/logo-wordmark.png" alt="${s("company_brand")}" width="180" style="display:block;height:auto;border:0">`
          : `<div style="font-size:20px;font-weight:700;letter-spacing:1px;color:#0077a8">${s("company_brand")}</div>`
      }
      <div style="font-size:12px;color:#5f6b76;margin-top:6px">${s("company_tagline")}</div>
    </td></tr>
    <tr><td style="padding:28px">
      <h2 style="margin:0 0 16px;font-size:18px;color:#0077a8">${title}</h2>
      ${body}
    </td></tr>
    <tr><td style="background:#f5f9fc;border-top:3px solid #f08020;padding:16px 28px;font-size:12px;color:#5f6b76;line-height:1.6">
      <b>${s("company_name")}</b><br>${s("company_address")}<br>
      Telp/WA ${s("company_phone")} · ${s("company_email")} · ${s("company_website")}
    </td></tr>
  </table></td></tr></table></body></html>`;
}

type OrderForEmail = {
  channel?: string;
  id: number;
  so_no: string;
  order_date: string;
  customer_name: string;
  contact_person: string;
  subtotal: number;
  discount_pct: number;
  tax_pct: number;
  total: number;
  paid: number;
  invoice_no: string | null;
  due_date: string | null;
  courier: string;
  tracking_no: string;
  notes: string;
};

type ItemForEmail = { name: string; crop: string; pack_size: string; qty: number; price: number };

export async function loadOrderForEmail(soId: number) {
  const order = await get<OrderForEmail & { email: string }>(
    `SELECT so.*, c.name AS customer_name, c.contact_person, c.email
     FROM sales_orders so JOIN customers c ON c.id = so.customer_id WHERE so.id = ?`,
    soId,
  );
  const items = await all<ItemForEmail>(
    `SELECT COALESCE(NULLIF(i.item_name, ''), p.name, '') name, COALESCE(p.crop, '') crop, ${ITEM_PACK_SQL}, i.qty, i.price FROM so_items i LEFT JOIN products p ON p.id = i.product_id WHERE i.so_id = ? ORDER BY i.id`,
    soId,
  );
  return order ? { order, items } : null;
}

function itemsTable(o: OrderForEmail, items: ItemForEmail[]) {
  const rows = items
    .map(
      (i) => `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(i.name)}<br><span style="color:#6b7785;font-size:12px">${escapeHtml(i.crop)} · ${escapeHtml(i.pack_size)}</span></td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${num(i.qty)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${rupiah(i.price)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${rupiah(i.qty * i.price)}</td></tr>`,
    )
    .join("");
  const disc = o.subtotal * (o.discount_pct / 100);
  const tax = (o.subtotal - disc) * (o.tax_pct / 100);
  const line = (label: string, value: string, bold = false) =>
    `<tr><td colspan="3" style="padding:6px 8px;text-align:right;${bold ? "font-weight:700" : "color:#5f6b76"}">${label}</td><td style="padding:6px 8px;text-align:right;${bold ? "font-weight:700" : ""}">${value}</td></tr>`;
  return `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse;margin:16px 0">
    <tr style="background:#eef6fb"><th style="padding:8px;text-align:left">Produk</th><th style="padding:8px;text-align:right">Qty (${CHANNELS[toChannel(o.channel)].unit})</th><th style="padding:8px;text-align:right">Harga</th><th style="padding:8px;text-align:right">Jumlah</th></tr>
    ${rows}
    ${line("Subtotal", rupiah(o.subtotal))}
    ${o.discount_pct ? line(`Diskon ${o.discount_pct}%`, "− " + rupiah(disc)) : ""}
    ${o.tax_pct ? line(`PPN ${o.tax_pct}%`, rupiah(tax)) : ""}
    ${line("Total", rupiah(o.total), true)}
  </table>`;
}

const greet = (o: OrderForEmail) =>
  `<p>Yth. ${escapeHtml(o.contact_person || o.customer_name)},</p>`;

export async function orderConfirmationEmail(o: OrderForEmail, items: ItemForEmail[]) {
  return {
    subject: `Konfirmasi Pesanan ${o.so_no} — ${await getSetting("company_brand")}`,
    html: await layout(
      `Pesanan ${o.so_no} telah dikonfirmasi`,
      `${greet(o)}<p>Terima kasih atas pesanan Anda tanggal ${tanggal(o.order_date)}. Pesanan sedang kami siapkan dengan rincian berikut:</p>
       ${itemsTable(o, items)}
       ${o.notes ? `<p style="color:#5f6b76">Catatan: ${escapeHtml(o.notes)}</p>` : ""}
       <p>Kami akan mengabari Anda kembali saat barang dikirim.</p>`,
    ),
  };
}

export async function shippingEmail(o: OrderForEmail, items: ItemForEmail[]) {
  return {
    subject: `Pesanan ${o.so_no} telah dikirim`,
    html: await layout(
      `Pesanan ${o.so_no} dalam pengiriman`,
      `${greet(o)}<p>Pesanan Anda telah dikirim.</p>
       <table style="font-size:14px;margin:8px 0 4px"><tr><td style="color:#5f6b76;padding-right:16px">Kurir</td><td><b>${escapeHtml(o.courier || "—")}</b></td></tr>
       <tr><td style="color:#5f6b76;padding-right:16px">No. Resi</td><td><b>${escapeHtml(o.tracking_no || "—")}</b></td></tr></table>
       ${itemsTable(o, items)}
       <p>Setiap kemasan dilengkapi nomor lot untuk ketertelusuran mutu benih.</p>`,
    ),
  };
}

export async function invoiceEmail(o: OrderForEmail, items: ItemForEmail[]) {
  const due = o.total - o.paid;
  return {
    subject: `Invoice ${o.invoice_no} — ${await getSetting("company_brand")}`,
    html: await layout(
      `Invoice ${o.invoice_no}`,
      `${greet(o)}<p>Berikut tagihan untuk pesanan <b>${o.so_no}</b>.</p>
       ${itemsTable(o, items)}
       <table style="font-size:14px;margin:8px 0"><tr><td style="color:#5f6b76;padding-right:16px">Sudah dibayar</td><td>${rupiah(o.paid)}</td></tr>
       <tr><td style="color:#5f6b76;padding-right:16px">Sisa tagihan</td><td><b>${rupiah(due)}</b></td></tr>
       <tr><td style="color:#5f6b76;padding-right:16px">Jatuh tempo</td><td><b>${tanggal(o.due_date)}</b></td></tr></table>
       <p>Pembayaran dapat ditransfer ke:<br><b>${escapeHtml(await getSetting("bank_info"))}</b></p>
       <p>Invoice PDF terlampir. Mohon kirimkan bukti transfer dengan membalas email ini.</p>`,
    ),
  };
}

export async function paymentReceiptEmail(o: OrderForEmail, amount: number) {
  const due = o.total - o.paid;
  return {
    subject: `Pembayaran diterima — ${o.invoice_no ?? o.so_no}`,
    html: await layout(
      "Terima kasih, pembayaran diterima",
      `${greet(o)}<p>Kami telah menerima pembayaran sebesar <b>${rupiah(amount)}</b> untuk ${o.invoice_no ?? o.so_no}.</p>
       <p>${due <= 0 ? "Tagihan ini sudah <b>LUNAS</b>." : `Sisa tagihan: <b>${rupiah(due)}</b>.`}</p>`,
    ),
  };
}

export async function reminderEmail(o: OrderForEmail) {
  return {
    subject: `Pengingat pembayaran ${o.invoice_no}`,
    html: await layout(
      "Pengingat pembayaran",
      `${greet(o)}<p>Kami ingin mengingatkan bahwa invoice <b>${o.invoice_no}</b> sebesar <b>${rupiah(o.total - o.paid)}</b>
       jatuh tempo pada <b>${tanggal(o.due_date)}</b>.</p>
       <p>Pembayaran dapat ditransfer ke:<br><b>${escapeHtml(await getSetting("bank_info"))}</b></p>
       <p>Abaikan email ini bila pembayaran sudah dilakukan. Terima kasih.</p>`,
    ),
  };
}

export async function lowStockEmail(rows: { name: string; pack_size: string; stock: number; min_stock: number }[]) {
  const list = rows
    .map(
      (r) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(r.name)} (${escapeHtml(r.pack_size)})</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;color:#b42318"><b>${num(r.stock)}</b></td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${num(r.min_stock)}</td></tr>`,
    )
    .join("");
  return {
    subject: `[ERP] Peringatan stok rendah — ${rows.length} produk`,
    html: await layout(
      "Stok di bawah batas minimum",
      `<p>Produk berikut perlu segera diproduksi / diisi ulang:</p>
       <table width="100%" style="font-size:14px;border-collapse:collapse"><tr style="background:#eef6fb"><th style="padding:6px 8px;text-align:left">Produk</th><th style="padding:6px 8px;text-align:right">Stok</th><th style="padding:6px 8px;text-align:right">Minimum</th></tr>${list}</table>`,
    ),
  };
}

export async function purchaseOrderEmail(
  po: { po_no: string; order_date: string; supplier_name: string; total: number; notes: string },
  items: { description: string; qty: number; unit: string; price: number }[],
) {
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(i.description)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${num(i.qty)} ${escapeHtml(i.unit)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${rupiah(i.price)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${rupiah(i.qty * i.price)}</td></tr>`,
    )
    .join("");
  return {
    subject: `Purchase Order ${po.po_no} — ${await getSetting("company_name")}`,
    html: await layout(
      `Purchase Order ${po.po_no}`,
      `<p>Kepada Yth. ${escapeHtml(po.supplier_name)},</p><p>Dengan ini kami memesan barang berikut (tanggal ${tanggal(po.order_date)}):</p>
       <table width="100%" style="font-size:14px;border-collapse:collapse;margin:12px 0"><tr style="background:#eef6fb"><th style="padding:6px 8px;text-align:left">Barang</th><th style="padding:6px 8px;text-align:right">Qty</th><th style="padding:6px 8px;text-align:right">Harga</th><th style="padding:6px 8px;text-align:right">Jumlah</th></tr>${rows}
       <tr><td colspan="3" style="padding:6px 8px;text-align:right;font-weight:700">Total</td><td style="padding:6px 8px;text-align:right;font-weight:700">${rupiah(po.total)}</td></tr></table>
       ${po.notes ? `<p>Catatan: ${escapeHtml(po.notes)}</p>` : ""}
       <p>Mohon konfirmasi ketersediaan dan estimasi pengiriman dengan membalas email ini.</p>`,
    ),
  };
}

export async function customEmail(subject: string, message: string) {
  return {
    subject,
    html: await layout(escapeHtml(subject), escapeHtml(message).replace(/\n/g, "<br>")),
  };
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:#0077a8;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">${label}</a></p>
   <p style="font-size:12px;color:#5f6b76">Jika tombol tidak bisa diklik, salin tautan ini ke browser:<br><span style="word-break:break-all">${escapeHtml(href)}</span></p>`;

/** Undangan akun baru (berlaku 72 jam) atau reset kata sandi (berlaku 1 jam). */
export async function passwordLinkEmail(name: string, link: string, kind: "reset" | "invite", division?: string) {
  if (kind === "invite") {
    return {
      subject: "Undangan akun ERP Haraka Seed",
      html: await layout(
        "Akun ERP Anda sudah dibuat",
        `<p>Halo ${escapeHtml(name)},</p>
         <p>Anda diundang menggunakan ERP PT Benih Haraka Sejahtera${division ? ` sebagai <b>${escapeHtml(division)}</b>` : ""}.
         Login memakai alamat email ini. Klik tombol di bawah untuk membuat kata sandi Anda.</p>
         ${button(link, "Buat kata sandi")}
         <p style="font-size:12px;color:#5f6b76">Tautan berlaku 72 jam dan hanya bisa dipakai sekali.</p>`,
      ),
    };
  }
  return {
    subject: "Reset kata sandi ERP Haraka Seed",
    html: await layout(
      "Permintaan reset kata sandi",
      `<p>Halo ${escapeHtml(name)},</p>
       <p>Kami menerima permintaan untuk mengganti kata sandi akun ERP Anda. Klik tombol di bawah untuk membuat kata sandi baru.</p>
       ${button(link, "Buat kata sandi baru")}
       <p style="font-size:12px;color:#5f6b76">Tautan berlaku 1 jam dan hanya bisa dipakai sekali. Abaikan email ini jika Anda tidak memintanya; kata sandi Anda tidak berubah.</p>`,
    ),
  };
}
