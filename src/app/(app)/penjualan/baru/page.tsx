import Link from "next/link";
import { all, get } from "@/lib/db";
import { packStock } from "@/lib/inventory";
import { PageHeader } from "@/components/ui";
import { today } from "@/lib/format";
import { CHANNELS, CHANNEL_KEYS, toChannel } from "@/lib/sales-channel";
import { OrderForm } from "./order-form";
import { requireAccess } from "@/lib/session";
import { itemNameSuggestions } from "@/lib/order-names";

export default async function NewOrderPage({ searchParams }: PageProps<"/penjualan/baru">) {
  await requireAccess("penjualan");
  const sp = await searchParams;
  const channel = toChannel(sp.jenis);
  const customerId = Number(sp.customer ?? 0) || 0;
  // Distributor ditampilkan lebih dulu sebagai saran; nama di luar daftar boleh diketik langsung.
  const customers = await all<{ name: string; city: string; email: string }>("SELECT name, city, email FROM customers ORDER BY (kind = 'distributor') DESC, name");
  const preset = customerId ? await get<{ name: string }>("SELECT name FROM customers WHERE id = ?", customerId) : undefined;
  const products = await all<{ id: number; name: string; crop: string }>("SELECT id, name, crop FROM products WHERE active = 1 ORDER BY name");
  const packs = (await packStock()).map((k) => ({ product_id: k.product_id, pack_size: k.pack_size, price: k.price, available: k.stock - k.reserved }));
  const names = await itemNameSuggestions(channel);
  const query = customerId ? `&customer=${customerId}` : "";
  return (
    <>
      <PageHeader title={`Pesanan baru · ${CHANNELS[channel].label.toLowerCase()}`} subtitle={CHANNELS[channel].hint} back={{ href: `/penjualan/${channel}`, label: CHANNELS[channel].title }} />
      <div className="mb-4 flex flex-wrap gap-2">
        {CHANNEL_KEYS.map((k) => (
          <Link
            key={k}
            href={`/penjualan/baru?jenis=${k}${query}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${channel === k ? "bg-brand-700 text-white" : "bg-canvas text-muted hover:text-ink"}`}
          >
            {CHANNELS[k].title}
          </Link>
        ))}
      </div>
      {/* key: ganti jenis = form baru, agar baris & harga jenis lain tidak terbawa */}
      <OrderForm key={channel} channel={channel} customers={customers} products={products} packs={packs} defaultCustomer={preset?.name} today={today()} names={names} />
    </>
  );
}
