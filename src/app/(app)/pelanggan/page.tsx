import Link from "next/link";
import type { Metadata } from "next";
import { all } from "@/lib/db";
import { CUSTOMER_KIND, rupiah, tanggal } from "@/lib/format";
import { Badge, Card, Empty, Flash, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Pelanggan" };

export default async function CustomersPage({ searchParams }: PageProps<"/pelanggan">) {
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim();
  const kind = String(sp.kind ?? "");
  const rows = all<{
    id: number; code: string; name: string; kind: string; contact_person: string; email: string; phone: string; city: string;
    orders: number; revenue: number; outstanding: number; last_order: string | null;
  }>(
    `SELECT c.*,
       (SELECT COUNT(*) FROM sales_orders so WHERE so.customer_id = c.id AND so.status NOT IN ('draft','batal')) orders,
       (SELECT COALESCE(SUM(total),0) FROM sales_orders so WHERE so.customer_id = c.id AND so.status NOT IN ('draft','batal')) revenue,
       (SELECT COALESCE(SUM(total - paid),0) FROM sales_orders so WHERE so.customer_id = c.id AND so.invoice_no IS NOT NULL AND so.status != 'batal') outstanding,
       (SELECT MAX(order_date) FROM sales_orders so WHERE so.customer_id = c.id) last_order
     FROM customers c
     WHERE (c.name LIKE ? OR c.city LIKE ? OR c.email LIKE ? OR c.code LIKE ?) AND (? = '' OR c.kind = ?)
     ORDER BY revenue DESC, c.name`,
    `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, kind, kind,
  );

  return (
    <>
      <PageHeader
        title="Pelanggan"
        subtitle="Distributor, toko tani, petani, dan pembeli ekspor"
        actions={
          <Link href="/pelanggan/baru" className="btn-primary">
            + Pelanggan baru
          </Link>
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <form className="mb-5 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Cari nama, kota, email…" className="input max-w-xs" />
        <select name="kind" defaultValue={kind} className="input w-auto">
          <option value="">Semua jenis</option>
          {Object.entries(CUSTOMER_KIND).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="btn-secondary">Cari</button>
      </form>
      <Card className="overflow-hidden">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Pelanggan</th>
                  <th>Jenis</th>
                  <th>Kontak</th>
                  <th className="num">Pesanan</th>
                  <th className="num">Omzet</th>
                  <th className="num">Piutang</th>
                  <th>Order terakhir</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/pelanggan/${c.id}`} className="font-semibold text-brand-800 hover:underline">
                        {c.name}
                      </Link>
                      <div className="text-xs text-muted">
                        {c.code} · {c.city || "—"}
                      </div>
                    </td>
                    <td>
                      <Badge tone={c.kind === "distributor" ? "green" : c.kind === "ekspor" ? "purple" : "blue"}>{CUSTOMER_KIND[c.kind] ?? c.kind}</Badge>
                    </td>
                    <td className="text-xs">
                      <div>{c.contact_person || "—"}</div>
                      <div className={c.email ? "text-muted" : "text-amber-700"}>{c.email || "email belum diisi"}</div>
                    </td>
                    <td className="num">{c.orders}</td>
                    <td className="num font-medium">{rupiah(c.revenue)}</td>
                    <td className={`num ${c.outstanding > 0 ? "font-medium text-amber-700" : "text-muted"}`}>{rupiah(c.outstanding)}</td>
                    <td className="whitespace-nowrap text-muted">{tanggal(c.last_order)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Tidak ada pelanggan yang cocok.</Empty>
        )}
      </Card>
    </>
  );
}
