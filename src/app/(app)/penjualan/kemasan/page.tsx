import type { Metadata } from "next";
import { SalesList } from "../sales-list";

export const metadata: Metadata = { title: "Penjualan Kemasan" };

export default function SalesKemasanPage({ searchParams }: PageProps<"/penjualan/kemasan">) {
  return <SalesList channel="kemasan" searchParams={searchParams} />;
}
