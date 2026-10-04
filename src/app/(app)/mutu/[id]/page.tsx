import { notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { toId } from "@/lib/form";
import { num, tanggal } from "@/lib/format";
import { COMPLAINT_SEVERITY, COMPLAINT_STATUS } from "@/lib/mutu";
import { Badge, Card, DL, Empty, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { Attachments } from "@/components/attachments";
import { updateComplaint } from "@/actions/mutu";
import { requireAccess } from "@/lib/session";

export default async function ComplaintPage({ params, searchParams }: PageProps<"/mutu/[id]">) {
  await requireAccess("mutu");
  const { id } = await params;
  const sp = await searchParams;
  const k = await get<{
    id: number; code: string; report_date: string; category: string; severity: string; description: string; status: string; root_cause: string; action_taken: string;
    closed_at: string | null; customer: string | null; phone: string | null; city: string | null; product: string | null; lot_id: number | null; lot_no: string | null;
    germination: number | null; purity: number | null; prod_date: string | null; expiry_date: string | null; qc_status: string | null; reporter: string | null;
  }>(
    `SELECT k.*, c.name customer, c.phone, c.city, p.name product, l.lot_no, l.germination, l.purity, l.prod_date, l.expiry_date, l.qc_status, u.name reporter
     FROM complaints k LEFT JOIN customers c ON c.id = k.customer_id LEFT JOIN products p ON p.id = k.product_id
     LEFT JOIN lots l ON l.id = k.lot_id LEFT JOIN users u ON u.id = k.created_by WHERE k.id = ?`,
    toId(id),
  );
  if (!k) notFound();
  // Ketertelusuran: siapa saja yang menerima lot yang sama (untuk keputusan penarikan/recall).
  const recipients = k.lot_id
    ? await all<{ customer: string; city: string; qty: number; shipped_at: string }>(
        `SELECT c.name customer, c.city, SUM(a.qty) qty, MAX(so.shipped_at) shipped_at FROM so_allocations a
         JOIN so_items i ON i.id = a.so_item_id JOIN sales_orders so ON so.id = i.so_id JOIN customers c ON c.id = so.customer_id
         WHERE a.lot_id = ? GROUP BY c.id ORDER BY 4 DESC`,
        k.lot_id,
      )
    : [];
  const related = k.lot_id ? await all<{ id: number; code: string }>("SELECT id, code FROM complaints WHERE lot_id = ? AND id <> ?", k.lot_id, k.id) : [];

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {k.code} <Badge tone={COMPLAINT_STATUS[k.status]?.tone}>{COMPLAINT_STATUS[k.status]?.label}</Badge>
            <Badge tone={COMPLAINT_SEVERITY[k.severity]?.tone}>{COMPLAINT_SEVERITY[k.severity]?.label}</Badge>
          </span>
        }
        subtitle={`${k.category} · dilaporkan ${tanggal(k.report_date)}${k.reporter ? ` · dicatat oleh ${k.reporter}` : ""}`}
        back={{ href: "/mutu", label: "Mutu" }}
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Uraian keluhan">
            <div className="space-y-4 p-5 text-sm">
              <p className="whitespace-pre-line">{k.description}</p>
              <DL
                items={[
                  ["Pelanggan", k.customer ? `${k.customer}${k.city ? ` · ${k.city}` : ""}${k.phone ? ` · ${k.phone}` : ""}` : "—"],
                  ["Varietas", k.product ?? "—"],
                  ["Lot", k.lot_no ? <span key="l" className="font-mono">{k.lot_no}</span> : "—"],
                ]}
              />
            </div>
          </Card>
          <Card title="Investigasi & tindakan">
            <form action={updateComplaint} className="grid gap-4 p-5 sm:grid-cols-2">
              <input type="hidden" name="id" value={k.id} />
              <Field label="Status">
                <select name="status" defaultValue={k.status} className="input">
                  {Object.entries(COMPLAINT_STATUS).map(([v, s]) => (
                    <option key={v} value={v}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tingkat">
                <select name="severity" defaultValue={k.severity} className="input">
                  {Object.entries(COMPLAINT_SEVERITY).map(([v, s]) => (
                    <option key={v} value={v}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Akar masalah" className="sm:col-span-2">
                <textarea name="root_cause" rows={3} defaultValue={k.root_cause} className="input" placeholder="Hasil investigasi: penyebab sebenarnya…" />
              </Field>
              <Field label="Tindakan perbaikan / penggantian" className="sm:col-span-2">
                <textarea name="action_taken" rows={3} defaultValue={k.action_taken} className="input" placeholder="Penggantian benih, uji ulang lot, perbaikan proses…" />
              </Field>
              <div className="flex items-center justify-between gap-3 sm:col-span-2">
                <span className="text-xs text-muted">{k.closed_at ? `Ditutup ${tanggal(k.closed_at)}` : "Akar masalah & tindakan wajib diisi sebelum status Selesai."}</span>
                <SubmitButton>Simpan</SubmitButton>
              </div>
            </form>
          </Card>
          <Attachments refType="complaint" refId={k.id} title="Foto & dokumen keluhan" />
        </div>
        <div className="space-y-5">
          <Card title="Data mutu lot">
            {k.lot_no ? (
              <div className="p-5">
                <DL
                  items={[
                    ["Daya kecambah", `${k.germination}%`],
                    ["Kemurnian", `${k.purity}%`],
                    ["Produksi", tanggal(k.prod_date)],
                    ["Kadaluarsa", tanggal(k.expiry_date)],
                    ["Status Lab/QC", k.qc_status === "karantina" ? <Badge key="q" tone="red">Karantina</Badge> : <Badge key="q" tone="green">Lulus</Badge>],
                  ]}
                />
                <p className="mt-3 text-xs text-muted">Minta Lab/QC melakukan uji ulang bila perlu; lot yang tidak lulus otomatis dikarantina.</p>
              </div>
            ) : (
              <Empty>Lot tidak diketahui.</Empty>
            )}
          </Card>
          <Card title={`Pelanggan lain penerima lot ini (${recipients.length})`}>
            {recipients.length ? (
              <ul className="divide-y divide-line text-sm">
                {recipients.map((r) => (
                  <li key={r.customer} className="px-5 py-2.5">
                    <div className="font-medium">{r.customer}</div>
                    <div className="text-xs text-muted">
                      {r.city} · {num(r.qty)} kemasan · {tanggal(r.shipped_at)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>{k.lot_no ? "Belum ada catatan pengiriman lot ini." : "—"}</Empty>
            )}
            {related.length > 0 && <p className="border-t border-line px-5 py-3 text-xs text-amber-800">Keluhan lain untuk lot ini: {related.map((r) => r.code).join(", ")}</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
