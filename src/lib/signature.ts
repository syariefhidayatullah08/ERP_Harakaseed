import "server-only";
import { PDFDocument, type PDFImage } from "pdf-lib";

// Gambar tanda tangan dua penanda tangan dokumen cetak (invoice, surat pengajuan PB).
// Disimpan di tabel settings (signer_sig = kiri, signer2_sig = kanan) sebagai JSON berisi base64.

export type Signature = { type: "png" | "jpg"; w: number; h: number; b64: string };

export const SIGNATURE_KEYS = ["signer_sig", "signer2_sig"] as const;
export type SignatureKey = (typeof SIGNATURE_KEYS)[number];
/** Batas ukuran file; server action menerima paling besar 1 MB per kiriman. */
export const SIGNATURE_MAX_BYTES = 400 * 1024;

export function parseSignature(raw?: string): Signature | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Signature;
    return (s.type === "png" || s.type === "jpg") && s.w > 0 && s.h > 0 && typeof s.b64 === "string" ? s : null;
  } catch {
    return null;
  }
}

/** Periksa file unggahan (PNG/JPG) dan baca ukurannya. Null bila bukan gambar yang bisa dipakai di PDF. */
export async function readSignature(bytes: Uint8Array, mime: string): Promise<Signature | null> {
  const type = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : null;
  if (!type) return null;
  try {
    const pdf = await PDFDocument.create();
    const img = type === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    return { type, w: img.width, h: img.height, b64: Buffer.from(bytes).toString("base64") };
  } catch {
    return null;
  }
}

export const signatureBytes = (sig: Signature) => Buffer.from(sig.b64, "base64");
export const signatureDataUrl = (sig: Signature) => `data:image/${sig.type === "png" ? "png" : "jpeg"};base64,${sig.b64}`;

export function embedSignature(pdf: PDFDocument, sig: Signature): Promise<PDFImage> {
  return sig.type === "png" ? pdf.embedPng(signatureBytes(sig)) : pdf.embedJpg(signatureBytes(sig));
}

/** Ukuran gambar agar muat di kotak maxW × maxH tanpa mengubah proporsi. */
export function fitSignature(sig: Signature, maxW: number, maxH: number) {
  const k = Math.min(maxW / sig.w, maxH / sig.h);
  return { width: sig.w * k, height: sig.h * k };
}
