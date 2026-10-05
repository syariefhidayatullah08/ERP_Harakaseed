import { saveProduct } from "@/actions/products";
import { SubmitButton } from "@/components/buttons";
import { Field } from "@/components/ui";
import type { ProductStock } from "@/lib/inventory";

const CATEGORIES = ["Buah", "Cabai", "Sayuran Buah", "Sayuran Daun", "Kacang-kacangan", "Jagung", "Umbi", "Lainnya"];

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
        <Field label="Stok minimum (kemasan)">
          <input name="min_stock" type="number" min={0} defaultValue={product?.min_stock ?? 100} className="input" />
        </Field>
        <Field label="Masa simpan (bulan)">
          <input name="shelf_life_months" type="number" min={1} defaultValue={product?.shelf_life_months ?? 18} className="input" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Umur panen">
          <input name="harvest_age" defaultValue={product?.harvest_age} className="input" placeholder="55–58 hari" />
        </Field>
        <Field label="Potensi hasil">
          <input name="yield_potential" defaultValue={product?.yield_potential} className="input" placeholder="23–29 ton/ha" />
        </Field>
        <Field label="Bobot buah">
          <input name="fruit_weight" defaultValue={product?.fruit_weight} className="input" placeholder="2,1–2,5 kg" />
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
