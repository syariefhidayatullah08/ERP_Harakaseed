import Link from "next/link";
import type { Metadata } from "next";
import { all } from "@/lib/db";
import { packStock, productStock } from "@/lib/inventory";
import { daysUntil, num, rupiah, tanggal, today } from "@/lib/format";
import { Badge, Card, Field, Flash, PageHeader, StatCard } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { createLotAction, sendLowStockAlert } from "@/actions/inventory";
import { can, requireAccess } from "@/lib/session";
import { ExportMenu } from "@/components/export-menu";

export const metadata: Metadata = { title: "Inventori" };

type LotRow = {
  id: number;
  lot_no: string;
  name: string;
  pack_size: string;
  qty_initial: number;
  qty_available: number;
  germination: number;
  purity: number;
  prod_date: string;
  expiry_date: string;
  location: string;
};

export default async function InventoryPage({ searchParams }: PageProps<"/inventori">) {
  const user = await requireAccess("inventori");
  const sp = await searchParams;
  const productFilter = Number(sp.product ?? 0);
  const showEmpty = sp.all === "1";
  const stock = await productStock("p.active = 1");
  const packs = await packStock();
  const lots = await all<LotRow>(
    `SELECT l.*, p.name FROM lots l JOIN products p ON p.id = l.product_id
     WHERE (? = 0 OR l.product_id = ?) AND (? = 1 OR l.qty_available > 0)
     ORDER BY l.expiry_date`,
    productFilter,
    productFilter,
    showEmpty ? 1 : 0,
  );
  const value = stock.reduce((s, p) => s + p.stock * p.unit_price, 0);
  const low = stock.filter((p) => p.min_stock > 0 && p.stock < p.min_stock);
  const expired = lots.filter((l) => l.expiry_date < today() && l.qty_available > 0);

  return (
    <>
      <PageHeader
        title="Inventori & Lot Benih"
        subtitle="Stok dihitung per lot (FEFO — lot yang kadaluarsa lebih dulu dikirim lebih dulu)"
        actions={
          <>
            <form action={sendLowStockAlert}>
              <SubmitButton className="btn-secondary" pendingText="Mengirim…">
                Email peringatan stok
              </SubmitButton>
            </form>
            <a href="#lot-baru" className="btn-accent">
              + Terima lot
            </a>
          </>
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {can(user, "keuangan") ? <StatCard label="Nilai stok (harga jual)" value={rupiah(value)} /> : <StatCard label="Varietas berstok" value={stock.filter((p) => p.stock > 0).length} />}
        <StatCard label="Total kemasan" value={num(stock.reduce((s, p) => s + p.stock, 0))} hint={`${stock.length} varietas aktif`} />
        <StatCard label="Di bawah minimum" value={low.length} tone={low.length ? "danger" : "default"} />
        <StatCard label="Lot kadaluarsa (masih ada sisa)" value={expired.length} tone={expired.length ? "warn" : "default"} hint="Tidak dihitung sebagai stok jual" />
      </div>

      <Card title="Stok per varietas" className="mb-5 overflow-hidden" actions={<ExportMenu type="stok-varietas" compact />}>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Varietas</th>
                <th>Kemasan</th>
                <th className="num">Stok</th>
                <th className="num">Dipesan</th>
                <th className="num">Tersedia</th>
                <th className="num">Minimum</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((p) => {
                const avail = p.stock - p.reserved;
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/produk/${p.id}`} className="font-semibold text-brand-800 hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-xs text-muted">{p.crop}</div>
                    </td>
                    <td>{p.pack_size || "—"}</td>
                    <td className="num">{num(p.stock)}</td>
                    <td className="num text-muted">{num(p.reserved)}</td>
                    <td className={`num font-semibold ${avail < 0 ? "text-red-700" : ""}`}>{num(avail)}</td>
                    <td className="num text-muted">{num(p.min_stock)}</td>
                    <td>
                      {p.min_stock > 0 && p.stock < p.min_stock ? <Badge tone="red">Rendah</Badge> : p.stock === 0 ? <Badge>Kosong</Badge> : <Badge tone="green">Aman</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Daftar lot"
        className="mb-5 overflow-hidden"
        actions={
          <form className="flex items-center gap-2">
            <select name="product" defaultValue={productFilter || ""} className="input py-1 text-xs">
              <option value="">Semua produk</option>
              {stock.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-muted">
              <input type="checkbox" name="all" value="1" defaultChecked={showEmpty} /> termasuk habis
            </label>
            <button className="btn-secondary btn-sm">Filter</button>
          </form>
        }
      >
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>No. Lot</th>
                <th>Produk</th>
                <th className="num">Sisa / Awal</th>
                <th className="num">Kecambah</th>
                <th className="num">Kemurnian</th>
                <th>Produksi</th>
                <th>Kadaluarsa</th>
                <th>Lokasi</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((l) => {
                const d = daysUntil(l.expiry_date);
                return (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/inventori/${l.id}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">
                        {l.lot_no}
                      </Link>
                    </td>
                    <td>
                      {l.name} <span className="text-xs text-muted">· {l.pack_size}</span>
                    </td>
                    <td className="num">
                      <b>{num(l.qty_available)}</b> <span className="text-muted">/ {num(l.qty_initial)}</span>
                    </td>
                    <td className="num">{l.germination}%</td>
                    <td className="num">{l.purity}%</td>
                    <td className="whitespace-nowrap text-muted">{tanggal(l.prod_date)}</td>
                    <td className="whitespace-nowrap">
                      {tanggal(l.expiry_date)}{" "}
                      {d < 0 ? <Badge tone="red">Kadaluarsa</Badge> : d <= 90 ? <Badge tone="amber">{d} hr</Badge> : null}
                    </td>
                    <td className="text-muted">{l.location}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Terima lot baru" className="scroll-mt-6">
        <form id="lot-baru" action={createLotAction} className="grid gap-4 p-5 sm:grid-cols-4">
          <Field label="Produk *" className="sm:col-span-2">
            <select name="product_pack" required defaultValue="" className="input">
              <option value="" disabled>
                Pilih varietas & gramasi…
              </option>
              {stock
                .filter((p) => !productFilter || p.id === productFilter)
                .flatMap((p) =>
                  packs
                    .filter((k) => k.product_id === p.id)
                    .map((k) => (
                      <option key={k.id} value={`${p.id}|${k.pack_size}`}>
                        {p.name} — {p.crop} · {k.pack_size}
                      </option>
                    )),
                )}
            </select>
          </Field>
          <Field label="No. lot *">
            <input name="lot_no" required className="input font-mono uppercase" placeholder="L2026xxx-KNT" />
          </Field>
          <Field label="Qty (kemasan) *">
            <input name="qty" type="number" min={1} required className="input" />
          </Field>
          <Field label="Daya kecambah (%)">
            <input name="germination" type="number" step="0.1" min={0} max={100} defaultValue={85} className="input" />
          </Field>
          <Field label="Kemurnian fisik (%)">
            <input name="purity" type="number" step="0.1" min={0} max={100} defaultValue={98} className="input" />
          </Field>
          <Field label="Kadar air (%)">
            <input name="moisture" type="number" step="0.1" min={0} max={100} defaultValue={7} className="input" />
          </Field>
          <Field label="Lokasi gudang">
            <input name="location" defaultValue="Gudang Jember" className="input" />
          </Field>
          <Field label="Tanggal produksi/kemas *">
            <input name="prod_date" type="date" required defaultValue={today()} className="input" />
          </Field>
          <Field label="Kadaluarsa (kosong = otomatis dari masa simpan)">
            <input name="expiry_date" type="date" className="input" />
          </Field>
          <Field label="Catatan" className="sm:col-span-2">
            <input name="note" className="input" placeholder="mis. hasil re-packing, retur, pembelian" />
          </Field>
          <div className="flex justify-end sm:col-span-4">
            <SubmitButton>Simpan lot</SubmitButton>
          </div>
        </form>
      </Card>
    </>
  );
}
