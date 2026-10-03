import Link from "next/link";
import { notFound } from "next/navigation";
import { get, run } from "@/lib/db";
import { Badge, Card, Flash, PageHeader } from "@/components/ui";
import { EmailCompose } from "@/components/email-compose";
import { tanggal } from "@/lib/format";

const REF_LINK: Record<string, (id: number) => string> = {
  sales_order: (id) => `/penjualan/${id}`,
  invoice: (id) => `/penjualan/${id}`,
  customer: (id) => `/pelanggan/${id}`,
  purchase_order: (id) => `/pembelian/${id}`,
};

export default async function EmailDetail({ params, searchParams }: PageProps<"/email/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const m = await get<{
    id: number; direction: string; from_addr: string; to_addr: string; subject: string; body_html: string; body_text: string;
    status: string; error: string; ref_type: string | null; ref_id: number | null; is_read: number; created_at: string;
  }>("SELECT * FROM emails WHERE id = ?", Number(id));
  if (!m) notFound();
  if (m.direction === "in" && !m.is_read) await run("UPDATE emails SET is_read = 1 WHERE id = ?", m.id);

  const inbound = m.direction === "in";
  const replyTo = inbound ? (m.from_addr.match(/<([^>]+)>/)?.[1] ?? m.from_addr) : m.to_addr;
  const customer = await get<{ id: number; name: string }>("SELECT id, name FROM customers WHERE email != '' AND lower(email) = lower(?)", replyTo);
  const quoted = (m.body_text || "")
    .split("\n")
    .slice(0, 30)
    .map((l) => `> ${l}`)
    .join("\n");

  return (
    <>
      <PageHeader title={m.subject} back={{ href: inbound ? "/email" : "/email?tab=terkirim", label: "Email" }} />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="space-y-1 border-b border-line px-5 py-4 text-sm">
            <div>
              <span className="text-muted">Dari:</span> {m.from_addr}
            </div>
            <div>
              <span className="text-muted">Kepada:</span> {m.to_addr}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted">{tanggal(m.created_at)} {m.created_at.slice(11, 16)}</span>
              {m.status === "gagal" && <Badge tone="red">Gagal: {m.error}</Badge>}
              {m.ref_type && m.ref_id && REF_LINK[m.ref_type] && (
                <Link href={REF_LINK[m.ref_type](m.ref_id)} className="text-brand-700 hover:underline">
                  Lihat dokumen terkait →
                </Link>
              )}
              {customer && (
                <Link href={`/pelanggan/${customer.id}`} className="text-brand-700 hover:underline">
                  Pelanggan: {customer.name}
                </Link>
              )}
            </div>
          </div>
          {m.body_html ? (
            <iframe sandbox="" srcDoc={m.body_html} title="Isi email" className="h-[640px] w-full bg-white" />
          ) : (
            <pre className="whitespace-pre-wrap p-5 font-sans text-sm">{m.body_text}</pre>
          )}
        </Card>
        <Card title={inbound ? "Balas" : "Kirim ulang / tindak lanjut"}>
          <EmailCompose
            to={replyTo}
            subject={m.subject.startsWith("Re:") ? m.subject : `Re: ${m.subject}`}
            message={inbound ? `\n\n${quoted}` : ""}
            back={`/email/${m.id}`}
            refType={customer ? "customer" : undefined}
            refId={customer?.id}
          />
        </Card>
      </div>
    </>
  );
}
