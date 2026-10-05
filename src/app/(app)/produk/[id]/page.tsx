import { toId } from "@/lib/form";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { all } from "@/lib/db";
import { productStock } from "@/lib/inventory";
import { addDays, daysUntil, num, rupiah, tanggal, today } from "@/lib/format";
import { Badge, Card, DL, Empty, Flash, PageHeader, StatCard } from "@/components/ui";
import { ProductForm } from "../product-form";
import { SubmitButton } from "@/components/buttons";
import { deletePack, savePack } from "@/actions/products";
import { can, requireAccess } from "@/lib/session";

export default async function ProductDetail({ params, searchParams }: PageProps<"/produk/[id]">) {
  const user = await requireAccess("produk");
  const { id } = await params;
  const sp = await searchParams;
  const [product] = await productStock("p.id = ?", toId(id));
  if (!product) notFound();

  const packs = await all<{ id: number; pack_size: string; price: number; active: number; stock: number }>(
    `SELECT k.id, k.pack_size, k.price, k.active,
            COALESCE((SELECT SUM(qty_available) FROM lots l WHERE l.product_id = k.product_id AND l.pack_size = k.pack_size AND l.expiry_date >= ? AND l.qc_status = 'lulus'), 0) stock
     FROM product_packs k WHERE k.product_id = ? ORDER BY k.active DESC, k.id`,
    today(),
    product.id,
  );
  const lots = await all<{ id: number; lot_no: string; pack_size: string; qty_initial: number; qty_available: number; germination: number; purity: number; expiry_date: string; prod_date: string }>(
    "SELECT * FROM lots WHERE product_id = ? ORDER BY expiry_date DESC",
    product.id,
  );
  const [sold] = await all<{ qty: number; v: number }>(
    `SELECT COALESCE(SUM(i.qty) FILTER (WHERE so.channel = 'kemasan'),0) qty, COALESCE(SUM(i.qty*i.price),0) v FROM so_items i JOIN sales_orders so ON so.id = i.so_id
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
        {can(user, "keuangan") && <StatCard label="Omzet 12 bulan" value={rupiah(sold.v)} />}
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
                {!packs.some((k) => k.active) && <Badge tone="orange">Gramasi & harga belum diisi</Badge>}
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
          <Card title="Gramasi & harga" className="overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Gramasi</th>
                  <th className="num">Stok (kemasan)</th>
                  <th>Harga per kemasan (Rp)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {packs.map((k) => (
                  <tr key={k.id}>
                    <td className="font-medium">
                      {k.pack_size} {!k.active && <Badge>Nonaktif</Badge>}
                    </td>
                    <td className="num">{num(k.stock)}</td>
                    <td>
                      <form action={savePack} className="flex gap-2">
                        <input type="hidden" name="product_id" value={product.id} />
                        <input type="hidden" name="pack_size" value={k.pack_size} />
                        <input name="price" type="number" min={0} defaultValue={k.price} className="input w-32" />
                        <SubmitButton className="btn-secondary btn-sm">{k.active ? "Simpan" : "Aktifkan"}</SubmitButton>
                      </form>
                    </td>
                    <td>
                      {k.active === 1 && (
                        <form action={deletePack}>
                          <input type="hidden" name="id" value={k.id} />
                          <SubmitButton className="btn-danger btn-sm" confirm={`Hapus gramasi ${k.pack_size}?`}>
                            Hapus
                          </SubmitButton>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!packs.length && <Empty>Belum ada gramasi. Tambahkan di bawah agar varietas ini bisa dijual per kemasan.</Empty>}
            <form action={savePack} className="flex flex-wrap items-end gap-3 border-t border-line p-5">
              <input type="hidden" name="product_id" value={product.id} />
              <label className="block">
                <span className="label">Gramasi baru</span>
                <input name="pack_size" required className="input w-32" placeholder="10 g" />
              </label>
              <label className="block">
                <span className="label">Harga per kemasan (Rp)</span>
                <input name="price" type="number" min={0} required className="input w-40" />
              </label>
              <SubmitButton>+ Tambah gramasi</SubmitButton>
            </form>
          </Card>
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
                        <div className="text-xs text-muted">
                          {l.pack_size && `${l.pack_size} · `}Daya kecambah {l.germination}%
                        </div>
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
