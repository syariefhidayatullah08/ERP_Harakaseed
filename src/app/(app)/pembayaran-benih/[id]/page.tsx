import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { rupiah } from "@/lib/format";
import { toId } from "@/lib/form";
import { Badge, Card, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { requireAccess } from "@/lib/session";
import { deleteIntake } from "@/actions/seed-payment";
import { INTAKE_STATUS, type Intake } from "@/lib/seed-payment";
import { IntakeForm } from "../intake-form";

export const metadata: Metadata = { title: "Data benih masuk" };

export default async function IntakePage({ params, searchParams }: PageProps<"/pembayaran-benih/[id]">) {
  await requireAccess("pembayaran_benih");
  const { id } = await params;
  const sp = await searchParams;
  const row = await get<Intake & { pb_no: string | null }>("SELECT i.*, (SELECT number FROM seed_pb WHERE id = i.pb_id) pb_no FROM seed_intakes i WHERE i.id = ?", toId(id));
  if (!row) notFound();
  const companies = (await all<{ company: string }>("SELECT DISTINCT company FROM seed_intakes WHERE company <> '' ORDER BY 1")).map((c) => c.company);
  return (
    <>
      <PageHeader
        title={`${row.farmer} · ${row.production_code || "tanpa kode"}`}
        subtitle={
          <>
            Nilai pembayaran {rupiah(row.amount)}
            {row.bad_debt > 0 && ` · kredit macet ${rupiah(row.bad_debt)}`} · <Badge tone={INTAKE_STATUS[row.status]?.tone}>{INTAKE_STATUS[row.status]?.label ?? row.status}</Badge>
          </>
        }
        back={{ href: "/pembayaran-benih", label: "Pembayaran Benih" }}
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      {row.pb_no && (
        <div className="mb-5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Baris ini masuk surat pengajuan{" "}
          <Link href={`/pembayaran-benih/pb/${row.pb_id}`} className="font-semibold underline">
            {row.pb_no}
          </Link>
          . Perubahan di sini ikut mengubah isi surat tersebut.
        </div>
      )}
      <IntakeForm row={row} kind={row.kind} companies={companies} />
      {!row.pb_id && (
        <Card title="Hapus data" className="mt-5">
          <form action={deleteIntake} className="flex items-center justify-between gap-3 p-5 text-sm">
            <input type="hidden" name="id" value={row.id} />
            <span className="text-muted">Hapus baris ini dari buku induk bila salah catat.</span>
            <SubmitButton className="btn-danger" confirm={`Hapus data benih ${row.farmer}?`}>
              Hapus
            </SubmitButton>
          </form>
        </Card>
      )}
    </>
  );
}
