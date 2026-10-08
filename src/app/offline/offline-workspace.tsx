"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { CloudOff, FileSpreadsheet, LogIn } from "lucide-react";
import { sheetByKey, sheetFamily, SHEETS, WORKBOOKS, type SheetDef } from "@/lib/sheets";
import { rememberedSheets, rememberedSheetsRaw } from "@/lib/offline-cache";
import { SheetGrid, type GridSheet } from "@/app/(app)/lembar/[sheet]/sheet-grid";

const noSubscribe = () => () => {};

const forGrid = (s: SheetDef): GridSheet => ({ key: s.key, title: s.title, excelName: s.excelName, dataStart: s.dataStart, notes: s.notes, columns: s.columns });

/**
 * Lembar Kerja Offline tanpa login: satu halaman (tersimpan di perangkat) untuk semua lembar, dipilih lewat ?s=.
 * Isi lembar dibaca dari perangkat; isian baru terkirim ke ERP setelah login. Lembar yang tampil mengikuti hak akses
 * pengguna terakhir yang login di perangkat ini (belum pernah login → semua lembar).
 */
export function OfflineWorkspace() {
  const key = useSearchParams().get("s");
  // null saat dirender di server (halaman statis): daftar lembar baru diketahui di perangkat.
  const raw = useSyncExternalStore(noSubscribe, rememberedSheetsRaw, () => null);
  const allowed = useMemo(() => (raw === null ? null : (rememberedSheets(raw) ?? SHEETS.map((s) => s.key))), [raw]);
  if (!allowed) return null;

  const mine = SHEETS.filter((s) => allowed.includes(s.key));
  const sheet = key ? sheetByKey(key) : undefined;

  if (sheet && allowed.includes(sheet.key)) {
    const family = sheetFamily(sheet.key).filter((s) => allowed.includes(s.key));
    const tabs = SHEETS.filter((s) => s.workbook && family.some((f) => f.key === s.key));
    const books = [...new Set(tabs.map((t) => t.workbook!))];
    return (
      <>
        <div className="mb-3">
          <a href="/offline" className="text-xs font-medium text-brand-700 hover:underline">
            ← Semua lembar
          </a>
          <h1 className="mt-1 text-xl font-bold text-ink">{sheet.title}</h1>
          {sheet.workbook && WORKBOOKS[sheet.workbook] && (
            <p className="text-xs text-muted">
              {WORKBOOKS[sheet.workbook].title}
              {sheet.excelName ? ` · sheet "${sheet.excelName.trim()}"` : ""}
            </p>
          )}
        </div>
        {tabs.length > 1 && (
          <div className="mb-3 space-y-1.5">
            {books.map((b) => (
              <div key={b} className="flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{WORKBOOKS[b]?.title ?? b}</span>
                {tabs
                  .filter((t) => t.workbook === b)
                  .map((t) => (
                    <a
                      key={t.key}
                      href={`/offline?s=${t.key}`}
                      className={`rounded-t-md border-b-2 px-2.5 py-1 text-xs ${t.key === sheet.key ? "border-brand-700 bg-brand-50 font-semibold text-brand-800" : "border-transparent bg-canvas text-muted hover:text-ink"}`}
                    >
                      {t.title}
                    </a>
                  ))}
              </div>
            ))}
          </div>
        )}
        <SheetGrid key={sheet.key} sheet={forGrid(sheet)} family={family.map(forGrid)} sameTabLogin />
      </>
    );
  }

  const books = Object.keys(WORKBOOKS).filter((b) => mine.some((s) => (s.workbook ?? "lain") === b));
  return (
    <>
      <h1 className="text-xl font-bold text-ink">Lembar Kerja Offline</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        Bisa diisi tanpa sinyal dan tanpa login. Isian tersimpan di perangkat ini, lalu otomatis naik ke ERP setelah ada sinyal dan Anda login.
      </p>
      <div className="space-y-6">
        {books.map((b) => (
          <section key={b}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-800">
              <FileSpreadsheet size={16} /> {WORKBOOKS[b].title}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mine
                .filter((s) => (s.workbook ?? "lain") === b)
                .map((s) => (
                  <a key={s.key} href={`/offline?s=${s.key}`} className="block rounded-xl border border-line bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="flex items-center gap-2 text-sm font-semibold text-brand-800">
                      <CloudOff size={15} /> {s.title}
                    </div>
                    {s.description && <p className="mt-1 text-xs text-muted">{s.description}</p>}
                  </a>
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export function OfflineHeader() {
  return (
    <header className="flex items-center justify-between gap-3 bg-navy px-4 py-3 text-white sm:px-8">
      <div className="text-sm font-bold tracking-widest">HARAKA SEED</div>
      <a href="/login" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20">
        <LogIn size={14} /> Masuk ERP
      </a>
    </header>
  );
}
