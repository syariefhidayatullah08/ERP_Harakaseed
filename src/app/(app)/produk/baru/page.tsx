import { Flash, PageHeader } from "@/components/ui";
import { ProductForm } from "../product-form";
import { requireAccess } from "@/lib/session";

export default async function NewProductPage({ searchParams }: PageProps<"/produk/baru">) {
  await requireAccess("produk");
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Produk baru" back={{ href: "/produk", label: "Produk" }} />
      <Flash error={sp.error as string} />
      <ProductForm />
    </>
  );
}
