import Link from "next/link";
import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requireAccess } from "@/lib/session";
import { IntakeLedgerPanel } from "@/components/intake-ledger";

export const metadata: Metadata = { title: "Buku Induk Benih" };

/**
 * Gudang & Lot → Buku Induk Benih: rekap benih panen produksi sendiri (INTERNAL) yang masuk gudang, kolomnya sama
 * dengan sheet INTERNAL. Benih eksternal (kontrak perusahaan lain) dilihat di Pembayaran Benih.
 */
export default async function SeedLedgerPage({ searchParams }: PageProps<"/inventori/buku-induk">) {
  await requireAccess("inventori");
  const sp = await searchParams;
  return (
    <>
      <PageHeader
        title="Buku Induk Benih"
        subtitle="Rekap benih panen produksi sendiri (INTERNAL) yang masuk gudang, seperti sheet INTERNAL buku induk. Benih eksternal ada di Pembayaran Benih."
        actions={
          <Link href="/pembayaran-benih/baru" className="btn-accent">
            + Benih masuk
          </Link>
        }
      />
      <Card className="overflow-hidden">
        <IntakeLedgerPanel path="/inventori/buku-induk" sp={sp} only="internal" />
      </Card>
    </>
  );
}
