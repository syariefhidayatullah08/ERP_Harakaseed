import Link from "next/link";
import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requireAccess } from "@/lib/session";
import { IntakeLedgerPanel } from "@/components/intake-ledger";

export const metadata: Metadata = { title: "Buku Induk Benih" };

/** Gudang & Lot → Buku Induk Benih: rekap benih panen yang masuk gudang, kolomnya sama dengan sheet INTERNAL / EKSTERNAL. */
export default async function SeedLedgerPage({ searchParams }: PageProps<"/inventori/buku-induk">) {
  await requireAccess("inventori");
  const sp = await searchParams;
  return (
    <>
      <PageHeader
        title="Buku Induk Benih"
        subtitle="Rekap benih panen yang masuk gudang dari petani (internal & eksternal), seperti buku induk spreadsheet"
        actions={
          <Link href="/pembayaran-benih/baru" className="btn-accent">
            + Benih masuk
          </Link>
        }
      />
      <Card className="overflow-hidden">
        <IntakeLedgerPanel path="/inventori/buku-induk" sp={sp} />
      </Card>
    </>
  );
}
