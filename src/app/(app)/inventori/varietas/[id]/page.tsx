import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { num } from "@/lib/format";
import { toId } from "@/lib/form";
import { Card, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { can, requireAccess } from "@/lib/session";
import { deleteVariety, updateVariety } from "@/actions/inventory";

export const metadata: Metadata = { title: "Ubah varietas" };

/** Gudang & Lot → Stok Varietas → Ubah / hapus satu varietas. Gramasi & harga tetap diatur di menu Produk. */
export default async function VarietyEdit({ params, searchParams }: PageProps<"/inventori/varietas/[id]">) {
  const user = await requireAccess(["inventori", "produk"]);
  const { id } = await params;
  const sp = await searchParams;
  const p = await get<{ id: number; sku: string; name: string; crop: string; category: string; min_stock: number; shelf_life_months: number; active: number }>(
    "SELECT id, sku, name, crop, category, min_stock, shelf_life_months, active FROM products WHERE id = ?",
    toId(id),
  );
  if (!p) notFound();
  const [categories, stock] = await Promise.all([
    all<{ category: string }>("SELECT DISTINCT category FROM products WHERE category <> '' ORDER BY 1"),
    get<{ n: number; lots: number }>("SELECT COALESCE(SUM(qty_available), 0) n, COUNT(*) FILTER (WHERE qty_available > 0) lots FROM lots WHERE product_id = ?", p.id),
  ]);
  const left = Number(stock?.n ?? 0);
  return (
    <>
      <PageHeader title={p.name} subtitle={`${p.crop} · SKU ${p.sku}`} back={{ href: "/inventori/varietas", label: "Stok Varietas" }} />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <Card title="Ubah data varietas">
        <form action={updateVariety} className="grid gap-4 p-5 sm:grid-cols-3">
          <input type="hidden" name="id" value={p.id} />
          <Field label="Nama varietas *">
            <input name="name" required defaultValue={p.name} className="input uppercase" />
          </Field>
          <Field label="Komoditas *">
            <input name="crop" required defaultValue={p.crop} className="input" />
          </Field>
          <Field label="Kategori">
            <input name="category" list="kategori" defaultValue={p.category} className="input" />
            <datalist id="kategori">
              {categories.map((c) => (
                <option key={c.category} value={c.category} />
              ))}
            </datalist>
          </Field>
          <Field label="Stok minimum (kemasan)">
            <input name="min_stock" type="number" min={0} defaultValue={p.min_stock} className="input" />
          </Field>
          <Field label="Masa simpan (bulan)">
            <input name="shelf_life_months" type="number" min={1} defaultValue={p.shelf_life_months} className="input" />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="active" value="1" defaultChecked={!!p.active} /> Aktif (tampil di Stok Varietas)
          </label>
          <div className="flex items-center justify-between gap-3 sm:col-span-3">
            <span className="text-xs text-muted">
              Gramasi & harga diatur di{" "}
              {can(user, "produk") ? (
                <Link href={`/produk/${p.id}`} className="text-brand-700 hover:underline">
                  menu Produk
                </Link>
              ) : (
                "menu Produk"
              )}
              .
            </span>
            <SubmitButton>Simpan perubahan</SubmitButton>
          </div>
        </form>
      </Card>
      <Card title="Hapus varietas" className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
          <span className="text-muted">
            {left > 0
              ? `Masih ada stok ${num(left)} kemasan di ${stock?.lots} lot. Habiskan/sesuaikan stok lotnya dulu sebelum menghapus.`
              : "Varietas yang belum pernah dipakai dihapus permanen; yang sudah punya riwayat lot/pesanan/produksi hanya disembunyikan dari daftar (bisa diaktifkan lagi)."}
          </span>
          {left === 0 && (
            <form action={deleteVariety}>
              <input type="hidden" name="id" value={p.id} />
              <SubmitButton className="btn-danger" confirm={`Hapus varietas ${p.name}?`}>
                Hapus
              </SubmitButton>
            </form>
          )}
        </div>
      </Card>
    </>
  );
}
