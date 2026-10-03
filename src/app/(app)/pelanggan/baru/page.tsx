import { Card, Flash, PageHeader } from "@/components/ui";
import { CustomerForm } from "../customer-form";
import { requireAccess } from "@/lib/session";

export default async function NewCustomerPage({ searchParams }: PageProps<"/pelanggan/baru">) {
  await requireAccess("pelanggan");
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Pelanggan baru" back={{ href: "/pelanggan", label: "Pelanggan" }} />
      <Flash error={sp.error as string} />
      <Card className="max-w-3xl">
        <CustomerForm />
      </Card>
    </>
  );
}
