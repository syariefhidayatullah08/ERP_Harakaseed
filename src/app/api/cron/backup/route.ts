import { timingSafeEqual } from "node:crypto";
import { runBackup } from "@/lib/backup";

/**
 * Backup harian, dipanggil Vercel Cron (lihat vercel.json). Vercel mengirim "Authorization: Bearer <CRON_SECRET>";
 * tanpa CRON_SECRET di environment, endpoint ini menolak semua permintaan.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response("Unauthorized", { status: 401 });
  const res = await runBackup({ scheduled: true });
  return Response.json(res, { status: res.ok ? 200 : 500 });
}
