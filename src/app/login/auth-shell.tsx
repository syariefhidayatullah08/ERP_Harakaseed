import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/** Kerangka sederhana untuk halaman lupa/reset kata sandi. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="card w-full max-w-sm p-7">
        <Link href="/login" className="mb-6 inline-block">
          <Image src="/logo-wordmark.png" alt="HARAKA SEED" width={162} height={40} priority />
        </Link>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mb-6 mt-1 text-sm text-muted">{subtitle}</p>
        {children}
        <Link href="/login" className="mt-6 block text-center text-sm text-brand-700 hover:underline">
          ← Kembali ke halaman masuk
        </Link>
      </div>
    </main>
  );
}
