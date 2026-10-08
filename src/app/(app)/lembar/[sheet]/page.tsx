import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui";
import { can, requireAccess } from "@/lib/session";
import { forGrid, sheetByKey, sheetFamily, sheetTabs, WORKBOOKS } from "@/lib/sheets";
import { SheetGrid } from "./sheet-grid";

export async function generateMetadata({ params }: PageProps<"/lembar/[sheet]">): Promise<Metadata> {
  return { title: sheetByKey((await params).sheet)?.title ?? "Lembar kerja" };
}

/** Satu lembar kerja offline: tampilan seperti Excel, tersimpan di perangkat, terkirim otomatis ke ERP saat online. */
export default async function SheetPage({ params }: PageProps<"/lembar/[sheet]">) {
  const sheet = sheetByKey((await params).sheet);
  if (!sheet) notFound();
  const user = await requireAccess(sheet.module);
  // Lembar yang dirujuk rumus ikut dimuat (hanya yang boleh dibuka pengguna ini).
  const family = sheetFamily(sheet.key).filter((s) => can(user, s.module));
  return (
    <>
      <div className="mb-2 flex items-center gap-3 text-xs">
        {/* <a> biasa (bukan Link) supaya saat offline halaman dibuka dari simpanan perangkat. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/lembar" className="font-medium text-brand-700 hover:underline">
          ← Semua lembar
        </a>
        {sheet.provisional && (
          <span>
            <Badge tone="amber">Kolom sementara</Badge> <span className="text-muted">akan disamakan dengan file Excel yang dipakai selama ini.</span>
          </span>
        )}
      </div>
      <SheetGrid
        sheet={forGrid(sheet)}
        family={family.map(forGrid)}
        tabs={sheetTabs(sheet, family, (k) => `/lembar/${k}`)}
        fileTitle={sheet.workbook ? WORKBOOKS[sheet.workbook]?.title : undefined}
        actions={
          <a href={`/api/lembar/export?sheet=${sheet.key}`} className="rounded bg-white/15 px-2.5 py-1 text-xs font-medium hover:bg-white/25">
            Unduh Excel
          </a>
        }
      />
    </>
  );
}
