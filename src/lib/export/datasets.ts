import "server-only";
import { all } from "../db";
import { today } from "../format";
import { hasAny, divisionLabel, type Module } from "../access";
import type { SessionUser } from "../session";
import { CUSTOMER_KIND, PO_STATUS, PRD_STATUS, SO_STATUS } from "../format";
import { ACTIVITY_MODULES } from "../activity";
import { INTAKE_KIND, INTAKE_STATUS, PB_STATUS } from "../seed-payment";
import { CHANNELS, toChannel } from "../sales-channel";
import { cashCategoryLabel } from "../cash";
import {
  complaintLines,
  findingLines,
  productionLines,
  qcLines,
  salesByCustomer,
  salesByProduct,
  salesLines,
  salesQtyLines,
  sdmLines,
  stockByLot,
  stockMovementReport,
} from "../reports";

export type ColType = "text" | "number" | "decimal" | "money" | "date" | "pct";
export type Col = { key: string; label: string; type?: ColType; width?: number };
export type Range = { from: string; to: string };
type Row = Record<string, unknown>;

export type Dataset = {
  title: string;
  need: Module | Module[];
  /** Data dibatasi periode tanggal (dari/sampai). */
  range?: boolean;
  columns: (user: SessionUser) => Col[];
  rows: (r: Range, user: SessionUser) => Promise<Row[]>;
};

const finance = (u: SessionUser) => hasAny(u.modules, "keuangan");
const label = (map: Record<string, { label: string }>) => (v: unknown) => map[String(v)]?.label ?? String(v ?? "");
const mapRows = <T extends Row>(rows: T[], fn: (r: T) => Row) => rows.map(fn);
/** Jenis penjualan & satuan qty-nya (kemasan / kg / lembar). */
const channelInfo = (v: unknown) => ({ channel: CHANNELS[toChannel(v)].label, unit: CHANNELS[toChannel(v)].unit });

/**
 * Semua data yang bisa diunduh (Excel / PDF / Word / CSV). Kunci = ?type= di /api/export.
 * `need` dicek di server; kolom rupiah sensitif hanya ditambahkan untuk pengguna dengan modul keuangan.
 */
