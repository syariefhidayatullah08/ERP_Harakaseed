"use client";

import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";
import { prepareShell } from "@/lib/offline-cache";

/**
 * Di halaman login: memasang /sw.js & menyimpan Lembar Kerja Offline (/offline) ke perangkat tanpa perlu login, lalu
 * menampilkan jalan masuk ke sana. Saat tidak ada sinyal, tombolnya ditonjolkan.
 */
export function OfflineEntry() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if ("serviceWorker" in navigator && navigator.onLine) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
      prepareShell().catch(() => {});
    }
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <a
      href="/offline"
      className={
        offline
          ? "mt-6 flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white shadow"
          : "mt-6 flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
      }
    >
      <CloudOff size={16} />
      {offline ? "Tidak ada sinyal — buka Lembar Kerja Offline" : "Lembar Kerja Offline (tanpa login)"}
    </a>
  );
}
