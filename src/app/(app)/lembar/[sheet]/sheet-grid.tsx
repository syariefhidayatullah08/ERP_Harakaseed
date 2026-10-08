"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { CloudOff, CloudUpload, CheckCircle2, Eye, EyeOff, FileSpreadsheet, LogIn, Redo2, Trash2, Undo2 } from "lucide-react";
import type { CellStyle, GridSheet, SheetColumn, SheetTabs } from "@/lib/sheets";
import { isDirty, loadRows, newRowId, saveRows, syncSheets, type LocalRow } from "@/lib/sheet-store";
import { Evaluator, formatCell, isError, type SheetSource } from "@/lib/sheet-formula";

export type { GridSheet } from "@/lib/sheets";

type Status = { kind: "loading" | "saved" | "syncing" | "offline" | "auth" | "error"; message?: string; at?: string; next?: string };
type Cell = { r: number; c: number };
/** Satu baris layar: nomor baris Excel + isinya (kosong = baris yang belum diisi, tetap bisa diketik). */
type Slot = { pos: number; row?: LocalRow };
/**
 * Satu langkah yang bisa dibatalkan (Ctrl+Z): isi sel sebelum & sesudah per baris. null = baris belum ada / terhapus.
 * Hanya kolom yang diubah yang dicatat, supaya membatalkan tidak menimpa isian orang lain di baris yang sama.
 */
type HistRow = { id: string; position: number; keys: string[]; before: Record<string, string> | null; after: Record<string, string> | null };
type HistEntry = { rows: HistRow[]; cell: Cell };
const HISTORY_MAX = 100;

// Jadwal sinkron: online = real-time (ketikan langsung terkirim, perubahan orang lain diambil tiap 5 detik selama
// lembar terlihat); offline / gagal = dicoba lagi otomatis tiap 30 menit, atau langsung begitu internet kembali.
const SYNC_LIVE_MS = 5_000;
const SYNC_HIDDEN_MS = 60_000;
const SYNC_RETRY_MS = 30 * 60_000;
const SYNC_DEBOUNCE_MS = 400;
const clock = (d = new Date()) => d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const live = (rows: LocalRow[] | undefined) => (rows ?? []).filter((r) => !r.deleted);

// Tampilan Excel.
const XL_FONT = 'Calibri, Carlito, "Segoe UI", Arial, sans-serif';
const GRIDLINE = "#E1E1E1";
const XL_GREEN = "#107C41";
const HDR_BG = "#F3F3F3";
const ROW_HDR = 44;
const ROW_H = 20;
const BLANK_ROWS = 30; // baris kosong di bawah data, seperti lembar Excel yang tidak berujung

/** Gaya sel Excel → CSS. Garis atas/kiri digambar ke dalam sel (box-shadow) agar tidak menebalkan garis tetangga. */
function cssOf(st: CellStyle | undefined, wrapDefault = false): CSSProperties {
  const css: CSSProperties = { borderRight: `1px solid ${GRIDLINE}`, borderBottom: `1px solid ${GRIDLINE}`, whiteSpace: wrapDefault ? "pre-wrap" : "nowrap", verticalAlign: "bottom" };
  if (!st) return css;
  if (st.b) css.fontWeight = 700;
  if (st.i) css.fontStyle = "italic";
  if (st.u) css.textDecoration = "underline";
  if (st.z) css.fontSize = `${(st.z * 4) / 3}px`;
  if (st.c) css.color = st.c;
  if (st.f) {
    css.background = st.f;
    css.borderRight = css.borderBottom = `1px solid ${st.f}`; // sel berwarna menutupi garis bantu, seperti Excel
  }
  if (st.h) css.textAlign = st.h === "center" || st.h === "distributed" ? "center" : st.h === "right" ? "right" : st.h === "justify" ? "justify" : "left";
  if (st.v) css.verticalAlign = st.v === "center" ? "middle" : st.v === "top" ? "top" : "bottom";
  if (st.w) css.whiteSpace = "pre-wrap";
  const bd = st.bd ?? "";
  if (/[rR]/.test(bd)) css.borderRight = `${bd.includes("R") ? 2 : 1}px solid #000`;
  if (/[bB]/.test(bd)) css.borderBottom = `${bd.includes("B") ? 2 : 1}px solid #000`;
  const inset = [/[tT]/.test(bd) && `inset 0 ${bd.includes("T") ? 2 : 1}px 0 #000`, /[lL]/.test(bd) && `inset ${bd.includes("L") ? 2 : 1}px 0 0 #000`].filter(Boolean);
  if (inset.length) css.boxShadow = inset.join(",");
  return css;
}

const colNum = (c: string) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const splitAddr = (a: string) => {
  const m = a.match(/^([A-Z]+)(\d+)$/)!;
  return { col: m[1], row: Number(m[2]) };
};

