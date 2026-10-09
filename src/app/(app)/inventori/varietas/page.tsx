import Link from "next/link";
import type { Metadata } from "next";
import { all } from "@/lib/db";
import { packStock, productStock } from "@/lib/inventory";
import { addDays, daysUntil, num, rupiah, tanggal, today } from "@/lib/format";
import { Badge, Card, Field, Flash, PageHeader, StatCard } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { createLotAction, deleteLot, deleteVariety, sendLowStockAlert } from "@/actions/inventory";
import { can, requireAccess } from "@/lib/session";
import { ExportMenu } from "@/components/export-menu";

export const metadata: Metadata = { title: "Stok Varietas" };

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
  used: boolean;
  docs: number;
};

const VARIETAS = "/inventori/varietas";
const STATUS: Record<string, string> = { rendah: "Rendah", kosong: "Kosong", aman: "Aman" };
const stockStatus = (p: { stock: number; min_stock: number }) => (p.min_stock > 0 && p.stock < p.min_stock ? "rendah" : p.stock === 0 ? "kosong" : "aman");

/** Gudang & Lot → Stok Varietas: stok per varietas & kemasan, daftar lot (FEFO), dan terima lot baru. */
export default async function InventoryPage({ searchParams }: PageProps<"/inventori/varietas">) {
  const user = await requireAccess("inventori");
  const sp = await searchParams;
  const one = (k: string) => String((Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "").trim();
  // Saringan Stok per varietas: cari (nama/komoditas/SKU), komoditas, status, termasuk nonaktif.
  const q = one("q").toLowerCase();
  const crop = one("crop");
  const status = one("status") in STATUS ? one("status") : "";
  const inactive = one("nonaktif") === "1";
  // Saringan Daftar lot: varietas, cari no. lot, lokasi, kadaluarsa, termasuk habis.
  const productFilter = Number(one("product")) || 0;
  const showEmpty = one("all") === "1";
  const lq = one("lq");
  const loc = one("loc");
  const exp = ["kadaluarsa", "90"].includes(one("exp")) ? one("exp") : "";
  const t = today();
  const [allStock, packs, lots, locations] = await Promise.all([
    productStock(inactive ? "1=1" : "p.active = 1"),
    packStock(),
    all<LotRow>(
      `SELECT l.*, p.name,
         EXISTS (SELECT 1 FROM so_allocations a WHERE a.lot_id = l.id) used,
         (SELECT COUNT(*) FROM attachments x WHERE x.ref_type = 'lot' AND x.ref_id = l.id)::int docs
       FROM lots l JOIN products p ON p.id = l.product_id
       WHERE (? = 0 OR l.product_id = ?) AND (? = 1 OR l.qty_available > 0)
         AND (? = '' OR l.lot_no ILIKE ? OR p.name ILIKE ?)
         AND (? = '' OR l.location = ?)
         AND (? = '' OR (? = 'kadaluarsa' AND l.expiry_date < ?) OR (? = '90' AND l.expiry_date BETWEEN ? AND ?))
       ORDER BY l.expiry_date`,
      productFilter, productFilter, showEmpty ? 1 : 0,
      lq, `%${lq}%`, `%${lq}%`,
      loc, loc,
      exp, exp, t, exp, t, addDays(t, 90),
    ),
    all<{ location: string }>("SELECT DISTINCT location FROM lots WHERE location <> '' ORDER BY 1"),
  ]);
  const stock = allStock.filter((p) => p.active || inactive);
  const shown = stock.filter(
    (p) =>
      (!q || [p.name, p.crop, p.sku].some((v) => String(v ?? "").toLowerCase().includes(q))) &&
      (!crop || p.crop === crop) &&
      (!status || stockStatus(p) === status),
  );
  const crops = [...new Set(stock.map((p) => p.crop).filter(Boolean))].sort();
  // Parameter saringan tabel lain ikut dibawa saat menyaring satu tabel.
  const keep = (keys: string[]) =>
    keys.map((k) => (one(k) ? <input key={k} type="hidden" name={k} value={one(k)} /> : null));
  const stockKeys = ["q", "crop", "status", "nonaktif"];
  const lotKeys = ["product", "all", "lq", "loc", "exp"];
  const filteredStock = !!(q || crop || status || inactive);
  const filteredLots = !!(productFilter || showEmpty || lq || loc || exp);
  const value = stock.filter((p) => p.active).reduce((s, p) => s + p.stock * p.unit_price, 0);
  const low = stock.filter((p) => p.min_stock > 0 && p.stock < p.min_stock);
  const expired = lots.filter((l) => l.expiry_date < t && l.qty_available > 0);

  return (
    <>
      <PageHeader
        title="Stok Varietas"
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
        <form className="flex flex-wrap items-end gap-2 border-b border-line px-4 py-3">
          {keep(lotKeys)}
          <input name="q" defaultValue={one("q")} placeholder="Cari varietas, komoditas, SKU…" className="input w-56 py-1 text-sm" />
          <select name="crop" defaultValue={crop} className="input w-auto py-1 text-sm" aria-label="Komoditas">
            <option value="">Semua komoditas</option>
            {crops.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status} className="input w-auto py-1 text-sm" aria-label="Status stok">
            <option value="">Semua status</option>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 pb-1.5 text-xs text-muted">
            <input type="checkbox" name="nonaktif" value="1" defaultChecked={inactive} /> termasuk yang disembunyikan
          </label>
          <button className="btn-secondary btn-sm">Saring</button>
          {filteredStock && (
            <Link href={`${VARIETAS}?${new URLSearchParams(Object.fromEntries(lotKeys.filter(one).map((k) => [k, one(k)])))}`} className="pb-1.5 text-xs text-brand-700 hover:underline">
              Hapus saringan
            </Link>
          )}
          <span className="ml-auto pb-1.5 text-xs text-muted">
            {shown.length} dari {stock.length} varietas
          </span>
        </form>
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
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const avail = p.stock - p.reserved;
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`${VARIETAS}/${p.id}`} className="font-semibold text-brand-800 hover:underline">
                        {p.name}
                      </Link>
                      {!p.active && (
                        <>
                          {" "}
                          <Badge>Disembunyikan</Badge>
                        </>
                      )}
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
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`${VARIETAS}?product=${p.id}#lot`} className="btn-secondary btn-sm" title="Lihat lot varietas ini">
                          Lot
                        </Link>
                        <Link href={`${VARIETAS}/${p.id}`} className="btn-secondary btn-sm">
                          Ubah
                        </Link>
                        <form action={deleteVariety}>
                          <input type="hidden" name="id" value={p.id} />
                          <SubmitButton className="btn-danger btn-sm" confirm={`Hapus varietas ${p.name}? Bila sudah punya riwayat lot/pesanan, varietas hanya disembunyikan.`}>
                            Hapus
                          </SubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!shown.length && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-sm text-muted">
                    Tidak ada varietas yang cocok dengan saringan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Daftar lot"
        className="mb-5 scroll-mt-6 overflow-hidden"
      >
        <form id="lot" action={`${VARIETAS}#lot`} className="flex scroll-mt-6 flex-wrap items-end gap-2 border-b border-line px-4 py-3">
          {keep(stockKeys)}
          <input name="lq" defaultValue={lq} placeholder="Cari no. lot / varietas…" className="input w-52 py-1 text-sm" />
          <select name="product" defaultValue={productFilter || ""} className="input w-auto py-1 text-sm" aria-label="Varietas">
            <option value="">Semua varietas</option>
            {stock.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select name="loc" defaultValue={loc} className="input w-auto py-1 text-sm" aria-label="Lokasi">
            <option value="">Semua lokasi</option>
            {locations.map((l) => (
              <option key={l.location} value={l.location}>
                {l.location}
              </option>
            ))}
          </select>
          <select name="exp" defaultValue={exp} className="input w-auto py-1 text-sm" aria-label="Kadaluarsa">
            <option value="">Semua kadaluarsa</option>
            <option value="90">Kadaluarsa ≤ 90 hari</option>
            <option value="kadaluarsa">Sudah kadaluarsa</option>
          </select>
          <label className="flex items-center gap-1 pb-1.5 text-xs text-muted">
            <input type="checkbox" name="all" value="1" defaultChecked={showEmpty} /> termasuk habis
          </label>
          <button className="btn-secondary btn-sm">Saring</button>
          {filteredLots && (
            <Link href={`${VARIETAS}?${new URLSearchParams(Object.fromEntries(stockKeys.filter(one).map((k) => [k, one(k)])))}#lot`} className="pb-1.5 text-xs text-brand-700 hover:underline">
              Hapus saringan
            </Link>
          )}
          <span className="ml-auto pb-1.5 text-xs text-muted">{lots.length} lot</span>
        </form>
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
                <th />
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
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/inventori/${l.id}#ubah`} className="btn-secondary btn-sm">
                          Ubah
                        </Link>
                        {!l.used && !l.docs && (
                          <form action={deleteLot}>
                            <input type="hidden" name="lot_id" value={l.id} />
                            <input type="hidden" name="back" value={VARIETAS} />
                            <SubmitButton className="btn-danger btn-sm" confirm={`Hapus lot ${l.lot_no} (sisa ${l.qty_available} kemasan)? Tidak bisa dibatalkan.`}>
                              Hapus
                            </SubmitButton>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!lots.length && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-sm text-muted">
                    Tidak ada lot yang cocok dengan saringan.
                  </td>
                </tr>
              )}
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
