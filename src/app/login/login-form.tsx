"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" required autoFocus className="input" placeholder="nama@gmail.com" />
      </label>
      <label className="block">
        <span className="mb-1 flex items-center justify-between">
          <span className="label mb-0">Kata sandi</span>
          <Link href="/login/lupa" className="text-xs font-medium text-brand-700 hover:underline">
            Lupa kata sandi?
          </Link>
        </span>
        <input name="password" type="password" required className="input" />
      </label>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}
