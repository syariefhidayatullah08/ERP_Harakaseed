import type { Metadata } from "next";
import { all } from "@/lib/db";
import { Flash, PageHeader } from "@/components/ui";
import { requireAccess } from "@/lib/session";
import { IntakeForm } from "../intake-form";

export const metadata: Metadata = { title: "Benih masuk baru" };

export default async function NewIntakePage({ searchParams }: PageProps<"/pembayaran-benih/baru">) {
  await requireAccess("pembayaran_benih");
  const sp = await searchParams;
  const companies = (await all<{ company: string }>("SELECT DISTINCT company FROM seed_intakes WHERE company <> '' ORDER BY 1")).map((c) => c.company);
  return (
    <>
      <PageHeader title="Catat benih masuk" subtitle="Satu baris buku induk pembayaran benih" back={{ href: "/pembayaran-benih", label: "Pembayaran Benih" }} />
      <Flash error={sp.error as string} />
      <IntakeForm kind={sp.kind === "eksternal" ? "eksternal" : "internal"} companies={companies} />
    </>
  );
}
