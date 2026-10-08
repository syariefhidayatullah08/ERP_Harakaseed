// Service worker ERP Haraka: supaya aplikasi (termasuk yang dipasang di layar utama HP/iPhone) tetap bisa dibuka tanpa
// sinyal. Yang disimpan di perangkat HANYA halaman Lembar Kerja Offline (/lembar…) dan file aplikasi (/_next/static).
// Halaman lain (keuangan, kas, dll.) tidak pernah disimpan; saat offline, membukanya diarahkan ke /offline (Lembar Kerja
// Offline tanpa login, jadi bisa dipakai walau belum/tidak sedang login).
// Isi lembar sendiri disimpan di IndexedDB oleh halaman lembar, bukan di sini. Penyimpanan halaman-halaman lembar
// dilakukan dari halaman aplikasi (src/lib/offline-cache.ts), bukan dari sini: iPhone bisa menghentikan service worker
// di tengah jalan.
const CACHE = "haraka-offline-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

const isSheetPage = (path) => path === "/lembar" || path.startsWith("/lembar/") || path === "/offline";

async function store(url, res) {
  const cache = await caches.open(CACHE);
  await cache.put(url, res);
}

/** Sinyal lemah di HP sering membuat permintaan menggantung lama, bukan langsung gagal: batasi waktunya. */
function fetchWithin(req, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(req).then(
      (res) => (clearTimeout(timer), resolve(res)),
      (err) => (clearTimeout(timer), reject(err)),
    );
  });
}

// Halaman lain tanpa sinyal → pindah ke Lembar Kerja Offline. Lewat skrip, bukan redirect HTTP, karena Safari iPhone
// kadang menolak redirect dari service worker.
const goTo = (to) =>
  new Response(
    `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Haraka ERP</title>
<script>location.replace(${JSON.stringify(to)})</script></head><body style="font-family:system-ui,sans-serif;padding:24px;color:#0a3b55">
<p>Tanpa sinyal — membuka <a href="${to}">Lembar Kerja Offline</a>…</p></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

const offlinePage = () =>
  new Response(
    `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Haraka ERP</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;color:#0a3b55"><h2>Sedang tidak ada sinyal</h2>
<p>Halaman ini belum tersimpan di perangkat. Buka aplikasi sekali saat ada sinyal dan tunggu tanda "Siap dipakai tanpa sinyal", lalu bisa dipakai tanpa internet.</p>
<p><a href="/offline">Coba buka Lembar Kerja Offline</a></p></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // File aplikasi (nama berisi kode unik, tidak pernah berubah): dari simpanan dulu.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) store(req, res.clone());
            return res;
          }),
      ),
    );
    return;
  }

  // Membuka halaman: internet dulu (selalu versi terbaru); tanpa sinyal → halaman lembar yang tersimpan.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const sheet = isSheetPage(url.pathname);
        try {
          const res = await fetchWithin(req, sheet ? 5000 : 10000);
          if (sheet && res.ok && !res.redirected) store(url.pathname, res.clone());
          return res;
        } catch {
          if (sheet) {
            const hit = await caches.match(url.pathname, { ignoreSearch: true });
            if (hit) return hit;
          }
          // Utamakan /offline (tidak butuh login, jadi tetap jalan walau sesi login sudah habis).
          const key = url.pathname.match(/^\/lembar\/([\w-]+)$/)?.[1];
          if (await caches.match("/offline")) return goTo(key ? `/offline?s=${key}` : "/offline");
          if (await caches.match("/lembar")) return goTo("/lembar");
          return offlinePage();
        }
      })(),
    );
  }
});
