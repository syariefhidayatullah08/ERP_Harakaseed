import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="inline-flex rounded-xl bg-white p-2">
            <Image src="/logo-emblem.png" alt="Logo Haraka" width={40} height={40} />
          </span>
          <div className="font-bold tracking-widest">HARAKA SEED</div>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Quality you can
            <br />
            plant with <span className="text-accent">confidence.</span>
          </h1>
          <p className="mt-4 max-w-md text-brand-200">
            Kelola produksi benih, lot &amp; mutu, penjualan ke distributor, dan komunikasi email pelanggan dalam satu
            sistem.
          </p>
        </div>
        <div className="text-xs text-brand-300">PT Benih Haraka Sejahtera · Jember, Jawa Timur</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Image src="/logo-wordmark.png" alt="HARAKA SEED" width={194} height={48} priority />
          </div>
          <h2 className="text-2xl font-bold">Masuk ke ERP</h2>
          <p className="mb-6 mt-1 text-sm text-muted">Masuk dengan email pribadi yang didaftarkan untuk divisi Anda.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
