import { all } from "@/lib/db";
import { productStock } from "@/lib/inventory";
import { PageHeader } from "@/components/ui";
import { today } from "@/lib/format";
import { OrderForm } from "./order-form";

export default async function NewOrderPage({ searchParams }: PageProps<"/penjualan/baru">) {
  const sp = await searchParams;
  const customers = await all<{ id: number; name: string; city: string; email: string }>("SELECT id, name, city, email FROM customers ORDER BY name");
  const products = (await productStock("p.active = 1")).map((p) => ({
    id: p.id,
    name: p.name,
    crop: p.crop,
    pack_size: p.pack_size,
    price: p.unit_price,
    available: p.stock - p.reserved,
  }));
  return (
    <>
      <PageHeader title="Pesanan baru" back={{ href: "/penjualan", label: "Penjualan" }} />
      <OrderForm customers={customers} products={products} defaultCustomer={Number(sp.customer ?? 0) || undefined} today={today()} />
    </>
  );
}
