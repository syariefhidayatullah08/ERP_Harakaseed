"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { all, get, insert, nextNumber, run } from "@/lib/db";
import { can, requireAccess, requireUser } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { addDays, today } from "@/lib/format";
import { DIVISIONS, isDivision } from "@/lib/access";
import { customEmail, sendEmail } from "@/lib/email";
import { AUDIT_STATUS, AUDIT_TYPES, DOC_STATUS, DOC_TYPES, FINDING_CATEGORY, FINDING_SOURCE } from "@/lib/mutu";

async function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

/** Email ke semua akun aktif di satu divisi (mis. temuan baru untuk divisi tsb). */
async function notifyDivision(division: string, subject: string, message: string) {
  const users = await all<{ email: string }>("SELECT email FROM users WHERE role = ? AND active = 1", division);
  for (const u of users) await sendEmail({ to: u.email, ...(await customEmail(subject, message)), refType: "mutu" });
  return users.length;
}

/* ----------------------------------- Audit ----------------------------------- */

export async function saveAudit(fd: FormData) {
  const user = await requireAccess("mutu");
  const id = numf(fd, "id");
  const title = str(fd, "title");
  const type = str(fd, "audit_type");
  const start = str(fd, "start_date");
  const back = id ? `/mutu/audit/${id}` : "/mutu";
  if (!title || !AUDIT_TYPES.includes(type) || !start) redirect(withMsg(back, "Isi judul, jenis audit, dan tanggal mulai.", "error"));
  const status = str(fd, "status") in AUDIT_STATUS ? str(fd, "status") : "rencana";
  const v = [type, str(fd, "standard") || "ISO 9001:2015", title, str(fd, "scope"), str(fd, "auditor"), start, str(fd, "end_date") || null, status, str(fd, "summary")] as const;
  if (id) {
    await run("UPDATE audits SET audit_type=?, standard=?, title=?, scope=?, auditor=?, start_date=?, end_date=?, status=?, summary=? WHERE id=?", ...v, id);
  } else {
    const newId = await insert(
      "INSERT INTO audits (code, audit_type, standard, title, scope, auditor, start_date, end_date, status, summary, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      await nextNumber("AUD", "audits", "code"),
      ...v,
      user.id,
    );
    revalidatePath("/mutu");
    redirect(withMsg(`/mutu/audit/${newId}`, "Audit dijadwalkan."));
  }
  revalidatePath("/mutu");
  redirect(withMsg(back, "Audit diperbarui."));
}

/* ------------------------------- Temuan / CAPA ------------------------------- */

