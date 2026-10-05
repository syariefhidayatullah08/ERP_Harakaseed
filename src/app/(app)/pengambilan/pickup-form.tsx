import { Field } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { savePickup } from "@/actions/pickup";
import { today } from "@/lib/format";
import type { Pickup } from "@/lib/pickup";

/** Form ringkas untuk diisi dari HP di lahan: kolom besar, satu kolom, keyboard angka untuk bobot. */
export function PickupForm({ row, farmers, codes }: { row?: Pickup; farmers: { name: string; village: string }[]; codes: string[] }) {
  return (
    <form action={savePickup} className="space-y-4 p-5">
      {row && <input type="hidden" name="id" value={row.id} />}
      <Field label="Nama petani *">
        <input name="farmer" required list="daftar-petani" autoComplete="off" defaultValue={row?.farmer} className="input py-3 text-base" placeholder="Ketik nama petani…" />
        <datalist id="daftar-petani">
          {farmers.map((f, i) => (
            <option key={i} value={f.name}>
              {f.village}
            </option>
          ))}
        </datalist>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bobot diambil (kg) *">
          <input name="kg" type="number" inputMode="decimal" step="any" min={0.01} required defaultValue={row?.kg} className="input py-3 text-base font-semibold" placeholder="0" />
        </Field>
        <Field label="Jumlah karung">
          <input name="sacks" type="number" inputMode="numeric" step={1} min={0} defaultValue={row?.sacks || ""} className="input py-3 text-base" placeholder="0" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kode produksi">
          <input name="production_code" list="daftar-kode" autoComplete="off" defaultValue={row?.production_code} className="input py-3 text-base uppercase" placeholder="mis. KE011" />
          <datalist id="daftar-kode">
            {codes.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Tanggal ambil">
          <input name="pickup_date" type="date" defaultValue={row?.pickup_date ?? today()} className="input py-3 text-base" />
        </Field>
      </div>
      <Field label="Lokasi lahan / desa">
        <input name="location" defaultValue={row?.location} className="input py-3 text-base" placeholder="mis. Tlogosari" />
      </Field>
      <Field label="No kontrak (kalau ada)">
        <input name="contract_no" defaultValue={row?.contract_no} className="input py-3 text-base" />
      </Field>
      <Field label="Catatan">
        <textarea name="notes" rows={2} defaultValue={row?.notes} className="input text-base" placeholder="mis. benih masih basah, 2 karung menyusul besok" />
      </Field>
      <SubmitButton className="btn-primary w-full py-3 text-base">{row ? "Simpan perubahan" : "Simpan, lalu ambil foto"}</SubmitButton>
    </form>
  );
}
