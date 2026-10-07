import Link from "next/link";
import type { Metadata } from "next";
import { CloudOff } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { can, requireUser } from "@/lib/session";
import { SHEETS } from "@/lib/sheets";

export const metadata: Metadata = { title: "Lembar Kerja Offline" };

/** Daftar lembar kerja offline yang boleh dibuka pengguna ini (mengikuti hak akses modulnya). */
export default async function SheetsIndex() {
  const user = await requireUser();
  const mine = SHEETS.filter((s) => can(user, s.module));
  return (
    <>
      <PageHeader title="Lembar Kerja Offline" subtitle="Tabel seperti Excel yang tetap bisa diisi tanpa internet; data tersimpan di laptop lalu terkirim otomatis ke ERP saat online." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mine.map((s) => (
          // <a> biasa (bukan Link) supaya saat offline halaman dibuka dari simpanan laptop.
          <a key={s.key} href={`/lembar/${s.key}`} className="block">
            <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-center gap-2 font-semibold text-brand-800">
                <CloudOff size={16} /> {s.title}
              </div>
              <p className="mt-1 text-sm text-muted">{s.description}</p>
            </Card>
          </a>
        ))}
      </div>
      {!mine.length && <p className="text-sm text-muted">Belum ada lembar yang bisa Anda buka.</p>}
      <p className="mt-6 text-xs text-muted">
        Buka lembar sekali saat online di laptop yang dipakai; setelah itu lembar bisa dibuka & diisi tanpa internet. <Link href="/pengaturan" className="text-brand-700 hover:underline">Pasang ERP sebagai aplikasi</Link> supaya mudah dibuka dari desktop.
      </p>
    </>
  );
}
