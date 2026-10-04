import { addFinding, saveAudit, saveQualityDoc } from "@/actions/mutu";
import { SubmitButton } from "@/components/buttons";
import { Field } from "@/components/ui";
import { DIVISIONS } from "@/lib/access";
import { today } from "@/lib/format";
import { AUDIT_STATUS, AUDIT_TYPES, DOC_STATUS, DOC_TYPES, FINDING_CATEGORY, FINDING_SOURCE, ISO_9001_CLAUSES, STANDARDS } from "@/lib/mutu";

export type Audit = {
  id: number; code: string; audit_type: string; standard: string; title: string; scope: string; auditor: string;
  start_date: string; end_date: string | null; status: string; summary: string;
};
export type QualityDoc = {
  id: number; code: string; title: string; doc_type: string; division: string; revision: string;
  effective_date: string | null; review_date: string | null; status: string; note: string;
};

const divisionOptions = Object.entries(DIVISIONS).map(([k, d]) => (
  <option key={k} value={k}>
    {d.label}
  </option>
));

export function AuditForm({ a }: { a?: Audit }) {
  return (
    <form action={saveAudit} className="grid gap-3 p-5 sm:grid-cols-2">
      {a && <input type="hidden" name="id" value={a.id} />}
      <Field label="Judul audit *" className="sm:col-span-2">
        <input name="title" required defaultValue={a?.title} className="input" placeholder="Audit internal semester II 2026" />
      </Field>
      <Field label="Jenis *">
        <select name="audit_type" required defaultValue={a?.audit_type ?? AUDIT_TYPES[0]} className="input">
          {AUDIT_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Standar">
        <select name="standard" defaultValue={a?.standard ?? STANDARDS[0]} className="input">
          {STANDARDS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Tanggal mulai *">
        <input name="start_date" type="date" required defaultValue={a?.start_date ?? today()} className="input" />
      </Field>
      <Field label="Tanggal selesai">
        <input name="end_date" type="date" defaultValue={a?.end_date ?? ""} className="input" />
      </Field>
      <Field label="Auditor / lembaga">
        <input name="auditor" defaultValue={a?.auditor} className="input" placeholder="Tim audit internal / nama lembaga sertifikasi" />
      </Field>
      <Field label="Status">
        <select name="status" defaultValue={a?.status ?? "rencana"} className="input">
          {Object.entries(AUDIT_STATUS).map(([k, s]) => (
            <option key={k} value={k}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Lingkup (divisi / proses / klausul)" className="sm:col-span-2">
        <textarea name="scope" rows={2} defaultValue={a?.scope} className="input" placeholder="Produksi, Lab/QC, Warehouse · klausul 7.5, 8.5, 8.6" />
      </Field>
      {a && (
        <Field label="Ringkasan hasil / kesimpulan" className="sm:col-span-2">
          <textarea name="summary" rows={3} defaultValue={a.summary} className="input" />
        </Field>
      )}
      <div className="sm:col-span-2">
        <SubmitButton className="btn-primary w-full">{a ? "Simpan audit" : "Jadwalkan audit"}</SubmitButton>
      </div>
    </form>
  );
}

export function FindingForm({ auditId }: { auditId?: number }) {
  return (
    <form action={addFinding} className="grid gap-3 p-5 sm:grid-cols-2">
      {auditId && <input type="hidden" name="audit_id" value={auditId} />}
      {!auditId && (
        <Field label="Sumber temuan">
          <select name="source" defaultValue="proses" className="input">
            {Object.entries(FINDING_SOURCE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Divisi penanggung jawab *">
        <select name="division" required defaultValue="" className="input">
          <option value="" disabled>
            Pilih…
          </option>
          {divisionOptions}
        </select>
      </Field>
      <Field label="Kategori *">
        <select name="category" required defaultValue="minor" className="input">
          {Object.entries(FINDING_CATEGORY).map(([k, c]) => (
            <option key={k} value={k}>
              {c.label} (tenggat {c.days} hari)
            </option>
          ))}
        </select>
      </Field>
      <Field label="Klausul ISO">
        <input name="clause" list="iso-clauses" className="input" placeholder="mis. 8.5.2 Identifikasi & mampu telusur" />
        <datalist id="iso-clauses">
          {ISO_9001_CLAUSES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label="Tenggat tindakan (kosong = otomatis)">
        <input name="due_date" type="date" className="input" />
      </Field>
      <Field label="Uraian temuan & bukti objektif *" className="sm:col-span-2">
        <textarea name="description" rows={3} required className="input" placeholder="Apa yang ditemukan, di mana, bukti yang dilihat, persyaratan yang tidak dipenuhi…" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton className="btn-primary w-full">Catat temuan & beri tahu divisi</SubmitButton>
      </div>
    </form>
  );
}

export function DocForm({ d }: { d?: QualityDoc }) {
  return (
    <form action={saveQualityDoc} className="grid gap-3 p-5 sm:grid-cols-2">
      {d && <input type="hidden" name="id" value={d.id} />}
      <Field label="Kode dokumen *">
        <input name="code" required defaultValue={d?.code} className="input font-mono uppercase" placeholder="SOP-QC-001" />
      </Field>
      <Field label="Revisi">
        <input name="revision" defaultValue={d?.revision ?? "00"} className="input" />
      </Field>
      <Field label="Judul *" className="sm:col-span-2">
        <input name="title" required defaultValue={d?.title} className="input" placeholder="Prosedur uji daya kecambah" />
      </Field>
      <Field label="Jenis *">
        <select name="doc_type" required defaultValue={d?.doc_type ?? "Prosedur (SOP)"} className="input">
          {DOC_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Divisi pemilik *">
        <select name="division" required defaultValue={d?.division ?? ""} className="input">
          <option value="" disabled>
            Pilih…
          </option>
          {divisionOptions}
        </select>
      </Field>
      <Field label="Tanggal berlaku">
        <input name="effective_date" type="date" defaultValue={d?.effective_date ?? ""} className="input" />
      </Field>
      <Field label="Jadwal tinjau ulang">
        <input name="review_date" type="date" defaultValue={d?.review_date ?? ""} className="input" />
      </Field>
      <Field label="Status">
        <select name="status" defaultValue={d?.status ?? "berlaku"} className="input">
          {Object.entries(DOC_STATUS).map(([k, s]) => (
            <option key={k} value={k}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Catatan perubahan">
        <input name="note" defaultValue={d?.note} className="input" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton className="btn-primary w-full">{d ? "Simpan dokumen" : "Daftarkan dokumen"}</SubmitButton>
      </div>
    </form>
  );
}
