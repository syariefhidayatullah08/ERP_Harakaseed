import Link from "next/link";
import type { Metadata } from "next";
import { all } from "@/lib/db";
import { addDays, daysUntil, tanggal, today } from "@/lib/format";
import { divisionLabel } from "@/lib/access";
import { AUDIT_STATUS, DOC_STATUS, FINDING_CATEGORY, FINDING_STATUS } from "@/lib/mutu";
import { Badge, Card, Empty, Flash, PageHeader, StatCard } from "@/components/ui";
import { requireAccess } from "@/lib/session";
import { AuditForm, DocForm, FindingForm, type Audit, type QualityDoc } from "./forms";

export const metadata: Metadata = { title: "Mutu & Audit ISO" };

type Finding = { id: number; code: string; audit_code: string | null; clause: string; division: string; category: string; status: string; due_date: string | null; description: string };

export default async function MutuPage({ searchParams }: PageProps<"/mutu">) {
  await requireAccess("mutu");
  const sp = await searchParams;
  const tab = ["temuan", "dokumen"].includes(String(sp.tab)) ? String(sp.tab) : "audit";
  const t = today();

  const audits = await all<Audit & { findings: number; open: number }>(
    `SELECT a.*, (SELECT COUNT(*) FROM findings f WHERE f.audit_id = a.id) findings,
            (SELECT COUNT(*) FROM findings f WHERE f.audit_id = a.id AND f.status <> 'ditutup') open
     FROM audits a ORDER BY a.start_date DESC`,
  );
  const findings = await all<Finding>(
    `SELECT f.id, f.code, f.clause, f.division, f.category, f.status, f.due_date, f.description, a.code audit_code
     FROM findings f LEFT JOIN audits a ON a.id = f.audit_id
     ORDER BY (f.status = 'ditutup'), CASE f.category WHEN 'mayor' THEN 0 WHEN 'minor' THEN 1 ELSE 2 END, f.due_date`,
  );
  const docs = await all<QualityDoc>("SELECT * FROM quality_docs ORDER BY (status = 'kadaluarsa'), code");

  const open = findings.filter((f) => f.status !== "ditutup");
  const overdue = open.filter((f) => f.due_date && f.due_date < t);
  const toReview = docs.filter((d) => d.status === "berlaku" && d.review_date && d.review_date <= addDays(t, 30));
  const upcoming = audits.filter((a) => a.status === "rencana" && a.start_date >= t);

  const tabs = [
    ["audit", `Audit (${audits.length})`],
    ["temuan", `Temuan & CAPA (${open.length} terbuka)`],
    ["dokumen", `Dokumen mutu (${docs.length})`],
  ];

  return (
    <>
      <PageHeader title="Mutu & Audit ISO" subtitle="Sistem manajemen mutu ISO 9001:2015: audit, temuan & tindakan perbaikan, pengendalian dokumen" />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Audit terjadwal" value={upcoming.length} hint={upcoming[0] ? `berikutnya ${tanggal(upcoming[0].start_date)}` : "belum ada jadwal"} />
        <StatCard
          label="Temuan terbuka"
          value={open.length}
          hint={`${open.filter((f) => f.category === "mayor").length} mayor`}
          tone={open.some((f) => f.category === "mayor") ? "danger" : open.length ? "warn" : "default"}
        />
        <StatCard label="Lewat tenggat" value={overdue.length} tone={overdue.length ? "danger" : "default"} />
        <StatCard label="Dokumen perlu ditinjau" value={toReview.length} hint="≤ 30 hari" tone={toReview.length ? "warn" : "default"} />
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map(([k, label]) => (
          <Link
            key={k}
            href={k === "audit" ? "/mutu" : `/mutu?tab=${k}`}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === k ? "border-brand-700 font-semibold text-brand-800" : "border-transparent text-muted hover:text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "audit" && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="overflow-hidden lg:col-span-2">
            {audits.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Audit</th>
                      <th>Jenis & standar</th>
                      <th>Tanggal</th>
                      <th className="num">Temuan</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audits.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <Link href={`/mutu/audit/${a.id}`} className="font-medium text-brand-700 hover:underline">
                            {a.title}
                          </Link>
                          <div className="text-xs text-muted">
                            {a.code}
                            {a.auditor && ` · ${a.auditor}`}
                          </div>
                        </td>
                        <td className="text-xs">
                          {a.audit_type}
                          <div className="text-muted">{a.standard}</div>
                        </td>
                        <td className="whitespace-nowrap text-xs">
                          {tanggal(a.start_date)}
                          {a.end_date && a.end_date !== a.start_date && ` – ${tanggal(a.end_date)}`}
                        </td>
                        <td className="num">
                          {a.findings} {a.open > 0 && <span className="text-xs text-red-700">({a.open} terbuka)</span>}
                        </td>
                        <td>
                          <Badge tone={AUDIT_STATUS[a.status]?.tone}>{AUDIT_STATUS[a.status]?.label}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Belum ada audit. Jadwalkan audit internal pertama di samping.</Empty>
            )}
          </Card>
          <Card title="Jadwalkan audit">
            <AuditForm />
          </Card>
        </div>
      )}

      {tab === "temuan" && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="overflow-hidden lg:col-span-2">
            {findings.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Temuan</th>
                      <th>Divisi</th>
                      <th>Tenggat</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {findings.map((f) => {
                      const late = f.status !== "ditutup" && f.due_date && f.due_date < t;
                      return (
                        <tr key={f.id}>
                          <td className="max-w-md">
                            <Link href={`/temuan/${f.id}`} className="font-medium text-brand-700 hover:underline">
                              {f.code}
                            </Link>{" "}
                            <Badge tone={FINDING_CATEGORY[f.category]?.tone}>{FINDING_CATEGORY[f.category]?.label}</Badge>
                            <div className="truncate text-xs text-muted">
                              {[f.audit_code, f.clause].filter(Boolean).join(" · ")} {f.description}
                            </div>
                          </td>
                          <td className="text-sm">{divisionLabel(f.division)}</td>
                          <td className="whitespace-nowrap text-xs">
                            {tanggal(f.due_date)} {late && f.due_date && <Badge tone="red">telat {-daysUntil(f.due_date)} hr</Badge>}
                          </td>
                          <td>
                            <Badge tone={FINDING_STATUS[f.status]?.tone}>{FINDING_STATUS[f.status]?.label}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Belum ada temuan.</Empty>
            )}
          </Card>
          <Card title="Catat temuan di luar audit">
            <FindingForm />
          </Card>
        </div>
      )}

      {tab === "dokumen" && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="overflow-hidden lg:col-span-2">
            {docs.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Dokumen</th>
                      <th>Divisi</th>
                      <th>Rev.</th>
                      <th>Tinjau ulang</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <Link href={`/mutu/dokumen/${d.id}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">
                            {d.code}
                          </Link>
                          <div className="text-sm">{d.title}</div>
                          <div className="text-xs text-muted">{d.doc_type}</div>
                        </td>
                        <td className="text-sm">{divisionLabel(d.division)}</td>
                        <td className="font-mono text-xs">{d.revision}</td>
                        <td className="whitespace-nowrap text-xs">
                          {tanggal(d.review_date)}{" "}
                          {d.status === "berlaku" && d.review_date && d.review_date <= addDays(t, 30) && (
                            <Badge tone={d.review_date < t ? "red" : "amber"}>{d.review_date < t ? "lewat" : "segera"}</Badge>
                          )}
                        </td>
                        <td>
                          <Badge tone={DOC_STATUS[d.status]?.tone}>{DOC_STATUS[d.status]?.label}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Belum ada dokumen terdaftar. Daftarkan manual mutu, SOP, IK, dan formulir di samping.</Empty>
            )}
          </Card>
          <Card title="Daftarkan dokumen">
            <DocForm />
          </Card>
        </div>
      )}
    </>
  );
}
