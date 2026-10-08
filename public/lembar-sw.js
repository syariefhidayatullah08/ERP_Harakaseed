// Service worker lama (hanya /lembar/) digantikan /sw.js untuk seluruh aplikasi. Perangkat yang masih memakainya
// akan mengambil versi ini saat online, lalu melepas dirinya sendiri.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key === "haraka-lembar-v1") await caches.delete(key);
      await self.registration.unregister();
    })(),
  );
});
