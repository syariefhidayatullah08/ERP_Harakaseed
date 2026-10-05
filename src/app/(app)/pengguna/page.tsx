import type { Metadata } from "next";
import { all } from "@/lib/db";
import { tanggal } from "@/lib/format";
import { ALL_MODULES, DIVISIONS, MODULES, OWNER_ONLY, parseModules, resolveModules, type Division } from "@/lib/access";
import { Badge, Card, Field, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { deleteUser, inviteUser, saveUserAccess, sendUserLink, updateUser } from "@/actions/users";
import { getAccessMatrix, requireAccess } from "@/lib/session";
import { ExportMenu } from "@/components/export-menu";

export const metadata: Metadata = { title: "Akun Pengguna" };

const TONE: Record<string, string> = { owner: "purple", marketing: "brand", warehouse: "amber", produksi: "green", lab_qc: "blue", mutu: "orange", admin_sdm: "gray" };

export default async function UsersPage({ searchParams }: PageProps<"/pengguna">) {
  const me = await requireAccess("pengguna");
  const sp = await searchParams;
  const users = await all<{ id: number; name: string; email: string; role: string; active: number; last_login: string | null; created_at: string; locked: boolean; modules: string | null }>(
    // locked_until disimpan sebagai waktu ISO (UTC), jadi bisa dibandingkan sebagai teks.
    `SELECT id, name, email, role, active, last_login, created_at, modules,
            COALESCE(locked_until > to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), false) locked
     FROM users ORDER BY active DESC, role, name`,
  );
  const matrix = await getAccessMatrix();
  const grantable = ALL_MODULES.filter((m) => !OWNER_ONLY.includes(m));
  // Menu ini khusus Founder; penyaring di bawah berjaga bila aturan aksesnya dilonggarkan lagi.
  const assignable = (Object.keys(DIVISIONS) as Division[]).filter((d) => d !== "owner" || me.role === "owner");

  return (
    <>
      <PageHeader title="Akun Pengguna" subtitle="Founder sebagai moderator ERP mengundang email tiap karyawan dan memberi hak akses sesuai divisinya." actions={<ExportMenu type="pengguna" />} />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={`Pengguna (${users.length})`} className="overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama & email</th>
                  <th>Divisi</th>
                  <th>Login terakhir</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const editable = u.role !== "owner" || me.role === "owner";
                  const custom = u.role === "owner" ? null : parseModules(u.modules);
                  const effective = resolveModules(u.role, matrix, custom);
                  return (
                    <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                      <td>
                        <div className="font-medium">
                          {u.name} {u.id === me.id && <span className="text-xs text-muted">(Anda)</span>}
                        </div>
                        <div className="text-xs text-muted">{u.email}</div>
                        {editable && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-brand-700">Kelola akun</summary>
                            <form action={updateUser} className="mt-2 grid gap-2 sm:grid-cols-3">
                              <input type="hidden" name="id" value={u.id} />
                              <input name="name" defaultValue={u.name} className="input py-1 text-xs" aria-label="Nama" />
                              <select name="role" defaultValue={u.role} className="input py-1 text-xs" aria-label="Divisi">
                                {assignable.map((d) => (
                                  <option key={d} value={d}>
                                    {DIVISIONS[d].label}
                                  </option>
                                ))}
                              </select>
                              <label className="flex items-center gap-1.5 text-xs">
                                <input type="checkbox" name="active" defaultChecked={u.active === 1} className="accent-brand-700" /> Aktif
                              </label>
                              <SubmitButton className="btn-secondary btn-sm sm:col-span-3">Simpan</SubmitButton>
                            </form>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {u.active === 1 && (
                                <form action={sendUserLink}>
                                  <input type="hidden" name="id" value={u.id} />
                                  <SubmitButton className="btn-secondary btn-sm" pendingText="Mengirim…">
                                    {u.last_login ? "Kirim email reset sandi" : "Kirim ulang undangan"}
                                  </SubmitButton>
                                </form>
                              )}
                              {u.id !== me.id && (
                                <form action={deleteUser}>
                                  <input type="hidden" name="id" value={u.id} />
                                  <SubmitButton className="btn-danger btn-sm" confirm={`Hapus akun ${u.email}?`}>
                                    Hapus
                                  </SubmitButton>
                                </form>
                              )}
                            </div>
                            {u.role !== "owner" && (
                              <form action={saveUserAccess} className="mt-3 rounded-lg bg-canvas p-3">
                                <input type="hidden" name="id" value={u.id} />
                                <div className="text-xs font-semibold">Hak akses khusus orang ini</div>
                                <p className="mt-0.5 text-xs text-muted">
                                  {custom ? "Sedang memakai akses khusus, tidak mengikuti divisinya." : "Sedang mengikuti divisinya. Ubah centang lalu simpan bila orang ini perlu akses berbeda."}
                                </p>
                                <div className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-2">
                                  {grantable.map((m) => (
                                    <label key={m} className="flex items-center gap-1.5 text-xs">
                                      <input type="checkbox" name={`m:${m}`} defaultChecked={effective.includes(m)} className="accent-brand-700" /> {MODULES[m]}
                                    </label>
                                  ))}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <SubmitButton className="btn-secondary btn-sm">Simpan akses khusus</SubmitButton>
                                  {custom && (
                                    <SubmitButton className="btn-secondary btn-sm" name="reset" value="1">
                                      Ikuti divisi lagi
                                    </SubmitButton>
                                  )}
                                </div>
                              </form>
                            )}
                          </details>
                        )}
                      </td>
                      <td className="align-top">
                        <Badge tone={TONE[u.role]}>{DIVISIONS[u.role as Division]?.label ?? u.role}</Badge>
                        {custom && (
                          <div className="mt-1" title={effective.map((m) => MODULES[m]).join(", ") || "Tanpa modul"}>
                            <Badge tone="orange">Akses khusus</Badge>
                          </div>
                        )}
                        {u.locked && (
                          <div className="mt-1" title="Terkunci sementara karena salah kata sandi berulang. Klik Kelola akun → Simpan untuk membuka.">
                            <Badge tone="red">Terkunci</Badge>
                          </div>
                        )}
                        {!u.active && (
                          <div className="mt-1">
                            <Badge tone="red">Nonaktif</Badge>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap align-top text-xs text-muted">
                        {u.last_login ? `${tanggal(u.last_login)} ${u.last_login.slice(11, 16)}` : <Badge tone="amber">Belum login</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-5">
          <Card title="Undang pengguna baru">
            <form action={inviteUser} className="space-y-3 p-5">
              <Field label="Nama lengkap *">
                <input name="name" required className="input" />
              </Field>
              <Field label="Email pribadi * (untuk login)">
                <input name="email" type="email" required className="input" placeholder="nama@gmail.com" />
              </Field>
              <Field label="Divisi * (menentukan hak akses)">
                <select name="role" required defaultValue="" className="input">
                  <option value="" disabled>
                    Pilih divisi…
                  </option>
                  {assignable.map((d) => (
                    <option key={d} value={d}>
                      {DIVISIONS[d].label}
                    </option>
                  ))}
                </select>
              </Field>
              <SubmitButton className="btn-primary w-full" pendingText="Mengirim undangan…">
                Buat akun & kirim undangan
              </SubmitButton>
              <p className="text-xs text-muted">
                Pengguna menerima email berisi tautan untuk membuat kata sandi sendiri (berlaku 72 jam). Tidak perlu membagikan kata sandi.
              </p>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
