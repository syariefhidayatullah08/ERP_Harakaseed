"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloudOff, CloudUpload, CheckCircle2, LogIn, Trash2 } from "lucide-react";
import type { SheetColumn, SheetDef } from "@/lib/sheets";
import { isDirty, loadRows, newRowId, saveRows, syncSheets, type LocalRow } from "@/lib/sheet-store";
import { Evaluator, formatValue, isError, type SheetSource } from "@/lib/sheet-formula";

type Status = { kind: "loading" | "saved" | "syncing" | "offline" | "auth" | "error"; message?: string; at?: string; next?: string };
type Cell = { r: number; c: number };
/** Bagian definisi lembar yang dibutuhkan tabel (dikirim dari server). */
export type GridSheet = Pick<SheetDef, "key" | "title" | "excelName" | "dataStart" | "notes"> & { columns: SheetColumn[] };

// Jadwal sinkron: online = real-time (ketikan langsung terkirim, perubahan orang lain diambil tiap 5 detik selama
// lembar terlihat); offline / gagal = dicoba lagi otomatis tiap 30 menit, atau langsung begitu internet kembali.
const SYNC_LIVE_MS = 5_000;
const SYNC_HIDDEN_MS = 60_000;
const SYNC_RETRY_MS = 30 * 60_000;
const SYNC_DEBOUNCE_MS = 400;
const clock = (d = new Date()) => d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const live = (rows: LocalRow[] | undefined) => (rows ?? []).filter((r) => !r.deleted);

type Shown = { text: string; error?: boolean; formula?: boolean; bg?: string };

