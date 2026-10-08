"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CloudDownload } from "lucide-react";
import { loadRows, syncSheets, type LocalRow } from "@/lib/sheet-store";
import { needsPrepare, prepareOffline } from "@/lib/offline-cache";

const DATA_KEY = "haraka-lembar-data-at";
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

type Prep = { state: "idle" } | { state: "busy"; done: number; total: number } | { state: "ready" };

/**
 * Agar ERP (juga yang dipasang di layar utama iPhone/Android) bisa dibuka tanpa sinyal: memasang /sw.js, menyimpan
 * semua halaman Lembar Kerja Offline yang boleh dibuka pengguna, dan mengunduh isi lembarnya ke perangkat. Selama
 * menyiapkan, tampil penanda kecil di pojok bawah supaya pengguna tahu kapan perangkat siap dipakai tanpa sinyal.
 */
export function OfflineSupport({ sheets }: { sheets: string[] }) {
  const [prep, setPrep] = useState<Prep>({ state: "idle" });

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !navigator.onLine || !sheets.length) return;
    let alive = true;
    (async () => {
      // Pengganti service worker lama yang hanya mencakup /lembar/.
      for (const reg of await navigator.serviceWorker.getRegistrations()) if (reg.scope.endsWith("/lembar/")) await reg.unregister();
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const assets = performance
        .getEntriesByType("resource")
        .map((e) => new URL(e.name))
        .filter((u) => u.origin === location.origin && u.pathname.startsWith("/_next/static/"))
        .map((u) => u.pathname + u.search);
      if (!needsPrepare()) return;
      const ok = await prepareOffline((done, total) => alive && setPrep({ state: "busy", done, total }), assets);
      if (!alive) return;
      setPrep(ok ? { state: "ready" } : { state: "idle" });
      if (ok) setTimeout(() => alive && setPrep({ state: "idle" }), 6000);
    })().catch(() => alive && setPrep({ state: "idle" }));
    return () => {
      alive = false;
    };
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

  if (prep.state === "idle") return null;
  return (
    <div role="status" className="no-print fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-full bg-navy px-3.5 py-2 text-xs font-medium text-white shadow-lg">
      {prep.state === "busy" ? (
        <>
          <CloudDownload size={14} className="animate-pulse" /> Menyiapkan mode offline… {prep.done}/{prep.total} — jangan tutup aplikasi dulu
        </>
      ) : (
        <>
          <CheckCircle2 size={14} className="text-emerald-300" /> Siap dipakai tanpa sinyal
        </>
      )}
    </div>
  );
}
