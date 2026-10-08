"use client";

import { useEffect } from "react";
import { loadRows, syncSheets, type LocalRow } from "@/lib/sheet-store";

const PRECACHE_KEY = "haraka-precache-at";
const DATA_KEY = "haraka-lembar-data-at";
const PRECACHE_EVERY_MS = 6 * 60 * 60_000;
const DATA_EVERY_MS = 15 * 60_000;

const due = (key: string, every: number) => {
  try {
    return Date.now() - Number(localStorage.getItem(key) ?? 0) > every;
  } catch {
    return true;
  }
};
const mark = (key: string) => {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* penyimpanan browser diblokir: cukup jalan lagi lain kali */
  }
};

/**
 * Agar ERP (juga yang dipasang di layar utama iPhone/Android) bisa dibuka tanpa sinyal: memasang /sw.js untuk seluruh
 * aplikasi, menyimpan semua halaman Lembar Kerja Offline yang boleh dibuka pengguna, dan mengunduh isi lembarnya ke
 * perangkat di latar belakang. Tidak menampilkan apa pun.
 */
export function OfflineSupport({ sheets }: { sheets: string[] }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !navigator.onLine) return;
    (async () => {
      // Pengganti service worker lama yang hanya mencakup /lembar/.
      for (const reg of await navigator.serviceWorker.getRegistrations()) if (reg.scope.endsWith("/lembar/")) await reg.unregister();
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const reg = await navigator.serviceWorker.ready;
      const assets = performance
        .getEntriesByType("resource")
        .map((e) => new URL(e.name))
        .filter((u) => u.origin === location.origin && u.pathname.startsWith("/_next/static/"))
        .map((u) => u.pathname + u.search);
      if (sheets.length && due(PRECACHE_KEY, PRECACHE_EVERY_MS)) {
        reg.active?.postMessage({ type: "precache", urls: assets });
        mark(PRECACHE_KEY);
      } else reg.active?.postMessage({ type: "precache-assets", urls: assets });
    })().catch(() => {});
  }, [sheets.length]);

  // Isi lembar ikut diunduh ke perangkat, supaya lembar yang belum pernah dibuka pun lengkap saat offline.
  // Dilewati di halaman lembar sendiri (halaman itu sudah menyinkronkan lembarnya).
  useEffect(() => {
    if (!sheets.length || !navigator.onLine || location.pathname.startsWith("/lembar") || !due(DATA_KEY, DATA_EVERY_MS)) return;
    (async () => {
      const store: Record<string, LocalRow[]> = Object.fromEntries(await Promise.all(sheets.map(async (k) => [k, await loadRows(k)] as const)));
      const res = await syncSheets(
        sheets,
        (k) => store[k] ?? [],
        (updates) => Object.assign(store, updates),
      );
      if (res.ok) mark(DATA_KEY);
    })().catch(() => {});
  }, [sheets]);

  return null;
}
