import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, PageHeader } from "@/components/ui";
import { requireAccess } from "@/lib/session";
import { sheetByKey } from "@/lib/sheets";
import { SheetGrid } from "./sheet-grid";

export async function generateMetadata({ params }: PageProps<"/lembar/[sheet]">): Promise<Metadata> {
  return { title: sheetByKey((await params).sheet)?.title ?? "Lembar kerja" };
}

/** Satu lembar kerja offline: tabel seperti Excel, tersimpan di laptop, terkirim otomatis ke ERP saat online. */
export default async function SheetPage({ params }: PageProps<"/lembar/[sheet]">) {
  const sheet = sheetByKey((await params).sheet);
  if (!sheet) notFound();
  await requireAccess(sheet.module);
  return (
    <>
      <PageHeader
        title={sheet.title}
        subtitle={sheet.description}
        actions={
          <a href={`/api/lembar/export?sheet=${sheet.key}`} className="btn-secondary">
            Unduh Excel
          </a>
        }
      />
      {sheet.provisional && (
        <p className="mb-3 text-xs">
          <Badge tone="amber">Kolom sementara</Badge> <span className="text-muted">Kolom & urutannya akan disamakan persis dengan file Excel yang dipakai selama ini.</span>
        </p>
      )}
      <SheetGrid sheet={sheet.key} columns={sheet.columns} />
    </>
  );
}
