import type { Metadata } from "next";
import { Suspense } from "react";
import { OfflineHeader, OfflineWorkspace } from "./offline-workspace";

export const metadata: Metadata = { title: "Lembar Kerja Offline" };

/**
 * Lembar Kerja Offline yang bisa dibuka tanpa login & tanpa sinyal (halaman statis, disimpan di perangkat oleh /sw.js).
 * Tidak memuat data apa pun dari server: isi lembar hanya dari perangkat, dan pengiriman ke ERP tetap butuh login.
 */
export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-canvas">
      <OfflineHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        <Suspense>
          <OfflineWorkspace />
        </Suspense>
      </main>
    </div>
  );
}
