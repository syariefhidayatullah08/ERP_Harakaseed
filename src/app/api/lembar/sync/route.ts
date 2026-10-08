import { all, tx, run } from "@/lib/db";
import { can, currentUser, type SessionUser } from "@/lib/session";
import { sheetByKey, storableKeys } from "@/lib/sheets";

type Change = { id: string; patch?: Record<string, unknown>; position?: number; deleted?: boolean };
type SheetSync = { sheet?: string; since?: number; changes?: Change[] };
type Result = { rows: { id: string; data: Record<string, string>; position: number; deleted: boolean; rev: number }[]; rev: number } | { error: string };

const MAX_CHANGES = 2000;
const MAX_CELL = 2000;
const MAX_SHEETS = 30;

/**
 * Sinkronisasi lembar kerja offline. Laptop mengirim perubahan yang belum terkirim (per sel: hanya kolom yang
 * diubah, supaya ketikan dua orang di baris yang sama tidak saling menimpa) dan menerima semua perubahan sejak `since`.
 * Satu permintaan boleh berisi beberapa lembar sekaligus (`sheets: [...]`) karena rumus bisa merujuk lembar lain.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sesi login habis. Login lagi untuk mengirim data." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as (SheetSync & { sheets?: SheetSync[] }) | null;
  if (!body) return Response.json({ error: "Permintaan tidak valid." }, { status: 400 });

  // Bentuk lama (satu lembar) tetap diterima.
  if (!Array.isArray(body.sheets)) {
    const r = await syncOne(user, body);
    return "error" in r ? Response.json(r, { status: r.error.startsWith("Tidak punya") ? 403 : 400 }) : Response.json(r);
  }
  const results: Record<string, Result> = {};
  for (const s of body.sheets.slice(0, MAX_SHEETS)) results[String(s.sheet)] = await syncOne(user, s);
  return Response.json({ results });
}

async function syncOne(user: SessionUser, body: SheetSync): Promise<Result> {
  const sheet = sheetByKey(String(body.sheet ?? ""));
  if (!sheet) return { error: "Lembar tidak dikenal." };
  if (!can(user, sheet.module)) return { error: "Tidak punya akses ke lembar ini." };

  const keys = storableKeys(sheet);
  const changes = (Array.isArray(body.changes) ? body.changes : []).slice(0, MAX_CHANGES);
  for (const c of changes) {
    if (typeof c.id !== "string" || !/^[\w-]{8,64}$/.test(c.id)) return { error: "Data baris tidak valid." };
  }

  if (changes.length) {
    await tx(async () => {
      for (const c of changes) {
        // Hanya kolom yang dikenal, isi berupa teks (seperti sel Excel).
        const patch = Object.fromEntries(
          Object.entries(c.patch ?? {})
            .filter(([k]) => keys.has(k))
            .map(([k, v]) => [k, v == null ? "" : String(v).slice(0, MAX_CELL)]),
        );
        const position = Number.isFinite(c.position) ? Number(c.position) : null;
        await run(
          `INSERT INTO sheet_rows (id, sheet, data, position, deleted, updated_by)
           VALUES (?, ?, ?::jsonb, COALESCE(?::float8, 0), ? = 1, ?)
           ON CONFLICT (id) DO UPDATE SET
             data = sheet_rows.data || EXCLUDED.data,
             position = COALESCE(?::float8, sheet_rows.position),
             deleted = sheet_rows.deleted OR EXCLUDED.deleted,
             rev = nextval('sheet_rev_seq'),
             updated_at = to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS'),
             updated_by = EXCLUDED.updated_by
           WHERE sheet_rows.sheet = EXCLUDED.sheet`,
          c.id, sheet.key, JSON.stringify(patch), position, c.deleted ? 1 : 0, user.id, position,
        );
      }
    });
  }

  // Sedikit tumpang-tindih ke belakang: perubahan yang nomor rev-nya lebih kecil tapi baru selesai disimpan
  // (transaksi bersamaan) tetap ikut terambil. Baris yang terambil dua kali aman karena laptop hanya menimpanya.
  const since = Number.isFinite(body.since) ? Number(body.since) : 0;
  const rows = await all<{ id: string; data: Record<string, string>; position: number; deleted: boolean; rev: number }>(
    "SELECT id, data, position, deleted, rev::float8 rev FROM sheet_rows WHERE sheet = ? AND rev > ? ORDER BY rev",
    sheet.key,
    Math.max(0, since - 200),
  );
  return { rows, rev: rows.reduce((m, r) => Math.max(m, r.rev), since) };
}
