import Link from "next/link";
import type { Metadata } from "next";
import { RefreshCw } from "lucide-react";
import { all, get } from "@/lib/db";
import { emailInfo } from "@/lib/email";
import { Card, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { EmailCompose } from "@/components/email-compose";
import { EmailList, type EmailRow } from "@/components/email-list";
import { syncInboxAction } from "@/actions/email";

export const metadata: Metadata = { title: "Email" };

const TABS = [
  { key: "masuk", label: "Kotak masuk" },
  { key: "terkirim", label: "Terkirim" },
  { key: "gagal", label: "Gagal kirim" },
  { key: "tulis", label: "Tulis email" },
];

export default async function EmailPage({ searchParams }: PageProps<"/email">) {
  const sp = await searchParams;
  const tab = String(sp.tab ?? "masuk");
  const q = String(sp.q ?? "").trim();
  const info = emailInfo();
  const where =
    tab === "terkirim" ? "direction = 'out' AND status = 'terkirim'" : tab === "gagal" ? "direction = 'out' AND status = 'gagal'" : "direction = 'in'";
  const rows =
    tab === "tulis"
      ? []
      : await all<EmailRow>(
          `SELECT * FROM emails WHERE ${where} AND (subject ILIKE ? OR from_addr ILIKE ? OR to_addr ILIKE ?) ORDER BY created_at DESC, id DESC LIMIT 200`,
          `%${q}%`,
          `%${q}%`,
          `%${q}%`,
        );
  const failed = (await get<{ n: number }>("SELECT COUNT(*) n FROM emails WHERE direction = 'out' AND status = 'gagal'"))!.n;
  const customers = await all<{ email: string; name: string }>("SELECT email, name FROM customers WHERE email != '' ORDER BY name");

  return (
    <>
      <PageHeader
        title="Email"
        subtitle={info.configured ? `Terhubung sebagai ${info.user} (SMTP ${info.smtp} · IMAP ${info.imap})` : "Email belum dikonfigurasi"}
        actions={
          <form action={syncInboxAction}>
            <SubmitButton className="btn-secondary" pendingText="Menyinkronkan…">
              <RefreshCw size={15} /> Sinkronkan kotak masuk
            </SubmitButton>
          </form>
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      {!info.configured && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Hubungkan email di file <code className="font-mono">.env.local</code> — lihat panduan di{" "}
          <Link href="/pengaturan" className="font-semibold underline">
            Pengaturan
          </Link>
          .
        </div>
      )}

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/email?tab=${t.key}`}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === t.key ? "border-brand-700 font-semibold text-brand-800" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
            {t.key === "gagal" && failed > 0 && <span className="ml-1 rounded-full bg-red-100 px-1.5 text-xs text-red-700">{failed}</span>}
          </Link>
        ))}
      </div>

      {tab === "tulis" ? (
        <Card className="max-w-3xl">
          <datalist id="customer-emails">
            {customers.map((c) => (
              <option key={c.email} value={c.email}>
                {c.name}
              </option>
            ))}
          </datalist>
          <EmailCompose back="/email?tab=terkirim" to={String(sp.to ?? "")} />
          <p className="px-5 pb-5 text-xs text-muted">Email dikirim dengan kop surat Haraka Seed dan tercatat di riwayat.</p>
        </Card>
      ) : (
        <>
          <form className="mb-4 flex gap-2">
            <input type="hidden" name="tab" value={tab} />
            <input name="q" defaultValue={q} placeholder="Cari subjek atau alamat…" className="input max-w-sm" />
            <button className="btn-secondary">Cari</button>
          </form>
          <Card>
            <EmailList
              rows={rows}
              empty={tab === "masuk" ? "Kotak masuk kosong. Klik “Sinkronkan kotak masuk” untuk mengambil email dari server." : "Tidak ada email."}
            />
          </Card>
        </>
      )}
    </>
  );
}
