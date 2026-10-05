import type { Metadata } from "next";
import { SalesList } from "../sales-list";

export const metadata: Metadata = { title: "Penjualan Label" };

export default function SalesLabelPage({ searchParams }: PageProps<"/penjualan/label">) {
  return <SalesList channel="label" searchParams={searchParams} />;
}
