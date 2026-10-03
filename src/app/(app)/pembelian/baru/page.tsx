import { all } from "@/lib/db";
import { today } from "@/lib/format";
import { Card, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { createPO } from "@/actions/purchasing";
import { requireAccess } from "@/lib/session";

export default async function NewPOPage({ searchParams }: PageProps<"/pembelian/baru">) {
  await requireAccess("pembelian");
  const sp = await searchParams;
  const suppliers = await all<{ id: number; name: string; category: string }>("SELECT id, name, category FROM suppliers ORDER BY name");
  return (
    <>
      <PageHeader title="Purchase order baru" back={{ href: "/pembelian", label: "Pembelian" }} />
      <Flash error={sp.error as string} />
      <form action={createPO} className="space-y-5">
        <Card>
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label="Supplier *">
              <select name="supplier_id" required defaultValue="" className="input">
                <option value="" disabled>
                  Pilih supplier…
                </option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.category && `(${s.category})`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tanggal">
              <input name="order_date" type="date" defaultValue={today()} className="input" />
            </Field>
            <Field label="Catatan">
              <input name="notes" className="input" />
            </Field>
          </div>
        </Card>
        <Card title="Barang (baris kosong diabaikan)" className="overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Deskripsi barang</th>
                <th className="w-28">Qty</th>
                <th className="w-28">Satuan</th>
                <th className="w-40">Harga satuan</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }, (_, i) => (
                <tr key={i}>
                  <td>
                    <input name="description" className="input" placeholder={i === 0 ? "Sachet aluminium foil 10 g, cetak logo" : ""} />
                  </td>
                  <td>
                    <input name="qty" type="number" step="any" min={0} className="input" />
                  </td>
                  <td>
                    <input name="unit" defaultValue="pcs" className="input" />
                  </td>
                  <td>
                    <input name="price" type="number" min={0} className="input" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="flex justify-end">
          <SubmitButton>Simpan PO</SubmitButton>
        </div>
      </form>
    </>
  );
}
