import "server-only";
import { all } from "./db";

const VALID = "so.status NOT IN ('draft','batal') AND so.order_date BETWEEN ? AND ?";

export async function salesByProduct(from: string, to: string) {
  return await all<{ sku: string; name: string; crop: string; category: string; qty: number; revenue: number; orders: number }>(
    `SELECT p.sku, p.name, p.crop, p.category, SUM(i.qty) qty, SUM(i.qty * i.price) revenue, COUNT(DISTINCT so.id) orders
     FROM so_items i JOIN sales_orders so ON so.id = i.so_id JOIN products p ON p.id = i.product_id
     WHERE ${VALID} GROUP BY p.id ORDER BY revenue DESC`,
    from,
    to,
  );
}

export async function salesByCustomer(from: string, to: string) {
  return await all<{ code: string; name: string; kind: string; city: string; orders: number; revenue: number; outstanding: number }>(
    `SELECT c.code, c.name, c.kind, c.city, COUNT(*) orders, SUM(so.total) revenue,
            SUM(CASE WHEN so.invoice_no IS NOT NULL THEN so.total - so.paid ELSE 0 END) outstanding
     FROM sales_orders so JOIN customers c ON c.id = so.customer_id
     WHERE ${VALID} GROUP BY c.id ORDER BY revenue DESC`,
    from,
    to,
  );
}

export async function salesByMonth(from: string, to: string) {
  return await all<{ month: string; orders: number; revenue: number; paid: number }>(
    `SELECT substr(so.order_date,1,7) AS month, COUNT(*) orders, SUM(so.total) revenue, SUM(so.paid) paid
     FROM sales_orders so WHERE ${VALID} GROUP BY month ORDER BY month`,
    from,
    to,
  );
}

export async function salesByCity(from: string, to: string) {
  return await all<{ city: string; orders: number; revenue: number }>(
    `SELECT COALESCE(NULLIF(c.city,''),'(tanpa kota)') city, COUNT(*) orders, SUM(so.total) revenue
     FROM sales_orders so JOIN customers c ON c.id = so.customer_id WHERE ${VALID} GROUP BY 1 ORDER BY revenue DESC`,
    from,
    to,
  );
}

export async function salesLines(from: string, to: string) {
  return await all<Record<string, string | number | null>>(
    `SELECT so.so_no, so.order_date, so.status, so.invoice_no, c.name customer, c.city, p.sku, p.name product, i.qty, i.price, i.qty * i.price amount
     FROM so_items i JOIN sales_orders so ON so.id = i.so_id JOIN customers c ON c.id = so.customer_id JOIN products p ON p.id = i.product_id
     WHERE ${VALID} ORDER BY so.order_date, so.so_no`,
    from,
    to,
  );
}

export async function stockByLot() {
  return await all<Record<string, string | number | null>>(
    `SELECT l.lot_no, p.sku, p.name product, l.qty_initial, l.qty_available, l.germination, l.purity, l.moisture, l.prod_date, l.expiry_date, l.location
     FROM lots l JOIN products p ON p.id = l.product_id WHERE l.qty_available > 0 ORDER BY p.name, l.expiry_date`,
  );
}

/* ------------------------------ Laporan divisi operasional ------------------------------ */

type Rows = Record<string, string | number | null>[];

/** Detail penjualan tanpa nilai rupiah (untuk Marketing). */
export async function salesQtyLines(from: string, to: string) {
  return await all<Record<string, string | number | null>>(
    `SELECT so.so_no, so.order_date, so.status, c.name customer, c.city, p.sku, p.name product, i.qty
     FROM so_items i JOIN sales_orders so ON so.id = i.so_id JOIN customers c ON c.id = so.customer_id JOIN products p ON p.id = i.product_id
     WHERE ${VALID} ORDER BY so.order_date, so.so_no`,
    from,
    to,
  );
}

