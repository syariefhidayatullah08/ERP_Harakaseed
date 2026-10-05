import type { Metadata } from "next";
import { all } from "@/lib/db";
import { tanggal } from "@/lib/format";
import { Badge, Card, Empty, Field, Flash, PageHeader, StatCard } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { deleteBulkStock, saveBulkStock } from "@/actions/bulk-stock";
import { requireAccess } from "@/lib/session";
import { ExportMenu } from "@/components/export-menu";

export const metadata: Metadata = { title: "Stok Bahan Baku" };

type Row = { id: number; production_code: string; product_name: string; untested_kg: number; testing_kg: number; ready_kg: number; packing: string; note: string; updated_at: string };

const kg = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n || 0);

export default async function BulkStockPage({ searchParams }: PageProps<"/stok-bahan">) {
  await requireAccess("stok_bahan");
  const sp = await searchParams;
  const rows = await all<Row>("SELECT * FROM bulk_stock ORDER BY id");
  const sum = (k: "untested_kg" | "testing_kg" | "ready_kg") => rows.reduce((s, r) => s + r[k], 0);
  const lastUpdate = rows.map((r) => r.updated_at).sort().pop();

  return (
    <>
      <PageHeader
        title="Stok Bahan Baku"
        subtitle={`Ketersediaan bahan baku benih (kg) per kode produksi${lastUpdate ? ` · diperbarui ${tanggal(lastUpdate)}` : ""}`}
        actions={<ExportMenu type="stok-bahan" />}
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Belum uji" value={`${kg(sum("untested_kg"))} kg`} />
        <StatCard label="Proses uji" value={`${kg(sum("testing_kg"))} kg`} tone={sum("testing_kg") > 0 ? "warn" : "default"} />
        <StatCard label="Siap jual" value={`${kg(sum("ready_kg"))} kg`} />
        <StatCard label="Total bahan baku" value={`${kg(sum("untested_kg") + sum("testing_kg") + sum("ready_kg"))} kg`} hint={`${rows.length} kode produksi`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={`Per kode produksi (${rows.length})`} className="overflow-hidden lg:col-span-2">
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Kode produksi</th>
                    <th>Nama produk</th>
                    <th className="num">Belum uji</th>
                    <th className="num">Proses uji</th>
                    <th className="num">Siap jual</th>
                    <th className="num">Total (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const total = r.untested_kg + r.testing_kg + r.ready_kg;
                    return (
                      <tr key={r.id} className={total ? "" : "text-muted"}>
                        <td className="align-top">
                          <div className="font-mono text-xs font-semibold">{r.production_code}</div>
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs text-brand-700">Ubah stok</summary>
                            <form action={saveBulkStock} className="mt-2 grid w-64 grid-cols-3 gap-2 text-ink">
                              <input type="hidden" name="id" value={r.id} />
                              <input name="production_code" defaultValue={r.production_code} required className="input py-1 text-xs" aria-label="Kode produksi" />
                              <input name="product_name" defaultValue={r.product_name} className="input col-span-2 py-1 text-xs" aria-label="Nama produk" placeholder="Nama produk" />
                              <label className="text-[11px] text-muted">
                                Belum uji
                                <input name="untested_kg" type="number" min={0} step="any" defaultValue={r.untested_kg} className="input py-1 text-xs" />
                              </label>
                              <label className="text-[11px] text-muted">
                                Proses uji
                                <input name="testing_kg" type="number" min={0} step="any" defaultValue={r.testing_kg} className="input py-1 text-xs" />
                              </label>
                              <label className="text-[11px] text-muted">
                                Siap jual
                                <input name="ready_kg" type="number" min={0} step="any" defaultValue={r.ready_kg} className="input py-1 text-xs" />
                              </label>
                              <input name="packing" defaultValue={r.packing} className="input py-1 text-xs" aria-label="Packing (dus)" placeholder="Packing" />
                              <input name="note" defaultValue={r.note} className="input col-span-2 py-1 text-xs" aria-label="Keterangan" placeholder="Keterangan" />
                              <SubmitButton className="btn-secondary btn-sm col-span-3">Simpan</SubmitButton>
                            </form>
                            <form action={deleteBulkStock} className="mt-2">
                              <input type="hidden" name="id" value={r.id} />
                              <SubmitButton className="btn-danger btn-sm" confirm={`Hapus kode ${r.production_code} dari stok bahan baku?`}>
                                Hapus
                              </SubmitButton>
                            </form>
                          </details>
                        </td>
                        <td className="align-top">
                          <div className="font-medium">{r.product_name || "—"}</div>
                          {(r.note || r.packing) && <div className="text-xs text-muted">{[r.packing && `Packing: ${r.packing}`, r.note].filter(Boolean).join(" · ")}</div>}
                        </td>
                        <td className="num align-top">{r.untested_kg ? kg(r.untested_kg) : ""}</td>
                        <td className="num align-top">{r.testing_kg ? <Badge tone="amber">{kg(r.testing_kg)}</Badge> : ""}</td>
                        <td className="num align-top">{r.ready_kg ? <span className="font-medium text-emerald-700">{kg(r.ready_kg)}</span> : ""}</td>
                        <td className="num align-top font-semibold">{total ? kg(total) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Belum ada data stok bahan baku.</Empty>
          )}
        </Card>

        <Card title="Tambah kode produksi">
          <form action={saveBulkStock} className="space-y-3 p-5">
            <Field label="Kode produksi *">
              <input name="production_code" required className="input" placeholder="mis. KE 11" />
            </Field>
            <Field label="Nama produk">
              <input name="product_name" className="input" placeholder="mis. VIVAN F1" />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Belum uji (kg)">
                <input name="untested_kg" type="number" min={0} step="any" className="input" />
              </Field>
              <Field label="Proses uji (kg)">
                <input name="testing_kg" type="number" min={0} step="any" className="input" />
              </Field>
              <Field label="Siap jual (kg)">
                <input name="ready_kg" type="number" min={0} step="any" className="input" />
              </Field>
            </div>
            <Field label="Packing (dus)">
              <input name="packing" className="input" />
            </Field>
            <Field label="Keterangan">
              <input name="note" className="input" placeholder="mis. PO belum terpenuhi" />
            </Field>
            <SubmitButton className="btn-primary w-full">Simpan</SubmitButton>
            <p className="text-xs text-muted">Stok di sini adalah bahan baku curah dalam kg. Stok kemasan siap kirim tetap dicatat per lot di menu Gudang & Lot.</p>
          </form>
        </Card>
      </div>
    </>
  );
}
