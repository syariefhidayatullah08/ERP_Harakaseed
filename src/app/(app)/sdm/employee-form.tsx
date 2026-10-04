import { saveEmployee } from "@/actions/sdm";
import { SubmitButton } from "@/components/buttons";
import { Field } from "@/components/ui";
import { DIVISIONS } from "@/lib/access";

export type Employee = {
  id: number;
  name: string;
  division: string;
  position: string;
  email: string;
  phone: string;
  join_date: string | null;
  status: string;
  note: string;
};

export function EmployeeForm({ e }: { e?: Employee }) {
  return (
    <form action={saveEmployee} className="grid gap-3 p-5 sm:grid-cols-2">
      {e && <input type="hidden" name="id" value={e.id} />}
      <Field label="Nama lengkap *" className="sm:col-span-2">
        <input name="name" required defaultValue={e?.name} className="input" />
      </Field>
      <Field label="Divisi *">
        <select name="division" required defaultValue={e?.division ?? ""} className="input">
          <option value="" disabled>
            Pilih…
          </option>
          {Object.entries(DIVISIONS).map(([k, d]) => (
            <option key={k} value={k}>
              {d.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Jabatan">
        <input name="position" defaultValue={e?.position} className="input" placeholder="Staf gudang, Kepala lab…" />
      </Field>
      <Field label="Email pribadi">
        <input name="email" type="email" defaultValue={e?.email} className="input" />
      </Field>
      <Field label="Telepon / WA">
        <input name="phone" defaultValue={e?.phone} className="input" />
      </Field>
      <Field label="Tanggal masuk">
        <input name="join_date" type="date" defaultValue={e?.join_date ?? ""} className="input" />
      </Field>
      <Field label="Status">
        <select name="status" defaultValue={e?.status ?? "aktif"} className="input">
          <option value="aktif">Aktif</option>
          <option value="nonaktif">Nonaktif / keluar</option>
        </select>
      </Field>
      <Field label="Catatan" className="sm:col-span-2">
        <textarea name="note" rows={2} defaultValue={e?.note} className="input" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton className="btn-primary w-full">{e ? "Simpan perubahan" : "Tambah karyawan"}</SubmitButton>
      </div>
    </form>
  );
}
