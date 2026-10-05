import type { Metadata } from "next";
import { Card, Flash, PageHeader } from "@/components/ui";
import { requireAccess } from "@/lib/session";
import { PickupForm } from "../pickup-form";
import { pickupChoices } from "../choices";

export const metadata: Metadata = { title: "Catat pengambilan benih" };

export default async function NewPickupPage({ searchParams }: PageProps<"/pengambilan/baru">) {
  await requireAccess("pengambilan");
  const sp = await searchParams;
  const { farmers, codes } = await pickupChoices();
  return (
    <>
      <PageHeader title="Catat pengambilan benih" subtitle="Isi data dulu, foto ditambahkan setelah disimpan" back={{ href: "/pengambilan", label: "Pengambilan Benih" }} />
      <Flash error={sp.error as string} />
      <Card className="max-w-xl">
        <PickupForm farmers={farmers} codes={codes} />
      </Card>
    </>
  );
}
