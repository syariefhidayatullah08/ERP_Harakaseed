/** Grafik batang satu seri: batang tipis, ujung membulat 4px di atas, tooltip saat hover, label hanya di nilai terakhir. */
export function BarChart({
  data,
  format,
  height = 180,
}: {
  data: { label: string; value: number; sub?: string }[];
  format: (n: number) => string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = [0, 0.5, 1].map((t) => t * max);
  return (
    <div className="flex gap-3">
      <div className="flex flex-col-reverse justify-between pb-6 text-right text-[10px] tabular-nums text-muted" style={{ height }}>
        {ticks.map((t) => (
          <span key={t}>{compact(t)}</span>
        ))}
      </div>
      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height: height - 24 }}>
          {ticks.map((t) => (
            <div key={t} className="border-t border-dashed border-line" />
          ))}
        </div>
        <div className="relative flex items-end gap-[2px]" style={{ height: height - 24 }}>
          {data.map((d, i) => {
            const h = (d.value / max) * 100;
            const last = i === data.length - 1;
            return (
              <div key={d.label} className="group relative flex h-full flex-1 items-end justify-center">
                <div
                  className={`w-full max-w-10 rounded-t-[4px] transition-colors ${last ? "bg-brand-700" : "bg-brand-500/70 group-hover:bg-brand-600"}`}
                  style={{ height: `${Math.max(h, d.value > 0 ? 1.5 : 0)}%` }}
                />
                {last && d.value > 0 && (
                  <div className="absolute -translate-y-1 text-[11px] font-semibold text-ink" style={{ bottom: `${h}%` }}>
                    {compact(d.value)}
                  </div>
                )}
                <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block">
                  <div className="font-semibold">{d.label}</div>
                  <div className="tabular-nums">{format(d.value)}</div>
                  {d.sub && <div className="text-white/70">{d.sub}</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-[2px] pt-2">
          {data.map((d) => (
            <div key={d.label} className="flex-1 truncate text-center text-[11px] text-muted">
              {d.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function compact(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(".0", "") + " M";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(".0", "") + " jt";
  if (n >= 1e3) return Math.round(n / 1e3) + " rb";
  return String(Math.round(n));
}

/** Batang horizontal untuk peringkat (mis. produk terlaris). */
export function RankBars({ rows, format }: { rows: { label: string; sub?: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="mb-1 flex justify-between gap-2">
            <span className="truncate font-medium">
              {r.label} {r.sub && <span className="font-normal text-muted">· {r.sub}</span>}
            </span>
            <span className="tabular-nums text-muted">{format(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-brand-50">
            <div className="h-2 rounded-full bg-brand-600" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