export const DATASETS: Record<string, Dataset> = {
  /* ------------------------------- Penjualan ------------------------------- */
  pesanan: {
    title: "Daftar Pesanan Penjualan",
    need: ["penjualan", "keuangan"],
    range: true,
    columns: (u) => [
      { key: "so_no", label: "No. Pesanan", width: 16 },
      { key: "channel", label: "Jenis" },
      { key: "order_date", label: "Tanggal", type: "date" },
      { key: "customer", label: "Pelanggan", width: 28 },
      { key: "city", label: "Kota", width: 16 },
      { key: "status", label: "Status" },
      { key: "total", label: "Total", type: "money" },
      ...(finance(u)
        ? ([
            { key: "invoice_no", label: "No. Invoice", width: 16 },
            { key: "paid", label: "Dibayar", type: "money" },
            { key: "sisa", label: "Sisa", type: "money" },
            { key: "due_date", label: "Jatuh tempo", type: "date" },
          ] as Col[])
        : []),
    ],
    rows: async (r) =>
      mapRows(
        await all<Row & { status: string; total: number; paid: number }>(
          `SELECT so.so_no, so.channel, so.order_date, c.name customer, c.city, so.status, so.total, so.invoice_no, so.paid, so.total - so.paid sisa, so.due_date
           FROM sales_orders so JOIN customers c ON c.id = so.customer_id WHERE so.order_date BETWEEN ? AND ? ORDER BY so.order_date, so.so_no`,
          r.from,
          r.to,
        ),
        (x) => ({ ...x, status: label(SO_STATUS)(x.status), channel: channelInfo(x.channel).channel }),
      ),
  },
  penjualan: {
    title: "Detail Penjualan (jumlah)",
    need: ["penjualan", "keuangan"],
    range: true,
    columns: () => [
      { key: "so_no", label: "No. Pesanan", width: 16 },
      { key: "order_date", label: "Tanggal", type: "date" },
      { key: "status", label: "Status" },
      { key: "customer", label: "Pelanggan", width: 26 },
      { key: "city", label: "Kota", width: 14 },
      { key: "sku", label: "SKU", width: 14 },
      { key: "product", label: "Varietas", width: 18 },
      { key: "channel", label: "Jenis" },
      { key: "pack_size", label: "Gramasi", width: 10 },
      { key: "qty", label: "Qty", type: "decimal" },
      { key: "unit", label: "Satuan", width: 10 },
    ],
    rows: async (r) => mapRows(await salesQtyLines(r.from, r.to), (x) => ({ ...x, status: label(SO_STATUS)(x.status), ...channelInfo(x.channel) })),
  },

  /* -------------------------------- Keuangan -------------------------------- */
  "keuangan-penjualan": {
    title: "Detail Penjualan (rupiah)",
    need: "keuangan",
    range: true,
    columns: () => [
      { key: "so_no", label: "No. Pesanan", width: 16 },
      { key: "invoice_no", label: "No. Invoice", width: 16 },
      { key: "order_date", label: "Tanggal", type: "date" },
      { key: "customer", label: "Pelanggan", width: 26 },
      { key: "city", label: "Kota", width: 14 },
      { key: "product", label: "Varietas", width: 18 },
      { key: "channel", label: "Jenis" },
      { key: "pack_size", label: "Gramasi", width: 10 },
      { key: "qty", label: "Qty", type: "decimal" },
      { key: "unit", label: "Satuan", width: 10 },
      { key: "price", label: "Harga", type: "money" },
      { key: "amount", label: "Jumlah", type: "money" },
    ],
    rows: async (r) => mapRows(await salesLines(r.from, r.to), (x) => ({ ...x, ...channelInfo(x.channel) })),
  },
  "keuangan-produk": {
    title: "Omzet per Varietas",
    need: "keuangan",
    range: true,
    columns: () => [
      { key: "sku", label: "SKU", width: 14 },
      { key: "name", label: "Varietas", width: 18 },
      { key: "crop", label: "Komoditas", width: 22 },
      { key: "category", label: "Kategori", width: 14 },
      { key: "orders", label: "Pesanan", type: "number" },
      { key: "qty", label: "Qty kemasan", type: "number" },
      { key: "revenue", label: "Omzet", type: "money" },
    ],
    rows: (r) => salesByProduct(r.from, r.to),
  },
  "keuangan-pelanggan": {
    title: "Omzet & Piutang per Pelanggan",
    need: "keuangan",
    range: true,
    columns: () => [
      { key: "code", label: "Kode", width: 10 },
      { key: "name", label: "Pelanggan", width: 28 },
      { key: "kind", label: "Jenis", width: 16 },
      { key: "city", label: "Kota", width: 14 },
      { key: "orders", label: "Pesanan", type: "number" },
      { key: "revenue", label: "Omzet", type: "money" },
      { key: "outstanding", label: "Piutang", type: "money" },
    ],
    rows: async (r) => mapRows(await salesByCustomer(r.from, r.to), (x) => ({ ...x, kind: CUSTOMER_KIND[x.kind] ?? x.kind })),
  },
  piutang: {
    title: "Daftar Piutang",
    need: "keuangan",
    columns: () => [
      { key: "invoice_no", label: "No. Invoice", width: 16 },
      { key: "so_no", label: "No. Pesanan", width: 16 },
      { key: "customer", label: "Pelanggan", width: 28 },
      { key: "due_date", label: "Jatuh tempo", type: "date" },
      { key: "telat", label: "Telat (hari)", type: "number" },
      { key: "total", label: "Total", type: "money" },
      { key: "paid", label: "Dibayar", type: "money" },
      { key: "sisa", label: "Sisa", type: "money" },
    ],
    rows: async () =>
      all(
        `SELECT so.invoice_no, so.so_no, c.name customer, so.due_date, GREATEST(0, (?::date - so.due_date::date)) telat,
                so.total, so.paid, so.total - so.paid sisa
         FROM sales_orders so JOIN customers c ON c.id = so.customer_id
         WHERE so.invoice_no IS NOT NULL AND so.status <> 'batal' AND so.paid < so.total ORDER BY so.due_date`,
        today(),
      ),
  },
  pembayaran: {
    title: "Pembayaran Masuk",
    need: "keuangan",
    range: true,
    columns: () => [
      { key: "pay_date", label: "Tanggal", type: "date" },
      { key: "so_no", label: "No. Pesanan", width: 16 },
      { key: "invoice_no", label: "No. Invoice", width: 16 },
      { key: "customer", label: "Pelanggan", width: 28 },
      { key: "method", label: "Metode" },
      { key: "note", label: "Catatan", width: 24 },
      { key: "amount", label: "Jumlah", type: "money" },
    ],
    rows: (r) =>
      all(
        `SELECT p.pay_date, so.so_no, so.invoice_no, c.name customer, p.method, p.note, p.amount FROM payments p
         JOIN sales_orders so ON so.id = p.so_id JOIN customers c ON c.id = so.customer_id WHERE p.pay_date BETWEEN ? AND ? ORDER BY p.pay_date`,
        r.from,
        r.to,
      ),
  },

  /* ------------------------------ Master data ------------------------------ */
  pelanggan: {
    title: "Daftar Pelanggan",
    need: "pelanggan",
    columns: () => [
      { key: "code", label: "Kode", width: 10 },
      { key: "name", label: "Nama", width: 28 },
      { key: "kind", label: "Jenis", width: 16 },
      { key: "contact_person", label: "Kontak", width: 18 },
      { key: "phone", label: "Telepon", width: 15 },
      { key: "email", label: "Email", width: 24 },
      { key: "city", label: "Kota", width: 14 },
      { key: "address", label: "Alamat", width: 30 },
      { key: "payment_terms", label: "Termin (hari)", type: "number" },
    ],
    rows: async () => mapRows(await all<Row & { kind: string }>("SELECT * FROM customers ORDER BY name"), (x) => ({ ...x, kind: CUSTOMER_KIND[x.kind] ?? x.kind })),
  },
  produk: {
    title: "Daftar Produk / Varietas",
    need: "produk",
    columns: () => [
      { key: "sku", label: "SKU", width: 14 },
      { key: "name", label: "Varietas", width: 16 },
      { key: "crop", label: "Komoditas", width: 24 },
      { key: "category", label: "Kategori", width: 14 },
      { key: "seed_type", label: "Tipe", width: 10 },
      { key: "pack_size", label: "Kemasan", width: 10 },
      { key: "unit_price", label: "Harga", type: "money" },
      { key: "min_stock", label: "Stok min.", type: "number" },
      { key: "harvest_age", label: "Umur panen", width: 14 },
      { key: "yield_potential", label: "Potensi hasil", width: 14 },
      { key: "fruit_weight", label: "Bobot buah", width: 12 },
    ],
    rows: () => all("SELECT * FROM products ORDER BY category, name"),
  },
  "stok-varietas": {
    title: "Posisi Stok per Varietas",
    need: ["inventori", "qc"],
    columns: () => [
      { key: "sku", label: "SKU", width: 14 },
      { key: "name", label: "Varietas", width: 16 },
      { key: "pack_size", label: "Kemasan", width: 10 },
      { key: "stock", label: "Stok layak jual", type: "number" },
      { key: "karantina", label: "Karantina", type: "number" },
      { key: "kadaluarsa", label: "Kadaluarsa", type: "number" },
      { key: "min_stock", label: "Stok min.", type: "number" },
    ],
    rows: async () =>
      all(
        `SELECT p.sku, p.name, p.pack_size, p.min_stock,
           COALESCE(SUM(l.qty_available) FILTER (WHERE l.expiry_date >= ? AND l.qc_status = 'lulus'),0) stock,
           COALESCE(SUM(l.qty_available) FILTER (WHERE l.qc_status = 'karantina'),0) karantina,
           COALESCE(SUM(l.qty_available) FILTER (WHERE l.expiry_date < ?),0) kadaluarsa
         FROM products p LEFT JOIN lots l ON l.product_id = p.id WHERE p.active = 1 GROUP BY p.id ORDER BY p.category, p.name`,
        today(),
        today(),
      ),
  },
  stok: {
    title: "Stok per Lot",
    need: ["inventori", "qc"],
    columns: () => [
      { key: "lot_no", label: "No. Lot", width: 18 },
      { key: "sku", label: "SKU", width: 14 },
      { key: "product", label: "Varietas", width: 16 },
      { key: "qty_initial", label: "Awal", type: "number" },
      { key: "qty_available", label: "Sisa", type: "number" },
      { key: "germination", label: "Daya kecambah", type: "pct" },
      { key: "purity", label: "Kemurnian", type: "pct" },
      { key: "moisture", label: "Kadar air", type: "pct" },
      { key: "prod_date", label: "Produksi", type: "date" },
      { key: "expiry_date", label: "Kadaluarsa", type: "date" },
      { key: "location", label: "Lokasi", width: 14 },
    ],
    rows: () => stockByLot(),
  },
  "gudang-pergerakan": {
    title: "Pergerakan Stok per Varietas",
    need: "inventori",
    range: true,
    columns: () => [
      { key: "name", label: "Varietas", width: 18 },
      { key: "masuk", label: "Masuk", type: "number" },
      { key: "keluar", label: "Keluar", type: "number" },
      { key: "penyesuaian", label: "Penyesuaian", type: "number" },
      { key: "retur", label: "Retur", type: "number" },
    ],
    rows: (r) => stockMovementReport(r.from, r.to),
  },
  produksi: {
    title: "Batch Produksi Benih",
    need: "produksi",
    range: true,
    columns: () => [
      { key: "code", label: "Kode", width: 15 },
      { key: "product", label: "Varietas", width: 16 },
      { key: "petani", label: "Petani mitra", width: 20 },
      { key: "area_ha", label: "Luas (ha)", type: "decimal" },
      { key: "plant_date", label: "Tanam", type: "date" },
      { key: "est_harvest", label: "Perkiraan panen", type: "date" },
      { key: "harvest_kg", label: "Panen (kg)", type: "decimal" },
      { key: "status", label: "Status", width: 14 },
    ],
    rows: async (r) => mapRows(await productionLines(r.from, r.to), (x) => ({ ...x, status: label(PRD_STATUS)(x.status) })),
  },
  "stok-bahan": {
    title: "Stok Bahan Baku Benih",
    need: "stok_bahan",
    columns: () => [
      { key: "production_code", label: "Kode Produksi", width: 16 },
      { key: "product_name", label: "Nama Produk", width: 26 },
      { key: "untested_kg", label: "Belum uji (kg)", type: "decimal" },
      { key: "testing_kg", label: "Proses uji (kg)", type: "decimal" },
      { key: "ready_kg", label: "Siap jual (kg)", type: "decimal" },
      { key: "total_kg", label: "Total (kg)", type: "decimal" },
      { key: "packing", label: "Packing (dus)", width: 14 },
      { key: "note", label: "Keterangan", width: 34 },
      { key: "updated_at", label: "Diperbarui", type: "date" },
    ],
    rows: () => all("SELECT *, untested_kg + testing_kg + ready_kg AS total_kg FROM bulk_stock ORDER BY id"),
  },
  kas: {
    title: "Buku Kas",
    need: "kas",
    range: true,
    columns: () => [
      { key: "entry_date", label: "Tanggal", type: "date" },
      { key: "description", label: "Keterangan", width: 44 },
      { key: "category", label: "Kategori", width: 34 },
      { key: "amount_in", label: "Pemasukan", type: "money" },
      { key: "amount_out", label: "Pengeluaran", type: "money" },
      { key: "balance", label: "Saldo", type: "money" },
    ],
    rows: async (r) =>
      mapRows(
        // Saldo berjalan dihitung dari seluruh riwayat, jadi tetap benar walau yang diunduh hanya satu periode.
        await all<Row & { category: string }>(
          `SELECT * FROM (SELECT entry_date, id, description, category, amount_in, amount_out,
                    SUM(amount_in - amount_out) OVER (ORDER BY entry_date, id) AS balance FROM cash_entries) t
           WHERE entry_date >= ? AND entry_date <= ? ORDER BY entry_date, id`,
          r.from,
          r.to,
        ),
        (x) => ({ ...x, category: cashCategoryLabel(x.category) }),
      ),
  },
  pengambilan: {
    title: "Pengambilan Benih di Lahan",
    need: "pengambilan",
    range: true,
    columns: () => [
      { key: "pickup_date", label: "Tanggal ambil", type: "date" },
      { key: "farmer", label: "Petani", width: 24 },
      { key: "location", label: "Lokasi", width: 20 },
      { key: "production_code", label: "Kode Produksi", width: 14 },
      { key: "contract_no", label: "No Kontrak", width: 12 },
      { key: "kg", label: "Bobot (kg)", type: "decimal" },
      { key: "sacks", label: "Karung", type: "number" },
      { key: "officer_name", label: "Petugas", width: 18 },
      { key: "photos", label: "Jumlah foto", type: "number" },
      { key: "status", label: "Buku induk", width: 22 },
      { key: "notes", label: "Catatan", width: 34 },
    ],
    rows: async (r) =>
      mapRows(
        await all<Row & { intake_id: number | null }>(
          `SELECT p.*, (SELECT COUNT(*) FROM attachments a WHERE a.ref_type = 'pickup' AND a.ref_id = p.id) photos
           FROM seed_pickups p WHERE p.pickup_date >= ? AND p.pickup_date <= ? ORDER BY p.pickup_date DESC, p.id DESC`,
          r.from,
          r.to,
        ),
        (x) => ({ ...x, status: x.intake_id ? "Sudah di buku induk" : "Belum masuk buku induk" }),
      ),
  },
  mitra: {
    title: "Petani Mitra",
    need: "mitra",
    columns: () => [
      { key: "name", label: "Nama", width: 22 },
      { key: "village", label: "Desa / Kecamatan", width: 22 },
      { key: "phone", label: "Telepon", width: 15 },
      { key: "area_ha", label: "Lahan (ha)", type: "decimal" },
      { key: "batches", label: "Jumlah batch", type: "number" },
      { key: "harvest", label: "Total panen (kg)", type: "decimal" },
    ],
    rows: () =>
      all(
        `SELECT g.name, g.village, g.phone, g.area_ha, (SELECT COUNT(*) FROM productions p WHERE p.grower_id = g.id) batches,
                (SELECT COALESCE(SUM(harvest_kg),0) FROM productions p WHERE p.grower_id = g.id) harvest FROM growers g ORDER BY g.name`,
      ),
  },
  qc: {
    title: "Hasil Uji Lab / QC",
    need: "qc",
    range: true,
    columns: () => [
      { key: "test_date", label: "Tanggal uji", type: "date" },
      { key: "lot_no", label: "No. Lot", width: 18 },
      { key: "product", label: "Varietas", width: 16 },
      { key: "germination", label: "Daya kecambah", type: "pct" },
      { key: "purity", label: "Kemurnian", type: "pct" },
      { key: "moisture", label: "Kadar air", type: "pct" },
      { key: "result", label: "Hasil" },
      { key: "penguji", label: "Penguji", width: 16 },
      { key: "note", label: "Catatan", width: 26 },
    ],
    rows: (r) => qcLines(r.from, r.to),
  },

  /* ---------------------------------- Mutu ---------------------------------- */
  audit: {
    title: "Daftar Audit",
    need: "mutu",
    range: true,
    columns: () => [
      { key: "code", label: "Kode", width: 14 },
      { key: "title", label: "Judul", width: 30 },
      { key: "audit_type", label: "Jenis", width: 22 },
      { key: "standard", label: "Standar", width: 16 },
      { key: "start_date", label: "Mulai", type: "date" },
      { key: "end_date", label: "Selesai", type: "date" },
      { key: "auditor", label: "Auditor", width: 20 },
      { key: "status", label: "Status" },
      { key: "temuan", label: "Temuan", type: "number" },
    ],
    rows: (r) =>
      all(
        `SELECT a.code, a.title, a.audit_type, a.standard, a.start_date, a.end_date, a.auditor, a.status,
                (SELECT COUNT(*) FROM findings f WHERE f.audit_id = a.id) temuan
         FROM audits a WHERE a.start_date BETWEEN ? AND ? ORDER BY a.start_date`,
        r.from,
        r.to,
      ),
  },
  mutu: {
    title: "Temuan Audit & Tindakan Perbaikan (CAPA)",
    need: "mutu",
    range: true,
    columns: () => [
      { key: "code", label: "No. Temuan", width: 14 },
      { key: "audit", label: "Audit", width: 14 },
      { key: "clause", label: "Klausul", width: 22 },
      { key: "division", label: "Divisi", width: 16 },
      { key: "category", label: "Kategori", width: 12 },
      { key: "description", label: "Uraian", width: 36 },
      { key: "root_cause", label: "Akar masalah", width: 30 },
      { key: "corrective_action", label: "Tindakan korektif", width: 30 },
      { key: "due_date", label: "Tenggat", type: "date" },
      { key: "status", label: "Status" },
      { key: "closed_at", label: "Ditutup", type: "date" },
    ],
    rows: async (r) => mapRows(await findingLines(r.from, r.to), (x) => ({ ...x, division: divisionLabel(String(x.division)) })),
  },
  "dokumen-mutu": {
    title: "Daftar Dokumen Mutu",
    need: "mutu",
    columns: () => [
      { key: "code", label: "Kode", width: 16 },
      { key: "title", label: "Judul", width: 34 },
      { key: "doc_type", label: "Jenis", width: 20 },
      { key: "division", label: "Pemilik", width: 16 },
      { key: "revision", label: "Rev." },
      { key: "effective_date", label: "Berlaku", type: "date" },
      { key: "review_date", label: "Tinjau ulang", type: "date" },
      { key: "status", label: "Status" },
    ],
    rows: async () => mapRows(await all<Row & { division: string }>("SELECT * FROM quality_docs ORDER BY code"), (x) => ({ ...x, division: divisionLabel(x.division) })),
  },
  keluhan: {
    title: "Keluhan Pelanggan",
    need: "keluhan",
    range: true,
    columns: () => [
      { key: "code", label: "Kode", width: 14 },
      { key: "report_date", label: "Tanggal", type: "date" },
      { key: "customer", label: "Pelanggan", width: 24 },
      { key: "product", label: "Varietas", width: 14 },
      { key: "lot_no", label: "Lot", width: 16 },
      { key: "category", label: "Kategori", width: 24 },
      { key: "severity", label: "Tingkat" },
      { key: "status", label: "Status" },
      { key: "root_cause", label: "Akar masalah", width: 28 },
      { key: "action_taken", label: "Tindakan", width: 28 },
      { key: "closed_at", label: "Ditutup", type: "date" },
    ],
    rows: (r) => complaintLines(r.from, r.to),
  },

  /* ------------------------------- Pembelian ------------------------------- */
  pembelian: {
    title: "Purchase Order",
    need: "pembelian",
    range: true,
    columns: () => [
      { key: "po_no", label: "No. PO", width: 16 },
      { key: "order_date", label: "Tanggal", type: "date" },
      { key: "supplier", label: "Supplier", width: 28 },
      { key: "items", label: "Barang", width: 40 },
      { key: "status", label: "Status" },
      { key: "total", label: "Total", type: "money" },
      { key: "received_at", label: "Diterima", type: "date" },
    ],
    rows: async (r) =>
      mapRows(
        await all<Row & { status: string }>(
          `SELECT po.po_no, po.order_date, s.name supplier, po.status, po.total, po.received_at,
                  (SELECT string_agg(i.description || ' (' || i.qty || ' ' || i.unit || ')', '; ') FROM po_items i WHERE i.po_id = po.id) items
           FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id WHERE po.order_date BETWEEN ? AND ? ORDER BY po.order_date`,
          r.from,
          r.to,
        ),
        (x) => ({ ...x, status: label(PO_STATUS)(x.status) }),
      ),
  },
  supplier: {
    title: "Daftar Supplier",
    need: "pembelian",
    columns: () => [
      { key: "name", label: "Nama", width: 30 },
      { key: "category", label: "Kategori", width: 20 },
      { key: "email", label: "Email", width: 24 },
      { key: "phone", label: "Telepon", width: 15 },
      { key: "address", label: "Alamat", width: 30 },
    ],
    rows: () => all("SELECT * FROM suppliers ORDER BY name"),
  },

  /* ------------------------ Pembayaran benih petani ------------------------ */
  "pembayaran-benih": {
    title: "Buku Induk Pembayaran Benih",
    need: "pembayaran_benih",
    range: true,
    columns: () => [
      { key: "kind", label: "Jenis" },
      { key: "company", label: "Perusahaan", width: 20 },
      { key: "received_date", label: "Tgl benih masuk", type: "date" },
      { key: "due_date", label: "Tgl jatuh tempo", type: "date" },
      { key: "farmer", label: "Nama petani", width: 22 },
      { key: "location", label: "Lokasi lahan", width: 16 },
      { key: "officer", label: "Petugas" },
      { key: "contract_no", label: "No kontrak", width: 13 },
      { key: "production_code", label: "Kode produksi", width: 14 },
      { key: "batch_no", label: "No batch" },
      { key: "gross_kg", label: "Bobot awal (kg)", type: "decimal" },
      { key: "net_kg", label: "Bobot bersih (kg)", type: "decimal" },
      { key: "fix_kg", label: "Bobot fix (kg)", type: "decimal" },
      { key: "test_ka", label: "KA" },
      { key: "test_km", label: "KM" },
      { key: "test_db", label: "DB" },
      { key: "loan", label: "Nilai pinjaman", type: "money" },
      { key: "price", label: "Harga petani", type: "money" },
      { key: "deduction", label: "Potongan", type: "money" },
      { key: "amount", label: "Nilai pembayaran", type: "money" },
      { key: "bad_debt", label: "Kredit macet", type: "money" },
      { key: "contract_price", label: "Harga kontrak", type: "money" },
      { key: "invoice", label: "Tagihan invoice", type: "money" },
      { key: "status", label: "Status" },
      { key: "pb_no", label: "No. surat PB", width: 22 },
      { key: "notes", label: "Keterangan", width: 30 },
    ],
    rows: async (r) =>
      mapRows(
        await all<Row & { kind: string; status: string }>(
          `SELECT i.*, CASE WHEN i.kind = 'eksternal' THEN i.contract_price * COALESCE(i.fix_kg, i.net_kg) END invoice, pb.number pb_no
           FROM seed_intakes i LEFT JOIN seed_pb pb ON pb.id = i.pb_id
           WHERE COALESCE(i.received_date, '2000-01-01') BETWEEN ? AND ? ORDER BY i.kind DESC, i.received_date, i.id`,
          r.from,
          r.to,
        ),
        (x) => ({ ...x, kind: INTAKE_KIND[x.kind] ?? x.kind, status: label(INTAKE_STATUS)(x.status) }),
      ),
  },
  "surat-pb": {
    title: "Daftar Surat Pengajuan Pembayaran Benih",
    need: "pembayaran_benih",
    range: true,
    columns: () => [
      { key: "number", label: "Nomor", width: 24 },
      { key: "pb_date", label: "Tanggal", type: "date" },
      { key: "kind", label: "Jenis" },
      { key: "rows", label: "Baris", type: "number" },
      { key: "kg", label: "Bobot (kg)", type: "decimal" },
      { key: "total", label: "Total pembayaran", type: "money" },
      { key: "status", label: "Status" },
      { key: "paid_at", label: "Dibayar", type: "date" },
    ],
    rows: async (r) =>
      mapRows(
        await all<Row & { kind: string; status: string }>(
          `SELECT pb.number, pb.pb_date, pb.kind, pb.status, pb.paid_at, COUNT(i.id) rows, COALESCE(ROUND(SUM(i.net_kg)::numeric, 2), 0) kg, COALESCE(SUM(i.amount), 0) total
           FROM seed_pb pb LEFT JOIN seed_intakes i ON i.pb_id = pb.id WHERE pb.pb_date BETWEEN ? AND ? GROUP BY pb.id ORDER BY pb.pb_date, pb.id`,
          r.from,
          r.to,
        ),
        (x) => ({ ...x, kind: INTAKE_KIND[x.kind] ?? x.kind, status: label(PB_STATUS)(x.status) }),
      ),
  },

  /* ------------------------------ Pengiriman ------------------------------ */
  pengiriman: {
    title: "Daftar Pengiriman",
    need: "pengiriman",
    range: true,
    // Tanpa harga, sama seperti surat jalan.
    columns: () => [
      { key: "so_no", label: "No. Pesanan", width: 16 },
      { key: "order_date", label: "Dipesan", type: "date" },
      { key: "customer", label: "Pelanggan", width: 26 },
      { key: "city", label: "Kota", width: 16 },
      { key: "address", label: "Alamat", width: 32 },
      { key: "items", label: "Barang", width: 44 },
      { key: "status", label: "Status" },
      { key: "shipped_at", label: "Dikirim", type: "date" },
      { key: "courier", label: "Ekspedisi", width: 16 },
      { key: "tracking_no", label: "No. resi", width: 18 },
    ],
    rows: async (r) =>
      mapRows(
        await all<Row & { status: string }>(
          `SELECT so.so_no, so.order_date, c.name customer, c.city, c.address, so.status, so.shipped_at, so.courier, so.tracking_no,
                  (SELECT string_agg(trim(p.name || ' ' || i.pack_size) || ' × ' || i.qty || CASE so.channel WHEN 'bulky' THEN ' kg' WHEN 'label' THEN ' lembar' ELSE '' END, '; ' ORDER BY i.id)
                   FROM so_items i JOIN products p ON p.id = i.product_id WHERE i.so_id = so.id) items
           FROM sales_orders so JOIN customers c ON c.id = so.customer_id
           WHERE so.status IN ('dikonfirmasi','dikirim','selesai') AND COALESCE(so.shipped_at, so.order_date) BETWEEN ? AND ?
           ORDER BY COALESCE(so.shipped_at, so.order_date), so.so_no`,
          r.from,
          r.to,
        ),
        (x) => ({ ...x, status: x.status === "dikonfirmasi" ? "Perlu dikirim" : label(SO_STATUS)(x.status) }),
      ),
  },

  /* --------------------------------- Email --------------------------------- */
  email: {
    title: "Riwayat Email",
    need: "email",
    range: true,
    columns: () => [
      { key: "created_at", label: "Waktu (WIB)", width: 19 },
      { key: "direction", label: "Arah" },
      { key: "from_addr", label: "Dari", width: 28 },
      { key: "to_addr", label: "Kepada", width: 28 },
      { key: "subject", label: "Subjek", width: 36 },
      { key: "status", label: "Status" },
      { key: "body", label: "Isi", width: 60 },
    ],
    rows: async (r) =>
      mapRows(
        // Isi email akun (tautan kata sandi) dan backup tidak ikut diunduh.
        await all<Row & { direction: string; status: string; error: string }>(
          `SELECT created_at, direction, from_addr, to_addr, subject, status, error,
                  CASE WHEN ref_type IN ('account','backup') THEN '' ELSE left(body_text, 2000) END body
           FROM emails WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC, id DESC LIMIT 20000`,
          r.from,
          `${r.to} 99`,
        ),
        (x) => ({
          ...x,
          direction: x.direction === "in" ? "Masuk" : "Keluar",
          status: x.direction === "in" ? "Diterima" : x.status === "gagal" ? `Gagal: ${x.error}` : "Terkirim",
        }),
      ),
  },

  /* ------------------------------ Organisasi ------------------------------ */
  sdm: {
    title: "Data Karyawan",
    need: "sdm",
    columns: () => [
      { key: "name", label: "Nama", width: 24 },
      { key: "division", label: "Divisi", width: 18 },
      { key: "position", label: "Jabatan", width: 20 },
      { key: "email", label: "Email", width: 26 },
      { key: "phone", label: "Telepon", width: 15 },
      { key: "join_date", label: "Tanggal masuk", type: "date" },
      { key: "status", label: "Status" },
    ],
    rows: async () => mapRows(await sdmLines(), (x) => ({ ...x, division: divisionLabel(String(x.division)) })),
  },
  pengguna: {
    title: "Akun Pengguna ERP",
    need: "pengguna",
    columns: () => [
      { key: "name", label: "Nama", width: 22 },
      { key: "email", label: "Email login", width: 28 },
      { key: "role", label: "Divisi", width: 18 },
      { key: "status", label: "Status" },
      { key: "last_login", label: "Login terakhir", width: 18 },
      { key: "created_at", label: "Dibuat", width: 18 },
    ],
    rows: async () =>
      mapRows(
        await all<Row & { role: string; active: number }>("SELECT name, email, role, active, last_login, created_at FROM users ORDER BY role, name"),
        (x) => ({ ...x, role: divisionLabel(x.role), status: x.active ? "Aktif" : "Nonaktif" }),
      ),
  },
  aktivitas: {
    title: "Log Aktivitas ERP",
    // Hanya Founder: keuangan adalah modul yang tidak bisa diberikan ke divisi lain.
    need: "keuangan",
    range: true,
    columns: () => [
      { key: "at", label: "Waktu (WIB)", width: 19 },
      { key: "user_name", label: "Pengguna", width: 20 },
      { key: "user_email", label: "Email", width: 26 },
      { key: "role", label: "Divisi", width: 16 },
      { key: "module", label: "Bagian", width: 18 },
      { key: "action", label: "Aktivitas", width: 32 },
      { key: "detail", label: "Rincian", width: 48 },
      { key: "ip", label: "IP", width: 15 },
    ],
    rows: async (r) =>
      mapRows(
        await all<Row & { role: string; module: string }>("SELECT * FROM activity_log WHERE at >= ? AND at < ? ORDER BY at DESC, id DESC LIMIT 20000", r.from, `${r.to} 99`),
        (x) => ({ ...x, role: x.role ? divisionLabel(x.role) : "", module: ACTIVITY_MODULES[x.module] ?? x.module }),
      ),
  },
};
