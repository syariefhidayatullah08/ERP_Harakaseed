import type { Metadata } from "next";
import { CheckCircle2, Lock, XCircle } from "lucide-react";
import Image from "next/image";
import { get, getDocSettings } from "@/lib/db";
import { emailInfo } from "@/lib/email";
import { getAccessMatrix, requireUser } from "@/lib/session";
import { Badge, Card, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { backupNow, changePassword, clearTransactions, saveAccessMatrix, saveSettings, saveSignature, updateMyName } from "@/actions/settings";
import { fitSignature, parseSignature, signatureDataUrl, SIGNATURE_MAX_BYTES } from "@/lib/signature";
import { BACKUP_KEEP, listBackups, type BackupFile } from "@/lib/backup";
import { tanggal } from "@/lib/format";
import { formatBytes } from "@/lib/attachments";
import { testEmail } from "@/actions/email";
import { InstallApp } from "@/components/install-app";
import { ALL_MODULES, DEFAULT_ACCESS, DIVISIONS, MODULE_HINT, MODULES, OWNER_ONLY, divisionLabel, resolveModules, type Division } from "@/lib/access";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function SettingsPage({ searchParams }: PageProps<"/pengaturan">) {
  const sp = await searchParams;
  const me = await requireUser();
  const isOwner = me.role === "owner";

  const myAccount = (
    <Card title="Akun saya">
      <div className="space-y-4 p-5">
        <div className="text-sm">
          <div className="text-muted">Email login</div>
          <div className="font-medium">{me.email}</div>
          <div className="mt-2 text-muted">Divisi</div>
          <div className="font-medium">{divisionLabel(me.role)}</div>
        </div>
        <form action={updateMyName} className="flex items-end gap-2">
          <Field label="Nama tampilan" className="flex-1">
            <input name="name" defaultValue={me.name} required className="input" />
          </Field>
          <SubmitButton className="btn-secondary">Simpan</SubmitButton>
        </form>
        <form action={changePassword} className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <Field label="Kata sandi lama">
            <input name="current" type="password" required autoComplete="current-password" className="input" />
          </Field>
          <Field label="Kata sandi baru (min. 8)">
            <input name="next" type="password" minLength={8} required autoComplete="new-password" className="input" />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton className="btn-secondary">Ganti kata sandi</SubmitButton>
          </div>
        </form>
      </div>
    </Card>
  );

  const installCard = (
    <Card title="Pasang sebagai aplikasi">
      <div className="p-5">
        <InstallApp />
      </div>
    </Card>
  );

  if (!isOwner) {
    return (
      <>
        <PageHeader title="Pengaturan" subtitle="Akun Anda. Pengaturan perusahaan hanya bisa diubah Founder." />
        <Flash msg={sp.msg as string} error={sp.error as string} />
        <div className="max-w-2xl space-y-5">
          {myAccount}
          {installCard}
        </div>
      </>
    );
  }

  const info = emailInfo();
  const settings = await getDocSettings();
  const s = (k: string) => settings[k] ?? "";
  const matrix = await getAccessMatrix();
  const divisions = Object.keys(DEFAULT_ACCESS) as Exclude<Division, "owner">[];
  const modules = ALL_MODULES.filter((m) => !OWNER_ONLY.includes(m));
  let backups: BackupFile[] = [];
  let backupError = "";
  try {
    backups = await listBackups();
  } catch (e) {
    backupError = e instanceof Error ? e.message : String(e);
  }
  const [lastAt, lastStatus, lastNote] = s("backup_last").split("|");
  const files = (await get<{ n: number; bytes: number }>("SELECT COUNT(*) n, COALESCE(SUM(size), 0) bytes FROM attachments"))!;

  return (
    <>
      <PageHeader title="Pengaturan" subtitle="Profil perusahaan, hak akses divisi, koneksi email, dan akun Anda" />
      <Flash msg={sp.msg as string} error={sp.error as string} />

      <Card
        title={<span id="akses">Hak akses divisi</span>}
        className="mb-5 scroll-mt-6 overflow-hidden"
        actions={matrix ? <Badge tone="orange">Disesuaikan</Badge> : <Badge>Bawaan</Badge>}
      >
        <form action={saveAccessMatrix}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="min-w-48">Modul</th>
                  <th className="text-center">{DIVISIONS.owner.label}</th>
                  {divisions.map((d) => (
                    <th key={d} className="text-center">
                      {DIVISIONS[d].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_MODULES.map((m) => {
                  const locked = OWNER_ONLY.includes(m);
                  return (
                    <tr key={m}>
                      <td>
                        <div className="font-medium">
                          {MODULES[m]} {locked && <Lock size={12} className="inline text-orange-600" />}
                        </div>
                        <div className="text-xs text-muted">{MODULE_HINT[m]}</div>
                      </td>
                      <td className="text-center">
                        <CheckCircle2 size={16} className="inline text-emerald-600" aria-label="Selalu" />
                      </td>
                      {divisions.map((d) => (
                        <td key={d} className="text-center">
                          {locked ? (
                            <span className="text-xs text-muted">—</span>
                          ) : (
                            <input
                              type="checkbox"
                              name={`${d}:${m}`}
                              defaultChecked={resolveModules(d, matrix).includes(m)}
                              className="size-4 accent-brand-700"
                              aria-label={`${DIVISIONS[d].label}: ${MODULES[m]}`}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
            <p className="text-xs text-muted">
              <Lock size={12} className="inline text-orange-600" /> Keuangan, Buku Kas, dan Akun Pengguna selalu khusus Founder. Perubahan berlaku langsung untuk semua pengguna. ({modules.length} modul
              bisa diatur)
            </p>
            <div className="flex gap-2">
              <SubmitButton className="btn-secondary" name="reset" value="1" confirm="Kembalikan semua hak akses ke bawaan?">
                Kembalikan bawaan
              </SubmitButton>
              <SubmitButton>Simpan hak akses</SubmitButton>
            </div>
          </div>
        </form>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {myAccount}
        {installCard}

        <Card title="Koneksi email perusahaan" actions={info.configured ? <Badge tone="green">Terkonfigurasi</Badge> : <Badge tone="amber">Belum terhubung</Badge>}>
          <div className="space-y-4 p-5 text-sm">
            <div className="flex items-center gap-2">
              {info.configured ? <CheckCircle2 className="text-emerald-600" size={18} /> : <XCircle className="text-amber-600" size={18} />}
              {info.configured ? (
                <span>
                  Akun <b>{info.user}</b> · SMTP {info.smtp} · IMAP {info.imap}
                </span>
              ) : (
                <span>Isi EMAIL_USER dan EMAIL_PASS (App Password Gmail) di environment Vercel.</span>
              )}
            </div>
            <p className="text-xs text-muted">
              Email ini dipakai ERP untuk mengirim konfirmasi pesanan, invoice, undangan akun, dan reset kata sandi. Login pengguna memakai email pribadi masing-masing.
            </p>
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
              ["auto_email_shipping", "Kirim info pengiriman (kurir, resi, surat jalan PDF) saat barang dikirim"],
              ["auto_email_invoice", "Kirim invoice PDF saat barang dikirim"],
            ].map(([k, label]) => (
              <label key={k} className="flex items-start gap-3">
                <input type="checkbox" name={k} defaultChecked={s(k) === "1"} className="mt-0.5 accent-brand-700" />
                {label}
              </label>
            ))}
            <Field label="Email penerima peringatan internal (stok rendah, email tes)">
              <input name="alert_email" type="email" defaultValue={s("alert_email")} className="input" />
            </Field>
            <SubmitButton>Simpan</SubmitButton>
          </form>
        </Card>

        <Card
          title={<span id="backup">Backup data</span>}
          className="scroll-mt-6"
          actions={
            !lastAt ? <Badge tone="amber">Belum pernah</Badge> : lastStatus === "ok" ? <Badge tone="green">Terakhir {tanggal(lastAt.slice(0, 10))}</Badge> : <Badge tone="red">Terakhir gagal</Badge>
          }
        >
          <div className="space-y-4 p-5 text-sm">
            <p className="text-muted">
              Seluruh database disalin otomatis setiap malam (± pukul 01.00 WIB) ke penyimpanan file privat, terpisah dari server database. {BACKUP_KEEP} backup terakhir
              disimpan. File lampiran (bukti transfer, foto, dokumen) ikut disalin.
            </p>
            {lastStatus === "gagal" && (
              <p className="text-red-700">
                Backup terakhir ({lastAt}) gagal: {lastNote}
              </p>
            )}
            {backupError && <p className="text-red-700">Daftar backup tidak bisa dibaca: {backupError}</p>}
            <form action={saveSettings} className="flex items-end gap-2">
              <Field label="Kirim salinan backup ke email Founder" className="flex-1">
                <select name="backup_email" defaultValue={s("backup_email") || "harian"} className="input">
                  <option value="harian">Setiap hari</option>
                  <option value="mingguan">Seminggu sekali (Senin)</option>
                  <option value="mati">Tidak dikirim (hanya disimpan di ERP)</option>
                </select>
              </Field>
              <SubmitButton className="btn-secondary">Simpan</SubmitButton>
            </form>
            <form action={backupNow}>
              <SubmitButton className="btn-secondary" pendingText="Membuat backup…">
                Buat backup sekarang
              </SubmitButton>
            </form>
            {backups.length > 0 && (
              <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                {backups.map((b) => (
                  <li key={b.name} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span>
                      {tanggal(b.name.slice(11, 21))} <span className="text-xs text-muted">· {Math.max(1, Math.round(b.size / 1024))} KB</span>
                    </span>
                    <a href={`/api/backup?file=${b.name}`} className="text-brand-700 hover:underline">
                      Unduh
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {files.n > 0 && (
              <p>
                <a href="/api/backup/files" className="text-brand-700 hover:underline">
                  Unduh semua file lampiran (.zip)
                </a>{" "}
                <span className="text-xs text-muted">
                  · {files.n} file, {formatBytes(files.bytes)}
                </span>
              </p>
            )}
            <p className="text-xs text-muted">File backup berisi seluruh data perusahaan. Simpan di tempat aman dan jangan dibagikan.</p>
          </div>
        </Card>

        <Card title="Mulai dengan data asli">
          <form action={clearTransactions} className="space-y-3 p-5 text-sm">
            <p className="text-muted">
              Hapus semua transaksi & data contoh (pesanan, pelanggan, supplier, petani, lot, produksi, uji lab, keluhan, email, lampiran). Produk, pengaturan, akun pengguna, audit & dokumen mutu, dan
              data karyawan tetap.
            </p>
            <Field label='Ketik "HAPUS" untuk konfirmasi'>
              <input name="confirm" className="input" autoComplete="off" />
            </Field>
            <SubmitButton className="btn-danger" confirm="Yakin menghapus semua data transaksi? Tindakan ini tidak bisa dibatalkan.">
              Hapus data contoh & transaksi
            </SubmitButton>
          </form>
        </Card>

        <Card title="Profil perusahaan (kop email, invoice, surat jalan)" className="lg:col-span-2">
          <form action={saveSettings} className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Nama perusahaan">
              <input name="company_name" defaultValue={s("company_name")} className="input" />
            </Field>
            <Field label="Merek">
              <input name="company_brand" defaultValue={s("company_brand")} className="input" />
            </Field>
            <Field label="Tagline">
              <input name="company_tagline" defaultValue={s("company_tagline")} className="input" />
            </Field>
            <Field label="Website">
              <input name="company_website" defaultValue={s("company_website")} className="input" />
            </Field>
            <Field label="Telepon / WA">
              <input name="company_phone" defaultValue={s("company_phone")} className="input" />
            </Field>
            <Field label="Email perusahaan">
              <input name="company_email" type="email" defaultValue={s("company_email")} className="input" />
            </Field>
            <Field label="Alamat" className="sm:col-span-2">
              <input name="company_address" defaultValue={s("company_address")} className="input" />
            </Field>
            <Field label="Rekening pembayaran (ringkas, untuk email & WhatsApp)" className="sm:col-span-2">
              <input name="bank_info" defaultValue={s("bank_info")} className="input" placeholder="Bank Mandiri · No. Rek … · a.n. PT Benih Haraka Sejahtera" />
            </Field>
            <div className="grid gap-4 rounded-lg bg-canvas p-4 sm:col-span-2 sm:grid-cols-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted sm:col-span-3">Kotak catatan & tanda tangan di invoice cetak</div>
              <Field label="Nama bank">
                <input name="bank_name" defaultValue={s("bank_name")} className="input" placeholder="BANK MANDIRI" />
              </Field>
              <Field label="No. rekening">
                <input name="bank_account" defaultValue={s("bank_account")} className="input" />
              </Field>
              <Field label="Atas nama">
                <input name="bank_holder" defaultValue={s("bank_holder")} className="input" />
              </Field>
              <Field label="Kota tanda tangan">
                <input name="invoice_city" defaultValue={s("invoice_city")} className="input" placeholder="Jember" />
              </Field>
              <div className="text-xs text-muted sm:col-span-3">Dua penanda tangan di invoice dan surat pengajuan pembayaran benih (PB): kiri dan kanan. Gambar tanda tangannya diunggah di kartu di bawah.</div>
              <Field label="Jabatan penanda tangan kiri">
                <input name="signer_title" defaultValue={s("signer_title")} className="input" placeholder="Direktur" />
              </Field>
              <Field label="Nama penanda tangan kiri" className="sm:col-span-2">
                <input name="signer_name" defaultValue={s("signer_name")} className="input" />
              </Field>
              <Field label="Jabatan penanda tangan kanan">
                <input name="signer2_title" defaultValue={s("signer2_title")} className="input" placeholder="ADM & SDM" />
              </Field>
              <Field label="Nama penanda tangan kanan" className="sm:col-span-2">
                <input name="signer2_name" defaultValue={s("signer2_name")} className="input" />
              </Field>
            </div>
            <div className="flex justify-end sm:col-span-2">
              <SubmitButton>Simpan profil</SubmitButton>
            </div>
          </form>
        </Card>

        <Card title={<span id="ttd">Gambar tanda tangan (invoice & surat PB)</span>} className="scroll-mt-6 lg:col-span-2">
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            {(
              [
                ["signer_sig", "kiri", s("signer_title") || "Direktur", s("signer_name")],
                ["signer2_sig", "kanan", s("signer2_title") || "ADM & SDM", s("signer2_name")],
              ] as const
            ).map(([slot, side, title, name]) => {
              const sig = parseSignature(settings[slot]);
              const size = sig && fitSignature(sig, 220, 90);
              return (
                <div key={slot} className="space-y-3 rounded-lg bg-canvas p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {title} <span className="text-xs text-muted">· {side}</span>
                      </div>
                      <div className="text-xs text-muted">{name || "Nama belum diisi"}</div>
                    </div>
                    {sig ? <Badge tone="green">Terpasang</Badge> : <Badge tone="amber">Belum ada</Badge>}
                  </div>
                  {sig && size && (
                    <div className="flex h-24 items-center justify-center rounded-lg border border-line bg-white">
                      <Image src={signatureDataUrl(sig)} alt={`Tanda tangan ${name || title}`} width={Math.round(size.width)} height={Math.round(size.height)} unoptimized />
                    </div>
                  )}
                  <form action={saveSignature} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="slot" value={slot} />
                    <input name="file" type="file" accept="image/png,image/jpeg" required className="input min-w-0 flex-1 text-xs" aria-label={`Gambar tanda tangan ${side}`} />
                    <SubmitButton className="btn-secondary" pendingText="Mengunggah…">
                      {sig ? "Ganti" : "Unggah"}
                    </SubmitButton>
                  </form>
                  {sig && (
                    <form action={saveSignature}>
                      <input type="hidden" name="slot" value={slot} />
                      <SubmitButton className="btn-danger btn-sm" name="remove" value="1" confirm={`Hapus gambar tanda tangan ${side}?`}>
                        Hapus gambar
                      </SubmitButton>
                    </form>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-muted sm:col-span-2">
              Gambar ditempel otomatis di atas nama penanda tangan pada PDF & Word invoice serta PDF surat pengajuan PB, termasuk yang dikirim ke pelanggan lewat email. Pakai PNG berlatar
              transparan (atau JPG berlatar putih), maksimal {SIGNATURE_MAX_BYTES / 1024} KB. Tanpa gambar, dokumen menyisakan ruang kosong untuk tanda tangan basah.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
