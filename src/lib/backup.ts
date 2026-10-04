import "server-only";
import { gzipSync } from "node:zlib";
import { del, list, put } from "@vercel/blob";
import { all, exec, getSetting, setSetting, tx } from "./db";
import { nowWib, today } from "./format";
import { customEmail, emailConfigured, sendEmail } from "./email";
import { logActivity, SYSTEM_ACTOR } from "./activity";

/** Jumlah backup harian yang disimpan; yang lebih lama dihapus otomatis. */
export const BACKUP_KEEP = 30;
// Lampiran email di atas ukuran ini tidak dikirim (batas Gmail 25 MB); file tetap tersimpan di ERP.
const MAX_EMAIL_BYTES = 15 * 1024 * 1024;

// Schema uji (DB_SCHEMA) menyimpan backup di folder terpisah agar tidak tercampur dengan produksi.
const PREFIX = process.env.DB_SCHEMA ? `backup-${process.env.DB_SCHEMA}/` : "backup/";
const NAME_RE = /^haraka-erp-\d{4}-\d{2}-\d{2}\.json\.gz$/;

export const backupPath = (name: string) => (NAME_RE.test(name) ? PREFIX + name : null);

/** Urutkan tabel agar induk (yang dirujuk foreign key) selalu sebelum anaknya; dipakai saat memulihkan. */
function parentFirst(tables: string[], fks: { child: string; parent: string }[]) {
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (t: string) => {
    if (seen.has(t)) return;
    seen.add(t);
    for (const fk of fks) if (fk.child === t && fk.parent !== t) visit(fk.parent);
    order.push(t);
  };
  for (const t of [...tables].sort()) visit(t);
  return order;
}

/** Salin seluruh isi database (semua tabel) ke satu file JSON terkompresi, dari satu snapshot yang konsisten. */
export async function createBackup() {
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  let order: string[] = [];
  await tx(async () => {
    await exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const names = (
      await all<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'")
    ).map((t) => t.table_name);
    const fks = await all<{ child: string; parent: string }>(
      `SELECT ch.relname child, pa.relname parent FROM pg_constraint c
       JOIN pg_class ch ON ch.oid = c.conrelid JOIN pg_class pa ON pa.oid = c.confrelid JOIN pg_namespace n ON n.oid = ch.relnamespace
       WHERE c.contype = 'f' AND n.nspname = current_schema()`,
    );
    order = parentFirst(names, fks);
    for (const t of order) {
      tables[t] = await all(`SELECT * FROM "${t}"`);
      counts[t] = tables[t].length;
    }
  });
  const createdAt = nowWib();
  const json = JSON.stringify({ meta: { app: "haraka-erp", format: 1, created_at: createdAt, order, counts }, tables });
  const buffer = gzipSync(Buffer.from(json, "utf8"));
  const rows = Object.values(counts).reduce((s, n) => s + n, 0);
  return { name: `haraka-erp-${today()}.json.gz`, buffer, createdAt, tables: order.length, rows };
}

export type BackupFile = { name: string; size: number; uploadedAt: Date };

export async function listBackups(): Promise<BackupFile[]> {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  return blobs
    .map((b) => ({ name: b.pathname.slice(PREFIX.length), size: b.size, uploadedAt: b.uploadedAt }))
    .filter((b) => NAME_RE.test(b.name))
    .sort((a, b) => b.name.localeCompare(a.name));
}

const mb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/**
 * Buat backup, simpan ke penyimpanan file privat, hapus yang lebih lama dari BACKUP_KEEP hari,
 * dan (untuk backup terjadwal) kirim salinannya ke email semua Owner aktif.
 */
export async function runBackup(opts: { scheduled: boolean }): Promise<{ ok: boolean; message: string }> {
  try {
    const b = await createBackup();
    await put(PREFIX + b.name, b.buffer, { access: "private", contentType: "application/gzip", addRandomSuffix: false, allowOverwrite: true });
    const old = (await listBackups()).slice(BACKUP_KEEP);
    if (old.length) await del(old.map((o) => PREFIX + o.name));

    let emailNote = "";
    const mode = await getSetting("backup_email", "harian");
    // Mingguan = setiap Senin (WIB).
    const due = mode === "harian" || (mode === "mingguan" && new Date(today() + "T00:00:00Z").getUTCDay() === 1);
    if (opts.scheduled && due && emailConfigured()) {
      const owners = await all<{ email: string }>("SELECT email FROM users WHERE role = 'owner' AND active = 1");
      const attach = b.buffer.length <= MAX_EMAIL_BYTES;
      const mail = await customEmail(
        `Backup data ERP ${b.createdAt.slice(0, 10)}`,
        `Backup otomatis database ERP sudah dibuat pada ${b.createdAt} WIB.\n\nIsi: ${b.tables} tabel, ${b.rows} baris (${mb(b.buffer.length)}).\n\n${
          attach
            ? "File backup terlampir. Simpan email ini; file hanya diperlukan bila data ERP perlu dipulihkan."
            : "File terlalu besar untuk dilampirkan. Unduh dari ERP: Pengaturan → Backup data."
        }\n\nFile ini berisi seluruh data perusahaan. Jangan diteruskan ke orang lain.`,
      );
      let sent = 0;
      for (const o of owners) {
        const res = await sendEmail({
          to: o.email,
          ...mail,
          refType: "backup",
          attachments: attach ? [{ filename: b.name, content: b.buffer, contentType: "application/gzip" }] : undefined,
        });
        if (res.ok) sent++;
      }
      emailNote = ` Email ke ${sent}/${owners.length} Owner.`;
    }

    const message = `Backup ${b.name} tersimpan: ${b.tables} tabel, ${b.rows} baris, ${mb(b.buffer.length)}.${emailNote}`;
    await setSetting("backup_last", `${b.createdAt}|ok|${message}`);
    await logActivity("backup", opts.scheduled ? "Backup otomatis harian" : "Backup manual", message, opts.scheduled ? SYSTEM_ACTOR : undefined);
    return { ok: true, message };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("Backup gagal:", e);
    await setSetting("backup_last", `${nowWib()}|gagal|${error}`).catch(() => {});
    await logActivity("backup", "Backup GAGAL", error, opts.scheduled ? SYSTEM_ACTOR : undefined);
    return { ok: false, message: `Backup gagal: ${error}` };
  }
}
