import "server-only";
import { rupiah, tanggal } from "./format";
import { invoiceSignature } from "./session";

/** Nomor Indonesia → format wa.me (62…). Kosong bila tidak valid. */
export function waNumber(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return d.length >= 10 && d.length <= 15 ? d : "";
}

export const waLink = (phone: string, text: string) => {
  const n = waNumber(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : "";
};

export function appUrl() {
  return process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
}

export const publicInvoiceUrl = (soId: number, doc: "invoice" | "sj" = "invoice") =>
  `${appUrl()}/i/${soId}/${invoiceSignature(soId)}${doc === "sj" ? "?doc=sj" : ""}`;

type O = {
  id: number;
  so_no: string;
  contact_person: string;
  customer: string;
  total: number;
  paid: number;
  invoice_no: string | null;
  due_date: string | null;
  courier: string;
  tracking_no: string;
  status: string;
};

/** Pesan WhatsApp siap kirim untuk satu pesanan. */
export function orderWhatsappMessages(o: O, brand: string, bank: string) {
  const hi = `Halo ${o.contact_person || o.customer},`;
  const sign = `\n\nTerima kasih,\n${brand}`;
  const msgs: { key: string; label: string; text: string }[] = [
    {
      key: "konfirmasi",
      label: "Konfirmasi pesanan",
      text: `${hi}\n\nPesanan ${o.so_no} senilai ${rupiah(o.total)} sudah kami terima dan sedang kami siapkan.${sign}`,
    },
  ];
  if (o.status === "dikirim" || o.status === "selesai") {
    msgs.push({
      key: "pengiriman",
      label: "Info pengiriman",
      text: `${hi}\n\nPesanan ${o.so_no} sudah dikirim${o.courier ? ` via ${o.courier}` : ""}${o.tracking_no ? `, no. resi ${o.tracking_no}` : ""}.\nSurat jalan: ${publicInvoiceUrl(o.id, "sj")}${sign}`,
    });
  }
  if (o.invoice_no) {
    const due = o.total - o.paid;
    msgs.push({
      key: "invoice",
      label: due > 0 ? "Invoice / tagihan" : "Invoice (lunas)",
      text:
        due > 0
          ? `${hi}\n\nBerikut invoice ${o.invoice_no} untuk pesanan ${o.so_no}.\nSisa tagihan: ${rupiah(due)}\nJatuh tempo: ${tanggal(o.due_date)}\n\nUnduh invoice: ${publicInvoiceUrl(o.id)}\n\nPembayaran ke: ${bank}${sign}`
          : `${hi}\n\nInvoice ${o.invoice_no} sudah LUNAS. Terima kasih atas pembayarannya.\nUnduh invoice: ${publicInvoiceUrl(o.id)}${sign}`,
    });
  }
  return msgs;
}
