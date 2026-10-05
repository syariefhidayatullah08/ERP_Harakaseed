import type { Metadata } from "next";
import { SalesList } from "./sales-list";

export const metadata: Metadata = { title: "Penjualan" };

export default function SalesPage({ searchParams }: PageProps<"/penjualan">) {
  return <SalesList searchParams={searchParams} />;
}
