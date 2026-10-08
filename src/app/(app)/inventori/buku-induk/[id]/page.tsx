import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { rupiah } from "@/lib/format";
import { toId } from "@/lib/form";
import { Badge, Card, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { can, requireAccess } from "@/lib/session";
import { deleteIntake } from "@/actions/seed-payment";
import { INTAKE_STATUS, type Intake } from "@/lib/seed-payment";
import { IntakeForm } from "../../../pembayaran-benih/intake-form";

export const metadata: Metadata = { title: "Ubah isian buku induk" };

const LEDGER = "/inventori/buku-induk";

/** Ubah / hapus satu baris Buku Induk Benih dari menu Gudang & Lot (form sama dengan Pembayaran Benih). */
export default async function LedgerRowPage({ params, searchParams }: PageProps<"/inventori/buku-induk/[id]">) {
  const user = await requireAccess("inventori");
  const { id } = await params;
  const sp = await searchParams;
  const row = await get<Intake & { pb_no: string | null; pb_status: string | null }>(
    "SELECT i.*, (SELECT number FROM seed_pb WHERE id = i.pb_id) pb_no, (SELECT status FROM seed_pb WHERE id = i.pb_id) pb_status FROM seed_intakes i WHERE i.id = ?",
    toId(id),
  );
  if (!row) notFound();
  const companies = (await all<{ company: string }>("SELECT DISTINCT company FROM seed_intakes WHERE company <> '' ORDER BY 1")).map((c) => c.company);
  const locked = row.pb_status === "dibayar" && user.role !== "owner";
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
        back={{ href: LEDGER, label: "Buku Induk Benih" }}
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      {row.pb_no && (
        <div className="mb-5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Baris ini masuk surat pengajuan{" "}
          {can(user, "pembayaran_benih") ? (
            <Link href={`/pembayaran-benih/pb/${row.pb_id}`} className="font-semibold underline">
              {row.pb_no}
            </Link>
          ) : (
            <b>{row.pb_no}</b>
          )}
          {locked ? " yang sudah dibayar; hanya Founder yang bisa mengubah atau menghapusnya." : ". Perubahan di sini ikut mengubah isi surat tersebut."}
        </div>
      )}
      {!locked && (
        <>
          <IntakeForm row={row} kind={row.kind} companies={companies} back={LEDGER} />
          <Card title="Hapus data" className="mt-5">
            <form action={deleteIntake} className="flex items-center justify-between gap-3 p-5 text-sm">
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="back" value={LEDGER} />
              <span className="text-muted">
                Hapus baris ini dari buku induk bila salah catat. Stok bahan baku dari baris ini ikut dikembalikan.
                {row.pb_no && ` Baris juga dikeluarkan dari surat ${row.pb_no}.`}
              </span>
              <SubmitButton className="btn-danger" confirm={`Hapus data benih ${row.farmer}${row.pb_no ? ` dan keluarkan dari surat ${row.pb_no}` : ""}?`}>
                Hapus
              </SubmitButton>
            </form>
          </Card>
        </>
      )}
    </>
  );
}
