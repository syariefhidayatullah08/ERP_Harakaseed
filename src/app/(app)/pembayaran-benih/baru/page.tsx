import type { Metadata } from "next";
import { all, get } from "@/lib/db";
import { toId } from "@/lib/form";
import type { Pickup } from "@/lib/pickup";
import { Flash, PageHeader } from "@/components/ui";
import { requireAccess } from "@/lib/session";
import { IntakeForm } from "../intake-form";

export const metadata: Metadata = { title: "Benih masuk baru" };

export default async function NewIntakePage({ searchParams }: PageProps<"/pembayaran-benih/baru">) {
  await requireAccess("pembayaran_benih");
  const sp = await searchParams;
  const companies = (await all<{ company: string }>("SELECT DISTINCT company FROM seed_intakes WHERE company <> '' ORDER BY 1")).map((c) => c.company);
  // ?ambil=<id>: diteruskan dari Pengambilan Benih; bobot bersih sengaja dikosongkan supaya diisi hasil timbang ulang.
  const pickup = typeof sp.ambil === "string" ? await get<Pickup>("SELECT * FROM seed_pickups WHERE id = ? AND intake_id IS NULL", toId(sp.ambil)) : undefined;
  const prefill = pickup && {
    farmer: pickup.farmer,
    location: pickup.location,
    received_date: pickup.pickup_date,
    production_code: pickup.production_code,
    contract_no: pickup.contract_no,
    gross_kg: pickup.kg,
    notes: [`Diambil ${pickup.officer_name || "petugas lapangan"}`, pickup.sacks ? `${pickup.sacks} karung` : "", pickup.notes].filter(Boolean).join(" · "),
  };
  return (
    <>
      <PageHeader title="Catat benih masuk" subtitle="Satu baris buku induk pembayaran benih" back={{ href: "/pembayaran-benih", label: "Pembayaran Benih" }} />
      <Flash error={sp.error as string} />
      {pickup && (
        <div className="mb-5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Data dari pengambilan lapangan: <b>{pickup.farmer}</b>, {pickup.kg} kg{pickup.officer_name && `, diambil ${pickup.officer_name}`}. Isi bobot bersih hasil timbang ulang dan harga, lalu simpan.
        </div>
      )}
      <IntakeForm kind={sp.kind === "eksternal" ? "eksternal" : "internal"} companies={companies} prefill={prefill} pickupId={pickup?.id} />
    </>
  );
}
