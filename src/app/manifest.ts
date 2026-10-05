import type { MetadataRoute } from "next";

// Membuat ERP bisa dipasang sebagai aplikasi di HP/komputer ("Tambahkan ke layar utama").
// Tanpa service worker: aplikasi selalu memuat versi terbaru dari server, jadi setiap deploy langsung berlaku.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ERP Haraka Seed",
    short_name: "Haraka ERP",
    description: "Sistem ERP PT Benih Haraka Sejahtera",
    lang: "id",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#0a3b55",
    icons: [
      { src: "/icons/app-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/app-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/app-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
