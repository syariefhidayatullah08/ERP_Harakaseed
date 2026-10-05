"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";

// Event khusus Chrome/Edge/Android; belum ada di tipe bawaan TypeScript.
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** Tombol pasang ERP sebagai aplikasi. Di iPhone/Safari tidak ada tombol otomatis, jadi ditampilkan petunjuknya. */
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const sync = () => setInstalled(standalone.matches);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => {
      setPrompt(null);
      setInstalled(true);
    };
    sync();
    standalone.addEventListener("change", sync);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      standalone.removeEventListener("change", sync);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return <p className="text-sm text-emerald-700">ERP sudah terpasang sebagai aplikasi di perangkat ini.</p>;

  return (
    <div className="space-y-3 text-sm">
      {prompt && (
        <button
          type="button"
          className="btn-primary"
          onClick={async () => {
            await prompt.prompt();
            if ((await prompt.userChoice).outcome === "accepted") setPrompt(null);
          }}
        >
          <Smartphone size={15} /> Pasang aplikasi di perangkat ini
        </button>
      )}
      <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
        <li>
          <b>Android (Chrome):</b> menu ⋮ → “Tambahkan ke layar utama” atau “Instal aplikasi”.
        </li>
        <li>
          <b>iPhone (Safari):</b> tombol Bagikan → “Tambahkan ke Layar Utama”.
        </li>
        <li>
          <b>Komputer (Chrome/Edge):</b> ikon pasang di ujung kanan bilah alamat.
        </li>
      </ul>
      <p className="text-xs text-muted">Aplikasi selalu memakai versi ERP terbaru dan tetap butuh internet.</p>
    </div>
  );
}
