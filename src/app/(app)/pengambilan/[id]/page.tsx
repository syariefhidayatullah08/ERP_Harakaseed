import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { get } from "@/lib/db";
import { tanggal } from "@/lib/format";
import { toId } from "@/lib/form";
import { Badge, Card, DL, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { Attachments } from "@/components/attachments";
import { can, requireAccess } from "@/lib/session";
import { deletePickup } from "@/actions/pickup";
import { pickupStatus, type Pickup } from "@/lib/pickup";
import { PickupForm } from "../pickup-form";
import { pickupChoices } from "../choices";

export const metadata: Metadata = { title: "Pengambilan benih" };

const kg = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n || 0);

export default async function PickupPage({ params, searchParams }: PageProps<"/pengambilan/[id]">) {
  const user = await requireAccess("pengambilan");
  const { id } = await params;
  const sp = await searchParams;
  const row = await get<Pickup>("SELECT * FROM seed_pickups WHERE id = ?", toId(id));
  if (!row) notFound();
  const st = pickupStatus(row);
  const locked = !!row.intake_id && user.role !== "owner";
  const { farmers, codes } = await pickupChoices();

  return (
    <>
      <PageHeader
        title={`${row.farmer} · ${kg(row.kg)} kg`}
        subtitle={
          <>
            {[row.production_code || "tanpa kode", tanggal(row.pickup_date), row.officer_name && `oleh ${row.officer_name}`].filter(Boolean).join(" · ")} · <Badge tone={st.tone}>{st.label}</Badge>
          </>
        }
        back={{ href: "/pengambilan", label: "Pengambilan Benih" }}
        actions={
          <Link href="/pengambilan/baru" className="btn-secondary">
            + Catat lagi
          </Link>
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Attachments refType="pickup" refId={row.id} title="Foto pengambilan" photoFirst />
        </div>
        <div className="space-y-5">
          <Card title="Rincian">
            <div className="p-5">
              <DL
                items={[
                  ["Petani", row.farmer],
                  ["Lokasi", row.location || "—"],
                  ["Kode produksi", row.production_code || "—"],
                  ["No kontrak", row.contract_no || "—"],
                  ["Bobot diambil", `${kg(row.kg)} kg${row.sacks ? ` · ${row.sacks} karung` : ""}`],
                  ["Tanggal ambil", tanggal(row.pickup_date)],
                  ["Petugas", row.officer_name || "—"],
                  ["Dicatat", `${tanggal(row.created_at)} ${row.created_at.slice(11, 16)}`],
                  ["Catatan", row.notes || "—"],
                ]}
              />
            </div>
          </Card>

          <Card title="Buku induk pembayaran benih">
            <div className="space-y-3 p-5 text-sm">
              {row.intake_id ? (
                <p>
                  Sudah dicatat di buku induk.{" "}
                  {can(user, "pembayaran_benih") && (
                    <Link href={`/pembayaran-benih/${row.intake_id}`} className="font-medium text-brand-700 hover:underline">
                      Buka baris buku induk →
                    </Link>
                  )}
                </p>
              ) : can(user, "pembayaran_benih") ? (
                <>
                  <p className="text-muted">Setelah benih sampai dan ditimbang ulang, teruskan ke buku induk. Petani, kode produksi, tanggal, dan bobot terisi otomatis; harga dan hasil uji diisi di sana.</p>
                  <Link href={`/pembayaran-benih/baru?ambil=${row.id}`} className="btn-primary">
                    Catat ke buku induk
                  </Link>
                </>
              ) : (
                <p className="text-muted">Menunggu admin mencatat benih ini ke buku induk pembayaran benih.</p>
              )}
            </div>
          </Card>

          {!locked && (
            <Card title="Ubah data">
              <details>
                <summary className="cursor-pointer px-5 py-3 text-sm text-brand-700">Buka form perubahan</summary>
                <PickupForm row={row} farmers={farmers} codes={codes} />
              </details>
              <form action={deletePickup} className="flex items-center justify-between gap-3 border-t border-line p-5 text-sm">
                <input type="hidden" name="id" value={row.id} />
                <span className="text-muted">Hapus bila salah catat. Fotonya ikut terhapus.</span>
                <SubmitButton className="btn-danger" confirm={`Hapus pengambilan benih ${row.farmer} (${kg(row.kg)} kg) beserta fotonya?`}>
                  Hapus
                </SubmitButton>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
