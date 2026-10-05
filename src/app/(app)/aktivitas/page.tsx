import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { all, get } from "@/lib/db";
import { tanggal } from "@/lib/format";
import { withMsg } from "@/lib/form";
import { divisionLabel } from "@/lib/access";
import { ACTIVITY_MODULES } from "@/lib/activity";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { ExportMenu } from "@/components/export-menu";

export const metadata: Metadata = { title: "Log Aktivitas" };

const PAGE_SIZE = 100;
type Row = { id: number; at: string; user_name: string; user_email: string; role: string; module: string; action: string; detail: string; ip: string };

export default async function ActivityPage({ searchParams }: PageProps<"/aktivitas">) {
  const me = await requireUser();
  if (me.role !== "owner") redirect(withMsg("/", "Log aktivitas hanya bisa dilihat Founder.", "error"));
  const sp = await searchParams;
  const date = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : "");
  const f = { q: String(sp.q ?? "").trim(), user: String(sp.user ?? ""), module: String(sp.module ?? ""), from: date(sp.from), to: date(sp.to) };
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);

  const where = `(? = '' OR action ILIKE ? OR detail ILIKE ? OR user_name ILIKE ?) AND (? = '' OR user_email = ?) AND (? = '' OR module = ?)
    AND (? = '' OR at >= ?) AND (? = '' OR at < ?)`;
  const like = `%${f.q}%`;
  // "sampai" mencakup seluruh hari itu.
  const params = [f.q, like, like, like, f.user, f.user, f.module, f.module, f.from, f.from, f.to, f.to ? `${f.to} 99` : ""];
  const total = (await get<{ n: number }>(`SELECT COUNT(*) n FROM activity_log WHERE ${where}`, ...params))!.n;
  const rows = await all<Row>(`SELECT * FROM activity_log WHERE ${where} ORDER BY at DESC, id DESC LIMIT ? OFFSET ?`, ...params, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const users = await all<{ user_email: string; user_name: string }>(
    "SELECT user_email, MAX(user_name) user_name FROM activity_log WHERE user_email <> '' GROUP BY user_email ORDER BY 2",
  );

  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    if (p > 1) u.set("page", String(p));
    return `/aktivitas${u.size ? `?${u}` : ""}`;
  };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Log Aktivitas"
        subtitle="Jejak audit: siapa melakukan apa dan kapan. Tercatat otomatis dan tidak bisa diubah dari ERP. Hanya Founder."
        actions={<ExportMenu type="aktivitas" from={f.from || undefined} to={f.to || undefined} />}
      />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <input name="q" defaultValue={f.q} placeholder="Cari aksi, rincian, atau nama…" className="input max-w-xs" />
        <select name="user" defaultValue={f.user} className="input w-auto" aria-label="Pengguna">
          <option value="">Semua pengguna</option>
          {users.map((u) => (
            <option key={u.user_email} value={u.user_email}>
              {u.user_name} ({u.user_email})
            </option>
          ))}
        </select>
        <select name="module" defaultValue={f.module} className="input w-auto" aria-label="Bagian">
          <option value="">Semua bagian</option>
          {Object.entries(ACTIVITY_MODULES).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <input name="from" type="date" defaultValue={f.from} className="input w-auto" aria-label="Dari tanggal" />
        <input name="to" type="date" defaultValue={f.to} className="input w-auto" aria-label="Sampai tanggal" />
        <button className="btn-secondary">Saring</button>
        {Object.values(f).some(Boolean) && (
          <Link href="/aktivitas" className="text-sm text-brand-700 hover:underline">
            Hapus saringan
          </Link>
        )}
      </form>
      <Card className="overflow-hidden">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Waktu (WIB)</th>
                  <th>Pengguna</th>
                  <th>Bagian</th>
                  <th>Aktivitas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-xs">
                      {tanggal(r.at.slice(0, 10))}
                      <div className="text-muted">{r.at.slice(11, 19)}</div>
                    </td>
                    <td>
                      <div className="text-sm font-medium">{r.user_name}</div>
                      <div className="text-xs text-muted">{[r.user_email, r.role && divisionLabel(r.role)].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td>
                      <Badge tone={r.module === "login" ? "amber" : r.module === "backup" ? "blue" : "brand"}>{ACTIVITY_MODULES[r.module] ?? r.module}</Badge>
                    </td>
                    <td className="max-w-xl">
                      <div className={`text-sm ${/gagal|dikunci|menghapus/i.test(r.action) ? "font-medium text-red-700" : ""}`}>{r.action}</div>
                      {r.detail && <div className="break-words text-xs text-muted">{r.detail}</div>}
                      {r.ip && <div className="text-[11px] text-muted">IP {r.ip}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Belum ada aktivitas yang cocok.</Empty>
        )}
      </Card>
      <div className="mt-3 flex items-center justify-between text-sm text-muted">
        <span>
          {total} catatan · halaman {page} dari {pages}
        </span>
        <span className="flex gap-2">
          {page > 1 && (
            <Link href={qs(page - 1)} className="btn-secondary btn-sm">
              ← Lebih baru
            </Link>
          )}
          {page < pages && (
            <Link href={qs(page + 1)} className="btn-secondary btn-sm">
              Lebih lama →
            </Link>
          )}
        </span>
      </div>
    </>
  );
}