export async function productionReport(from: string, to: string) {
  return await all<{ name: string; batches: number; berjalan: number; lulus: number; gagal: number; area_ha: number; harvest_kg: number }>(
    `SELECT p.name, COUNT(*) batches,
            COUNT(*) FILTER (WHERE pr.status IN ('tanam','panen','prosesing','uji_lab')) berjalan,
            COUNT(*) FILTER (WHERE pr.status = 'lulus') lulus,
            COUNT(*) FILTER (WHERE pr.status = 'gagal') gagal,
            COALESCE(SUM(pr.area_ha),0) area_ha, COALESCE(SUM(pr.harvest_kg),0) harvest_kg
     FROM productions pr JOIN products p ON p.id = pr.product_id
     WHERE pr.plant_date BETWEEN ? AND ? GROUP BY p.id ORDER BY batches DESC, p.name`,
    from,
    to,
  );
}

export async function productionLines(from: string, to: string): Promise<Rows> {
  return await all(
    `SELECT pr.code, p.name product, g.name petani, pr.area_ha, pr.plant_date, pr.est_harvest, pr.harvest_kg, pr.status
     FROM productions pr JOIN products p ON p.id = pr.product_id LEFT JOIN growers g ON g.id = pr.grower_id
     WHERE pr.plant_date BETWEEN ? AND ? ORDER BY pr.plant_date`,
    from,
    to,
  );
}

export async function qcReport(from: string, to: string) {
  return await all<{ name: string; tests: number; lulus: number; gagal: number; avg_dk: number; min_dk: number }>(
    `SELECT p.name, COUNT(*) tests, COUNT(*) FILTER (WHERE t.result = 'lulus') lulus, COUNT(*) FILTER (WHERE t.result = 'gagal') gagal,
            ROUND(AVG(t.germination)::numeric, 1) avg_dk, MIN(t.germination) min_dk
     FROM lot_tests t JOIN lots l ON l.id = t.lot_id JOIN products p ON p.id = l.product_id
     WHERE t.test_date BETWEEN ? AND ? GROUP BY p.id ORDER BY tests DESC`,
    from,
    to,
  );
}

export async function qcLines(from: string, to: string): Promise<Rows> {
  return await all(
    `SELECT t.test_date, l.lot_no, p.name product, t.germination, t.purity, t.moisture, t.result, t.note, u.name penguji
     FROM lot_tests t JOIN lots l ON l.id = t.lot_id JOIN products p ON p.id = l.product_id LEFT JOIN users u ON u.id = t.tested_by
     WHERE t.test_date BETWEEN ? AND ? ORDER BY t.test_date`,
    from,
    to,
  );
}

export async function stockMovementReport(from: string, to: string) {
  return await all<{ name: string; masuk: number; keluar: number; penyesuaian: number; retur: number }>(
    `SELECT p.name,
            COALESCE(SUM(m.qty) FILTER (WHERE m.kind = 'masuk'),0) masuk,
            COALESCE(-SUM(m.qty) FILTER (WHERE m.kind = 'keluar'),0) keluar,
            COALESCE(SUM(m.qty) FILTER (WHERE m.kind = 'penyesuaian'),0) penyesuaian,
            COALESCE(SUM(m.qty) FILTER (WHERE m.kind = 'retur'),0) retur
     FROM stock_moves m JOIN products p ON p.id = m.product_id
     WHERE substr(m.created_at,1,10) BETWEEN ? AND ? GROUP BY p.id ORDER BY keluar DESC, masuk DESC`,
    from,
    to,
  );
}

export async function complaintReport(from: string, to: string) {
  const byCategory = await all<{ category: string; total: number; terbuka: number; avg_days: number | null }>(
    `SELECT category, COUNT(*) total, COUNT(*) FILTER (WHERE status <> 'selesai') terbuka,
            ROUND(AVG((closed_at::date - report_date::date)) FILTER (WHERE closed_at IS NOT NULL), 1) avg_days
     FROM complaints WHERE report_date BETWEEN ? AND ? GROUP BY category ORDER BY total DESC`,
    from,
    to,
  );
  const byProduct = await all<{ name: string; total: number }>(
    `SELECT COALESCE(p.name,'(tidak diketahui)') name, COUNT(*) total FROM complaints k LEFT JOIN products p ON p.id = k.product_id
     WHERE k.report_date BETWEEN ? AND ? GROUP BY 1 ORDER BY total DESC LIMIT 10`,
    from,
    to,
  );
  return { byCategory, byProduct };
}

