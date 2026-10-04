"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { requestPasswordReset } from "@/actions/auth";

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  if (state && "sent" in state) {
    return (
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
        <MailCheck className="mb-2" size={20} />
        Jika <b>{state.email}</b> terdaftar, tautan reset sudah dikirim. Cek kotak masuk (dan folder Spam). Tautan berlaku 1 jam.
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" required autoFocus className="input" placeholder="nama@gmail.com" />
      </label>
      {state && "error" in state && <p className="text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Mengirim…" : "Kirim tautan reset"}
      </button>
    </form>
  );
}
