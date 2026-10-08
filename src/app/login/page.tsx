import type { Metadata } from "next";
import Image from "next/image";
import { cookies } from "next/headers";
import { LoginForm } from "./login-form";
import { OtpForm } from "./otp-form";
import { OfflineEntry } from "./offline-entry";
import { TWO_FACTOR_COOKIE } from "@/lib/session";

export const metadata: Metadata = { title: "Masuk" };

const DIVISIONS = ["Founder", "Marketing", "Warehouse", "Produksi", "Lab/QC", "Mutu", "Admin/SDM"];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Langkah kode OTP hanya tampil bila kata sandi baru saja benar (cookie verifikasi sementara masih ada).
  const otp = (await searchParams).langkah === "otp" && (await cookies()).has(TWO_FACTOR_COOKIE);
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-navy via-brand-900 to-[#0b5276] p-12 text-white lg:flex">
        {/* Cahaya & pola dekoratif */}
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-brand-500/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 size-[30rem] rounded-full bg-accent/35 blur-3xl" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]"
        />

        <div className="relative flex items-center gap-3">
          <span className="inline-flex rounded-xl bg-white p-2 shadow-lg shadow-black/20">
            <Image src="/logo-emblem.png" alt="Logo Haraka" width={40} height={40} />
          </span>
          <div className="font-bold tracking-widest">HARAKA SEED</div>
        </div>
        <div className="relative">
          <h1 className="text-5xl font-extrabold leading-tight tracking-tight">
            Quality you can
            <br />
            plant with{" "}
            <span className="bg-linear-to-r from-accent via-orange-400 to-gold bg-clip-text text-transparent">confidence.</span>
          </h1>
          <p className="mt-5 max-w-md text-brand-100">
            Satu sistem untuk produksi benih, uji mutu, gudang, penjualan, dan audit ISO PT Benih Haraka Sejahtera.
          </p>
          <div className="mt-6 flex max-w-md flex-wrap gap-2">
            {DIVISIONS.map((d) => (
              <span key={d} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-brand-50 backdrop-blur-sm">
                {d}
              </span>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-brand-200">PT Benih Haraka Sejahtera · Jember, Jawa Timur · ISO 9001:2015</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Image src="/logo-wordmark.png" alt="HARAKA SEED" width={194} height={48} priority />
          </div>
          <div aria-hidden className="mb-3 h-1 w-12 rounded-full bg-linear-to-r from-brand-500 to-accent" />
          <h2 className="text-2xl font-bold">{otp ? "Verifikasi dua langkah" : "Masuk ke ERP"}</h2>
          <p className="mb-6 mt-1 text-sm text-muted">
            {otp ? "Kata sandi benar. Satu langkah lagi untuk memastikan ini memang Anda." : "Masuk dengan email pribadi yang didaftarkan untuk divisi Anda."}
          </p>
          {otp ? <OtpForm /> : <LoginForm />}
          {!otp && <OfflineEntry />}
        </div>
      </div>
    </main>
  );
}