/** Satu baris tabel; hanya digambar ulang bila isinya, pilihan sel, atau isian yang sedang diketik berubah. */
const Row = memo(function Row({
  pos,
  row,
  columns,
  shown,
  selCol,
  edit,
  onCell,
  onEdit,
  onFinish,
  onDelete,
}: {
  pos: number;
  row?: LocalRow;
  columns: SheetColumn[];
  shown: Shown[] | null;
  selCol: number;
  edit: string | null;
  onCell: (pos: number, c: number) => void;
  onEdit: (v: string) => void;
  onFinish: () => void;
  onDelete: (row: LocalRow) => void;
}) {
  return (
    <tr className={row ? "" : "bg-canvas/40"}>
      <td className="sticky left-0 z-[1] border border-line bg-canvas px-1 text-center text-xs text-muted">
        {pos}
        {row && isDirty(row) && <span title="Belum terkirim ke ERP" className="ml-0.5 inline-block size-1.5 rounded-full bg-amber-500 align-middle" />}
      </td>
      {columns.map((col, c) => {
        const active = selCol === c;
        const s = shown?.[c];
        return (
          <td
            key={col.key}
            onMouseDown={() => onCell(pos, c)}
            onDoubleClick={() => !col.computed && onEdit(row?.data[col.key] ?? "")}
            style={s?.bg ? { backgroundColor: s.bg } : undefined}
            className={`relative h-7 border border-line px-1.5 ${col.computed ? "bg-sky-50 italic text-sky-900" : ""} ${s && !s.error && /^-?[\d.]+$/.test(s.text) ? "text-right tabular-nums" : ""} ${s?.error ? "text-red-700" : ""} ${active ? "outline outline-2 -outline-offset-2 outline-brand-600" : ""}`}
          >
            {active && edit !== null ? (
              <>
                <input
                  autoFocus
                  value={edit}
                  list={col.options ? `opsi-${col.key}` : undefined}
                  onChange={(e) => onEdit(e.target.value)}
                  onBlur={onFinish}
                  className="absolute inset-0 w-full bg-white px-1.5 text-sm outline-none"
                />
                {col.options && (
                  <datalist id={`opsi-${col.key}`}>
                    {col.options.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                )}
              </>
            ) : (
              <span className="block truncate" title={s?.formula ? row?.data[col.key] || col.computed : undefined}>
                {s?.text}
              </span>
            )}
          </td>
        );
      })}
      <td className="border border-line text-center">
        {row && (
          <button type="button" tabIndex={-1} onClick={() => onDelete(row)} className="text-muted hover:text-red-700" aria-label="Hapus baris">
            <Trash2 size={13} />
          </button>
        )}
      </td>
    </tr>
  );
});

/**
 * Tabel seperti Excel untuk lembar kerja offline. Ketikan langsung tersimpan di laptop (IndexedDB) dan dikirim ke ERP
 * di latar belakang; tanpa internet lembar tetap bisa diisi dan terkirim otomatis begitu online lagi. Rumus dihitung
 * di laptop, termasuk yang merujuk lembar lain dalam keluarga yang sama (`family`).
 */
export function SheetGrid({ sheet, family, sameTabLogin = false }: { sheet: GridSheet; family: GridSheet[]; sameTabLogin?: boolean }) {
  const columns = sheet.columns;
  const familyKeys = useMemo(() => family.map((f) => f.key), [family]);
  const [store, setStore] = useState<Record<string, LocalRow[]>>({});
  const storeRef = useRef<Record<string, LocalRow[]>>({});
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [sel, setSelState] = useState<Cell>({ r: 0, c: 0 });
  const [edit, setEditState] = useState<string | null>(null);
  // Salinan langsung (tanpa menunggu render) agar ketikan cepat tidak hilang & Tab/Enter beruntun memakai sel yang benar.
  const selRef = useRef<Cell>({ r: 0, c: 0 });
  const editRef = useRef<string | null>(null);
  const setSel = (c: Cell) => {
    selRef.current = c;
    setSelState(c);
  };
  const setEdit = (v: string | null) => {
    editRef.current = v;
    setEditState(v);
  };
  const [filter, setFilter] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncing = useRef(false);
  const again = useRef(false);
  const nextRun = useRef<() => void>(() => {});

  const putStore = useCallback((next: Record<string, LocalRow[]>) => {
    storeRef.current = next;
    setStore(next);
  }, []);

  /* ------------------------------ Sinkronisasi ------------------------------ */

  const planSync = useCallback((ms: number, run: () => void) => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(run, ms);
  }, []);

  const runSync = useCallback(async (): Promise<void> => {
    if (syncing.current) {
      again.current = true;
      return;
    }
    syncing.current = true;
    again.current = false;
    setStatus((s) => ({ ...s, kind: "syncing" }));
    const res = await syncSheets(
      familyKeys,
      (k) => storeRef.current[k] ?? [],
      (updates) => putStore({ ...storeRef.current, ...updates }),
    );
    syncing.current = false;
    if (res.ok) {
      const own = res.errors[sheet.key];
      if (own) setStatus({ kind: "error", message: own, next: clock(new Date(Date.now() + SYNC_RETRY_MS)) });
      else setStatus({ kind: "saved", at: clock() });
      planSync(own ? SYNC_RETRY_MS : again.current ? SYNC_DEBOUNCE_MS : document.hidden ? SYNC_HIDDEN_MS : SYNC_LIVE_MS, () => nextRun.current());
    } else {
      setStatus({ kind: res.reason, message: res.message, next: clock(new Date(Date.now() + SYNC_RETRY_MS)) });
      planSync(SYNC_RETRY_MS, () => nextRun.current());
    }
  }, [familyKeys, sheet.key, planSync, putStore]);

  useEffect(() => {
    nextRun.current = () => void runSync();
  }, [runSync]);

  const scheduleSync = useCallback(() => {
    if (syncing.current) again.current = true;
    else planSync(SYNC_DEBOUNCE_MS, () => nextRun.current());
  }, [planSync]);

  // Muat dari laptop dulu (langsung tampil walau offline), lalu sinkron. Internet kembali / lembar dilihat lagi =
  // langsung sinkron tanpa menunggu jadwal.
  useEffect(() => {
    let alive = true;
    Promise.all(familyKeys.map(async (k) => [k, await loadRows(k)] as const)).then((pairs) => {
      if (!alive) return;
      putStore(Object.fromEntries(pairs));
      void runSync();
    });
    const now = () => void runSync();
    const offline = () => setStatus((s) => ({ ...s, kind: "offline", message: "Sedang offline", next: clock(new Date(Date.now() + SYNC_RETRY_MS)) }));
    const visible = () => {
      if (!document.hidden) void runSync();
    };
    window.addEventListener("online", now);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      window.removeEventListener("online", now);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [familyKeys, runSync, putStore]);

  // Halaman lembar tersimpan di perangkat lewat /sw.js (dipasang di layout oleh OfflineSupport).

  /* ------------------------------ Rumus ------------------------------ */

  // Satu evaluator per perubahan isi: semua lembar keluarga bisa saling dirujuk ('Nama Sheet'!A1).
  const { evaluator, sources } = useMemo(() => {
    const srcs = new Map<string, SheetSource>();
    const byName = new Map<string, SheetSource>();
    for (const f of family) {
      const rows = new Map(live(store[f.key]).map((r) => [r.position, r]));
      const positions = [...rows.keys()].sort((a, b) => a - b);
      const notes = new Map((f.notes ?? []).map((n) => [n.cell, n.formula ?? n.text]));
      const computed = new Map(f.columns.filter((c) => c.computed).map((c) => [c.key, c.computed!]));
      const src: SheetSource = {
        raw: (col, row) => rows.get(row)?.data[col] ?? (row < (f.dataStart ?? 1) ? (notes.get(`${col}${row}`) ?? "") : ""),
        rows: () => positions,
        computed: (col) => computed.get(col),
      };
      srcs.set(f.key, src);
      byName.set((f.excelName ?? f.title).trim().toLowerCase(), src);
    }
    const ev = new Evaluator({ sheet: (name) => byName.get(name.trim().toLowerCase()) ?? null });
    return { evaluator: ev, sources: srcs };
  }, [store, family]);
  const src = sources.get(sheet.key)!;

  const visible = useMemo(() => {
    const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
    return live(store[sheet.key])
      .filter((r) => words.every((w) => Object.entries(r.data).some(([k, v]) => !k.includes("#") && v.toLowerCase().includes(w))))
      .sort((a, b) => a.position - b.position);
  }, [store, sheet.key, filter]);

  // Tampilan semua sel (dihitung ulang hanya saat isi berubah, bukan saat pindah sel).
  const shownRows = useMemo(
    () =>
      visible.map((row) =>
        columns.map((col): Shown => {
          const raw = row.data[col.key] ?? "";
          const bg = row.data[`${col.key}#bg`];
          if (col.computed || raw.startsWith("=")) {
            const v = evaluator.value(src, col.key, row.position);
            return { text: formatValue(v), error: isError(v), formula: true, bg };
          }
          return { text: raw, bg };
        }),
      ),
    [visible, columns, evaluator, src],
  );

  const pending = (store[sheet.key] ?? []).filter(isDirty).length;
  const nextPos = live(store[sheet.key]).reduce((m, r) => Math.max(m, r.position), (sheet.dataStart ?? 1) - 1) + 1;

  /* ------------------------------ Mengisi sel ------------------------------ */

  /** Isi beberapa sel sekaligus (ketik / tempel). Baris di luar data dibuat baru di bawah, membawa rumus standar kolom. */
  const setCells = useCallback(
    async (start: Cell, block: string[][]) => {
      const current = storeRef.current[sheet.key] ?? [];
      const order = [...visible];
      let maxPos = live(current).reduce((m, r) => Math.max(m, r.position), (sheet.dataStart ?? 1) - 1);
      const changed = new Map<string, LocalRow>();
      block.forEach((line, i) => {
        let row = order[start.r + i];
        if (!row) {
          const position = ++maxPos;
          const data: Record<string, string> = {};
          const dirty: Record<string, true> = {};
          for (const c of columns) {
            if (!c.formula || c.computed) continue;
            data[c.key] = c.formula.replace(/\{r\}/g, String(position));
            dirty[c.key] = true;
          }
          row = { id: newRowId(), data, position, deleted: false, dirty, dirtyPosition: true };
          order.push(row);
        }
        const base = changed.get(row.id) ?? { ...row, data: { ...row.data }, dirty: { ...row.dirty } };
        line.forEach((value, j) => {
          const col = columns[start.c + j];
          if (!col || col.computed) return;
          if ((base.data[col.key] ?? "") === value) return;
          base.data[col.key] = value;
          base.dirty[col.key] = true;
        });
        if (Object.keys(base.dirty).length || base.dirtyPosition) changed.set(row.id, base);
      });
      if (!changed.size) return;
      const next = current.filter((r) => !changed.has(r.id)).concat([...changed.values()]);
      putStore({ ...storeRef.current, [sheet.key]: next });
      await saveRows(sheet.key, [...changed.values()]);
      scheduleSync();
    },
    [sheet.key, sheet.dataStart, visible, columns, putStore, scheduleSync],
  );

  const deleteRow = useCallback(
    async (row: LocalRow) => {
      if (!confirm(`Hapus baris ${row.position}?`)) return;
      const del = { ...row, deleted: true, dirtyDeleted: true };
      putStore({ ...storeRef.current, [sheet.key]: (storeRef.current[sheet.key] ?? []).map((r) => (r.id === row.id ? del : r)) });
      await saveRows(sheet.key, [del]);
      scheduleSync();
    },
    [sheet.key, putStore, scheduleSync],
  );

  const rowCount = visible.length + 1; // baris kosong paling bawah = baris baru
  const rawAt = (r: number, c: number) => visible[r]?.data[columns[c].key] ?? "";
  const move = (dr: number, dc: number) => {
    const s = selRef.current;
    setSel({ r: Math.min(Math.max(0, s.r + dr), rowCount - 1), c: Math.min(Math.max(0, s.c + dc), columns.length - 1) });
  };
  const finishEdit = useCallback(
    async (dr = 0, dc = 0) => {
      const cell = selRef.current;
      const value = editRef.current;
      setEdit(null);
      setSel({ r: Math.min(Math.max(0, cell.r + dr), visible.length + (value !== null && cell.r === visible.length ? 1 : 0)), c: Math.min(Math.max(0, cell.c + dc), columns.length - 1) });
      gridRef.current?.focus();
      if (value !== null) await setCells(cell, [[value]]);
    },
    [setCells, visible.length, columns.length],
  );

  const printable = (e: React.KeyboardEvent) => e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

  const onKeyDown = (e: React.KeyboardEvent) => {
    const s = selRef.current;
    if (editRef.current !== null) {
      // Huruf yang masuk sebelum kotak isian sempat fokus: tambahkan, jangan sampai hilang.
      if (printable(e) && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setEdit(editRef.current + e.key);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        void (e.key === "Enter" ? finishEdit(1, 0) : finishEdit(0, e.shiftKey ? -1 : 1));
      } else if (e.key === "Escape") {
        setEdit(null);
        gridRef.current?.focus();
      }
      return;
    }
    const keys: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Enter: [1, 0] };
    if (keys[e.key]) return (e.preventDefault(), move(...keys[e.key]));
    if (e.key === "Tab") return (e.preventDefault(), move(0, e.shiftKey ? -1 : 1));
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      void navigator.clipboard?.writeText(shownRows[s.r]?.[s.c]?.text ?? "").catch(() => {});
      return;
    }
    if (columns[s.c]?.computed) return;
    if (e.key === "F2") return (e.preventDefault(), setEdit(rawAt(s.r, s.c)));
    if (e.key === "Delete" || e.key === "Backspace") return (e.preventDefault(), void setCells(s, [[""]]));
    if (printable(e)) {
      e.preventDefault();
      setEdit(e.key);
    }
  };

  // Tempel dari Excel / spreadsheet: teks bertab & baris baru → blok sel mulai dari sel terpilih.
  const onPaste = (e: React.ClipboardEvent) => {
    if (editRef.current !== null) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    const block = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((l) => l.split("\t"));
    void setCells(selRef.current, block);
  };

  const onCell = useCallback(
    (pos: number, c: number) => {
      const r = visible.findIndex((x) => x.position === pos);
      const idx = r < 0 ? visible.length : r;
      if (editRef.current !== null && (idx !== selRef.current.r || c !== selRef.current.c)) void finishEdit();
      setSel({ r: idx, c });
      // Ketikan berikutnya selalu masuk ke tabel, walau fokus sebelumnya ada di tempat lain (mis. kotak cari).
      if (editRef.current === null) gridRef.current?.focus({ preventScroll: true });
    },
    [visible, finishEdit],
  );
  const onEdit = useCallback((v: string) => setEdit(v), []);
  const onFinish = useCallback(() => void finishEdit(), [finishEdit]);

  /* ------------------------------ Tampilan ------------------------------ */

  const badge = (() => {
    if (status.kind === "loading") return { icon: CloudUpload, tone: "text-muted", text: "Memuat…" };
    if (status.kind === "syncing") return { icon: CloudUpload, tone: "text-brand-700", text: "Mengirim ke ERP…" };
    if (status.kind === "auth") return { icon: LogIn, tone: "text-amber-700", text: status.message ?? "Login lagi" };
    if (status.kind === "offline" || status.kind === "error")
      return {
        icon: CloudOff,
        tone: "text-amber-700",
        text: `${status.kind === "offline" ? "Offline" : status.message} · ${pending} baris tersimpan di laptop · dicoba kirim lagi otomatis tiap 30 menit${status.next ? ` (berikutnya ${status.next})` : ""}, atau langsung saat internet kembali`,
      };
    return pending
      ? { icon: CloudUpload, tone: "text-brand-700", text: `${pending} baris tersimpan di laptop, segera terkirim` }
      : { icon: CheckCircle2, tone: "text-emerald-700", text: `Real-time · semua tersimpan & terkirim ke ERP${status.at ? ` · sinkron ${status.at}` : ""}` };
  })();

  // Judul kolom dua tingkat seperti di Excel: kelompok (mis. "Stock Seed Tersedia (gr)") di atas Male/Female.
  const hasGroups = columns.some((c) => c.group);
  const topRow: React.ReactNode[] = [];
  for (let i = 0; i < columns.length; i++) {
    const c = columns[i];
    if (!c.group) {
      topRow.push(
        <th key={c.key} rowSpan={hasGroups ? 2 : 1} className={`border border-line px-1.5 py-1 text-left text-xs font-semibold ${c.computed ? "bg-sky-100" : ""}`}>
          {c.label}
        </th>,
      );
      continue;
    }
    if (i > 0 && columns[i - 1].group === c.group) continue;
    let span = 1;
    while (columns[i + span]?.group === c.group) span++;
    topRow.push(
      <th key={c.key} colSpan={span} className={`border border-line px-1.5 py-1 text-center text-xs font-semibold ${c.computed ? "bg-sky-100" : ""}`}>
        {c.group}
      </th>,
    );
  }
  const width = columns.reduce((s, c) => s + (c.width ?? 120), 48 + 32);
  const noteText = (n: NonNullable<GridSheet["notes"]>[number]) => {
    if (!n.formula) return n.text;
    const m = n.cell.match(/^([A-Z]+)(\d+)$/);
    return m ? formatValue(evaluator.value(src, m[1], Number(m[2]))) : n.text;
  };

  return (
    <div className="space-y-3">
      {(sheet.notes?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {sheet.notes!.map((n) => (
            <span key={n.cell} title={`Sel ${n.cell}`} style={n.bg ? { backgroundColor: n.bg } : undefined} className={`rounded px-2 py-0.5 ${n.bg ? "font-medium text-ink" : "bg-canvas text-muted"}`}>
              {noteText(n)}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${badge.tone}`}>
          <badge.icon size={16} /> {badge.text}
        </span>
        {status.kind === "auth" && (
          // Di /offline (tanpa login) cukup pindah halaman: isian sudah tersimpan di perangkat dan terkirim setelah login.
          sameTabLogin ? (
            <a href="/login" className="btn-secondary btn-sm">
              Login untuk mengirim
            </a>
          ) : (
            <a href="/login" target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
              Login lagi (tab baru)
            </a>
          )
        )}
        <button type="button" className="btn-secondary btn-sm" onClick={() => void runSync()} disabled={status.kind === "syncing"}>
          Kirim sekarang
        </button>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Cari di lembar…" className="input ml-auto w-56 py-1 text-sm" />
      </div>

      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        className="max-h-[70vh] overflow-auto rounded-lg border border-line bg-white outline-none focus:ring-2 focus:ring-brand-300"
      >
        <table className="border-collapse text-sm" style={{ width, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 48 }} />
            {columns.map((c) => (
              <col key={c.key} style={{ width: c.width ?? 120 }} />
            ))}
            <col style={{ width: 32 }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-canvas">
            <tr>
              <th className="sticky left-0 z-[2] border border-line bg-canvas" />
              {columns.map((c) => (
                <th key={c.key} className="border border-line py-0.5 text-center text-[10px] font-normal text-muted">
                  {c.key}
                </th>
              ))}
              <th className="border border-line" />
            </tr>
            <tr>
              <th rowSpan={hasGroups ? 2 : 1} className="sticky left-0 z-[2] border border-line bg-canvas text-[10px] font-normal text-muted">
                baris
              </th>
              {topRow}
              <th rowSpan={hasGroups ? 2 : 1} className="border border-line" />
            </tr>
            {hasGroups && (
              <tr>
                {columns
                  .filter((c) => c.group)
                  .map((c) => (
                    <th key={c.key} className={`border border-line px-1.5 py-1 text-left text-xs font-semibold ${c.computed ? "bg-sky-100" : ""}`}>
                      {c.label}
                    </th>
                  ))}
              </tr>
            )}
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, r) => {
              const row = visible[r];
              return (
                <Row
                  key={row?.id ?? "baru"}
                  pos={row?.position ?? nextPos}
                  row={row}
                  columns={columns}
                  shown={row ? shownRows[r] : null}
                  selCol={sel.r === r ? sel.c : -1}
                  edit={sel.r === r ? edit : null}
                  onCell={onCell}
                  onEdit={onEdit}
                  onFinish={onFinish}
                  onDelete={deleteRow}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Nomor baris & huruf kolom sama dengan file Excel. Klik sel lalu ketik (Enter/Tab untuk pindah, F2 atau klik dua kali untuk mengubah & melihat rumus,
        Delete untuk mengosongkan). Rumus diawali &ldquo;=&rdquo; seperti di Excel. Salin blok dari Excel lalu Ctrl+V. Ketik di baris paling bawah untuk menambah
        baris; rumus standar kolom ikut terisi. Kolom biru = otomatis. Titik oranye = belum terkirim ke ERP.
      </p>
    </div>
  );
}
