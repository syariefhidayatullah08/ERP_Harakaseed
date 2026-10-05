import { Readable } from "node:stream";
import type { ReadableStream as NodeWebStream } from "node:stream/web";
import archiver from "archiver";
import { get as getBlob } from "@vercel/blob";
import { all } from "@/lib/db";
import { today } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { toCsvCols } from "@/lib/export/render";

type FileRow = { id: number; ref_type: string; ref_id: number; category: string; note: string; pathname: string; filename: string; size: number; created_at: string; uploader: string | null };

/** Unduh semua file lampiran sebagai satu ZIP, berikut daftar-lampiran.csv. Hanya Founder. */
export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "owner") return new Response("Forbidden", { status: 403 });
  const rows = await all<FileRow>(
    `SELECT a.id, a.ref_type, a.ref_id, a.category, a.note, a.pathname, a.filename, a.size, a.created_at, u.name uploader
     FROM attachments a LEFT JOIN users u ON u.id = a.uploaded_by ORDER BY a.ref_type, a.ref_id, a.id`,
  );
  if (!rows.length) return new Response("Belum ada lampiran", { status: 404 });
  await logActivity("backup", "Mengunduh semua file lampiran (ZIP)", `${rows.length} file`, user);

  // Tanpa kompresi: foto & PDF sudah terkompresi. File dialirkan satu per satu agar hemat memori.
  const zip = archiver("zip", { store: true });
  const fill = async () => {
    const index = [];
    for (const r of rows) {
      const name = `${r.ref_type}-${r.ref_id}/${r.id}-${r.filename.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")}`;
      const file = await getBlob(r.pathname, { access: "private" }).catch(() => null);
      const found = file?.statusCode === 200;
      if (found) {
        const added = new Promise((resolve, reject) => zip.once("entry", resolve).once("error", reject));
        zip.append(Readable.fromWeb(file.stream as unknown as NodeWebStream), { name });
        await added;
      }
      index.push({ ...r, file: found ? name : "TIDAK DITEMUKAN di penyimpanan" });
    }
    const cols = [
      { key: "file", label: "File dalam ZIP" },
      { key: "ref_type", label: "Jenis dokumen" },
      { key: "ref_id", label: "ID dokumen" },
      { key: "category", label: "Kategori" },
      { key: "note", label: "Catatan" },
      { key: "size", label: "Ukuran (byte)" },
      { key: "uploader", label: "Diunggah oleh" },
      { key: "created_at", label: "Waktu unggah (WIB)" },
    ];
    zip.append("﻿" + toCsvCols(cols, index), { name: "daftar-lampiran.csv" });
    await zip.finalize();
  };
  fill().catch((e) => zip.destroy(e instanceof Error ? e : new Error(String(e))));

  return new Response(Readable.toWeb(zip) as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="lampiran-haraka-erp-${today()}.zip"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
