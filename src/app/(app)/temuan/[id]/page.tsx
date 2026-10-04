import Link from "next/link";
import { notFound } from "next/navigation";
import { get } from "@/lib/db";
import { toId } from "@/lib/form";
import { tanggal } from "@/lib/format";
import { divisionLabel } from "@/lib/access";
import { FINDING_CATEGORY, FINDING_SOURCE, FINDING_STATUS } from "@/lib/mutu";
import { Badge, Card, DL, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { Attachments } from "@/components/attachments";
import { respondFinding, verifyFinding } from "@/actions/mutu";
import { can, requireUser } from "@/lib/session";

export default async function FindingPage({ params, searchParams }: PageProps<"/temuan/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const f = await get<{
    id: number; code: string; audit_id: number | null; audit_title: string | null; source: string; clause: string; division: string; category: string; description: string;
    root_cause: string; correction: string; corrective_action: string; due_date: string | null; status: string; verification: string; responded_at: string | null; closed_at: string | null;
    created_at: string; auditor_name: string | null;
  }>(
    `SELECT f.*, a.title audit_title, u.name auditor_name FROM findings f LEFT JOIN audits a ON a.id = f.audit_id
     LEFT JOIN users u ON u.id = f.created_by WHERE f.id = ?`,
    toId(id),
  );
  const isMutu = can(user, "mutu");
  // Hanya Mutu dan divisi penanggung jawab yang boleh melihat temuan ini.
  if (!f || (!isMutu && f.division !== user.role)) notFound();
  const closed = f.status === "ditutup";
  const canRespond = !closed && (f.division === user.role || isMutu);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {f.code} <Badge tone={FINDING_CATEGORY[f.category]?.tone}>{FINDING_CATEGORY[f.category]?.label}</Badge>
            <Badge tone={FINDING_STATUS[f.status]?.tone}>{FINDING_STATUS[f.status]?.label}</Badge>
          </span>
        }
        subtitle={`Divisi ${divisionLabel(f.division)} · tenggat ${tanggal(f.due_date)}`}
        back={isMutu ? { href: "/mutu?tab=temuan", label: "Temuan & CAPA" } : { href: "/temuan", label: "Temuan Audit" }}
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Temuan">
            <div className="space-y-4 p-5 text-sm">
              <p className="whitespace-pre-line">{f.description}</p>
              <DL
                items={[
                  ["Sumber", f.audit_id && isMutu ? <Link key="a" href={`/mutu/audit/${f.audit_id}`} className="text-brand-700 hover:underline">{f.audit_title}</Link> : f.audit_title ?? FINDING_SOURCE[f.source] ?? f.source],
                  ["Klausul", f.clause || "—"],
                  ["Dicatat", `${tanggal(f.created_at)}${f.auditor_name ? ` oleh ${f.auditor_name}` : ""}`],
                ]}
              />
            </div>
          </Card>

          <Card title="Analisis & tindakan perbaikan (diisi divisi)">
            {canRespond ? (
              <form action={respondFinding} className="space-y-3 p-5">
                <input type="hidden" name="id" value={f.id} />
                <Field label="Akar masalah * (mis. analisis 5-Why)">
                  <textarea name="root_cause" rows={3} required defaultValue={f.root_cause} className="input" />
                </Field>
                <Field label="Koreksi segera (perbaikan masalah yang ada)">
                  <textarea name="correction" rows={2} defaultValue={f.correction} className="input" />
                </Field>
                <Field label="Tindakan korektif * (mencegah terulang)">
                  <textarea name="corrective_action" rows={3} required defaultValue={f.corrective_action} className="input" />
                </Field>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">{f.responded_at ? `Terakhir ditanggapi ${tanggal(f.responded_at)}` : "Unggah bukti tindakan di kotak lampiran."}</span>
                  <SubmitButton>{f.status === "ditanggapi" ? "Perbarui tanggapan" : "Kirim ke Mutu untuk verifikasi"}</SubmitButton>
                </div>
              </form>
            ) : (
              <div className="p-5 text-sm">
                <DL
                  items={[
                    ["Akar masalah", f.root_cause || "—"],
                    ["Koreksi", f.correction || "—"],
                    ["Tindakan korektif", f.corrective_action || "—"],
                  ]}
                />
              </div>
            )}
          </Card>
          <Attachments refType="finding" refId={f.id} title="Bukti temuan & tindakan perbaikan" />
        </div>

        <Card title="Verifikasi Mutu">
          <div className="p-5 text-sm">
            {f.verification && (
              <div className="mb-4 rounded-lg bg-canvas p-3">
                <div className="text-xs text-muted">{closed ? `Ditutup ${tanggal(f.closed_at)}` : "Catatan verifikasi terakhir"}</div>
                <div className="mt-1 whitespace-pre-line">{f.verification}</div>
              </div>
            )}
            {isMutu && !closed ? (
              <form action={verifyFinding} className="space-y-3">
                <input type="hidden" name="id" value={f.id} />
                <Field label="Hasil verifikasi efektivitas tindakan *">
                  <textarea name="verification" rows={4} required className="input" placeholder="Bukti yang diperiksa, apakah tindakan efektif…" />
                </Field>
                <SubmitButton name="decision" value="tutup" className="btn-primary w-full" confirm="Tutup temuan ini?">
                  Efektif → tutup temuan
                </SubmitButton>
                <SubmitButton name="decision" value="kembalikan" className="btn-secondary w-full">
                  Belum efektif → kembalikan ke divisi
                </SubmitButton>
              </form>
            ) : (
              !closed && <p className="text-muted">Setelah tanggapan dikirim, divisi Mutu akan memverifikasi dan menutup temuan.</p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
