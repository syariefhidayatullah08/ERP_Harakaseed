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

export type SyncResult = { ok: true; rows: LocalRow[] } | { ok: false; reason: "offline" | "auth" | "error"; message: string };

/**
 * Kirim perubahan yang belum terkirim lalu ambil perubahan dari server. `getLatest` membaca isi lembar terbaru di
 * laptop setelah server menjawab, sehingga ketikan yang terjadi selama pengiriman tidak tertimpa.
 */
export async function syncSheet(sheet: string, getLatest: () => Promise<LocalRow[]>): Promise<SyncResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, reason: "offline", message: "Sedang offline" };
  const before = await getLatest();
  const pending = before.filter(isDirty);
  const sent = new Map(pending.map((r) => [r.id, { data: { ...r.data }, dirty: { ...r.dirty }, deleted: r.dirtyDeleted, position: r.position }]));
  const changes = pending.map((r) => ({
    id: r.id,
    patch: Object.fromEntries(Object.keys(r.dirty).map((k) => [k, r.data[k] ?? ""])),
    position: r.position,
    deleted: !!r.dirtyDeleted,
  }));
  let res: Response;
  try {
    res = await fetch("/api/lembar/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sheet, since: await getSince(sheet), changes }),
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
  const json = (await res.json().catch(() => null)) as { rows?: { id: string; data: Record<string, string>; position: number; deleted: boolean }[]; rev?: number; error?: string } | null;
  if (!res.ok || !json?.rows) return { ok: false, reason: "error", message: json?.error ?? `Gagal mengirim (${res.status})` };

  // Gabungkan: data server menimpa, kecuali sel yang diubah lagi di laptop selama pengiriman berlangsung.
  const latest = new Map((await getLatest()).map((r) => [r.id, r]));
  for (const s of json.rows) {
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
  // Baris yang terkirim tapi tidak ikut kembali (mis. ditolak karena lembar lain) dibiarkan apa adanya.
  const merged = [...latest.values()];
  await saveRows(sheet, merged);
  await setSince(sheet, json.rev ?? 0);
  return { ok: true, rows: merged };
}
