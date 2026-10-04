// Pemakaian: node --env-file=.env.local scripts/email-check.mjs
// Menguji login SMTP (kirim) dan IMAP (kotak masuk) dengan EMAIL_USER / EMAIL_PASS. Tidak menampilkan kata sandi.
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";

const user = process.env.EMAIL_USER ?? "";
const pass = (process.env.EMAIL_PASS ?? "").replace(/\s+/g, "");
const smtpHost = process.env.SMTP_HOST ?? "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT ?? 465);
const imapHost = process.env.IMAP_HOST ?? "imap.gmail.com";
const imapPort = Number(process.env.IMAP_PORT ?? 993);

const explain = (msg) => {
  if (/535|Username and Password not accepted|AUTHENTICATIONFAILED|Invalid credentials/i.test(msg))
    return "Email atau App Password ditolak Google. Pastikan memakai App Password 16 huruf (bukan sandi Gmail biasa) dan Verifikasi 2 Langkah aktif.";
  if (/534|Application-specific password required/i.test(msg)) return "Google meminta App Password. Buat di myaccount.google.com/apppasswords.";
  if (/IMAP access is disabled|\[ALERT\].*IMAP/i.test(msg)) return "IMAP belum aktif. Gmail → Setelan → Penerusan dan POP/IMAP → Aktifkan IMAP.";
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED/i.test(msg)) return "Tidak bisa terhubung ke server email (cek koneksi internet / firewall).";
  return msg;
};

console.log(`Akun     : ${user || "(EMAIL_USER kosong)"}`);
console.log(`Sandi    : ${pass ? `terisi, ${pass.length} karakter` : "(EMAIL_PASS kosong)"}`);
if (!user || !pass) process.exit(1);
if (pass.length !== 16) console.log("Catatan  : App Password Gmail biasanya 16 huruf. Periksa kembali bila login gagal.");

let ok = true;
try {
  await nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: smtpPort === 465, auth: { user, pass } }).verify();
  console.log(`SMTP     : OK (${smtpHost}:${smtpPort}) — ERP bisa mengirim email`);
} catch (e) {
  ok = false;
  console.log(`SMTP     : GAGAL — ${explain(e.message)}`);
}
const imap = new ImapFlow({ host: imapHost, port: imapPort, secure: true, auth: { user, pass }, logger: false });
try {
  await imap.connect();
  const box = await imap.mailboxOpen("INBOX");
  console.log(`IMAP     : OK (${imapHost}:${imapPort}) — ${box.exists} email di kotak masuk`);
  await imap.logout();
} catch (e) {
  ok = false;
  console.log(`IMAP     : GAGAL — ${explain(e.responseText ?? e.message)}`);
}
process.exit(ok ? 0 : 1);
