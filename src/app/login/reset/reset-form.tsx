"use client";

import { useActionState } from "react";
import { resetPassword } from "@/actions/auth";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <label className="block">
        <span className="label">Kata sandi baru (min. 8 karakter)</span>
        <input name="password" type="password" minLength={8} required autoFocus autoComplete="new-password" className="input" />
      </label>
      <label className="block">
        <span className="label">Ulangi kata sandi</span>
        <input name="confirm" type="password" minLength={8} required autoComplete="new-password" className="input" />
      </label>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan & masuk"}
      </button>
    </form>
  );
}
