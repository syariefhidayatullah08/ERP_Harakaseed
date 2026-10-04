import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { productStock } from "@/lib/inventory";
import { num, rupiah } from "@/lib/format";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { requireAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Produk" };

// Urutan sama dengan katalog resmi Haraka
const CATEGORY_ORDER = ["Buah", "Cabai", "Sayuran Buah", "Sayuran Daun", "Kacang-kacangan", "Jagung"];

export default async function ProductsPage({ searchParams }: PageProps<"/produk">) {
  await requireAccess("produk");
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim();
  const onlyIncomplete = sp.lengkapi === "1";
  const all = await productStock("(p.name ILIKE ? OR p.crop ILIKE ? OR p.sku ILIKE ?)", `%${q}%`, `%${q}%`, `%${q}%`);
  const incomplete = all.filter((p) => !p.unit_price || !p.pack_size);
  const products = onlyIncomplete ? incomplete : all;
  const categories = [...new Set(products.map((p) => p.category))].sort(
    (a, b) => (CATEGORY_ORDER.indexOf(a) + 1 || 99) - (CATEGORY_ORDER.indexOf(b) + 1 || 99),
  );

  return (
    <>
      <PageHeader
        title="Produk / Varietas"
        subtitle={`${all.length} varietas benih · ${all.filter((p) => p.seed_type !== "OP").length} F1 Hibrida, ${all.filter((p) => p.seed_type === "OP").length} OP`}
        actions={
          <Link href="/produk/baru" className="btn-accent">
            + Produk baru
          </Link>
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />

      {incomplete.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <span>
            <b>{incomplete.length} varietas</b> belum punya harga atau ukuran kemasan. Lengkapi agar bisa dijual dengan benar.
          </span>
          <Link href={onlyIncomplete ? "/produk" : "/produk?lengkapi=1"} className="btn-secondary btn-sm">
            {onlyIncomplete ? "Tampilkan semua" : "Tampilkan yang perlu dilengkapi"}
          </Link>
        </div>
      )}

      <form className="mb-5">
        {onlyIncomplete && <input type="hidden" name="lengkapi" value="1" />}
        <input name="q" defaultValue={q} placeholder="Cari nama, komoditas, atau SKU…" className="input max-w-sm" />
      </form>

      {categories.map((cat) => {
        const list = products.filter((p) => p.category === cat);
        return (
          <section key={cat} className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
              {cat} <span className="font-normal">· {list.length}</span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((p) => {
                const low = p.min_stock > 0 && p.stock < p.min_stock;
                const specs = [p.harvest_age && `Panen ${p.harvest_age}`, p.yield_potential, p.fruit_weight].filter(Boolean);
                return (
                  <Link key={p.id} href={`/produk/${p.id}`} className="card group flex gap-4 p-4 transition-shadow hover:shadow-md">
                    <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md bg-canvas">
                      {p.image ? (
                        <Image src={p.image} alt={`Kemasan ${p.name}`} fill sizes="80px" className="object-cover object-center" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-[10px] text-muted">Tanpa foto</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-bold tracking-wide text-brand-800 group-hover:text-brand-600">{p.name}</div>
                          <div className="truncate text-xs text-muted">{p.crop}</div>
                        </div>
                        <Badge tone={p.seed_type === "OP" ? "orange" : "brand"}>{p.seed_type === "OP" ? "OP" : "F1"}</Badge>
                      </div>
                      {specs.length > 0 && <div className="mt-1 truncate text-[11px] text-muted">{specs.join(" · ")}</div>}
                      <div className="mt-2 grid grid-cols-3 gap-2 border-t border-line pt-2 text-xs">
                        <div>
                          <div className="text-muted">Kemasan</div>
                          <div className="font-medium">{p.pack_size || <span className="text-orange-700">—</span>}</div>
                        </div>
                        <div>
                          <div className="text-muted">Harga</div>
                          <div className="font-medium tabular-nums">{p.unit_price ? rupiah(p.unit_price) : <span className="text-orange-700">Belum diisi</span>}</div>
                        </div>
                        <div>
                          <div className="text-muted">Stok</div>
                          <div className={`font-semibold tabular-nums ${low ? "text-red-700" : ""}`}>{num(p.stock)}</div>
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
                        <span className="font-mono">{p.sku}</span>
                        {!p.active ? <Badge>Nonaktif</Badge> : low ? <Badge tone="red">Di bawah minimum</Badge> : null}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
