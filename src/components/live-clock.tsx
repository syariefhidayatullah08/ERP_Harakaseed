"use client";

import { useSyncExternalStore } from "react";
import { Clock } from "lucide-react";

const TZ = "Asia/Jakarta";
const dateFmt = new Intl.DateTimeFormat("id-ID", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("id-ID", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

// Detak tiap detik sebagai "sumber luar"; di server bernilai 0 (jam belum ditampilkan) agar sama dengan render awal browser.
const tick = (cb: () => void) => {
  const t = setInterval(cb, 1000);
  return () => clearInterval(t);
};
const seconds = () => Math.floor(Date.now() / 1000);

/** Jam & tanggal berjalan (WIB), diperbarui tiap detik. `compact` = satu baris untuk bilah atas HP. */
export function LiveClock({ compact = false }: { compact?: boolean }) {
  const sec = useSyncExternalStore(tick, seconds, () => 0);
  const now = sec ? new Date(sec * 1000) : null;
  const time = now ? timeFmt.format(now).replace(/\./g, ":") : "--:--:--";
  const date = now ? dateFmt.format(now) : "";
  if (compact) {
    return (
      <span className="font-mono text-xs tabular-nums text-brand-100" title={date ? `${date} WIB` : undefined}>
        {time}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-2.5">
      <Clock size={15} className="shrink-0 text-orange-300/90" />
      <div className="min-w-0">
        <div className="font-mono text-base font-semibold tabular-nums leading-tight text-white">
          {time} <span className="text-[10px] font-sans font-normal text-brand-200">WIB</span>
        </div>
        <div className="truncate text-[11px] text-brand-200">{date || "Memuat jam…"}</div>
      </div>
    </div>
  );
}
