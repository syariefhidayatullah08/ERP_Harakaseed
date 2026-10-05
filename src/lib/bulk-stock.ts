import "server-only";
import { all, get, insert, run } from "./db";
import { today } from "./format";

// Stok bahan baku (kg) mengikuti transaksi: benih masuk internal di buku induk menambah "proses uji",
// penjualan bulky yang dikirim mengurangi "siap jual". Setiap perubahan otomatis dicatat di bulk_moves
// supaya bisa dibatalkan persis saat sumbernya diubah, dihapus, atau dibatalkan.

export type Bucket = "untested_kg" | "testing_kg" | "ready_kg";
export const BUCKET_LABEL: Record<Bucket, string> = { untested_kg: "Belum uji", testing_kg: "Proses uji", ready_kg: "Siap jual" };
type RefType = "intake" | "so";
type Move = { stockId: number; bucket: Bucket; kg: number; date: string; note: string };

/** "KE011", "KE 11", "PA 03 / BG 07" → ["KE11"], ["KE11"], ["PA3", "BG7"]: spasi & nol di depan angka diabaikan. */
export const codeTokens = (code: string) =>
  code
    .toUpperCase()
    .split("/")
    .map((t) => t.replace(/\s+/g, "").replace(/^([A-Z]+)0+(?=\d)/, "$1"))
    .filter(Boolean);

/** Benih induk (stock seed jantan/betina) bukan stok komersil, jadi tidak ikut dihitung. */
export const isParentSeed = (code: string) => /\b(SS[MF]?|MALE|FEMALE)\b/i.test(code);

const round = (n: number) => Math.round(n * 100) / 100;

/** Ganti seluruh mutasi otomatis milik satu sumber (panggil di dalam tx). Daftar kosong = batalkan semuanya. */
export async function setBulkMoves(refType: RefType, refId: number, moves: Move[]) {
  const old = await all<{ id: number; stock_id: number; bucket: Bucket; kg: number }>("SELECT id, stock_id, bucket, kg FROM bulk_moves WHERE ref_type = ? AND ref_id = ?", refType, refId);
  for (const m of old) await run(`UPDATE bulk_stock SET ${m.bucket} = ROUND((${m.bucket} - ?)::numeric, 2), updated_at = ? WHERE id = ?`, m.kg, today(), m.stock_id);
  if (old.length) await run("DELETE FROM bulk_moves WHERE ref_type = ? AND ref_id = ?", refType, refId);
  for (const m of moves) {
    if (!m.kg) continue;
    await run(`UPDATE bulk_stock SET ${m.bucket} = ROUND((${m.bucket} + ?)::numeric, 2), updated_at = ? WHERE id = ?`, m.kg, today(), m.stockId);
    await run("INSERT INTO bulk_moves (stock_id, move_date, bucket, kg, ref_type, ref_id, note) VALUES (?,?,?,?,?,?,?)", m.stockId, m.date, m.bucket, m.kg, refType, refId, m.note);
  }
}

/** Baris stok untuk sebuah kode produksi; dibuat baru bila kodenya belum ada di daftar. */
async function stockIdForCode(code: string) {
  const want = codeTokens(code);
  const rows = await all<{ id: number; production_code: string }>("SELECT id, production_code FROM bulk_stock ORDER BY id");
  const hit = rows.find((r) => codeTokens(r.production_code).some((t) => want.includes(t)));
  return hit?.id ?? (await insert("INSERT INTO bulk_stock (production_code, note, updated_at) VALUES (?, 'Dibuat otomatis dari buku induk', ?)", code.toUpperCase().replace(/\s+/g, " ").trim(), today()));
}

/**
 * Samakan stok dengan satu baris buku induk (panggil di dalam tx). Baris lama dari sebelum fitur ini tidak
 * pernah tercatat mutasinya, jadi saat diubah (`created` = false) tidak ikut menambah stok.
 */
export async function syncIntakeStock(intakeId: number, created: boolean) {
  const tracked = created || !!(await get("SELECT 1 FROM bulk_moves WHERE ref_type = 'intake' AND ref_id = ? LIMIT 1", intakeId));
  if (!tracked) return;
  const i = await get<{ kind: string; production_code: string; net_kg: number; farmer: string; received_date: string | null }>("SELECT kind, production_code, net_kg, farmer, received_date FROM seed_intakes WHERE id = ?", intakeId);
  const counts = i && i.kind === "internal" && i.net_kg > 0 && i.production_code.trim() && !isParentSeed(i.production_code);
  await setBulkMoves(
    "intake",
    intakeId,
    counts ? [{ stockId: await stockIdForCode(i.production_code), bucket: "testing_kg", kg: round(i.net_kg), date: i.received_date ?? today(), note: `Benih masuk dari ${i.farmer}` }] : [],
  );
}

/**
 * Kurangi stok siap jual untuk penjualan bulky yang dikirim (panggil di dalam tx). Mengembalikan catatan
 * untuk ditampilkan: varietas yang belum dipasangkan ke kode produksi, atau stok yang jadi minus.
 */
export async function deductBulkySale(soId: number, soNo: string, customer: string, date: string) {
  const items = await all<{ product_id: number; name: string; qty: number }>("SELECT i.product_id, p.name, SUM(i.qty) qty FROM so_items i JOIN products p ON p.id = i.product_id WHERE i.so_id = ? GROUP BY 1, 2", soId);
  const moves: Move[] = [];
  const warnings: string[] = [];
  for (const it of items) {
    const rows = await all<{ id: number; ready_kg: number }>("SELECT id, ready_kg FROM bulk_stock WHERE product_id = ? ORDER BY ready_kg DESC, id", it.product_id);
    if (!rows.length) {
      warnings.push(`${it.name} belum dipasangkan ke kode produksi di Stok Bahan Baku, jadi stoknya tidak dikurangi.`);
      continue;
    }
    let left = round(it.qty);
    const take = (stockId: number, kg: number) => moves.push({ stockId, bucket: "ready_kg", kg: -round(kg), date, note: `Penjualan bulky ${soNo} · ${customer}` });
    for (const r of rows) {
      const kg = Math.min(left, Math.max(0, r.ready_kg));
      if (kg > 0) take(r.id, kg);
      left = round(left - kg);
    }
    // Stok tidak cukup: sisanya tetap dicatat di kode pertama sehingga minusnya terlihat dan bisa ditelusuri.
    if (left > 0) {
      take(rows[0].id, left);
      warnings.push(`Stok siap jual ${it.name} kurang ${new Intl.NumberFormat("id-ID").format(left)} kg; periksa Stok Bahan Baku.`);
    }
  }
  await setBulkMoves("so", soId, moves);
  return warnings;
}
