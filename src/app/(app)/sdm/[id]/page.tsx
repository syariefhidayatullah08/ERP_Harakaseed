import Link from "next/link";
import { notFound } from "next/navigation";
import { get } from "@/lib/db";
import { toId } from "@/lib/form";
import { tanggal } from "@/lib/format";
import { divisionLabel } from "@/lib/access";
import { Badge, Card, Flash, PageHeader } from "@/components/ui";
import { Attachments } from "@/components/attachments";
import { can, requireAccess } from "@/lib/session";
import { EmployeeForm, type Employee } from "../employee-form";

export default async function EmployeePage({ params, searchParams }: PageProps<"/sdm/[id]">) {
  const user = await requireAccess("sdm");
  const { id } = await params;
  const sp = await searchParams;
  const e = await get<Employee>("SELECT * FROM employees WHERE id = ?", toId(id));
  if (!e) notFound();
  const account = e.email
    ? await get<{ role: string; active: number; last_login: string | null }>("SELECT role, active, last_login FROM users WHERE lower(email) = lower(?)", e.email)
    : undefined;

  return (
    <>
      <PageHeader title={e.name} subtitle={`${divisionLabel(e.division)}${e.position ? ` · ${e.position}` : ""}`} back={{ href: "/sdm", label: "SDM" }} />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Data karyawan" className="lg:col-span-2">
          <EmployeeForm e={e} />
        </Card>
        <div className="space-y-5">
          <Card title="Akun ERP">
            <div className="space-y-2 p-5 text-sm">
              {account ? (
                <>
                  <div>
                    <Badge tone={account.active ? "green" : "red"}>{account.active ? "Aktif" : "Nonaktif"}</Badge> {divisionLabel(account.role)}
                  </div>
                  <div className="text-xs text-muted">Login terakhir: {account.last_login ? tanggal(account.last_login) : "belum pernah"}</div>
                  {account.role !== e.division && <p className="text-xs text-amber-800">Divisi akun berbeda dengan data karyawan.</p>}
                </>
              ) : (
                <p className="text-muted">{e.email ? "Belum punya akun ERP." : "Isi email pribadi untuk membuatkan akun ERP."}</p>
              )}
              {can(user, "pengguna") && (
                <Link href="/pengguna" className="btn-secondary btn-sm">
                  Kelola akun pengguna
                </Link>
              )}
            </div>
          </Card>
          <Attachments refType="employee" refId={e.id} title="Dokumen karyawan" />
        </div>
      </div>
    </>
  );
}
