"use client";

import { useActionState } from "react";
import Link from "next/link";
import { verifyLoginOtp } from "@/actions/auth";

/** Langkah kedua login untuk akun yang memakai verifikasi dua langkah. */
export function OtpForm() {
  const [state, action, pending] = useActionState(verifyLoginOtp, null);
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="label">Kode verifikasi</span>
        <input
          name="code"
          required
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={9}
          className="input text-center text-lg tracking-[0.3em]"
          placeholder="123456"
        />
        <span className="mt-1 block text-xs text-muted">
          Buka aplikasi authenticator di HP Anda lalu ketik 6 digit untuk Haraka ERP. HP hilang? Ketik salah satu kode cadangan (mis. K7PQ-2M9X).
        </span>
      </label>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Memeriksa…" : "Verifikasi & masuk"}
      </button>
      <Link href="/login" className="block text-center text-xs font-medium text-brand-700 hover:underline">
        Kembali ke kata sandi
      </Link>
    </form>
  );
}
