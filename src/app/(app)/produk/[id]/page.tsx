import { toId } from "@/lib/form";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { all } from "@/lib/db";
import { productStock } from "@/lib/inventory";
import { addDays, daysUntil, num, rupiah, tanggal, today } from "@/lib/format";
import { Badge, Card, DL, Empty, Flash, PageHeader, StatCard } from "@/components/ui";
import { ProductForm } from "../product-form";
import { requireAccess } from "@/lib/session";

export default async function ProductDetail({ params, searchParams }: PageProps<"/produk/[id]">) {
  await requireAccess("produk");
  const { id } = await params;
  const sp = await searchParams;
  const [product] = await productStock("p.id = ?", toId(id));
  if (!product) notFound();

  const lots = await all<{ id: number; lot_no: string; qty_initial: number; qty_available: number; germination: number; purity: number; expiry_date: string; prod_date: string }>(
    "SELECT * FROM lots WHERE product_id = ? ORDER BY expiry_date DESC",
    product.id,
  );
  const [sold] = await all<{ qty: number; v: number }>(
    `SELECT COALESCE(SUM(i.qty),0) qty, COALESCE(SUM(i.qty*i.price),0) v FROM so_items i JOIN sales_orders so ON so.id = i.so_id
     WHERE i.product_id = ? AND so.status NOT IN ('draft','batal') AND so.order_date >= ?`,
    product.id,
    addDays(today(), -365),
  );

  return (
    <>
      <PageHeader title={product.name} subtitle={[product.crop, product.pack_size, product.sku].filter(Boolean).join(" · ")} back={{ href: "/produk", label: "Produk" }} />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Stok layak jual" value={num(product.stock)} tone={product.min_stock > 0 && product.stock < product.min_stock ? "danger" : "default"} hint={`Minimum ${num(product.min_stock)}`} />
        <StatCard label="Dipesan (belum kirim)" value={num(product.reserved)} hint={`Tersedia ${num(product.stock - product.reserved)}`} />
        <StatCard label="Terjual 12 bulan" value={num(sold.qty)} hint="kemasan" />
        <StatCard label="Omzet 12 bulan" value={rupiah(sold.v)} />
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <div className="card flex flex-col gap-5 p-5 sm:flex-row">
            {product.image && (
              <a href={product.image} target="_blank" rel="noopener noreferrer" className="relative mx-auto h-56 w-44 shrink-0 overflow-hidden rounded-lg bg-canvas sm:mx-0">
                <Image src={product.image} alt={`Kemasan ${product.name}`} fill sizes="176px" className="object-cover" priority />
              </a>
            )}
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge tone={product.seed_type === "OP" ? "orange" : "brand"}>{product.seed_type}</Badge>
                <Badge>{product.category}</Badge>
                {!product.unit_price && <Badge tone="orange">Harga belum diisi</Badge>}
              </div>
              <DL
                items={[
                  ["Umur panen", product.harvest_age || "—"],
                  ["Potensi hasil", product.yield_potential || "—"],
                  ["Bobot buah", product.fruit_weight || "—"],
                ]}
              />
              {product.description && <p className="text-sm leading-relaxed text-muted">{product.description}</p>}
            </div>
          </div>
          <ProductForm product={product} />
        </div>
        <Card
          title="Lot benih"
          className="overflow-hidden lg:col-span-2"
          actions={
            <Link href={`/inventori?product=${product.id}#lot-baru`} className="text-xs font-medium text-brand-700">
              + Lot
            </Link>
          }
        >
          {lots.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Lot</th>
                  <th className="num">Sisa</th>
                  <th>Kadaluarsa</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((l) => {
                  const d = daysUntil(l.expiry_date);
                  return (
                    <tr key={l.id}>
                      <td>
                        <Link href={`/inventori/${l.id}`} className="font-mono text-xs text-brand-700 hover:underline">
                          {l.lot_no}
                        </Link>
                        <div className="text-xs text-muted">Daya kecambah {l.germination}%</div>
                      </td>
                      <td className="num">{num(l.qty_available)}</td>
                      <td>
                        <div className="text-xs">{tanggal(l.expiry_date)}</div>
                        {d < 0 ? <Badge tone="red">Kadaluarsa</Badge> : d <= 90 ? <Badge tone="amber">{d} hari</Badge> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <Empty>Belum ada lot.</Empty>
          )}
        </Card>
      </div>
    </>
  );
}
