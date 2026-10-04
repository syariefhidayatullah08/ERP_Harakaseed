import type { Metadata } from "next";
import { AuthShell } from "../auth-shell";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Lupa kata sandi" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Lupa kata sandi" subtitle="Masukkan email yang Anda pakai untuk login. Kami kirimkan tautan untuk membuat kata sandi baru.">
      <ForgotForm />
    </AuthShell>
  );
}
