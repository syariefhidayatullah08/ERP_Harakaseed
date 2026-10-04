import { get as getBlob } from "@vercel/blob";
import { currentUser } from "@/lib/session";
import { backupPath } from "@/lib/backup";
import { logActivity } from "@/lib/activity";

/** Unduh file backup: /api/backup?file=haraka-erp-YYYY-MM-DD.json.gz. Hanya Owner. */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "owner") return new Response("Forbidden", { status: 403 });
  const name = new URL(request.url).searchParams.get("file") ?? "";
  const path = backupPath(name);
  if (!path) return new Response("Nama file tidak valid", { status: 400 });
  const file = await getBlob(path, { access: "private", useCache: false });
  if (!file || file.statusCode !== 200) return new Response("File backup tidak ditemukan", { status: 404 });
  await logActivity("backup", "Mengunduh file backup", name, user);
  return new Response(file.stream, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
