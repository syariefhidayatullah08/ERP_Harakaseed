import Link from "next/link";
import type { Metadata } from "next";
import { all } from "@/lib/db";
import { PO_STATUS, rupiah, tanggal } from "@/lib/format";
import { Badge, Card, Empty, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { saveSupplier } from "@/actions/purchasing";
import { requireAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Pembelian" };

export default async function PurchasingPage({ searchParams }: PageProps<"/pembelian">) {
  await requireAccess("pembelian");
  const sp = await searchParams;
  const pos = await all<{ id: number; po_no: string; supplier: string; order_date: string; status: string; total: number }>(
    "SELECT po.*, s.name supplier FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id ORDER BY po.id DESC",
  );
  const suppliers = await all<{ id: number; name: string; category: string; email: string; phone: string }>("SELECT * FROM suppliers ORDER BY name");

  return (
    <>
      <PageHeader
        title="Pembelian"
        subtitle="Purchase order kemasan, bahan perlakuan benih, dan kebutuhan produksi"
        actions={
          <Link href="/pembelian/baru" className="btn-primary">
            + PO baru
          </Link>
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Purchase order" className="overflow-hidden lg:col-span-2">
          {pos.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>No. PO</th>
                  <th>Supplier</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/pembelian/${p.id}`} className="font-medium text-brand-700 hover:underline">
                        {p.po_no}
                      </Link>
                    </td>
                    <td>{p.supplier}</td>
                    <td className="text-muted">{tanggal(p.order_date)}</td>
                    <td>
                      <Badge tone={PO_STATUS[p.status]?.tone}>{PO_STATUS[p.status]?.label}</Badge>
                    </td>
                    <td className="num">{rupiah(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>Belum ada purchase order.</Empty>
          )}
        </Card>
        <div className="space-y-5">
          <Card title="Supplier">
            {suppliers.length ? (
              <ul className="divide-y divide-line text-sm">
                {suppliers.map((s) => (
                  <li key={s.id} className="px-5 py-2.5">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted">
                      {s.category} {s.email ? `· ${s.email}` : <span className="text-amber-700">· tanpa email</span>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Belum ada supplier.</Empty>
            )}
          </Card>
          <Card title="Tambah supplier">
            <form action={saveSupplier} className="space-y-3 p-5">
              <Field label="Nama *">
                <input name="name" required className="input" />
              </Field>
              <Field label="Kategori">
                <input name="category" className="input" placeholder="Kemasan, pupuk, fungisida…" />
              </Field>
              <Field label="Email">
                <input name="email" type="email" className="input" />
              </Field>
              <Field label="Telepon">
                <input name="phone" className="input" />
              </Field>
              <SubmitButton className="btn-primary w-full">Simpan supplier</SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
