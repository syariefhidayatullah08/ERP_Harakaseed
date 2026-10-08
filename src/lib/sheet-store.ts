// Penyimpanan lembar kerja offline di laptop (IndexedDB) + sinkronisasi ke ERP. Hanya dipakai di browser.
// Setiap ketikan langsung disimpan di laptop; perubahan yang belum terkirim ditandai `dirty` (per kolom) dan dikirim
// ke /api/lembar/sync saat online. Data di laptop tidak hilang walau browser ditutup atau internet putus.

export type LocalRow = {
  id: string;
  data: Record<string, string>;
  position: number;
  deleted: boolean;
  /** Kolom yang diubah di laptop dan belum diterima server. */
  dirty: Record<string, true>;
  /** Penghapusan / urutan baru yang belum diterima server. */
  dirtyDeleted?: boolean;
  dirtyPosition?: boolean;
};

const DB_NAME = "haraka-lembar";
const ROWS = "rows";
const META = "meta";

let dbPromise: Promise<IDBDatabase> | null = null;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      const rows = d.createObjectStore(ROWS, { keyPath: ["sheet", "id"] });
      rows.createIndex("sheet", "sheet");
      d.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function done(t: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function result<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadRows(sheet: string): Promise<LocalRow[]> {
  const t = (await db()).transaction(ROWS, "readonly");
  // Baris tersimpan juga membawa kolom `sheet` (kunci penyimpanan); tidak mengganggu pemakaian sebagai LocalRow.
  return (await result(t.objectStore(ROWS).index("sheet").getAll(sheet))) as LocalRow[];
}

export async function saveRows(sheet: string, rows: LocalRow[]) {
  const t = (await db()).transaction(ROWS, "readwrite");
  for (const r of rows) t.objectStore(ROWS).put({ ...r, sheet });
  await done(t);
}

export async function getSince(sheet: string): Promise<number> {
  const t = (await db()).transaction(META, "readonly");
  return Number((await result(t.objectStore(META).get(`since:${sheet}`))) ?? 0);
}

async function setSince(sheet: string, rev: number) {
  const t = (await db()).transaction(META, "readwrite");
  t.objectStore(META).put(rev, `since:${sheet}`);
  await done(t);
}

export const newRowId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

export const isDirty = (r: LocalRow) => Object.keys(r.dirty).length > 0 || !!r.dirtyDeleted || !!r.dirtyPosition;

export type MultiSyncResult = { ok: true; rows: Record<string, LocalRow[]>; errors: Record<string, string> } | { ok: false; reason: "offline" | "auth" | "error"; message: string };

type ServerRow = { id: string; data: Record<string, string>; position: number; deleted: boolean };
type Sent = Map<string, { data: Record<string, string>; dirty: Record<string, true>; position: number }>;

function prepare(rows: LocalRow[]) {
  const pending = rows.filter(isDirty);
  const sent: Sent = new Map(pending.map((r) => [r.id, { data: { ...r.data }, dirty: { ...r.dirty }, position: r.position }]));
  const changes = pending.map((r) => ({
    id: r.id,
    patch: Object.fromEntries(Object.keys(r.dirty).map((k) => [k, r.data[k] ?? ""])),
    position: r.position,
    deleted: !!r.dirtyDeleted,
  }));
  return { sent, changes };
}

/** Gabungkan jawaban server: data server menimpa, kecuali sel yang diubah lagi di laptop selama pengiriman berlangsung. */
function merge(latestRows: LocalRow[], serverRows: ServerRow[], sent: Sent) {
  const latest = new Map(latestRows.map((r) => [r.id, r]));
  for (const s of serverRows) {
    const local = latest.get(s.id);
    const was = sent.get(s.id);
    const dirty: Record<string, true> = {};
    const data = { ...s.data };
    if (local) {
      for (const k of Object.keys(local.dirty)) {
        const changedAgain = !was || !was.dirty[k] || was.data[k] !== local.data[k];
        if (changedAgain) {
          dirty[k] = true;
          data[k] = local.data[k];
        }
      }
    }
    latest.set(s.id, {
      id: s.id,
      data,
      position: local?.dirtyPosition && local.position !== was?.position ? local.position : s.position,
      deleted: s.deleted || !!local?.dirtyDeleted,
      dirty,
      dirtyDeleted: !!local?.dirtyDeleted && !s.deleted,
      dirtyPosition: !!local?.dirtyPosition && local.position !== was?.position,
    });
  }
  // Baris yang terkirim tapi tidak ikut kembali dibiarkan apa adanya.
  return [...latest.values()];
}

type Failure = { ok: false; reason: "offline" | "auth" | "error"; message: string };

async function post(body: unknown): Promise<{ ok: true; json: Record<string, unknown> } | Failure> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, reason: "offline", message: "Sedang offline" };
  let res: Response;
  try {
    res = await fetch("/api/lembar/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "offline", message: "Tidak tersambung ke server" };
  }
  // Tanpa cookie sesi, proxy mengalihkan ke halaman login (HTML), bukan JSON.
  if (res.status === 401 || res.redirected || !(res.headers.get("content-type") ?? "").includes("json")) {
    return { ok: false, reason: "auth", message: "Sesi login habis. Login lagi supaya data terkirim; data tetap aman di laptop." };
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !json) return { ok: false, reason: "error", message: (json?.error as string) ?? `Gagal mengirim (${res.status})` };
  return { ok: true, json };
}

/**
 * Sinkron beberapa lembar sekaligus dalam satu permintaan (lembar yang saling dirujuk rumus): kirim perubahan yang belum
 * terkirim, ambil perubahan dari server, lalu gabungkan.
 *
 * `read` & `write` harus sinkron (tanpa await): penggabungan memakai isi lembar terbaru tepat saat jawaban server
 * diterapkan, sehingga ketikan yang terjadi selama pengiriman tidak pernah tertimpa.
 */
export async function syncSheets(
  sheets: string[],
  read: (sheet: string) => LocalRow[],
  write: (updates: Record<string, LocalRow[]>) => void,
): Promise<MultiSyncResult> {
  const prepared = new Map<string, Sent>();
  const body = [];
  for (const sheet of sheets) {
    const { sent, changes } = prepare(read(sheet));
    prepared.set(sheet, sent);
    body.push({ sheet, since: await getSince(sheet), changes });
  }
  const res = await post({ sheets: body });
  if (!res.ok) return res;
  const results = (res.json.results ?? {}) as Record<string, { rows?: ServerRow[]; rev?: number; error?: string }>;
  const rows: Record<string, LocalRow[]> = {};
  const errors: Record<string, string> = {};
  // Bagian sinkron: baca isi terbaru → gabung → tulis, tanpa jeda di antaranya.
  for (const sheet of sheets) {
    const r = results[sheet];
    if (!r || r.error || !r.rows) errors[sheet] = r?.error ?? "Tidak ada jawaban";
    else rows[sheet] = merge(read(sheet), r.rows, prepared.get(sheet)!);
  }
  write(rows);
  // Penyimpanan ke laptop menyusul; transaksi IndexedDB berjalan berurutan, jadi ketikan sesudahnya tetap menang.
  for (const sheet of Object.keys(rows)) {
    await saveRows(sheet, rows[sheet]);
    await setSince(sheet, results[sheet].rev ?? 0);
  }
  return { ok: true, rows, errors };
}
