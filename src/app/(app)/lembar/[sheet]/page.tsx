import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, PageHeader } from "@/components/ui";
import { can, requireAccess } from "@/lib/session";
import { sheetByKey, sheetFamily, SHEETS, WORKBOOKS, type SheetDef } from "@/lib/sheets";
import { SheetGrid, type GridSheet } from "./sheet-grid";

export async function generateMetadata({ params }: PageProps<"/lembar/[sheet]">): Promise<Metadata> {
  return { title: sheetByKey((await params).sheet)?.title ?? "Lembar kerja" };
}

const forGrid = (s: SheetDef): GridSheet => ({ key: s.key, title: s.title, excelName: s.excelName, dataStart: s.dataStart, notes: s.notes, columns: s.columns });

/** Satu lembar kerja offline: tabel seperti Excel, tersimpan di laptop, terkirim otomatis ke ERP saat online. */
export default async function SheetPage({ params }: PageProps<"/lembar/[sheet]">) {
  const sheet = sheetByKey((await params).sheet);
  if (!sheet) notFound();
  const user = await requireAccess(sheet.module);
  // Lembar yang dirujuk rumus ikut dimuat (hanya yang boleh dibuka pengguna ini).
  const family = sheetFamily(sheet.key).filter((s) => can(user, s.module));
  // Tab seperti di bawah Excel: lembar dalam file yang sama, lalu file lain di keluarga yang sama.
  const tabs = SHEETS.filter((s) => s.workbook && family.some((f) => f.key === s.key));
  const books = [...new Set(tabs.map((t) => t.workbook!))];
  return (
    <>
      <PageHeader
        title={sheet.title}
        subtitle={sheet.workbook && WORKBOOKS[sheet.workbook] ? `${WORKBOOKS[sheet.workbook].title}${sheet.excelName ? ` · sheet "${sheet.excelName.trim()}"` : ""}` : sheet.description}
        actions={
          <a href={`/api/lembar/export?sheet=${sheet.key}`} className="btn-secondary">
            Unduh Excel
          </a>
        }
      />
      {books.length > 0 && tabs.length > 1 && (
        <div className="mb-3 space-y-1.5">
          {books.map((b) => (
            <div key={b} className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{WORKBOOKS[b]?.title ?? b}</span>
              {tabs
                .filter((t) => t.workbook === b)
                .map((t) => (
                  // <a> biasa (bukan Link) supaya saat offline halaman dibuka dari simpanan laptop.
                  <a
                    key={t.key}
                    href={`/lembar/${t.key}`}
                    className={`rounded-t-md border-b-2 px-2.5 py-1 text-xs ${t.key === sheet.key ? "border-brand-700 bg-brand-50 font-semibold text-brand-800" : "border-transparent bg-canvas text-muted hover:text-ink"}`}
                  >
                    {t.title}
                  </a>
                ))}
            </div>
          ))}
        </div>
      )}
      {sheet.provisional && (
        <p className="mb-3 text-xs">
          <Badge tone="amber">Kolom sementara</Badge> <span className="text-muted">Kolom & urutannya akan disamakan persis dengan file Excel yang dipakai selama ini.</span>
        </p>
      )}
      <SheetGrid sheet={forGrid(sheet)} family={family.map(forGrid)} />
    </>
  );
}
