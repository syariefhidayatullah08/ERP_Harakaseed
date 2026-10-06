"use client";

import { useActionState, useState } from "react";
import { disableTotp, enableTotp } from "@/actions/security";
import { SubmitButton } from "@/components/buttons";

/**
 * Verifikasi dua langkah: aktivasi (pindai QR, ketik kode pertama, simpan kode cadangan) atau status + mematikan.
 * Satu komponen untuk kedua keadaan, agar kode cadangan tetap tampil saat halaman disegarkan setelah aktivasi.
 */
export function TwoFactorCard({ enabled, recoveryLeft, secret, qr }: { enabled: boolean; recoveryLeft: number; secret: string; qr: string }) {
  const [state, action, pending] = useActionState(enableTotp, null);
  const [copied, setCopied] = useState(false);

  if (state?.codes) {
    const text = state.codes.join("\n");
    return (
      <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
        <div className="font-semibold text-emerald-800">Verifikasi dua langkah aktif.</div>
        <p>
          Simpan <b>kode cadangan</b> di bawah ini di tempat aman (mis. foto/catat di buku, jangan di HP yang sama). Bila HP hilang, satu kode bisa dipakai
          sekali sebagai pengganti kode OTP. Kode ini <b>hanya tampil sekarang</b>.
        </p>
        <pre className="grid grid-cols-2 gap-1 rounded-md bg-white p-3 font-mono text-sm tracking-wider">
          {state.codes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </pre>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => {})}
          >
            {copied ? "Tersalin" : "Salin kode"}
          </button>
          <a href="/pengaturan#keamanan" className="btn-primary btn-sm">
            Sudah saya simpan
          </a>
        </div>
      </div>
    );
  }

  if (enabled) {
    return (
      <div className="space-y-3 text-sm">
        <p>
          <span className="font-semibold text-emerald-700">Aktif.</span> Setiap login meminta kode dari aplikasi authenticator di HP Anda.
          Sisa kode cadangan: <b>{recoveryLeft}</b>
          {recoveryLeft <= 2 && <span className="text-amber-700"> — hampir habis; matikan lalu aktifkan lagi untuk mendapat kode baru.</span>}
        </p>
        <details>
          <summary className="cursor-pointer text-xs text-muted">Matikan verifikasi dua langkah</summary>
          <form action={disableTotp} className="mt-2 flex items-end gap-2">
            <label className="block">
              <span className="label">Kata sandi Anda</span>
              <input name="password" type="password" required autoComplete="current-password" className="input" />
            </label>
            <SubmitButton className="btn-danger" confirm="Matikan verifikasi dua langkah? Akun jadi hanya dilindungi kata sandi.">
              Matikan
            </SubmitButton>
          </form>
        </details>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3 text-sm">
      <input type="hidden" name="secret" value={secret} />
      <ol className="list-decimal space-y-1 pl-5 text-muted">
        <li>Pasang aplikasi <b>Google Authenticator</b> atau <b>Microsoft Authenticator</b> dari Play Store / App Store.</li>
        <li>Di aplikasi, tekan + lalu pindai QR code ini.</li>
        <li>Ketik 6 digit yang muncul untuk Haraka ERP.</li>
      </ol>
      <div className="flex flex-wrap items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- gambar data URL buatan server, bukan file */}
        <img src={qr} alt="QR code verifikasi dua langkah" width={160} height={160} className="rounded-md border border-line bg-white p-1" />
        <div className="min-w-0 text-xs text-muted">
          Tidak bisa memindai? Ketik kunci ini di aplikasi:
          <div className="mt-1 break-all font-mono text-sm text-ink">{secret.replace(/(.{4})/g, "$1 ").trim()}</div>
        </div>
      </div>
      <div className="flex items-end gap-2">
        <label className="block">
          <span className="label">Kode 6 digit</span>
          <input name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="input w-36 text-center tracking-[0.3em]" placeholder="123456" />
        </label>
        <button className="btn-primary" disabled={pending}>
          {pending ? "Memeriksa…" : "Aktifkan"}
        </button>
      </div>
      {state?.error && <p className="text-red-700">{state.error}</p>}
    </form>
  );
}
