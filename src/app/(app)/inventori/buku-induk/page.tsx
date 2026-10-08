import Link from "next/link";
import type { Metadata } from "next";
import { Card, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { can, requireAccess } from "@/lib/session";
import { deleteIntake } from "@/actions/seed-payment";
import { IntakeLedgerPanel } from "@/components/intake-ledger";

export const metadata: Metadata = { title: "Buku Induk Benih" };

const LEDGER = "/inventori/buku-induk";
const kg = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);

/**
 * Gudang & Lot → Buku Induk Benih: rekap benih panen produksi sendiri (INTERNAL) yang masuk gudang, kolomnya sama
 * dengan sheet INTERNAL. Setiap baris bisa diubah & dihapus dari sini. Benih eksternal dilihat di Pembayaran Benih.
 */
export default async function SeedLedgerPage({ searchParams }: PageProps<"/inventori/buku-induk">) {
  const user = await requireAccess("inventori");
  const sp = await searchParams;
  return (
    <>
      <PageHeader
        title="Buku Induk Benih"
        subtitle="Rekap benih panen produksi sendiri (INTERNAL) yang masuk gudang, seperti sheet INTERNAL buku induk. Klik Ubah untuk membetulkan isian, Hapus bila salah catat."
        actions={
          can(user, "pembayaran_benih") && (
            <Link href="/pembayaran-benih/baru" className="btn-accent">
              + Benih masuk
            </Link>
          )
        }
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <Card className="overflow-hidden">
        <IntakeLedgerPanel
          path={LEDGER}
          sp={sp}
          only="internal"
          detail={LEDGER}
          action={(r) => {
            // Baris yang sudah dibayar lewat surat PB hanya boleh diubah/dihapus Founder (dicek juga di server).
            const locked = r.status === "lunas" && !!r.pb_no && user.role !== "owner";
            return (
              <div className="flex items-center gap-1">
                <Link href={`${LEDGER}/${r.id}`} className="btn-secondary btn-sm">
                  Ubah
                </Link>
                {!locked && (
                  <form action={deleteIntake}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="back" value={LEDGER} />
                    <SubmitButton
                      className="btn-danger btn-sm"
                      confirm={`Hapus data benih ${r.farmer} (${r.production_code || "tanpa kode"}, ${kg(r.net_kg)} kg)${r.pb_no ? ` dan keluarkan dari surat ${r.pb_no}` : ""}? Stok bahan baku dari baris ini ikut dikembalikan.`}
                    >
                      Hapus
                    </SubmitButton>
                  </form>
                )}
              </div>
            );
          }}
        />
      </Card>
    </>
  );
}
