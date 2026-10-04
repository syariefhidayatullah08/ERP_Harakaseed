import { notFound } from "next/navigation";
import { get } from "@/lib/db";
import { toId } from "@/lib/form";
import { tanggal } from "@/lib/format";
import { DOC_STATUS } from "@/lib/mutu";
import { Badge, Card, Flash, PageHeader } from "@/components/ui";
import { Attachments } from "@/components/attachments";
import { requireAccess } from "@/lib/session";
import { DocForm, type QualityDoc } from "../../forms";

export default async function QualityDocPage({ params, searchParams }: PageProps<"/mutu/dokumen/[id]">) {
  await requireAccess("mutu");
  const { id } = await params;
  const sp = await searchParams;
  const d = await get<QualityDoc>("SELECT * FROM quality_docs WHERE id = ?", toId(id));
  if (!d) notFound();
  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{d.code}</span> <Badge tone={DOC_STATUS[d.status]?.tone}>{DOC_STATUS[d.status]?.label}</Badge>
          </span>
        }
        subtitle={`${d.title} · Rev. ${d.revision}${d.effective_date ? ` · berlaku ${tanggal(d.effective_date)}` : ""}`}
        back={{ href: "/mutu?tab=dokumen", label: "Dokumen mutu" }}
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Data dokumen">
          <DocForm d={d} />
        </Card>
        <Attachments refType="qdoc" refId={d.id} title="File dokumen & revisi" />
      </div>
    </>
  );
}
