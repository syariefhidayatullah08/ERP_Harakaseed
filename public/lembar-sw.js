// Service worker khusus Lembar Kerja Offline (/lembar/…): menyimpan halaman lembar & file aplikasinya di laptop
// supaya tetap bisa dibuka tanpa internet. Bagian ERP lain tidak terpengaruh (scope hanya /lembar/).
// Data lembar tidak disimpan di sini, melainkan di IndexedDB oleh halaman itu sendiri.
const CACHE = "haraka-lembar-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// Halaman mengirim daftar file yang dipakainya (kunjungan pertama belum lewat service worker).
self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        event.data.urls.map((url) =>
          fetch(url, { credentials: "same-origin" })
            .then((res) => (res.ok && !res.redirected ? cache.put(url, res) : undefined))
            .catch(() => undefined),
        ),
      ),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // File aplikasi (nama berisi hash, tidak pernah berubah): ambil dari simpanan dulu.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // Halaman lembar: coba internet dulu (versi terbaru), kalau gagal pakai simpanan di laptop.
  if (req.mode === "navigate" && url.pathname.startsWith("/lembar")) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          // Jangan menyimpan halaman login (sesi habis) sebagai halaman lembar.
          if (res.ok && !res.redirected) (await caches.open(CACHE)).put(url.pathname, res.clone());
          return res;
        } catch {
          const hit = await caches.match(url.pathname);
          return (
            hit ||
            new Response("<h1>Lembar ini belum pernah dibuka di laptop ini.</h1><p>Buka sekali saat online, setelah itu bisa dipakai tanpa internet.</p>", {
              headers: { "content-type": "text/html; charset=utf-8" },
            })
          );
        }
      })(),
    );
  }
});
