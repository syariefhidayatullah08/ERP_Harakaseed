import { Flash, PageHeader } from "@/components/ui";
import { ProductForm } from "../product-form";

export default async function NewProductPage({ searchParams }: PageProps<"/produk/baru">) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Produk baru" back={{ href: "/produk", label: "Produk" }} />
      <Flash error={sp.error as string} />
      <ProductForm />
    </>
  );
}