export async function complaintLines(from: string, to: string): Promise<Rows> {
  return await all(
    `SELECT k.code, k.report_date, c.name customer, p.name product, l.lot_no, k.category, k.severity, k.status, k.root_cause, k.action_taken, k.closed_at
     FROM complaints k LEFT JOIN customers c ON c.id = k.customer_id LEFT JOIN products p ON p.id = k.product_id LEFT JOIN lots l ON l.id = k.lot_id
     WHERE k.report_date BETWEEN ? AND ? ORDER BY k.report_date`,
    from,
    to,
  );
}

export async function mutuReport(from: string, to: string) {
  const audits = await all<{ audit_type: string; total: number; selesai: number }>(
    `SELECT audit_type, COUNT(*) total, COUNT(*) FILTER (WHERE status = 'selesai') selesai
     FROM audits WHERE start_date BETWEEN ? AND ? GROUP BY audit_type ORDER BY total DESC`,
    from,
    to,
  );
  const byDivision = await all<{ division: string; total: number; mayor: number; minor: number; terbuka: number; telat: number; avg_days: number | null }>(
    `SELECT division, COUNT(*) total,
            COUNT(*) FILTER (WHERE category = 'mayor') mayor, COUNT(*) FILTER (WHERE category = 'minor') minor,
            COUNT(*) FILTER (WHERE status <> 'ditutup') terbuka,
            COUNT(*) FILTER (WHERE status <> 'ditutup' AND due_date < to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')) telat,
            ROUND(AVG((closed_at::date - substr(created_at,1,10)::date)) FILTER (WHERE closed_at IS NOT NULL), 1) avg_days
     FROM findings WHERE substr(created_at,1,10) BETWEEN ? AND ? GROUP BY division ORDER BY total DESC`,
    from,
    to,
  );
  const byClause = await all<{ clause: string; total: number }>(
    `SELECT COALESCE(NULLIF(clause,''),'(tanpa klausul)') clause, COUNT(*) total FROM findings
     WHERE substr(created_at,1,10) BETWEEN ? AND ? GROUP BY 1 ORDER BY total DESC LIMIT 10`,
    from,
    to,
  );
  return { audits, byDivision, byClause };
}

export async function findingLines(from: string, to: string): Promise<Rows> {
  return await all(
    `SELECT f.code, a.code audit, a.title audit_judul, f.clause, f.division, f.category, f.description, f.root_cause, f.corrective_action,
            f.due_date, f.status, f.verification, f.closed_at
     FROM findings f LEFT JOIN audits a ON a.id = f.audit_id WHERE substr(f.created_at,1,10) BETWEEN ? AND ? ORDER BY f.code`,
    from,
    to,
  );
}

export async function sdmReport() {
  return await all<{ division: string; aktif: number; nonaktif: number; akun: number }>(
    `SELECT d.division,
            (SELECT COUNT(*) FROM employees e WHERE e.division = d.division AND e.status = 'aktif') aktif,
            (SELECT COUNT(*) FROM employees e WHERE e.division = d.division AND e.status <> 'aktif') nonaktif,
            (SELECT COUNT(*) FROM users u WHERE u.role = d.division AND u.active = 1) akun
     FROM (SELECT DISTINCT division FROM employees UNION SELECT DISTINCT role FROM users) d ORDER BY 1`,
  );
}

export async function sdmLines(): Promise<Rows> {
  return await all("SELECT name, division, position, email, phone, join_date, status FROM employees ORDER BY division, name");
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\r\n");
}
