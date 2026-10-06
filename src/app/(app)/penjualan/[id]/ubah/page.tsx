import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { all, get } from "@/lib/db";
import { packStock } from "@/lib/inventory";
import { Flash, PageHeader } from "@/components/ui";
import { today } from "@/lib/format";
import { toId, withMsg } from "@/lib/form";
import { CHANNELS, toChannel } from "@/lib/sales-channel";
import { OrderForm } from "../../baru/order-form";
import { requireAccess } from "@/lib/session";
import { itemNameSuggestions } from "@/lib/order-names";

export const metadata: Metadata = { title: "Ubah pesanan" };

export default async function EditOrderPage({ params, searchParams }: PageProps<"/penjualan/[id]/ubah">) {
  await requireAccess("penjualan");
  const { id } = await params;
  const sp = await searchParams;
  const o = await get<{ id: number; so_no: string; channel: string; status: string; customer: string; order_date: string; discount_pct: number; tax_pct: number; notes: string; deposit: number; invoice_manual: string }>(
    "SELECT so.id, so.so_no, so.channel, so.status, c.name customer, so.order_date, so.discount_pct, so.tax_pct, so.notes, so.deposit, so.invoice_manual FROM sales_orders so JOIN customers c ON c.id = so.customer_id WHERE so.id = ?",
    toId(id),
  );
  if (!o) notFound();
  if (!["draft", "dikonfirmasi"].includes(o.status)) redirect(withMsg(`/penjualan/${o.id}`, "Pesanan yang sudah dikirim tidak bisa diubah. Batalkan atau hapus pesanan, lalu buat ulang.", "error"));
  const channel = toChannel(o.channel);
  const lines = await all<{ product_id: number; pack_size: string; qty: number; price: number; item_name: string; item_code: string }>("SELECT COALESCE(product_id, 0) product_id, pack_size, qty, price, item_name, item_code FROM so_items WHERE so_id = ? ORDER BY id", o.id);
  const names = await itemNameSuggestions(channel);
  const customers = await all<{ name: string; city: string; email: string }>("SELECT name, city, email FROM customers ORDER BY (kind = 'distributor') DESC, name");
  const products = await all<{ id: number; name: string; crop: string }>("SELECT id, name, crop FROM products WHERE active = 1 ORDER BY name");
  const packs = (await packStock()).map((k) => ({ product_id: k.product_id, pack_size: k.pack_size, price: k.price, available: k.stock - k.reserved }));
  return (
    <>
      <PageHeader title={`Ubah ${o.so_no}`} subtitle={`${CHANNELS[channel].title} · ${o.status === "draft" ? "draft" : "sudah dikonfirmasi, belum dikirim"}`} back={{ href: `/penjualan/${o.id}`, label: o.so_no }} />
      <Flash error={sp.error as string} />
      <OrderForm channel={channel} customers={customers} products={products} packs={packs} today={today()} initial={{ id: o.id, customer: o.customer, order_date: o.order_date, invoice_manual: o.invoice_manual, discount_pct: o.discount_pct, tax_pct: o.tax_pct, notes: o.notes, deposit: o.deposit, lines }} names={names} />
    </>
  );
}
