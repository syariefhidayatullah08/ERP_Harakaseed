import "server-only";
import { headers } from "next/headers";
import { run } from "./db";
import { currentUser } from "./session";
import { MODULES } from "./access";

/** Label bagian ERP di log aktivitas: modul hak akses + bagian di luar modul. */
export const ACTIVITY_MODULES: Record<string, string> = {
  ...MODULES,
  login: "Login & keamanan",
  akun: "Akun saya",
  pengaturan: "Pengaturan",
  lampiran: "Lampiran",
  unduhan: "Unduh data",
  backup: "Backup",
};

type Actor = { id?: number | null; name: string; email: string; role: string };

/** Pelaku untuk kejadian tanpa pengguna login (cron backup, login gagal). */
export const SYSTEM_ACTOR: Actor = { id: null, name: "Sistem", email: "", role: "" };

/**
 * Catat siapa melakukan apa. Dipanggil setelah perubahan berhasil disimpan.
 * Tidak pernah melempar error: gagal mencatat log tidak boleh membatalkan pekerjaan pengguna.
 */
export async function logActivity(module: string, action: string, detail = "", actor?: Actor | null) {
  try {
    const who = actor ?? (await currentUser()) ?? SYSTEM_ACTOR;
    let ip = "";
    try {
      ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim();
    } catch {
      // di luar request (skrip) tidak ada header
    }
    await run(
      "INSERT INTO activity_log (user_id, user_name, user_email, role, module, action, detail, ip) VALUES (?,?,?,?,?,?,?,?)",
      who.id ?? null,
      who.name,
      who.email,
      who.role,
      module,
      action.slice(0, 200),
      detail.slice(0, 1000),
      ip.slice(0, 64),
    );
  } catch (e) {
    console.error("Gagal mencatat log aktivitas:", e);
  }
}