const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia("(min-width: 768px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

type Shown = { text: string; error?: boolean; num?: boolean; bg?: string; spill?: boolean };

/** Satu baris tabel; hanya digambar ulang bila isinya, pilihan sel, atau isian yang sedang diketik berubah. */
const Row = memo(function Row({
  index,
  pos,
  row,
  columns,
  colCss,
  height,
  shown,
  selCol,
  edit,
  editInCell,
  onCell,
  onEdit,
  onFinish,
}: {
  index: number;
  pos: number;
  row?: LocalRow;
  columns: SheetColumn[];
  colCss: CSSProperties[];
  height: number;
  shown: Shown[] | null;
  selCol: number;
  edit: string | null;
  editInCell: boolean;
  onCell: (index: number, c: number) => void;
  onEdit: (v: string) => void;
  onFinish: () => void;
}) {
  const selected = selCol >= 0;
  return (
    <tr style={{ height }}>
      <td
        className="sticky left-0 z-[6] select-none px-1 text-right text-[11px] tabular-nums"
        style={{ background: selected ? "#D2D2D2" : HDR_BG, color: selected ? XL_GREEN : "#444", fontWeight: selected ? 700 : 400, borderRight: `1px solid ${selected ? XL_GREEN : "#C8C8C8"}`, borderBottom: "1px solid #DADADA" }}
      >
        {row && isDirty(row) && <span title="Belum terkirim ke ERP" className="mr-1 inline-block size-1.5 rounded-full bg-amber-500 align-middle" />}
        {pos}
      </td>
      {columns.map((col, c) => {
        const active = selCol === c;
        const s = shown?.[c];
        const style: CSSProperties = { ...colCss[c] };
        if (s?.bg) style.background = s.bg;
        if (!style.textAlign && s?.num) style.textAlign = "right";
        if (s?.error) style.color = "#C00000";
        if (s?.spill) style.zIndex = Math.max(Number(style.zIndex ?? 0), 2) + 1; // di atas sel tetangga yang ditimpa
        if (active) {
          style.outline = `2px solid ${XL_GREEN}`;
          style.outlineOffset = "-1px";
          style.zIndex = 4;
        }
        return (
          <td
            key={col.key}
            data-cell={`${index}:${c}`}
            onMouseDown={() => onCell(index, c)}
            onDoubleClick={() => !col.computed && onEdit(row?.data[col.key] ?? "")}
            style={style}
            className={`relative px-[3px] leading-[1.15] ${s?.spill ? "overflow-visible" : "overflow-hidden"}`}
          >
            {active && edit !== null && editInCell ? (
              <>
                <input
                  autoFocus
                  value={edit}
                  list={col.options ? `opsi-${col.key}` : undefined}
                  onChange={(e) => onEdit(e.target.value)}
                  onBlur={onFinish}
                  className="absolute inset-0 z-[5] w-full bg-white px-[3px] outline-none"
                  style={{ font: "inherit", minWidth: "100%", boxShadow: `inset 0 0 0 2px ${XL_GREEN}` }}
                />
                {col.options && (
                  <datalist id={`opsi-${col.key}`}>
                    {col.options.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                )}
              </>
            ) : active && edit !== null ? (
              <span className="block overflow-hidden">{edit}</span>
            ) : s?.spill ? (
              <span className="pointer-events-none relative z-[2] whitespace-nowrap">{s.text}</span>
            ) : (
              <span className="block overflow-hidden" style={{ textOverflow: "clip" }}>
                {s?.text}
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
});

/**
 * Lembar kerja seperti Excel (1:1 dengan file asal: judul, sel gabungan, lebar kolom, warna, garis, format angka, baris
 * beku, nomor baris & huruf kolom). Ketikan langsung tersimpan di perangkat (IndexedDB) dan dikirim ke ERP di latar
 * belakang; tanpa internet tetap bisa diisi dan terkirim otomatis begitu online lagi. Rumus dihitung di perangkat,
 * termasuk yang merujuk sheet lain dalam keluarga yang sama (`family`).
 */
export function SheetGrid({
  sheet,
  family,
  sameTabLogin = false,
  tabs,
  fileTitle,
  actions,
}: {
  sheet: GridSheet;
  family: GridSheet[];
  sameTabLogin?: boolean;
  tabs?: SheetTabs;
  fileTitle?: string;
  actions?: ReactNode;
}) {
  const familyKeys = useMemo(() => family.map((f) => f.key), [family]);
  const [store, setStore] = useState<Record<string, LocalRow[]>>({});
  const storeRef = useRef<Record<string, LocalRow[]>>({});
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [sel, setSelState] = useState<Cell>({ r: 0, c: 0 });
  const [edit, setEditState] = useState<string | null>(null);
  const [editInCell, setEditInCell] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
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
  // Riwayat untuk Ctrl+Z / Ctrl+Y. Baris yang dibuat ulang saat membatalkan hapus mendapat id baru (alias).
  const undoStack = useRef<HistEntry[]>([]);
  const redoStack = useRef<HistEntry[]>([]);
  const alias = useRef(new Map<string, string>());
  const [histSize, setHistSize] = useState({ undo: 0, redo: 0 });
  const record = useCallback((entry: HistEntry) => {
    undoStack.current = [...undoStack.current.slice(-(HISTORY_MAX - 1)), entry];
    redoStack.current = [];
    setHistSize({ undo: undoStack.current.length, redo: 0 });
  }, []);
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 768px)").matches, () => true);

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

  // Muat dari perangkat dulu (langsung tampil walau offline), lalu sinkron. Internet kembali / lembar dilihat lagi =
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

  /* ------------------------------ Rumus ------------------------------ */

  // Satu evaluator per perubahan isi: semua lembar keluarga bisa saling dirujuk ('Nama Sheet'!A1).
  const { evaluator, sources } = useMemo(() => {
    const srcs = new Map<string, SheetSource>();
    const byName = new Map<string, SheetSource>();
    for (const f of family) {
      const rows = new Map(live(store[f.key]).map((r) => [r.position, r]));
      const positions = [...rows.keys()].sort((a, b) => a - b);
      const head = new Map<string, string>((f.notes ?? []).map((n) => [n.cell, n.formula ?? n.text]));
      for (const [addr, c] of Object.entries(f.head?.cells ?? {})) if (c.f || c.t) head.set(addr, c.f ?? c.t ?? "");
      const computed = new Map(f.columns.filter((c) => c.computed).map((c) => [c.key, c.computed!]));
      const src: SheetSource = {
        raw: (col, row) => rows.get(row)?.data[col] ?? (row < (f.dataStart ?? 1) ? (head.get(`${col}${row}`) ?? "") : ""),
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

  /* ------------------------------ Susunan tampilan ------------------------------ */

  const dataStart = sheet.dataStart ?? 1;
  const hiddenCount = sheet.columns.filter((c) => c.hidden).length;
  const columns = useMemo(() => sheet.columns.filter((c) => showHidden || !c.hidden), [sheet.columns, showHidden]);
  const styleOf = useCallback((i?: number) => (i === undefined ? undefined : sheet.styles?.[i]), [sheet.styles]);

  // Kolom beku (Freeze Panes) hanya di layar lebar; di HP kolom beku memakan seluruh layar.
  const frozenKeys = useMemo(() => new Set(wide ? sheet.columns.slice(0, sheet.freeze?.x ?? 0).map((c) => c.key) : []), [wide, sheet.columns, sheet.freeze]);
  const lefts = useMemo(() => {
    const out: (number | null)[] = [];
    let x = ROW_HDR;
    for (const c of columns) {
      out.push(frozenKeys.has(c.key) ? x : null);
      x += c.width ?? 64;
    }
    return out;
  }, [columns, frozenKeys]);
  const sticky = (i: number, z = 2): CSSProperties => (lefts[i] === null ? {} : { position: "sticky", left: lefts[i]!, zIndex: z });

  const colCss = useMemo(
    () =>
      columns.map((c, i) => {
        const css = cssOf(styleOf(c.s));
        if (lefts[i] !== null) Object.assign(css, { position: "sticky", left: lefts[i], zIndex: 2, background: css.background ?? "#fff" });
        return css;
      }),
    [columns, styleOf, lefts],
  );

  const slots = useMemo((): Slot[] => {
    const rows = live(store[sheet.key]).sort((a, b) => a.position - b.position);
    const maxPos = rows.reduce((m, r) => Math.max(m, r.position), dataStart - 1);
    const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length) {
      const hit = rows.filter((r) => words.every((w) => Object.entries(r.data).some(([k, v]) => !k.includes("#") && v.toLowerCase().includes(w))));
      return [...hit.map((r) => ({ pos: r.position, row: r })), { pos: maxPos + 1 }];
    }
    // Semua nomor baris berurutan seperti Excel: baris kosong di sela data tetap tampil & bisa diisi.
    const out: Slot[] = [];
    let p = dataStart;
    for (const r of rows) {
      while (p < r.position) out.push({ pos: p++ });
      out.push({ pos: r.position, row: r });
      p = Math.max(p, r.position + 1);
    }
    for (const end = p + BLANK_ROWS; p < end; p++) out.push({ pos: p });
    return out;
  }, [store, sheet.key, filter, dataStart]);

  // Tampilan semua sel (dihitung ulang hanya saat isi berubah, bukan saat pindah sel).
  const shownRows = useMemo(
    () =>
      slots.map(({ row }) => {
        if (!row) return null;
        const out = columns.map((col): Shown => {
          const raw = row.data[col.key] ?? "";
          const bg = row.data[`${col.key}#bg`];
          if (col.computed || raw.startsWith("=")) {
            const v = evaluator.value(src, col.key, row.position);
            return { text: formatCell(v, col.fmt), error: isError(v), num: typeof v === "number", bg };
          }
          if (raw && col.fmt && /^-?\d+(\.\d+)?$/.test(raw)) return { text: formatCell(Number(raw), col.fmt), num: true, bg };
          return { text: raw, num: /^-?\d+([.,]\d+)?$/.test(raw), bg };
        });
        // Teks panjang meluber ke sel kanan yang kosong, seperti Excel.
        out.forEach((s, i) => {
          if (s.text && !s.num && !s.error && i + 1 < out.length && !out[i + 1].text && !styleOf(columns[i].s)?.w) s.spill = true;
        });
        return out;
      }),
    [slots, columns, evaluator, src, styleOf],
  );

  // Baris judul di atas data (persis Excel), termasuk sel gabungan.
  const headRows = useMemo(() => {
    const head = sheet.head;
    if (!head) return null;
    const visibleIdx = new Map(columns.map((c, i) => [c.key, i]));
    const merges = (head.merges ?? []).map((m) => {
      const [a, b] = m.split(":").map(splitAddr);
      return { r1: a.row, c1: colNum(a.col), r2: b.row, c2: colNum(b.col) };
    });
    const covered = new Map<string, { master: string }>();
    const span = new Map<string, { colSpan: number; rowSpan: number; anchor: string }>();
    for (const m of merges) {
      const keys = sheet.columns.filter((c) => colNum(c.key) >= m.c1 && colNum(c.key) <= m.c2 && visibleIdx.has(c.key)).map((c) => c.key);
      if (!keys.length) continue;
      const master = `${sheet.columns.find((c) => colNum(c.key) === m.c1)?.key ?? keys[0]}${m.r1}`;
      span.set(master, { colSpan: keys.length, rowSpan: m.r2 - m.r1 + 1, anchor: `${keys[0]}${m.r1}` });
      for (let r = m.r1; r <= m.r2; r++) for (const k of keys) if (`${k}${r}` !== `${keys[0]}${m.r1}`) covered.set(`${k}${r}`, { master });
    }
    const anchors = new Map([...span].map(([master, s]) => [s.anchor, { ...s, master }]));
    return Array.from({ length: head.rows }, (_, i) => {
      const r = i + 1;
      const cells: { key: string; idx: number; addr: string; colSpan: number; rowSpan: number }[] = [];
      columns.forEach((c, idx) => {
        const addr = `${c.key}${r}`;
        if (covered.has(addr)) return;
        const a = anchors.get(addr);
        cells.push({ key: c.key, idx, addr: a?.master ?? addr, colSpan: a?.colSpan ?? 1, rowSpan: a?.rowSpan ?? 1 });
      });
      return { r, height: head.heights?.[r] ?? sheet.rowHeight ?? ROW_H, cells };
    });
  }, [sheet.head, sheet.columns, sheet.rowHeight, columns]);

  const headText = (addr: string) => {
    const c = sheet.head?.cells[addr];
    if (!c) return "";
    if (!c.f) return c.t ?? "";
    const { col, row } = splitAddr(addr);
    return formatCell(evaluator.value(src, col, row));
  };

  const pending = (store[sheet.key] ?? []).filter(isDirty).length;

  /* ------------------------------ Mengisi sel ------------------------------ */

  /** Isi beberapa sel sekaligus (ketik / tempel). Baris kosong diisi di nomor barisnya, membawa rumus standar kolom. */
  const setCells = useCallback(
    async (start: Cell, block: string[][]) => {
      const current = storeRef.current[sheet.key] ?? [];
      const lastPos = slots.at(-1)?.pos ?? dataStart - 1;
      const changed = new Map<string, LocalRow>();
      const originals = new Map<string, Record<string, string> | null>();
      block.forEach((line, i) => {
        const at = start.r + i;
        const slot = slots[at];
        let row = slot?.row ? (changed.get(slot.row.id) ?? slot.row) : undefined;
        if (!row) {
          const position = slot ? slot.pos : lastPos + (at - slots.length + 1);
          const data: Record<string, string> = {};
          const dirty: Record<string, true> = {};
          for (const c of sheet.columns) {
            if (!c.formula || c.computed) continue;
            data[c.key] = c.formula.replace(/\{r\}/g, String(position));
            dirty[c.key] = true;
          }
          row = { id: newRowId(), data, position, deleted: false, dirty, dirtyPosition: true };
        }
        if (!originals.has(row.id)) originals.set(row.id, slot?.row && slot.row.id === row.id ? { ...slot.row.data } : null);
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
      const hist: HistRow[] = [];
      for (const r of changed.values()) {
        const before = originals.get(r.id) ?? null;
        const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(r.data)])].filter((k) => (before?.[k] ?? "") !== (r.data[k] ?? ""));
        if (keys.length || !before) hist.push({ id: r.id, position: r.position, keys, before, after: { ...r.data } });
      }
      if (hist.length) record({ rows: hist, cell: start });
      const next = current.filter((r) => !changed.has(r.id)).concat([...changed.values()]);
      putStore({ ...storeRef.current, [sheet.key]: next });
      await saveRows(sheet.key, [...changed.values()]);
      scheduleSync();
    },
    [sheet.key, sheet.columns, dataStart, slots, columns, putStore, scheduleSync, record],
  );

  const deleteRow = useCallback(
    async (row: LocalRow) => {
      if (!confirm(`Hapus isi baris ${row.position}?`)) return;
      const del = { ...row, deleted: true, dirtyDeleted: true };
      record({ rows: [{ id: row.id, position: row.position, keys: Object.keys(row.data), before: { ...row.data }, after: null }], cell: selRef.current });
      putStore({ ...storeRef.current, [sheet.key]: (storeRef.current[sheet.key] ?? []).map((r) => (r.id === row.id ? del : r)) });
      await saveRows(sheet.key, [del]);
      scheduleSync();
    },
    [sheet.key, putStore, scheduleSync, record],
  );

  /** Batalkan (Ctrl+Z) / ulangi (Ctrl+Y): kembalikan sel yang diubah ke isi sebelum/sesudahnya, lalu kirim ke ERP. */
  const travel = useCallback(
    async (dir: "undo" | "redo") => {
      const from = dir === "undo" ? undoStack : redoStack;
      const to = dir === "undo" ? redoStack : undoStack;
      const entry = from.current.at(-1);
      if (!entry) return;
      from.current = from.current.slice(0, -1);
      to.current = [...to.current, entry];
      setHistSize({ undo: undoStack.current.length, redo: redoStack.current.length });
      const resolve = (id: string) => {
        let cur = id;
        for (let i = 0; i < 20 && alias.current.has(cur); i++) cur = alias.current.get(cur)!;
        return cur;
      };
      const rows = storeRef.current[sheet.key] ?? [];
      const byId = new Map(rows.map((r) => [r.id, r]));
      const changed: LocalRow[] = [];
      for (const h of entry.rows) {
        const target = dir === "undo" ? h.before : h.after;
        const cur = byId.get(resolve(h.id));
        if (target === null) {
          if (cur && !cur.deleted) changed.push({ ...cur, deleted: true, dirtyDeleted: true });
        } else if (cur && !cur.deleted) {
          const data = { ...cur.data };
          const dirty = { ...cur.dirty };
          for (const k of h.keys) {
            if ((data[k] ?? "") === (target[k] ?? "")) continue;
            data[k] = target[k] ?? "";
            dirty[k] = true;
          }
          changed.push({ ...cur, data, dirty });
        } else {
          // Baris yang terhapus tidak bisa dihidupkan lagi di server: dibuat baris baru dengan isi & nomor baris yang sama.
          const id = newRowId();
          alias.current.set(resolve(h.id), id);
          const data = Object.fromEntries(Object.entries(target).filter(([, v]) => v !== ""));
          changed.push({ id, data, position: h.position, deleted: false, dirty: Object.fromEntries(Object.keys(data).map((k) => [k, true as const])), dirtyPosition: true });
        }
      }
      if (!changed.length) return;
      const ids = new Set(changed.map((r) => r.id));
      putStore({ ...storeRef.current, [sheet.key]: rows.filter((r) => !ids.has(r.id)).concat(changed) });
      setSel(entry.cell);
      await saveRows(sheet.key, changed);
      scheduleSync();
    },
    [sheet.key, putStore, scheduleSync],
  );

  // Ctrl+Z / Ctrl+Y tetap berlaku walau fokus sedang di tombol (mis. sesudah klik "Hapus baris"), kecuali saat mengetik
  // di kotak isian lain (kotak itu punya batalkan sendiri).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!(e.ctrlKey || e.metaKey) || (k !== "z" && k !== "y")) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t && (gridRef.current?.contains(t) || t.closest("input, textarea, select, [contenteditable='true']"))) return;
      e.preventDefault();
      void travel(k === "y" || e.shiftKey ? "redo" : "undo");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [travel]);

  const rowCount = slots.length;
  const rawAt = (r: number, c: number) => slots[r]?.row?.data[columns[c]?.key] ?? "";
  const move = (dr: number, dc: number) => {
    const s = selRef.current;
    setSel({ r: Math.min(Math.max(0, s.r + dr), rowCount - 1), c: Math.min(Math.max(0, s.c + dc), columns.length - 1) });
  };
  const finishEdit = useCallback(
    async (dr = 0, dc = 0) => {
      const cell = selRef.current;
      const value = editRef.current;
      setEdit(null);
      setSel({ r: Math.min(Math.max(0, cell.r + dr), slots.length - 1), c: Math.min(Math.max(0, cell.c + dc), columns.length - 1) });
      gridRef.current?.focus({ preventScroll: true });
      if (value !== null) await setCells(cell, [[value]]);
    },
    [setCells, slots.length, columns.length],
  );

  const startEdit = (value: string, inCell = true) => {
    setEditInCell(inCell);
    setEdit(value);
  };

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
        void (e.key === "Enter" ? finishEdit(e.shiftKey ? -1 : 1, 0) : finishEdit(0, e.shiftKey ? -1 : 1));
      } else if (e.key === "Escape") {
        setEdit(null);
        gridRef.current?.focus();
      }
      return;
    }
    const keys: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Enter: [e.shiftKey ? -1 : 1, 0] };
    if (keys[e.key]) return (e.preventDefault(), move(...keys[e.key]));
    if (e.key === "Tab") return (e.preventDefault(), move(0, e.shiftKey ? -1 : 1));
    if (e.key === "PageDown" || e.key === "PageUp") return (e.preventDefault(), move(e.key === "PageDown" ? 20 : -20, 0));
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) {
      e.preventDefault();
      void travel(e.key.toLowerCase() === "y" || e.shiftKey ? "redo" : "undo");
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      void navigator.clipboard?.writeText(shownRows[s.r]?.[s.c]?.text ?? "").catch(() => {});
      return;
    }
    // Ctrl + "-" seperti Excel: hapus baris.
    if ((e.ctrlKey || e.metaKey) && e.key === "-") {
      e.preventDefault();
      const row = slots[s.r]?.row;
      if (row) void deleteRow(row);
      return;
    }
    if (columns[s.c]?.computed) return;
    if (e.key === "F2") return (e.preventDefault(), startEdit(rawAt(s.r, s.c)));
    if (e.key === "Delete" || e.key === "Backspace") return (e.preventDefault(), void setCells(s, [[""]]));
    if (printable(e)) {
      e.preventDefault();
      startEdit(e.key);
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
    (index: number, c: number) => {
      if (editRef.current !== null && (index !== selRef.current.r || c !== selRef.current.c)) void finishEdit();
      setSel({ r: index, c });
      // Ketikan berikutnya selalu masuk ke tabel, walau fokus sebelumnya ada di tempat lain (mis. kotak cari).
      if (editRef.current === null) gridRef.current?.focus({ preventScroll: true });
    },
    [finishEdit],
  );
  const onEdit = useCallback((v: string) => {
    setEditInCell(true);
    setEdit(v);
  }, []);
  const onFinish = useCallback(() => void finishEdit(), [finishEdit]);

  // Sel terpilih selalu terlihat saat berpindah dengan keyboard.
  useEffect(() => {
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-cell="${sel.r}:${sel.c}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [sel]);

  /* ------------------------------ Tampilan ------------------------------ */

  const badge = (() => {
    if (status.kind === "loading") return { icon: CloudUpload, tone: "text-[#444]", text: "Memuat…" };
    if (status.kind === "syncing") return { icon: CloudUpload, tone: "text-brand-700", text: "Mengirim ke ERP…" };
    if (status.kind === "auth") return { icon: LogIn, tone: "text-amber-700", text: status.message ?? "Login lagi" };
    if (status.kind === "offline" || status.kind === "error")
      return {
        icon: CloudOff,
        tone: "text-amber-700",
        text: `${status.kind === "offline" ? "Offline" : status.message} · ${pending} baris tersimpan di perangkat · dikirim otomatis saat ada sinyal${status.next ? ` (dicoba lagi ${status.next})` : ""}`,
      };
    return pending
      ? { icon: CloudUpload, tone: "text-brand-700", text: `${pending} baris tersimpan di perangkat, segera terkirim` }
      : { icon: CheckCircle2, tone: "text-emerald-700", text: `Real-time · semua tersimpan & terkirim ke ERP${status.at ? ` · sinkron ${status.at}` : ""}` };
  })();

  const selCol = columns[sel.c];
  const selSlot = slots[sel.r];
  const address = selCol && selSlot ? `${selCol.key}${selSlot.pos}` : "";
  const barValue = edit !== null ? edit : selCol?.computed ? selCol.computed.replace(/\{r\}/g, String(selSlot?.pos ?? "")) : rawAt(sel.r, sel.c);
  const width = columns.reduce((s, c) => s + (c.width ?? 64), ROW_HDR);
  const frozenHead = (sheet.freeze?.y ?? 0) > 0;
  const rowH = sheet.rowHeight ?? ROW_H;

  const letterRow = (
    <tr style={{ height: 20 }}>
      <th className="sticky left-0 z-[7]" style={{ background: HDR_BG, borderRight: "1px solid #C8C8C8", borderBottom: "1px solid #C8C8C8" }}>
        <span className="ml-auto mr-0.5 mt-2 block size-0 border-b-[7px] border-l-[7px] border-b-[#B7B7B7] border-l-transparent" />
      </th>
      {columns.map((c, i) => {
        const on = i === sel.c;
        return (
          <th
            key={c.key}
            className="text-center text-[11px] font-normal"
            style={{ ...sticky(i, 5), background: on ? "#D2D2D2" : c.hidden ? "#FBE9E7" : HDR_BG, color: on ? XL_GREEN : "#444", fontWeight: on ? 700 : 400, borderRight: "1px solid #DADADA", borderBottom: `${on ? 2 : 1}px solid ${on ? XL_GREEN : "#C8C8C8"}` }}
            title={c.hidden ? "Kolom tersembunyi di Excel" : undefined}
          >
            {c.key}
          </th>
        );
      })}
    </tr>
  );

  const headTrs = headRows
    ? headRows.map((hr) => (
        <tr key={`h${hr.r}`} style={{ height: hr.height }}>
          <td className="sticky left-0 z-[6] select-none px-1 text-right text-[11px] tabular-nums" style={{ background: HDR_BG, color: "#444", borderRight: "1px solid #C8C8C8", borderBottom: "1px solid #DADADA" }}>
            {hr.r}
          </td>
          {hr.cells.map((cell) => {
            const st = styleOf(sheet.head?.cells[cell.addr]?.s);
            const css = cssOf(st);
            const text = headText(cell.addr);
            const spill = !!text && cell.colSpan === 1 && !st?.w;
            return (
              <td
                key={cell.addr}
                colSpan={cell.colSpan}
                rowSpan={cell.rowSpan}
                style={{ ...css, ...(cell.colSpan === 1 ? sticky(cell.idx, 2) : {}), background: css.background ?? "#fff", ...(spill ? { zIndex: lefts[cell.idx] === null ? 3 : 4 } : {}) }}
                className={`relative px-[3px] leading-[1.15] ${spill ? "overflow-visible" : "overflow-hidden"}`}
              >
                <span className={spill ? "relative z-[2] whitespace-nowrap" : "block"}>{text}</span>
              </td>
            );
          })}
        </tr>
      ))
    : null;

  return (
    <div className="overflow-hidden rounded-md border border-[#C8C8C8] bg-white shadow-sm" style={{ fontFamily: XL_FONT }}>
      {/* Bilah judul seperti Excel: nama file & sheet */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-white" style={{ background: XL_GREEN }}>
        <FileSpreadsheet size={16} />
        <span className="min-w-0 flex-1 truncate text-[13px]">
          {fileTitle ? `${fileTitle}.xlsx — ` : ""}
          <b>{(sheet.excelName ?? sheet.title).trim()}</b>
        </span>
        {actions}
      </div>

      {/* Bilah alat: cari, kolom tersembunyi, hapus baris */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#DADADA] bg-[#F8F8F8] px-2 py-1.5 text-[12px]">
        <button type="button" title="Batalkan (Ctrl+Z)" aria-label="Batalkan" disabled={!histSize.undo} onClick={() => void travel("undo")} className="inline-flex h-7 items-center gap-1 rounded border border-[#C8C8C8] bg-white px-2 hover:bg-[#EDEDED] disabled:opacity-40">
          <Undo2 size={14} /> <span className="hidden sm:inline">Batalkan</span>
        </button>
        <button type="button" title="Ulangi (Ctrl+Y)" aria-label="Ulangi" disabled={!histSize.redo} onClick={() => void travel("redo")} className="inline-flex h-7 items-center gap-1 rounded border border-[#C8C8C8] bg-white px-2 hover:bg-[#EDEDED] disabled:opacity-40">
          <Redo2 size={14} /> <span className="hidden sm:inline">Ulangi</span>
        </button>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Cari di sheet…" className="h-7 w-44 rounded border border-[#C8C8C8] bg-white px-2 outline-none focus:border-[#107C41]" />
        {hiddenCount > 0 && (
          <button type="button" onClick={() => setShowHidden((v) => !v)} className="inline-flex h-7 items-center gap-1 rounded border border-[#C8C8C8] bg-white px-2 hover:bg-[#EDEDED]">
            {showHidden ? <EyeOff size={13} /> : <Eye size={13} />} {showHidden ? "Sembunyikan" : "Tampilkan"} {hiddenCount} kolom tersembunyi
          </button>
        )}
        {selSlot?.row && (
          <button type="button" onClick={() => void deleteRow(selSlot.row!)} className="inline-flex h-7 items-center gap-1 rounded border border-[#C8C8C8] bg-white px-2 hover:bg-red-50 hover:text-red-700">
            <Trash2 size={13} /> Hapus baris {selSlot.pos}
          </button>
        )}
      </div>

      {/* Kotak nama + bilah rumus (fx) */}
      <div className="flex items-stretch border-b border-[#DADADA] text-[13px]">
        <div className="flex w-20 shrink-0 items-center border-r border-[#DADADA] px-2 tabular-nums">{address}</div>
        <div className="flex w-8 shrink-0 items-center justify-center border-r border-[#DADADA] font-serif italic text-[#666]">fx</div>
        <input
          aria-label="Bilah rumus"
          value={barValue}
          readOnly={!!selCol?.computed}
          onFocus={() => {
            if (editRef.current === null && selCol && !selCol.computed) startEdit(rawAt(sel.r, sel.c), false);
          }}
          onChange={(e) => {
            setEditInCell(false);
            setEdit(e.target.value);
          }}
          onBlur={() => {
            if (editRef.current !== null && !editInCell) void finishEdit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              void (e.key === "Enter" ? finishEdit(1, 0) : finishEdit(0, e.shiftKey ? -1 : 1));
            } else if (e.key === "Escape") {
              setEdit(null);
              gridRef.current?.focus();
            }
          }}
          className="h-7 min-w-0 flex-1 px-2 outline-none"
          style={{ fontFamily: XL_FONT }}
        />
      </div>

      <div ref={gridRef} tabIndex={0} onKeyDown={onKeyDown} onPaste={onPaste} className="h-[68vh] min-h-80 overflow-auto bg-white outline-none" style={{ fontSize: "14.67px", color: "#000" }}>
        <table className="border-separate" style={{ width, tableLayout: "fixed", borderSpacing: 0 }}>
          <colgroup>
            <col style={{ width: ROW_HDR }} />
            {columns.map((c) => (
              <col key={c.key} style={{ width: c.width ?? 64 }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-[8]">
            {letterRow}
            {frozenHead && headTrs}
          </thead>
          <tbody>
            {!frozenHead && headTrs}
            {!headRows && (
              <tr style={{ height: rowH }}>
                <td className="sticky left-0 z-[6]" style={{ background: HDR_BG, borderRight: "1px solid #C8C8C8", borderBottom: "1px solid #DADADA" }} />
                {columns.map((c, i) => (
                  <td key={c.key} className="px-[3px] font-bold" style={{ ...cssOf(undefined), ...sticky(i), background: "#fff" }}>
                    {c.label}
                  </td>
                ))}
              </tr>
            )}
            {slots.map((slot, r) => (
              <Row
                key={slot.row?.id ?? `p${slot.pos}`}
                index={r}
                pos={slot.pos}
                row={slot.row}
                columns={columns}
                colCss={colCss}
                height={rowH}
                shown={shownRows[r]}
                selCol={sel.r === r ? sel.c : -1}
                edit={sel.r === r ? edit : null}
                editInCell={editInCell}
                onCell={onCell}
                onEdit={onEdit}
                onFinish={onFinish}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Tab sheet seperti Excel */}
      {tabs && tabs.length > 0 && (
        <div className="flex items-end gap-0 overflow-x-auto border-t border-[#C8C8C8] text-[12px]" style={{ background: HDR_BG }}>
          {tabs.map((g) => (
            <div key={g.book} className="flex shrink-0 items-end">
              {tabs.length > 1 && (
                <span className="self-center px-2 text-[10px] font-semibold uppercase tracking-wide text-[#777]" title={g.title}>
                  {g.title.length > 28 ? `${g.title.slice(0, 26)}…` : g.title}
                </span>
              )}
              {g.items.map((t) => {
                const on = t.key === sheet.key;
                return (
                  <a
                    key={t.key}
                    href={t.href}
                    title={t.dim ? "Sheet tersembunyi di Excel" : t.title}
                    className={`whitespace-nowrap border-r border-[#D0D0D0] px-3 py-1.5 ${on ? "bg-white font-semibold" : "hover:bg-[#E6E6E6]"} ${t.dim ? "italic opacity-60" : ""}`}
                    style={{ color: on ? XL_GREEN : "#333", borderBottom: on ? `3px solid ${XL_GREEN}` : t.color ? `3px solid ${t.color}` : "3px solid transparent" }}
                  >
                    {t.title}
                  </a>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Bilah status */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[#DADADA] px-3 py-1 text-[12px]" style={{ background: HDR_BG }}>
        <span className={`inline-flex min-w-0 items-center gap-1.5 ${badge.tone}`}>
          <badge.icon size={14} /> <span className="truncate">{badge.text}</span>
        </span>
        {status.kind === "auth" &&
          // Di /offline (tanpa login) cukup pindah halaman: isian sudah tersimpan di perangkat dan terkirim setelah login.
          (sameTabLogin ? (
            <a href="/login" className="rounded border border-[#C8C8C8] bg-white px-2 py-0.5 font-medium hover:bg-[#EDEDED]">
              Login untuk mengirim
            </a>
          ) : (
            <a href="/login" target="_blank" rel="noreferrer" className="rounded border border-[#C8C8C8] bg-white px-2 py-0.5 font-medium hover:bg-[#EDEDED]">
              Login lagi (tab baru)
            </a>
          ))}
        <button type="button" className="ml-auto rounded border border-[#C8C8C8] bg-white px-2 py-0.5 hover:bg-[#EDEDED]" onClick={() => void runSync()} disabled={status.kind === "syncing"}>
          Kirim sekarang
        </button>
      </div>
      <p className="border-t border-[#EEE] px-3 py-1.5 text-[11px] text-[#666]" style={{ fontFamily: "inherit" }}>
        Sama seperti Excel: klik sel lalu ketik, Enter/Tab untuk pindah, F2 atau klik dua kali untuk mengubah, rumus diawali &ldquo;=&rdquo; dan bisa merujuk
        sheet lain. Salin blok dari Excel lalu Ctrl+V. Ctrl+Z membatalkan, Ctrl+Y mengulangi. Ctrl+&minus; menghapus baris. Titik oranye di nomor baris = belum terkirim ke ERP.
      </p>
    </div>
  );
}
