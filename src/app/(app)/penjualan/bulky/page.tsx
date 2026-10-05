import type { Metadata } from "next";
import { SalesList } from "../sales-list";

export const metadata: Metadata = { title: "Penjualan Bulky" };

export default function SalesBulkyPage({ searchParams }: PageProps<"/penjualan/bulky">) {
  return <SalesList channel="bulky" searchParams={searchParams} />;
}
