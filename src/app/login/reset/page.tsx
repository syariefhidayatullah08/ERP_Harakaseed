import type { Metadata } from "next";
import Link from "next/link";
import { verifyPasswordToken } from "@/lib/session";
import { AuthShell } from "../auth-shell";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Buat kata sandi" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: PageProps<"/login/reset">) {
  const token = String((await searchParams).token ?? "");
  const user = token ? await verifyPasswordToken(token) : null;
  if (!user) {
    return (
      <AuthShell title="Tautan tidak berlaku" subtitle="Tautan sudah kedaluwarsa atau sudah pernah dipakai.">
        <Link href="/login/lupa" className="btn-primary w-full">
          Minta tautan baru
        </Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Buat kata sandi" subtitle={`Untuk akun ${user.email}`}>
      <ResetForm token={token} />
    </AuthShell>
  );
}
