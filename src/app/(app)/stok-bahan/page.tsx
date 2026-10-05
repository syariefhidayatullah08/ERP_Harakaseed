import type { Metadata } from "next";
import Link from "next/link";
import { all } from "@/lib/db";
import { tanggal } from "@/lib/format";
import { Badge, Card, Empty, Field, Flash, PageHeader, StatCard } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { deleteBulkStock, saveBulkStock } from "@/actions/bulk-stock";
import { requireAccess } from "@/lib/session";
import { ExportMenu } from "@/components/export-menu";

export const metadata: Metadata = { title: "Stok Bahan Baku" };

type Row = { id: number; production_code: string; product_name: string; untested_kg: number; testing_kg: number; ready_kg: number; packing: string; note: string; updated_at: string; product_id: number | null; variety: string | null };
type MoveRow = { id: number; move_date: string; bucket: string; kg: number; ref_type: string; ref_id: number; note: string; production_code: string };
const BUCKETS: Record<string, string> = { untested_kg: "belum uji", testing_kg: "proses uji", ready_kg: "siap jual" };

const kg = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n || 0);

export default async function BulkStockPage({ searchParams }: PageProps<"/stok-bahan">) {
  await requireAccess("stok_bahan");
  const sp = await searchParams;
  const rows = await all<Row>("SELECT b.*, p.name variety FROM bulk_stock b LEFT JOIN products p ON p.id = b.product_id ORDER BY b.id");
  const products = await all<{ id: number; name: string }>("SELECT id, name FROM products WHERE active = 1 ORDER BY name");
  const moves = await all<MoveRow>("SELECT m.*, b.production_code FROM bulk_moves m JOIN bulk_stock b ON b.id = m.stock_id ORDER BY m.id DESC LIMIT 25");
  const unmapped = rows.filter((r) => !r.product_id && r.untested_kg + r.testing_kg + r.ready_kg > 0).length;
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

      {unmapped > 0 && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>{unmapped} kode produksi</b> yang masih ada stoknya belum dipasangkan ke varietas. Penjualan bulky hanya mengurangi stok kode yang sudah dipasangkan; pasangkan lewat “Ubah stok”.
        </div>
      )}
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
                              <label className="col-span-3 text-[11px] text-muted">
                                Varietas (untuk penjualan bulky)
                                <select name="product_id" defaultValue={r.product_id ?? ""} className="input py-1 text-xs">
                                  <option value="">— belum dipasangkan —</option>
                                  {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
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
                          <div className="text-xs">{r.variety ? <span className="text-muted">Varietas: {r.variety}</span> : <span className="text-amber-700">Belum dipasangkan ke varietas</span>}</div>
                          {(r.note || r.packing) && <div className="text-xs text-muted">{[r.packing && `Packing: ${r.packing}`, r.note].filter(Boolean).join(" · ")}</div>}
                        </td>
                        <td className="num align-top">{r.untested_kg ? kg(r.untested_kg) : ""}</td>
                        <td className="num align-top">{r.testing_kg ? <Badge tone="amber">{kg(r.testing_kg)}</Badge> : ""}</td>
                        <td className="num align-top">{r.ready_kg ? <span className={`font-medium ${r.ready_kg < 0 ? "text-red-700" : "text-emerald-700"}`}>{kg(r.ready_kg)}</span> : ""}</td>
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

        <div className="space-y-5">
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
            <Field label="Varietas (untuk penjualan bulky)">
              <select name="product_id" defaultValue="" className="input">
                <option value="">— belum dipasangkan —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <SubmitButton className="btn-primary w-full">Simpan</SubmitButton>
            <p className="text-xs text-muted">Stok di sini adalah bahan baku curah dalam kg. Stok kemasan siap kirim tetap dicatat per lot di menu Gudang & Lot.</p>
          </form>
        </Card>
        <Card title="Perubahan otomatis terakhir" className="overflow-hidden">
          {moves.length ? (
            <ul className="divide-y divide-line text-xs">
              {moves.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 px-5 py-2.5">
                  <span className="min-w-0">
                    <span className="font-mono font-semibold">{m.production_code}</span> <span className="text-muted">· {tanggal(m.move_date)} · {BUCKETS[m.bucket] ?? m.bucket}</span>
                    <span className="block truncate text-muted">
                      {m.ref_type === "so" ? (
                        <Link href={`/penjualan/${m.ref_id}`} className="text-brand-700 hover:underline">
                          {m.note}
                        </Link>
                      ) : (
                        m.note
                      )}
                    </span>
                  </span>
                  <span className={`shrink-0 font-semibold tabular-nums ${m.kg < 0 ? "text-red-700" : "text-emerald-700"}`}>
                    {m.kg > 0 ? "+" : ""}
                    {kg(m.kg)} kg
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Belum ada. Benih masuk internal di buku induk menambah “proses uji”; penjualan bulky yang dikirim mengurangi “siap jual”.</Empty>
          )}
        </Card>
        </div>
      </div>
    </>
  );
}
