import "server-only";
import { all } from "./db";

const VALID = "so.status NOT IN ('draft','batal') AND so.order_date BETWEEN ? AND ?";

export function salesByProduct(from: string, to: string) {
  return all<{ sku: string; name: string; crop: string; category: string; qty: number; revenue: number; orders: number }>(
    `SELECT p.sku, p.name, p.crop, p.category, SUM(i.qty) qty, SUM(i.qty * i.price) revenue, COUNT(DISTINCT so.id) orders
     FROM so_items i JOIN sales_orders so ON so.id = i.so_id JOIN products p ON p.id = i.product_id
     WHERE ${VALID} GROUP BY p.id ORDER BY revenue DESC`,
    from,
    to,
  );
}

export function salesByCustomer(from: string, to: string) {
  return all<{ code: string; name: string; kind: string; city: string; orders: number; revenue: number; outstanding: number }>(
    `SELECT c.code, c.name, c.kind, c.city, COUNT(*) orders, SUM(so.total) revenue,
            SUM(CASE WHEN so.invoice_no IS NOT NULL THEN so.total - so.paid ELSE 0 END) outstanding
     FROM sales_orders so JOIN customers c ON c.id = so.customer_id
     WHERE ${VALID} GROUP BY c.id ORDER BY revenue DESC`,
    from,
    to,
  );
}

export function salesByMonth(from: string, to: string) {
  return all<{ month: string; orders: number; revenue: number; paid: number }>(
    `SELECT substr(so.order_date,1,7) month, COUNT(*) orders, SUM(so.total) revenue, SUM(so.paid) paid
     FROM sales_orders so WHERE ${VALID} GROUP BY month ORDER BY month`,
    from,
    to,
  );
}

export function salesByCity(from: string, to: string) {
  return all<{ city: string; orders: number; revenue: number }>(
    `SELECT COALESCE(NULLIF(c.city,''),'(tanpa kota)') city, COUNT(*) orders, SUM(so.total) revenue
     FROM sales_orders so JOIN customers c ON c.id = so.customer_id WHERE ${VALID} GROUP BY city ORDER BY revenue DESC`,
    from,
    to,
  );
}

export function salesLines(from: string, to: string) {
  return all<Record<string, string | number | null>>(
    `SELECT so.so_no, so.order_date, so.status, so.invoice_no, c.name customer, c.city, p.sku, p.name product, i.qty, i.price, i.qty * i.price amount
     FROM so_items i JOIN sales_orders so ON so.id = i.so_id JOIN customers c ON c.id = so.customer_id JOIN products p ON p.id = i.product_id
     WHERE ${VALID} ORDER BY so.order_date, so.so_no`,
    from,
    to,
  );
}

export function stockByLot() {
  return all<Record<string, string | number | null>>(
    `SELECT l.lot_no, p.sku, p.name product, l.qty_initial, l.qty_available, l.germination, l.purity, l.moisture, l.prod_date, l.expiry_date, l.location
     FROM lots l JOIN products p ON p.id = l.product_id WHERE l.qty_available > 0 ORDER BY p.name, l.expiry_date`,
  );
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
