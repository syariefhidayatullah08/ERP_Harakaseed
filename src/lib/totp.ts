import "server-only";
import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";

// Kode verifikasi dua langkah (TOTP, RFC 6238) yang cocok dengan Google Authenticator, Microsoft Authenticator, dll.:
// 6 digit, berganti tiap 30 detik, dihitung dari kunci rahasia yang dipindai sekali lewat QR code.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD = 30;

function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text: string) {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of text.toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Kunci rahasia baru (160 bit) dalam base32. */
export const newTotpSecret = () => base32Encode(randomBytes(20));

/** Tautan otpauth:// untuk QR code aplikasi authenticator. */
export const totpUri = (secret: string, account: string, issuer = "Haraka ERP") =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${PERIOD}`;

function codeAt(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/**
 * Cocokkan kode 6 digit, toleransi ±1 langkah (jam HP selisih sedikit). Mengembalikan langkah waktu yang cocok —
 * simpan sebagai totp_last_step dan kirim kembali sebagai `after` agar kode yang sama tidak bisa dipakai dua kali.
 */
export function verifyTotp(secret: string, code: string, after = 0): number | null {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const now = Math.floor(Date.now() / 1000 / PERIOD);
  for (const step of [now, now - 1, now + 1]) if (step > after && codeAt(secret, step) === clean) return step;
  return null;
}

/* ------------------------- Kode cadangan (bila HP hilang) ------------------------- */

const normalizeRecovery = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const hashRecovery = (code: string) => createHash("sha256").update(normalizeRecovery(code)).digest("hex");

/** 8 kode cadangan sekali pakai, mis. "K7PQ-2M9X". Tanpa huruf/angka yang mirip (0/O, 1/I). */
export function newRecoveryCodes() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = (n: number) => Array.from({ length: n }, () => chars[randomInt(chars.length)]).join("");
  return Array.from({ length: 8 }, () => `${pick(4)}-${pick(4)}`);
}

/** Kode cadangan yang dipakai dihapus dari daftar. Mengembalikan sisa daftar hash, atau null bila kode tidak cocok. */
export function consumeRecoveryCode(stored: string | null, code: string): string[] | null {
  let hashes: string[] = [];
  try {
    hashes = stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return null;
  }
  if (normalizeRecovery(code).length !== 8) return null;
  const h = hashRecovery(code);
  return hashes.includes(h) ? hashes.filter((x) => x !== h) : null;
}
