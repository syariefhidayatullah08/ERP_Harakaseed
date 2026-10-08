import Link from "next/link";
import type { Metadata } from "next";
import { CloudOff, FileSpreadsheet } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { can, requireUser } from "@/lib/session";
import { SHEETS, WORKBOOKS } from "@/lib/sheets";

export const metadata: Metadata = { title: "Lembar Kerja Offline" };

/** Daftar lembar kerja offline yang boleh dibuka pengguna ini (mengikuti hak akses modulnya), per file Excel. */
export default async function SheetsIndex() {
  const user = await requireUser();
  const mine = SHEETS.filter((s) => can(user, s.module));
  const books = Object.keys(WORKBOOKS).filter((b) => mine.some((s) => (s.workbook ?? "lain") === b));
  return (
    <>
      <PageHeader title="Lembar Kerja Offline" subtitle="Tabel seperti Excel yang tetap bisa diisi tanpa internet; data tersimpan di laptop lalu terkirim otomatis ke ERP saat online." />
      <div className="space-y-6">
        {books.map((b) => (
          <section key={b}>
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-brand-800">
              <FileSpreadsheet size={16} /> {WORKBOOKS[b].title}
            </h2>
            {WORKBOOKS[b].description && <p className="mb-2 text-xs text-muted">{WORKBOOKS[b].description}</p>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mine
                .filter((s) => (s.workbook ?? "lain") === b)
                .map((s) => (
                  // <a> biasa (bukan Link) supaya saat offline halaman dibuka dari simpanan laptop.
                  <a key={s.key} href={`/lembar/${s.key}`} className="block">
                    <Card className="h-full p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
                      <div className="flex items-center gap-2 text-sm font-semibold text-brand-800">
                        <CloudOff size={15} /> {s.title}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {s.description ?? `Kolom ${s.columns[0]?.key}–${s.columns.at(-1)?.key}, data mulai baris ${s.dataStart ?? 1} seperti di Excel.`}
                      </p>
                    </Card>
                  </a>
                ))}
            </div>
          </section>
        ))}
      </div>
      {!mine.length && <p className="text-sm text-muted">Belum ada lembar yang bisa Anda buka.</p>}
      <p className="mt-6 text-xs text-muted">
        Buka lembar sekali saat online di laptop yang dipakai; setelah itu lembar bisa dibuka & diisi tanpa internet. Rumus Excel tetap berjalan, termasuk yang
        merujuk sheet lain. <Link href="/pengaturan" className="text-brand-700 hover:underline">Pasang ERP sebagai aplikasi</Link> supaya mudah dibuka dari desktop.
      </p>
    </>
  );
}
