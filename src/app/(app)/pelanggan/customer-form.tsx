import { saveCustomer } from "@/actions/customers";
import { SubmitButton } from "@/components/buttons";
import { Field } from "@/components/ui";
import { CUSTOMER_KIND } from "@/lib/format";

export type Customer = {
  id: number;
  code: string;
  name: string;
  kind: string;
  contact_person: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  payment_terms: number;
};

export function CustomerForm({ c }: { c?: Customer }) {
  return (
    <form action={saveCustomer} className="grid gap-4 p-5 sm:grid-cols-2">
      {c && <input type="hidden" name="id" value={c.id} />}
      <Field label="Nama usaha / pelanggan *" className="sm:col-span-2">
        <input name="name" required defaultValue={c?.name} className="input" />
      </Field>
      <Field label="Jenis">
        <select name="kind" defaultValue={c?.kind ?? "distributor"} className="input">
          {Object.entries(CUSTOMER_KIND).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Kontak person">
        <input name="contact_person" defaultValue={c?.contact_person} className="input" />
      </Field>
      <Field label="Email (untuk konfirmasi & invoice)">
        <input name="email" type="email" defaultValue={c?.email} className="input" />
      </Field>
      <Field label="Telepon / WA">
        <input name="phone" defaultValue={c?.phone} className="input" />
      </Field>
      <Field label="Kota / Kabupaten">
        <input name="city" defaultValue={c?.city} className="input" />
      </Field>
      <Field label="Termin pembayaran (hari)">
        <input name="payment_terms" type="number" min={0} defaultValue={c?.payment_terms ?? 30} className="input" />
      </Field>
      <Field label="Alamat" className="sm:col-span-2">
        <textarea name="address" rows={2} defaultValue={c?.address} className="input" />
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <SubmitButton>Simpan</SubmitButton>
      </div>
    </form>
  );
}
