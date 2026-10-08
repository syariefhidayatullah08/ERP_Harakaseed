// Service worker ERP Haraka: supaya aplikasi (termasuk yang dipasang di layar utama HP/iPhone) tetap bisa dibuka tanpa
// sinyal. Yang disimpan di perangkat HANYA halaman Lembar Kerja Offline (/lembar…) dan file aplikasi (/_next/static).
// Halaman lain (keuangan, kas, dll.) tidak pernah disimpan; saat offline, membukanya diarahkan ke daftar lembar.
// Isi lembar sendiri disimpan di IndexedDB oleh halaman lembar, bukan di sini.
const CACHE = "haraka-offline-v2";
const STATIC = /\/_next\/static\/[^"'\\\s)]+/g;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

const isSheetPage = (path) => path === "/lembar" || path.startsWith("/lembar/");

async function store(url, res) {
  const cache = await caches.open(CACHE);
  await cache.put(url, res);
}

/** Ambil & simpan satu alamat; halaman login (sesi habis) tidak pernah disimpan sebagai halaman lembar. */
async function fetchAndStore(url) {
  try {
    const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    if (!res.ok || res.redirected) return null;
    await store(url, res.clone());
    return res;
  } catch {
    return null;
  }
}

/** File aplikasi yang dirujuk sebuah halaman (termasuk yang dimuat belakangan oleh React). */
async function storeAssetsOf(html) {
  for (const url of new Set(html.match(STATIC) ?? [])) {
    if (!(await caches.match(url))) await fetchAndStore(url);
  }
}

/** Simpan daftar lembar + semua lembar yang boleh dibuka pengguna + file aplikasinya. */
async function precache(extra) {
  for (const url of extra ?? []) if (url.startsWith("/_next/static/") && !(await caches.match(url))) await fetchAndStore(url);
  const index = await fetchAndStore("/lembar");
  if (!index) return;
  const html = await index.text();
  await storeAssetsOf(html);
  for (const path of new Set([...html.matchAll(/href="(\/lembar\/[\w-]+)"/g)].map((m) => m[1]))) {
    const page = await fetchAndStore(path);
    if (page) await storeAssetsOf(await page.text());
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "precache") event.waitUntil(precache(event.data.urls));
  // Tiap halaman dibuka: simpan file aplikasi yang dipakainya (kunjungan pertama belum lewat service worker).
  if (event.data?.type === "precache-assets")
    event.waitUntil(Promise.all((event.data.urls ?? []).filter((u) => u.startsWith("/_next/static/")).map(async (u) => (await caches.match(u)) || fetchAndStore(u))));
});

const offlinePage = () =>
  new Response(
    `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Haraka ERP</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;color:#0a3b55"><h2>Sedang tidak ada sinyal</h2>
<p>Halaman ini belum tersimpan di perangkat. Buka aplikasi sekali saat ada sinyal agar Lembar Kerja Offline tersimpan, lalu bisa dipakai tanpa internet.</p>
<p><a href="/lembar">Coba buka Lembar Kerja Offline</a></p></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
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
        try {
          const res = await fetch(req);
          if (isSheetPage(url.pathname) && res.ok && !res.redirected) store(url.pathname, res.clone());
          return res;
        } catch {
          if (isSheetPage(url.pathname)) {
            const hit = await caches.match(url.pathname);
            if (hit) return hit;
          }
          // Dashboard / halaman lain tanpa sinyal → daftar Lembar Kerja Offline (bila sudah tersimpan).
          if (await caches.match("/lembar")) return Response.redirect("/lembar", 302);
          return offlinePage();
        }
      })(),
    );
  }
});
