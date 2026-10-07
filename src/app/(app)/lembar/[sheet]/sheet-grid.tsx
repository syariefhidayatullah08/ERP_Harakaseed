"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloudOff, CloudUpload, CheckCircle2, LogIn, Trash2 } from "lucide-react";
import type { SheetColumn } from "@/lib/sheets";
import { isDirty, loadRows, newRowId, saveRows, syncSheet, type LocalRow } from "@/lib/sheet-store";

type Status = { kind: "loading" | "saved" | "syncing" | "offline" | "auth" | "error"; message?: string; at?: string };
type Cell = { r: number; c: number };

const SYNC_EVERY_MS = 20_000;
const SYNC_DEBOUNCE_MS = 1_500;
const clock = () => new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

/**
 * Tabel seperti Excel untuk satu lembar kerja offline. Ketikan langsung tersimpan di laptop (IndexedDB) dan dikirim
 * ke ERP di latar belakang; tanpa internet, lembar tetap bisa diisi dan terkirim otomatis begitu online lagi.
 */
export function SheetGrid({ sheet, columns }: { sheet: string; columns: SheetColumn[] }) {
  const [rows, setRows] = useState<LocalRow[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [sel, setSelState] = useState<Cell>({ r: 0, c: 0 });
  const [edit, setEditState] = useState<{ value: string } | null>(null);
  // Salinan langsung (tanpa menunggu render) agar ketikan cepat tidak hilang: huruf yang masuk sebelum kotak isian
  // muncul tetap ditambahkan, dan Tab/Enter beruntun memakai sel yang benar.
  const selRef = useRef<Cell>({ r: 0, c: 0 });
  const editRef = useRef<{ value: string } | null>(null);
  const setSel = (c: Cell) => {
    selRef.current = c;
    setSelState(c);
  };
  const setEdit = (v: { value: string } | null) => {
    editRef.current = v;
    setEditState(v);
  };
  const [filter, setFilter] = useState("");
  const rowsRef = useRef<LocalRow[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncing = useRef(false);

  const commitRows = useCallback(
    async (next: LocalRow[], changed: LocalRow[]) => {
      rowsRef.current = next;
      setRows(next);
      await saveRows(sheet, changed);
    },
    [sheet],
  );

  const runSync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    setStatus((s) => ({ ...s, kind: "syncing" }));
    const res = await syncSheet(sheet, async () => rowsRef.current);
    syncing.current = false;
    if (res.ok) {
      rowsRef.current = res.rows;
      setRows(res.rows);
      setStatus({ kind: "saved", at: clock() });
    } else {
      setStatus({ kind: res.reason, message: res.message });
    }
  }, [sheet]);

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => void runSync(), SYNC_DEBOUNCE_MS);
  }, [runSync]);

  // Muat dari laptop dulu (langsung tampil walau offline), lalu sinkron; ulangi berkala & saat internet kembali.
  useEffect(() => {
    let alive = true;
    loadRows(sheet).then((local) => {
      if (!alive) return;
      rowsRef.current = local;
      setRows(local);
      void runSync();
    });
    const tick = setInterval(() => void runSync(), SYNC_EVERY_MS);
    const online = () => void runSync();
    const offline = () => setStatus((s) => ({ ...s, kind: "offline", message: "Sedang offline" }));
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      alive = false;
      clearInterval(tick);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [sheet, runSync]);

  // Halaman lembar ikut tersimpan di laptop supaya tetap bisa dibuka tanpa internet.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/lembar-sw.js", { scope: "/lembar/" })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        const assets = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((u) => u.startsWith(location.origin) && u.includes("/_next/static/"));
        reg.active?.postMessage({ type: "cache", urls: [location.pathname, ...assets] });
      })
      .catch(() => {});
  }, []);

  const visible = useMemo(() => {
    const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
    return rows
      .filter((r) => !r.deleted)
      .filter((r) => words.every((w) => Object.values(r.data).join(" ").toLowerCase().includes(w)))
      .sort((a, b) => a.position - b.position);
  }, [rows, filter]);

  const pending = rows.filter(isDirty).length;
  // Baris kosong paling bawah: mengetik di sini membuat baris baru (seperti Excel).
  const rowCount = visible.length + 1;

  /** Isi beberapa sel sekaligus (ketik / tempel). Baris di luar data dibuat baru di bawah. */
  const setCells = useCallback(
    async (start: Cell, block: string[][]) => {
      const current = rowsRef.current;
      const order = [...visible];
      let maxPos = current.reduce((m, r) => Math.max(m, r.position), 0);
      const changed = new Map<string, LocalRow>();
      block.forEach((line, i) => {
        let row = order[start.r + i];
        if (!row) {
          row = { id: newRowId(), data: {}, position: ++maxPos, deleted: false, dirty: {}, dirtyPosition: true };
          order.push(row);
        }
        const base = changed.get(row.id) ?? { ...row, data: { ...row.data }, dirty: { ...row.dirty } };
        line.forEach((value, j) => {
          const col = columns[start.c + j];
          if (!col) return;
          if ((base.data[col.key] ?? "") === value) return;
          base.data[col.key] = value;
          base.dirty[col.key] = true;
        });
        if (Object.keys(base.dirty).length || base.dirtyPosition) changed.set(row.id, base);
      });
      if (!changed.size) return;
      const next = current.filter((r) => !changed.has(r.id)).concat([...changed.values()]);
      await commitRows(next, [...changed.values()]);
      scheduleSync();
    },
    [visible, columns, commitRows, scheduleSync],
  );

  const deleteRow = async (row: LocalRow) => {
    if (!confirm("Hapus baris ini?")) return;
    const del = { ...row, deleted: true, dirtyDeleted: true };
    await commitRows(rowsRef.current.map((r) => (r.id === row.id ? del : r)), [del]);
    scheduleSync();
  };

  const valueAt = (r: number, c: number) => visible[r]?.data[columns[c].key] ?? "";
  const move = (dr: number, dc: number) => {
    const s = selRef.current;
    setSel({ r: Math.min(Math.max(0, s.r + dr), rowCount - 1), c: Math.min(Math.max(0, s.c + dc), columns.length - 1) });
  };
  const finishEdit = async (dr = 0, dc = 0) => {
    const cell = selRef.current;
    const value = editRef.current?.value;
    setEdit(null);
    move(dr, dc);
    gridRef.current?.focus();
    if (value !== undefined) await setCells(cell, [[value]]);
  };

  const printable = (e: React.KeyboardEvent) => e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

  const onKeyDown = (e: React.KeyboardEvent) => {
    const sel = selRef.current;
    if (editRef.current) {
      // Huruf yang masuk sebelum kotak isian sempat fokus: tambahkan, jangan sampai hilang.
      if (printable(e) && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setEdit({ value: editRef.current.value + e.key });
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
    if (e.key === "F2") return (e.preventDefault(), setEdit({ value: valueAt(sel.r, sel.c) }));
    if (e.key === "Delete" || e.key === "Backspace") return (e.preventDefault(), void setCells(sel, [[""]]));
    if (printable(e)) {
      e.preventDefault();
      setEdit({ value: e.key });
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") void navigator.clipboard?.writeText(valueAt(sel.r, sel.c)).catch(() => {});
  };

  // Tempel dari Excel / spreadsheet: teks bertab & baris baru → blok sel mulai dari sel terpilih.
  const onPaste = (e: React.ClipboardEvent) => {
    if (editRef.current) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    const block = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((l) => l.split("\t"));
    void setCells(selRef.current, block);
  };

  const badge = (() => {
    if (status.kind === "loading") return { icon: CloudUpload, tone: "text-muted", text: "Memuat…" };
    if (status.kind === "syncing") return { icon: CloudUpload, tone: "text-brand-700", text: "Mengirim ke ERP…" };
    if (status.kind === "auth") return { icon: LogIn, tone: "text-amber-700", text: status.message ?? "Login lagi" };
    if (status.kind === "offline" || status.kind === "error")
      return { icon: CloudOff, tone: "text-amber-700", text: `${status.kind === "offline" ? "Offline" : status.message} · ${pending} baris tersimpan di laptop, menunggu terkirim` };
    return pending
      ? { icon: CloudUpload, tone: "text-brand-700", text: `${pending} baris tersimpan di laptop, segera terkirim` }
      : { icon: CheckCircle2, tone: "text-emerald-700", text: `Semua tersimpan & terkirim ke ERP${status.at ? ` · ${status.at}` : ""}` };
  })();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${badge.tone}`}>
          <badge.icon size={16} /> {badge.text}
        </span>
        {status.kind === "auth" && (
          <a href={`/login`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
            Login lagi (tab baru)
          </a>
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
        <table className="border-collapse text-sm" style={{ minWidth: columns.reduce((s, c) => s + (c.width ?? 120), 48 + 36) }}>
          <thead className="sticky top-0 z-10 bg-canvas">
            <tr>
              <th className="w-12 border border-line px-1 py-1.5 text-center text-xs font-semibold text-muted">#</th>
              {columns.map((c) => (
                <th key={c.key} style={{ width: c.width ?? 120 }} className="border border-line px-2 py-1.5 text-left text-xs font-semibold">
                  {c.label}
                </th>
              ))}
              <th className="w-9 border border-line" />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, r) => {
              const row = visible[r];
              return (
                <tr key={row?.id ?? "baru"} className={row ? "" : "bg-canvas/40"}>
                  <td className="border border-line px-1 text-center text-xs text-muted">
                    {row ? r + 1 : "+"}
                    {row && isDirty(row) && <span title="Belum terkirim ke ERP" className="ml-0.5 inline-block size-1.5 rounded-full bg-amber-500 align-middle" />}
                  </td>
                  {columns.map((col, c) => {
                    const active = sel.r === r && sel.c === c;
                    const value = row?.data[col.key] ?? "";
                    return (
                      <td
                        key={col.key}
                        onMouseDown={() => {
                          if (edit && !active) void finishEdit();
                          setSel({ r, c });
                        }}
                        onDoubleClick={() => setEdit({ value })}
                        className={`relative h-8 border border-line px-2 ${col.type === "number" ? "text-right tabular-nums" : ""} ${active ? "outline outline-2 -outline-offset-2 outline-brand-600" : ""}`}
                      >
                        {active && edit ? (
                          <>
                            <input
                              autoFocus
                              value={edit.value}
                              list={col.options ? `opsi-${col.key}` : undefined}
                              onChange={(e) => setEdit({ value: e.target.value })}
                              onBlur={() => void finishEdit()}
                              className="absolute inset-0 w-full bg-white px-2 text-sm outline-none"
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
                          <span className="block truncate">{value}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="border border-line text-center">
                    {row && (
                      <button type="button" tabIndex={-1} onClick={() => void deleteRow(row)} className="text-muted hover:text-red-700" aria-label="Hapus baris">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Klik sel lalu ketik (Enter/Tab untuk pindah, F2 atau klik dua kali untuk mengubah, Delete untuk mengosongkan). Salin blok dari Excel lalu
        Ctrl+V di sel awal. Ketik di baris &ldquo;+&rdquo; paling bawah untuk menambah baris. Titik oranye = belum terkirim ke ERP.
      </p>
    </div>
  );
}
