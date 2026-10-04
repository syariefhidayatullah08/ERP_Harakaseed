import Link from "next/link";
import type { Metadata } from "next";
import { all } from "@/lib/db";
import { daysUntil, tanggal, today } from "@/lib/format";
import { divisionLabel } from "@/lib/access";
import { FINDING_CATEGORY, FINDING_STATUS } from "@/lib/mutu";
import { Badge, Card, Empty, Flash, PageHeader } from "@/components/ui";
import { can, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Temuan Audit" };

/** Temuan audit/ketidaksesuaian yang harus ditindaklanjuti divisi pengguna. Mutu melihat semuanya. */
export default async function MyFindingsPage({ searchParams }: PageProps<"/temuan">) {
  const user = await requireUser();
  const sp = await searchParams;
  const all_ = can(user, "mutu");
  const rows = await all<{ id: number; code: string; clause: string; division: string; category: string; status: string; due_date: string | null; description: string; audit_title: string | null }>(
    `SELECT f.*, a.title audit_title FROM findings f LEFT JOIN audits a ON a.id = f.audit_id
     WHERE (? = 1 OR f.division = ?)
     ORDER BY (f.status = 'ditutup'), f.due_date`,
    all_ ? 1 : 0,
    user.role,
  );
  const t = today();

  return (
    <>
      <PageHeader
        title="Temuan Audit"
        subtitle={all_ ? "Semua temuan & tindakan perbaikan (CAPA)" : `Temuan untuk divisi ${divisionLabel(user.role)}: isi akar masalah & tindakan perbaikannya`}
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <Card className="overflow-hidden">
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((f) => {
              const late = f.status !== "ditutup" && f.due_date && f.due_date < t;
              return (
                <li key={f.id}>
                  <Link href={`/temuan/${f.id}`} className="block px-5 py-3 hover:bg-brand-50/50">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-brand-700">{f.code}</span>
                      <Badge tone={FINDING_CATEGORY[f.category]?.tone}>{FINDING_CATEGORY[f.category]?.label}</Badge>
                      <Badge tone={FINDING_STATUS[f.status]?.tone}>{FINDING_STATUS[f.status]?.label}</Badge>
                      {late && f.due_date && <Badge tone="red">telat {-daysUntil(f.due_date)} hari</Badge>}
                    </div>
                    <div className="mt-1 text-sm">{f.description}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {[all_ ? divisionLabel(f.division) : null, f.audit_title, f.clause, `tenggat ${tanggal(f.due_date)}`].filter(Boolean).join(" · ")}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>Tidak ada temuan audit untuk divisi Anda. 👍</Empty>
        )}
      </Card>
    </>
  );
}
