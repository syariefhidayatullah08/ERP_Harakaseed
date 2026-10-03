import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import { all, getSetting } from "@/lib/db";
import { emailInfo } from "@/lib/email";
import { requireUser } from "@/lib/session";
import { tanggal } from "@/lib/format";
import { Badge, Card, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { addUser, changePassword, clearTransactions, saveSettings } from "@/actions/settings";
import { testEmail } from "@/actions/email";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function SettingsPage({ searchParams }: PageProps<"/pengaturan">) {
  const sp = await searchParams;
  const me = await requireUser();
  const info = emailInfo();
  const users = all<{ id: number; name: string; email: string; role: string; created_at: string }>("SELECT * FROM users ORDER BY id");
  const s = (k: string) => getSetting(k);
  const isAdmin = me.role === "admin";

  return (
    <>
      <PageHeader title="Pengaturan" subtitle="Profil perusahaan, koneksi email, otomasi, dan pengguna" />
      <Flash msg={sp.msg as string} error={sp.error as string} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Koneksi email"
          actions={info.configured ? <Badge tone="green">Terkonfigurasi</Badge> : <Badge tone="amber">Belum terhubung</Badge>}
        >
          <div className="space-y-4 p-5 text-sm">
            <div className="flex items-center gap-2">
              {info.configured ? <CheckCircle2 className="text-brand-600" size={18} /> : <XCircle className="text-amber-600" size={18} />}
              {info.configured ? (
                <span>
                  Akun <b>{info.user}</b> · SMTP {info.smtp} · IMAP {info.imap}
                </span>
              ) : (
                <span>Isi kredensial email di file .env.local lalu jalankan ulang server.</span>
              )}
            </div>
            <details className="rounded-lg bg-canvas p-4" open={!info.configured}>
              <summary className="cursor-pointer font-semibold">Panduan menghubungkan Gmail</summary>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted">
                <li>
                  Login ke akun Google <b>{s("company_email")}</b>, aktifkan <b>Verifikasi 2 Langkah</b>.
                </li>
                <li>
                  Buka <b>myaccount.google.com/apppasswords</b>, buat App Password bernama “ERP Haraka”.
                </li>
                <li>
                  Di Gmail → Setelan → <b>Penerusan dan POP/IMAP</b>, pastikan IMAP aktif.
                </li>
                <li>
                  Salin <code className="font-mono">.env.example</code> menjadi <code className="font-mono">.env.local</code>, isi:
                  <pre className="mt-2 overflow-x-auto rounded bg-ink p-3 font-mono text-xs text-white">
                    {`EMAIL_USER=${s("company_email")}\nEMAIL_PASS=xxxx xxxx xxxx xxxx`}
                  </pre>
                </li>
                <li>Jalankan ulang server, lalu klik “Kirim email tes”.</li>
              </ol>
              <p className="mt-3 text-xs text-muted">
                Memakai email domain sendiri (mis. @harakaseeds.com di Zoho/cPanel)? Isi juga SMTP_HOST, SMTP_PORT, IMAP_HOST, IMAP_PORT.
              </p>
            </details>
            <form action={testEmail}>
              <SubmitButton className="btn-secondary" pendingText="Menguji koneksi…">
                Kirim email tes ke {s("alert_email") || s("company_email")}
              </SubmitButton>
            </form>
          </div>
        </Card>

        <Card title="Email otomatis">
          <form action={saveSettings} className="space-y-3 p-5 text-sm">
            <input type="hidden" name="toggles" value="1" />
            {[
              ["auto_email_order", "Kirim konfirmasi ke pelanggan saat pesanan dikonfirmasi"],
              ["auto_email_shipping", "Kirim info pengiriman (kurir & resi) saat barang dikirim"],
              ["auto_email_invoice", "Kirim invoice saat barang dikirim"],
            ].map(([k, label]) => (
              <label key={k} className="flex items-start gap-3">
                <input type="checkbox" name={k} defaultChecked={s(k) === "1"} className="mt-0.5 accent-brand-700" disabled={!isAdmin} />
                {label}
              </label>
            ))}
            <Field label="Email penerima peringatan internal (stok rendah, email tes)">
              <input name="alert_email" type="email" defaultValue={s("alert_email")} className="input" disabled={!isAdmin} />
            </Field>
            {isAdmin && <SubmitButton>Simpan</SubmitButton>}
          </form>
        </Card>

        <Card title="Profil perusahaan (kop email, invoice, surat jalan)" className="lg:col-span-2">
          <form action={saveSettings} className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Nama perusahaan">
              <input name="company_name" defaultValue={s("company_name")} className="input" disabled={!isAdmin} />
            </Field>
            <Field label="Merek">
              <input name="company_brand" defaultValue={s("company_brand")} className="input" disabled={!isAdmin} />
            </Field>
            <Field label="Tagline">
              <input name="company_tagline" defaultValue={s("company_tagline")} className="input" disabled={!isAdmin} />
            </Field>
            <Field label="Website">
              <input name="company_website" defaultValue={s("company_website")} className="input" disabled={!isAdmin} />
            </Field>
            <Field label="Telepon / WA">
              <input name="company_phone" defaultValue={s("company_phone")} className="input" disabled={!isAdmin} />
            </Field>
            <Field label="Email perusahaan">
              <input name="company_email" type="email" defaultValue={s("company_email")} className="input" disabled={!isAdmin} />
            </Field>
            <Field label="Alamat" className="sm:col-span-2">
              <input name="company_address" defaultValue={s("company_address")} className="input" disabled={!isAdmin} />
            </Field>
            <Field label="Rekening pembayaran (tampil di invoice & email)" className="sm:col-span-2">
              <input name="bank_info" defaultValue={s("bank_info")} className="input" disabled={!isAdmin} placeholder="Bank BRI 0000-00-000000-00-0 a.n. PT Benih Haraka Sejahtera" />
            </Field>
            {isAdmin && (
              <div className="flex justify-end sm:col-span-2">
                <SubmitButton>Simpan profil</SubmitButton>
              </div>
            )}
          </form>
        </Card>

        <Card title="Pengguna" className="overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Peran</th>
                <th>Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted">{u.email}</div>
                  </td>
                  <td>
                    <Badge tone={u.role === "admin" ? "purple" : "gray"}>{u.role}</Badge>
                  </td>
                  <td className="text-muted">{tanggal(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {isAdmin && (
            <form action={addUser} className="grid gap-3 border-t border-line p-5 sm:grid-cols-2">
              <Field label="Nama">
                <input name="name" className="input" />
              </Field>
              <Field label="Email *">
                <input name="email" type="email" required className="input" />
              </Field>
              <Field label="Kata sandi * (min. 8)">
                <input name="password" type="password" minLength={8} required className="input" />
              </Field>
              <Field label="Peran">
                <select name="role" className="input">
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton className="btn-secondary">Tambah pengguna</SubmitButton>
              </div>
            </form>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="Ganti kata sandi saya">
            <form action={changePassword} className="grid gap-3 p-5 sm:grid-cols-2">
              <Field label="Kata sandi lama">
                <input name="current" type="password" required className="input" />
              </Field>
              <Field label="Kata sandi baru">
                <input name="next" type="password" minLength={8} required className="input" />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton className="btn-secondary">Ganti kata sandi</SubmitButton>
              </div>
            </form>
          </Card>
          {isAdmin && (
            <Card title="Mulai dengan data asli">
              <form action={clearTransactions} className="space-y-3 p-5 text-sm">
                <p className="text-muted">
                  Sistem terisi data contoh (pelanggan/supplier bertanda “Contoh”, pesanan, lot awal). Hapus semua transaksi, pelanggan, supplier, petani,
                  lot, dan riwayat email. Produk, pengaturan, dan pengguna tetap ada.
                </p>
                <Field label='Ketik "HAPUS" untuk konfirmasi'>
                  <input name="confirm" className="input" autoComplete="off" />
                </Field>
                <SubmitButton className="btn-danger" confirm="Yakin menghapus semua data transaksi? Tindakan ini tidak bisa dibatalkan.">
                  Hapus data contoh & transaksi
                </SubmitButton>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
