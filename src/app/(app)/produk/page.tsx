import Link from "next/link";
import type { Metadata } from "next";
import { productStock } from "@/lib/inventory";
import { num, rupiah } from "@/lib/format";
import { Badge, Flash, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Produk" };

export default async function ProductsPage({ searchParams }: PageProps<"/produk">) {
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim();
  const products = productStock(
    "(p.name LIKE ? OR p.crop LIKE ? OR p.sku LIKE ?)",
    `%${q}%`,
    `%${q}%`,
    `%${q}%`,
  );
  const categories = [...new Set(products.map((p) => p.category))];

  return (
    <>
      <PageHeader
        title="Produk / Varietas"
        subtitle={`${products.length} varietas benih terdaftar`}
        actions={
          <Link href="/produk/baru" className="btn-primary">
            + Produk baru
          </Link>
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <form className="mb-5">
        <input name="q" defaultValue={q} placeholder="Cari nama, komoditas, atau SKU…" className="input max-w-sm" />
      </form>

      {categories.map((cat) => (
        <section key={cat} className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">{cat}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products
              .filter((p) => p.category === cat)
              .map((p) => {
                const low = p.stock < p.min_stock;
                return (
                  <Link key={p.id} href={`/produk/${p.id}`} className="card group p-5 transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-lg font-bold tracking-wide text-brand-800 group-hover:text-brand-600">{p.name}</div>
                        <div className="text-sm text-muted">{p.crop}</div>
                      </div>
                      <Badge tone={p.seed_type === "OP" ? "blue" : "green"}>{p.seed_type}</Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
                      <div>
                        <div className="text-muted">Kemasan</div>
                        <div className="font-medium">{p.pack_size}</div>
                      </div>
                      <div>
                        <div className="text-muted">Harga</div>
                        <div className="font-medium tabular-nums">{rupiah(p.unit_price)}</div>
                      </div>
                      <div>
                        <div className="text-muted">Stok</div>
                        <div className={`font-semibold tabular-nums ${low ? "text-red-700" : ""}`}>{num(p.stock)}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted">
                      <span className="font-mono">{p.sku}</span>
                      {!p.active ? <Badge>Nonaktif</Badge> : low ? <Badge tone="red">Di bawah minimum</Badge> : null}
                    </div>
                  </Link>
                );
              })}
          </div>
        </section>
      ))}
    </>
  );
}
