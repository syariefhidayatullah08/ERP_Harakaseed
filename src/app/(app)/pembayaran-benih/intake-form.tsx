import { Card, Field } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { saveIntake } from "@/actions/seed-payment";
import { today } from "@/lib/format";
import { DUE_RULES, type Intake } from "@/lib/seed-payment";

/** Form satu baris buku induk. Nilai pembayaran & kredit macet dihitung otomatis saat disimpan. */
export function IntakeForm({ row, kind, companies }: { row?: Intake; kind: string; companies: string[] }) {
  const v = (k: keyof Intake) => (row?.[k] ?? "") as string | number;
  return (
    <form action={saveIntake} className="space-y-5">
      {row && <input type="hidden" name="id" value={row.id} />}
      <Card title="Benih masuk">
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Jenis *">
            <select name="kind" defaultValue={kind} className="input">
              <option value="internal">Internal (produksi sendiri)</option>
              <option value="eksternal">Eksternal (kontrak perusahaan lain)</option>
            </select>
          </Field>
          <Field label="Nama petani *">
            <input name="farmer" required defaultValue={v("farmer")} className="input" />
          </Field>
          <Field label="Lokasi lahan">
            <input name="location" defaultValue={v("location")} className="input" />
          </Field>
          <Field label="Tanggal benih masuk">
            <input name="received_date" type="date" defaultValue={row ? v("received_date") : today()} className="input" />
          </Field>
          <Field label="Lama jatuh tempo">
            <select name="due_days" defaultValue={DUE_RULES[0].days} className="input">
              {DUE_RULES.map((r) => (
                <option key={r.days} value={r.days}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tanggal jatuh tempo (kosongkan = dihitung otomatis)">
            <input name="due_date" type="date" defaultValue={v("due_date")} className="input" />
          </Field>
          <Field label="Petugas lapang">
            <input name="officer" defaultValue={v("officer")} className="input" placeholder="PPG / SPR / WHD / AGG" />
          </Field>
          <Field label="No kontrak">
            <input name="contract_no" defaultValue={v("contract_no")} className="input" />
          </Field>
          <Field label="Kode produksi">
            <input name="production_code" defaultValue={v("production_code")} className="input" placeholder="mis. KE011" />
          </Field>
          <Field label="No batch">
            <input name="batch_no" defaultValue={v("batch_no")} className="input" />
          </Field>
          <Field label="Bobot awal (kg)">
            <input name="gross_kg" type="number" step="any" min={0} defaultValue={v("gross_kg")} className="input" />
          </Field>
          <Field label="Bobot bersih (kg) *">
            <input name="net_kg" type="number" step="any" min={0} required defaultValue={v("net_kg")} className="input" />
          </Field>
        </div>
      </Card>

      <Card title="Hasil pengujian">
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="KA · kadar air (%)">
            <input name="test_ka" defaultValue={v("test_ka")} className="input" />
          </Field>
          <Field label="KM · kemurnian (%)">
            <input name="test_km" defaultValue={v("test_km")} className="input" />
          </Field>
          <Field label="DB · daya berkecambah (%)">
            <input name="test_db" defaultValue={v("test_db")} className="input" />
          </Field>
        </div>
      </Card>

      <Card title="Pembayaran ke petani">
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Harga petani per kg (Rp) *">
            <input name="price" type="number" step="any" min={0} required defaultValue={v("price")} className="input" />
          </Field>
          <Field label="Nilai pinjaman (Rp)">
            <input name="loan" type="number" step="any" min={0} defaultValue={v("loan") || 0} className="input" />
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={row?.status === "lunas" ? "lunas" : "proses_uji"} className="input">
              <option value="proses_uji">Proses uji / belum dibayar</option>
              <option value="lunas">Lunas (sudah dibayar di luar surat PB)</option>
            </select>
          </Field>
          <Field label="Potongan lain (Rp)">
            <input name="deduction" type="number" step="any" min={0} defaultValue={v("deduction") || 0} className="input" />
          </Field>
          <Field label="Keterangan potongan">
            <input name="deduction_note" defaultValue={v("deduction_note")} className="input" placeholder="mis. sortir" />
          </Field>
          <Field label="Keterangan tambahan">
            <input name="notes" defaultValue={v("notes")} className="input" />
          </Field>
          <p className="text-xs text-muted sm:col-span-3">
            Nilai pembayaran = bobot bersih × harga − pinjaman − potongan. Bila hasilnya minus, pembayaran menjadi Rp 0 dan selisihnya dicatat sebagai kredit macet.
          </p>
        </div>
      </Card>

      <Card title="Khusus benih eksternal (abaikan untuk internal)">
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Perusahaan">
            <input name="company" list="pb-companies" defaultValue={v("company")} className="input" placeholder="mis. CV. Nusa Heulang" />
            <datalist id="pb-companies">
              {companies.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Harga kontrak perusahaan per kg (Rp)">
            <input name="contract_price" type="number" step="any" min={0} defaultValue={v("contract_price") || ""} className="input" />
          </Field>
          <Field label="Tanggal pengiriman benih">
            <input name="ship_date" type="date" defaultValue={v("ship_date")} className="input" />
          </Field>
          <Field label="Bobot bersih terkirim (kg)">
            <input name="shipped_kg" type="number" step="any" min={0} defaultValue={v("shipped_kg")} className="input" />
          </Field>
          <Field label="Bobot bersih fix (kg) · dasar tagihan invoice">
            <input name="fix_kg" type="number" step="any" min={0} defaultValue={v("fix_kg")} className="input" />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <SubmitButton>{row ? "Simpan perubahan" : "Simpan benih masuk"}</SubmitButton>
      </div>
    </form>
  );
}
