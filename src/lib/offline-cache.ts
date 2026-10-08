// Menyiapkan perangkat untuk dipakai tanpa sinyal: menyimpan halaman Lembar Kerja Offline + file aplikasinya ke Cache
// Storage (dibaca /sw.js saat offline). Dijalankan dari halaman (bukan dari service worker) karena iPhone bisa
// menghentikan service worker di tengah jalan; status "siap" baru dicatat setelah semua halaman benar-benar tersimpan.
// Hanya dipakai di browser.

export const OFFLINE_CACHE = "haraka-offline-v2";
const STATIC = /\/_next\/static\/[^"'\\\s)]+/g;
const READY_KEY = "haraka-offline-ready";
const REFRESH_MS = 6 * 60 * 60_000;

export type OfflineReady = { at: number; pages: number };

export function readyInfo(): OfflineReady | null {
  try {
    const v = JSON.parse(localStorage.getItem(READY_KEY) ?? "null") as OfflineReady | null;
    return v && typeof v.at === "number" ? v : null;
  } catch {
    return null;
  }
}

/** Perlu disiapkan (belum pernah lengkap, atau sudah lebih dari 6 jam — agar mengikuti versi aplikasi terbaru). */
export const needsPrepare = () => {
  const r = readyInfo();
  return !r || Date.now() - r.at > REFRESH_MS;
};

async function save(cache: Cache, url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    if (!res.ok || res.redirected) return null;
    const text = url.startsWith("/_next/static/") ? "" : await res.clone().text();
    await cache.put(url, res);
    return text;
  } catch {
    return null;
  }
}

async function saveAssets(cache: Cache, html: string, extra: string[] = []) {
  for (const url of new Set([...(html.match(STATIC) ?? []), ...extra])) {
    if (!(await cache.match(url))) await save(cache, url);
  }
}

/**
 * Simpan daftar lembar, setiap lembar yang boleh dibuka pengguna, dan file aplikasinya. `onProgress(selesai, total)`
 * untuk penanda di layar. Mengembalikan true bila semua halaman tersimpan.
 */
export async function prepareOffline(onProgress: (done: number, total: number) => void, extraAssets: string[] = []): Promise<boolean> {
  if (!("caches" in window) || !navigator.onLine) return false;
  const cache = await caches.open(OFFLINE_CACHE);
  const index = await save(cache, "/lembar");
  if (index === null) return false;
  const pages = [...new Set([...index.matchAll(/href="(\/lembar\/[\w-]+)"/g)].map((m) => m[1]))];
  const total = pages.length + 1;
  let done = 1;
  onProgress(done, total);
  await saveAssets(cache, index, extraAssets);
  let failed = 0;
  for (const path of pages) {
    const html = await save(cache, path);
    if (html === null) failed++;
    else await saveAssets(cache, html);
    onProgress(++done, total);
  }
  if (failed) return false;
  try {
    localStorage.setItem(READY_KEY, JSON.stringify({ at: Date.now(), pages: total } satisfies OfflineReady));
  } catch {
    /* penyimpanan diblokir: akan disiapkan lagi lain kali */
  }
  return true;
}
