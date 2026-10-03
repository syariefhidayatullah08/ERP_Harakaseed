import { saveProduct } from "@/actions/products";
import { SubmitButton } from "@/components/buttons";
import { Field } from "@/components/ui";
import type { ProductStock } from "@/lib/inventory";

const CATEGORIES = ["Buah", "Cabai", "Jagung", "Sayuran Buah", "Sayuran Daun", "Kacang-kacangan", "Umbi", "Lainnya"];

export function ProductForm({ product }: { product?: ProductStock }) {
  return (
    <form action={saveProduct} className="card space-y-4 p-6">
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="SKU *">
          <input name="sku" required defaultValue={product?.sku} className="input font-mono uppercase" placeholder="HKS-XXX-10" />
        </Field>
        <Field label="Nama varietas *">
          <input name="name" required defaultValue={product?.name} className="input uppercase" placeholder="KENTA F1" />
        </Field>
        <Field label="Komoditas *">
          <input name="crop" required defaultValue={product?.crop} className="input" placeholder="Semangka Tanpa Biji" />
        </Field>
        <Field label="Kategori">
          <select name="category" defaultValue={product?.category ?? "Sayuran Buah"} className="input">
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Tipe benih">
          <select name="seed_type" defaultValue={product?.seed_type ?? "F1 Hibrida"} className="input">
            <option>F1 Hibrida</option>
            <option value="OP">OP (Open Pollinated)</option>
          </select>
        </Field>
        <Field label="Ukuran kemasan *">
          <input name="pack_size" required defaultValue={product?.pack_size} className="input" placeholder="10 g / 50 butir" />
        </Field>
        <Field label="Harga jual per kemasan (Rp)">
          <input name="unit_price" type="number" min={0} defaultValue={product?.unit_price ?? 0} className="input" />
        </Field>
        <Field label="Stok minimum (kemasan)">
          <input name="min_stock" type="number" min={0} defaultValue={product?.min_stock ?? 100} className="input" />
        </Field>
        <Field label="Masa simpan (bulan)">
          <input name="shelf_life_months" type="number" min={1} defaultValue={product?.shelf_life_months ?? 18} className="input" />
        </Field>
      </div>
      <Field label="Deskripsi / keunggulan">
        <textarea name="description" rows={3} defaultValue={product?.description} className="input" />
      </Field>
      {product && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={product.active === 1} className="accent-brand-700" /> Produk aktif dijual
        </label>
      )}
      <div className="flex justify-end">
        <SubmitButton>Simpan produk</SubmitButton>
      </div>
    </form>
  );
}
