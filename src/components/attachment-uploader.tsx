"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Camera, Paperclip, UploadCloud } from "lucide-react";
import { registerAttachment } from "@/actions/attachments";

const MAX_MB = 25;

/**
 * Foto kamera HP biasanya 3–8 MB; diperkecil di HP (sisi terpanjang 1600 px, JPEG) sebelum diunggah
 * supaya cepat terkirim dengan sinyal lemah di lahan. File yang gagal diolah diunggah apa adanya.
 */
async function shrinkPhoto(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 500 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.\w+$/, "")}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** `photoFirst`: mode lapangan — tombol kamera besar, foto diperkecil dulu dan langsung terunggah begitu dipilih. */
export function AttachmentUploader({ refType, refId, categories, photoFirst = false }: { refType: string; refId: number; categories: string[]; photoFirst?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState(categories[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  async function submit(list: File[] = files) {
    if (!list.length) return;
    setBusy(true);
    setError("");
    try {
      for (const [i, original] of list.entries()) {
        const file = photoFirst ? await shrinkPhoto(original) : original;
        if (file.size > MAX_MB * 1024 * 1024) throw new Error(`${file.name} lebih dari ${MAX_MB} MB.`);
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const blob = await upload(`evidence/${refType}/${refId}/${safeName}`, file, {
          access: "private",
          handleUploadUrl: "/api/upload",
          clientPayload: JSON.stringify({ refType, refId }),
          onUploadProgress: ({ percentage }) => setProgress(`${i + 1}/${list.length} · ${Math.round(percentage)}%`),
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
        {photoFirst ? <Camera size={26} className="text-brand-600" /> : <UploadCloud size={22} className="text-brand-600" />}
        <span className="font-medium">
          {busy && photoFirst ? `Mengunggah… ${progress}` : files.length ? `${files.length} file dipilih` : photoFirst ? "Ambil foto atau pilih dari galeri" : "Pilih file atau foto"}
        </span>
        <span className="text-xs text-muted">{photoFirst ? "Foto langsung terunggah setelah dipilih · bisa beberapa foto sekaligus" : `JPG, PNG, PDF, Word, Excel · maks. ${MAX_MB} MB per file`}</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={photoFirst ? "image/*" : "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            setFiles(picked);
            if (photoFirst) void submit(picked);
          }}
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
      {!photoFirst && (
        <button type="button" onClick={() => submit()} disabled={!files.length || busy} className="btn-primary w-full">
          {busy ? `Mengunggah… ${progress}` : "Unggah lampiran"}
        </button>
      )}
    </div>
  );
}
