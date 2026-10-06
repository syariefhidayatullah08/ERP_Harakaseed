import type { Metadata } from "next";
import { SalesList } from "../sales-list";

export const metadata: Metadata = { title: "Penjualan Kerjasama Produksi" };

export default function SalesKerjasamaPage({ searchParams }: PageProps<"/penjualan/kerjasama">) {
  return <SalesList channel="kerjasama" searchParams={searchParams} />;
}
