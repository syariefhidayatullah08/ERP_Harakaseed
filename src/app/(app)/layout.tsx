import { Sidebar } from "@/components/sidebar";
import { requireUser } from "@/lib/session";
import { get } from "@/lib/db";
import { logout } from "@/actions/auth";

// Semua halaman ERP membaca database per request; jangan pernah dirender saat build.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const unread = (await get<{ n: number }>("SELECT COUNT(*) AS n FROM emails WHERE direction = 'in' AND is_read = 0"))?.n ?? 0;
  return (
    <div className="min-h-screen">
      <Sidebar user={user} unread={unread} logout={logout} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
