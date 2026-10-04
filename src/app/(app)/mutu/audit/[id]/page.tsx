import Link from "next/link";
import { notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { toId } from "@/lib/form";
import { tanggal } from "@/lib/format";
import { divisionLabel } from "@/lib/access";
import { AUDIT_STATUS, FINDING_CATEGORY, FINDING_STATUS } from "@/lib/mutu";
import { Badge, Card, Empty, Flash, PageHeader } from "@/components/ui";
import { Attachments } from "@/components/attachments";
import { requireAccess } from "@/lib/session";
import { AuditForm, FindingForm, type Audit } from "../../forms";

export default async function AuditPage({ params, searchParams }: PageProps<"/mutu/audit/[id]">) {
  await requireAccess("mutu");
  const { id } = await params;
  const sp = await searchParams;
  const a = await get<Audit>("SELECT * FROM audits WHERE id = ?", toId(id));
  if (!a) notFound();
  const findings = await all<{ id: number; code: string; clause: string; division: string; category: string; status: string; due_date: string | null; description: string }>(
    "SELECT * FROM findings WHERE audit_id = ? ORDER BY id",
    a.id,
  );

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {a.title} <Badge tone={AUDIT_STATUS[a.status]?.tone}>{AUDIT_STATUS[a.status]?.label}</Badge>
          </span>
        }
        subtitle={`${a.code} · ${a.audit_type} · ${a.standard} · ${tanggal(a.start_date)}`}
        back={{ href: "/mutu", label: "Mutu & Audit ISO" }}
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title={`Temuan audit (${findings.length})`} className="overflow-hidden">
            {findings.length ? (
              <ul className="divide-y divide-line">
                {findings.map((f) => (
                  <li key={f.id} className="px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/temuan/${f.id}`} className="font-medium text-brand-700 hover:underline">
                        {f.code}
                      </Link>
                      <Badge tone={FINDING_CATEGORY[f.category]?.tone}>{FINDING_CATEGORY[f.category]?.label}</Badge>
                      <Badge tone={FINDING_STATUS[f.status]?.tone}>{FINDING_STATUS[f.status]?.label}</Badge>
                    </div>
                    <div className="mt-1">{f.description}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {divisionLabel(f.division)} {f.clause && `· ${f.clause}`} · tenggat {tanggal(f.due_date)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Belum ada temuan untuk audit ini.</Empty>
            )}
          </Card>
          <Card title="Tambah temuan">
            <FindingForm auditId={a.id} />
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Data audit">
            <AuditForm a={a} />
          </Card>
          <Attachments refType="audit" refId={a.id} title="Dokumen audit (jadwal, checklist, laporan, sertifikat)" />
        </div>
      </div>
    </>
  );
}
