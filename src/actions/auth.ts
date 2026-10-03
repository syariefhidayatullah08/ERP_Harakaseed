"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { get } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createToken, SESSION_COOKIE } from "@/lib/session";

export async function login(_: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await get<{ id: number; password_hash: string }>("SELECT id, password_hash FROM users WHERE email = ?", email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: "Email atau kata sandi salah." };
  }
  (await cookies()).set(SESSION_COOKIE, createToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIE !== "1",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
