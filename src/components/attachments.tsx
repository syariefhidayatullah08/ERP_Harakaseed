import { FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import { all } from "@/lib/db";
import { tanggal } from "@/lib/format";
import { ATTACHMENT_CATEGORIES, formatBytes, type AttachmentRef, type AttachmentRow } from "@/lib/attachments";
import { deleteAttachment } from "@/actions/attachments";
import { AttachmentUploader } from "./attachment-uploader";
import { SubmitButton } from "./buttons";
import { Badge, Card, Empty } from "./ui";

/** Daftar lampiran bukti untuk satu dokumen + form unggah. */
export async function Attachments({ refType, refId, title = "Lampiran & bukti" }: { refType: AttachmentRef; refId: number; title?: string }) {
  const rows = await all<AttachmentRow>(
    `SELECT a.*, u.name uploader FROM attachments a LEFT JOIN users u ON u.id = a.uploaded_by
     WHERE a.ref_type = ? AND a.ref_id = ? ORDER BY a.id DESC`,
    refType,
    refId,
  );
  const images = rows.filter((r) => r.content_type.startsWith("image/") && !/hei[cf]/.test(r.content_type));

  return (
    <Card title={`${title}${rows.length ? ` (${rows.length})` : ""}`}>
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 p-5 pb-0 sm:grid-cols-4">
          {images.slice(0, 8).map((r) => (
            <a key={r.id} href={`/api/files/${r.id}`} target="_blank" rel="noopener noreferrer" className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-canvas">
              {/* eslint-disable-next-line @next/next/no-img-element -- file privat lewat route ber-auth, bukan aset statis */}
              <img src={`/api/files/${r.id}`} alt={r.filename} loading="lazy" className="size-full object-cover transition-transform group-hover:scale-105" />
            </a>
          ))}
        </div>
      )}
      {rows.length ? (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-5 py-3 text-sm">
              <span className="mt-0.5 rounded-md bg-brand-50 p-1.5 text-brand-700">
                {r.content_type.startsWith("image/") ? <ImageIcon size={15} /> : <FileText size={15} />}
              </span>
              <div className="min-w-0 flex-1">
                <a href={`/api/files/${r.id}`} target="_blank" rel="noopener noreferrer" className="block truncate font-medium text-brand-700 hover:underline">
                  {r.filename}
                </a>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <Badge tone="orange">{r.category}</Badge>
                  <span>{formatBytes(r.size)}</span>
                  <span>
                    · {tanggal(r.created_at)} {r.created_at.slice(11, 16)}
                  </span>
                  {r.uploader && <span>· {r.uploader}</span>}
                </div>
                {r.note && <div className="mt-1 text-xs">{r.note}</div>}
              </div>
              <a href={`/api/files/${r.id}?download`} className="text-xs text-muted hover:text-brand-700">
                Unduh
              </a>
              <form action={deleteAttachment}>
                <input type="hidden" name="id" value={r.id} />
                <SubmitButton className="text-muted hover:text-red-700" pendingText="…" confirm={`Hapus lampiran ${r.filename}?`}>
                  <Trash2 size={15} aria-label="Hapus" />
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Belum ada lampiran. Unggah foto/scan sebagai bukti.</Empty>
      )}
      <AttachmentUploader refType={refType} refId={refId} categories={ATTACHMENT_CATEGORIES[refType]} />
    </Card>
  );
}
