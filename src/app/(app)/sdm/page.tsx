import Link from "next/link";
import type { Metadata } from "next";
import { all } from "@/lib/db";
import { tanggal } from "@/lib/format";
import { DIVISIONS, type Division } from "@/lib/access";
import { Badge, Card, Empty, Flash, PageHeader, StatCard } from "@/components/ui";
import { can, requireAccess } from "@/lib/session";
import { EmployeeForm, type Employee } from "./employee-form";

export const metadata: Metadata = { title: "SDM / Karyawan" };

export default async function SdmPage({ searchParams }: PageProps<"/sdm">) {
  const user = await requireAccess("sdm");
  const sp = await searchParams;
  const division = String(sp.divisi ?? "");
  const employees = await all<Employee & { has_account: number }>(
    `SELECT e.*, EXISTS (SELECT 1 FROM users u WHERE e.email <> '' AND lower(u.email) = lower(e.email) AND u.active = 1)::int has_account
     FROM employees e WHERE (? = '' OR e.division = ?) ORDER BY e.status, e.division, e.name`,
    division,
    division,
  );
  const perDivision = await all<{ division: string; n: number }>("SELECT division, COUNT(*) n FROM employees WHERE status = 'aktif' GROUP BY division");
  const active = perDivision.reduce((s, d) => s + d.n, 0);

  return (
    <>
      <PageHeader title="SDM / Karyawan" subtitle="Data karyawan per divisi" />
      <Flash msg={sp.msg as string} error={sp.error as string} />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Karyawan aktif" value={active} />
        <StatCard label="Divisi terisi" value={`${perDivision.length} / ${Object.keys(DIVISIONS).length}`} />
        <StatCard label="Punya akun ERP" value={employees.filter((e) => e.has_account && e.status === "aktif").length} href={can(user, "pengguna") ? "/pengguna" : undefined} />
        <StatCard label="Nonaktif / keluar" value={employees.filter((e) => e.status !== "aktif").length} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap gap-1">
            <Link href="/sdm" className={`rounded-full px-3 py-1 text-xs ${!division ? "bg-brand-700 text-white" : "bg-white text-muted ring-1 ring-line"}`}>
              Semua
            </Link>
            {(Object.keys(DIVISIONS) as Division[]).map((d) => (
              <Link
                key={d}
                href={`/sdm?divisi=${d}`}
                className={`rounded-full px-3 py-1 text-xs ${division === d ? "bg-brand-700 text-white" : "bg-white text-muted ring-1 ring-line"}`}
              >
                {DIVISIONS[d].label} ({perDivision.find((p) => p.division === d)?.n ?? 0})
              </Link>
            ))}
          </div>
          <Card className="overflow-hidden">
            {employees.length ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Divisi & jabatan</th>
                      <th>Kontak</th>
                      <th>Masuk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((e) => (
                      <tr key={e.id} className={e.status === "aktif" ? "" : "opacity-60"}>
                        <td>
                          <Link href={`/sdm/${e.id}`} className="font-medium text-brand-700 hover:underline">
                            {e.name}
                          </Link>
                          <div className="mt-0.5 flex gap-1">
                            {e.status !== "aktif" && <Badge tone="red">Nonaktif</Badge>}
                            {e.has_account ? <Badge tone="green">Akun ERP</Badge> : null}
                          </div>
                        </td>
                        <td>
                          {DIVISIONS[e.division as Division]?.label ?? e.division}
                          <div className="text-xs text-muted">{e.position || "—"}</div>
                        </td>
                        <td className="text-xs">
                          <div>{e.email || "—"}</div>
                          <div className="text-muted">{e.phone}</div>
                        </td>
                        <td className="whitespace-nowrap text-xs text-muted">{tanggal(e.join_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Belum ada data karyawan.</Empty>
            )}
          </Card>
        </div>
        <Card title="Tambah karyawan">
          <EmployeeForm />
        </Card>
      </div>
    </>
  );
}
