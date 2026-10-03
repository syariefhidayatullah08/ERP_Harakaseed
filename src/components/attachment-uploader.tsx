"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Paperclip, UploadCloud } from "lucide-react";
import { registerAttachment } from "@/actions/attachments";

const MAX_MB = 25;

export function AttachmentUploader({ refType, refId, categories }: { refType: string; refId: number; categories: string[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState(categories[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    if (!files.length) return;
    setBusy(true);
    setError("");
    try {
      for (const [i, file] of files.entries()) {
        if (file.size > MAX_MB * 1024 * 1024) throw new Error(`${file.name} lebih dari ${MAX_MB} MB.`);
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const blob = await upload(`evidence/${refType}/${refId}/${safeName}`, file, {
          access: "private",
          handleUploadUrl: "/api/upload",
          clientPayload: JSON.stringify({ refType, refId }),
          onUploadProgress: ({ percentage }) => setProgress(`${i + 1}/${files.length} · ${Math.round(percentage)}%`),
        });
        const res = await registerAttachment({ refType, refId, pathname: blob.pathname, filename: file.name, category, note });
        if (!res.ok) throw new Error(res.error);
      }
      setFiles([]);
      setNote("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      // SDK Blob menyamarkan alasan penolakan server; tampilkan penjelasan yang bisa ditindaklanjuti.
      setError(
        /client token/i.test(msg)
          ? "Upload ditolak: sesi habis, peran Anda tidak punya akses ke dokumen ini, atau jenis file tidak didukung."
          : /content type/i.test(msg)
            ? "Jenis file tidak didukung. Gunakan foto (JPG/PNG), PDF, Word, atau Excel."
            : msg || "Upload gagal.",
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <div className="space-y-3 border-t border-line p-5">
      <label
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center text-sm transition-colors ${
          files.length ? "border-brand-300 bg-brand-50" : "border-line hover:border-brand-300 hover:bg-brand-50/50"
        }`}
      >
        <UploadCloud size={22} className="text-brand-600" />
        <span className="font-medium">{files.length ? `${files.length} file dipilih` : "Pilih file atau foto"}</span>
        <span className="text-xs text-muted">JPG, PNG, PDF, Word, Excel · maks. {MAX_MB} MB per file</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          className="sr-only"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </label>
      {files.length > 0 && (
        <ul className="space-y-1 text-xs text-muted">
          {files.map((f) => (
            <li key={f.name} className="flex items-center gap-1.5 truncate">
              <Paperclip size={12} /> {f.name}
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input" aria-label="Kategori">
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Keterangan (opsional)" className="input" />
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="button" onClick={submit} disabled={!files.length || busy} className="btn-primary w-full">
        {busy ? `Mengunggah… ${progress}` : "Unggah lampiran"}
      </button>
    </div>
  );
}