export async function addFinding(fd: FormData) {
  const user = await requireAccess("mutu");
  const auditId = numf(fd, "audit_id") || null;
  const division = str(fd, "division");
  const category = str(fd, "category");
  const description = str(fd, "description");
  const back = auditId ? `/mutu/audit/${auditId}` : "/mutu?tab=temuan";
  if (!isDivision(division) || !(category in FINDING_CATEGORY) || !description) redirect(withMsg(back, "Isi divisi, kategori, dan uraian temuan.", "error"));
  const due = str(fd, "due_date") || addDays(today(), FINDING_CATEGORY[category].days);
  const code = await nextNumber("NCR", "findings", "code");
  const id = await insert(
    `INSERT INTO findings (code, audit_id, source, clause, division, category, description, due_date, created_by)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    code,
    auditId,
    str(fd, "source") in FINDING_SOURCE ? str(fd, "source") : "audit",
    str(fd, "clause"),
    division,
    category,
    description,
    due,
    user.id,
  );
  const n = await notifyDivision(
    division,
    `[Mutu] Temuan ${code} untuk divisi ${DIVISIONS[division].label}`,
    `Ada temuan ${FINDING_CATEGORY[category].label.toLowerCase()} yang perlu ditindaklanjuti divisi Anda.\n\n${description}\n\nKlausul: ${str(fd, "clause") || "-"}\nTenggat tindakan: ${due}\n\nIsi analisis akar masalah dan tindakan perbaikan di:\n${await baseUrl()}/temuan/${id}`,
  );
  revalidatePath("/mutu");
  revalidatePath("/temuan");
  redirect(withMsg(back, `Temuan ${code} dicatat${n ? `, ${n} anggota divisi diberi tahu lewat email` : ""}.`));
}

/** Divisi penanggung jawab (atau Mutu) mengisi akar masalah & tindakan perbaikan. */
export async function respondFinding(fd: FormData) {
  const user = await requireUser();
  const id = numf(fd, "id");
  const f = await get<{ code: string; division: string; status: string }>("SELECT code, division, status FROM findings WHERE id = ?", id);
  if (!f) redirect(withMsg("/temuan", "Temuan tidak ditemukan.", "error"));
  if (f.division !== user.role && !can(user, "mutu")) redirect(withMsg("/temuan", "Temuan ini bukan untuk divisi Anda.", "error"));
  const back = `/temuan/${id}`;
  if (f.status === "ditutup") redirect(withMsg(back, "Temuan sudah ditutup.", "error"));
  const rootCause = str(fd, "root_cause");
  const action = str(fd, "corrective_action");
  if (!rootCause || !action) redirect(withMsg(back, "Akar masalah dan tindakan perbaikan wajib diisi.", "error"));
  await run(
    "UPDATE findings SET root_cause = ?, correction = ?, corrective_action = ?, status = 'ditanggapi', responded_at = ? WHERE id = ?",
    rootCause,
    str(fd, "correction"),
    action,
    today(),
    id,
  );
  const n = await notifyDivision("mutu", `[Mutu] ${f.code} sudah ditanggapi`, `Divisi ${DIVISIONS[f.division as keyof typeof DIVISIONS]?.label ?? f.division} sudah mengisi tindakan perbaikan untuk ${f.code}. Mohon diverifikasi:\n${await baseUrl()}/temuan/${id}`);
  revalidatePath("/mutu");
  revalidatePath("/temuan");
  redirect(withMsg(back, `Tanggapan terkirim ke divisi Mutu untuk diverifikasi${n ? " (diberi tahu lewat email)" : ""}.`));
}

/** Mutu memverifikasi efektivitas tindakan: tutup, atau kembalikan ke divisi. */
export async function verifyFinding(fd: FormData) {
  await requireAccess("mutu");
  const id = numf(fd, "id");
  const decision = str(fd, "decision");
  const note = str(fd, "verification");
  const back = `/temuan/${id}`;
  const f = await get<{ code: string; division: string }>("SELECT code, division FROM findings WHERE id = ?", id);
  if (!f) redirect(withMsg("/mutu?tab=temuan", "Temuan tidak ditemukan.", "error"));
  if (!note) redirect(withMsg(back, "Tulis hasil verifikasi.", "error"));
  if (decision === "tutup") {
    await run("UPDATE findings SET status = 'ditutup', verification = ?, closed_at = ? WHERE id = ?", note, today(), id);
  } else {
    await run("UPDATE findings SET status = 'terbuka', verification = ? WHERE id = ?", note, id);
    await notifyDivision(f.division, `[Mutu] ${f.code} dikembalikan`, `Tindakan perbaikan untuk ${f.code} belum dapat diterima:\n\n${note}\n\nPerbarui tanggapan di:\n${await baseUrl()}/temuan/${id}`);
  }
  revalidatePath("/mutu");
  revalidatePath("/temuan");
  redirect(withMsg(back, decision === "tutup" ? `${f.code} ditutup.` : `${f.code} dikembalikan ke divisi.`));
}

/* ---------------------------- Pengendalian dokumen ---------------------------- */

export async function saveQualityDoc(fd: FormData) {
  await requireAccess("mutu");
  const id = numf(fd, "id");
  const code = str(fd, "code").toUpperCase();
  const title = str(fd, "title");
  const type = str(fd, "doc_type");
  const division = str(fd, "division");
  const back = id ? `/mutu/dokumen/${id}` : "/mutu?tab=dokumen";
  if (!code || !title || !DOC_TYPES.includes(type) || !isDivision(division)) redirect(withMsg(back, "Isi kode, judul, jenis, dan divisi pemilik dokumen.", "error"));
  const dup = await get<{ id: number }>("SELECT id FROM quality_docs WHERE code = ? AND id <> ?", code, id);
  if (dup) redirect(withMsg(back, `Kode dokumen ${code} sudah dipakai.`, "error"));
  const status = str(fd, "status") in DOC_STATUS ? str(fd, "status") : "berlaku";
  const v = [code, title, type, division, str(fd, "revision") || "00", str(fd, "effective_date") || null, str(fd, "review_date") || null, status, str(fd, "note")] as const;
  if (id) {
    await run("UPDATE quality_docs SET code=?, title=?, doc_type=?, division=?, revision=?, effective_date=?, review_date=?, status=?, note=? WHERE id=?", ...v, id);
    revalidatePath("/mutu");
    redirect(withMsg(back, "Dokumen diperbarui."));
  }
  const newId = await insert("INSERT INTO quality_docs (code, title, doc_type, division, revision, effective_date, review_date, status, note) VALUES (?,?,?,?,?,?,?,?,?)", ...v);
  revalidatePath("/mutu");
  redirect(withMsg(`/mutu/dokumen/${newId}`, `Dokumen ${code} didaftarkan. Unggah file dokumennya di bawah.`));
}
