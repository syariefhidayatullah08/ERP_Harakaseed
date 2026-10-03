"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { canAccess, moduleForPath, ROLES } from "@/lib/access";
import { useState } from "react";
import {
  LayoutDashboard,
  Sprout,
  Boxes,
  Tractor,
  Users,
  ShoppingCart,
  Truck,
  Mail,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Wheat,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: typeof Mail; badge?: boolean } | { section: string };

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { section: "Operasional" },
  { href: "/penjualan", label: "Penjualan", icon: ShoppingCart },
  { href: "/pelanggan", label: "Pelanggan", icon: Users },
  { href: "/inventori", label: "Inventori & Lot", icon: Boxes },
  { href: "/produksi", label: "Produksi Benih", icon: Tractor },
  { href: "/mitra", label: "Petani Mitra", icon: Wheat },
  { href: "/pembelian", label: "Pembelian", icon: Truck },
  { href: "/produk", label: "Produk / Varietas", icon: Sprout },
  { section: "Komunikasi & Analisis" },
  { href: "/email", label: "Email", icon: Mail, badge: true },
  { href: "/laporan", label: "Laporan", icon: BarChart3 },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings },
];

export function Sidebar({
  user,
  unread,
  logout,
}: {
  user: { name: string; email: string; role: string };
  unread: number;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <div className="no-print sticky top-0 z-30 flex items-center justify-between bg-brand-900 px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2 text-sm font-bold tracking-wider text-white">
          <span className="inline-flex rounded-md bg-white p-1">
            <Image src="/logo.png" alt="Logo Haraka" width={22} height={22} />
          </span>{" "}
          HARAKA SEED
        </div>
        <button onClick={() => setOpen(!open)} className="text-white" aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-brand-900 transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link href="/" className="flex items-center gap-3 px-5 py-5" onClick={() => setOpen(false)}>
          <span className="inline-flex rounded-lg bg-white p-1.5">
            <Image src="/logo.png" alt="Logo Haraka" width={28} height={28} />
          </span>
          <div>
            <div className="text-sm font-bold tracking-wider text-white">HARAKA SEED</div>
            <div className="text-[11px] text-brand-200">Enterprise Resource Planning</div>
          </div>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {NAV.filter((item) => "section" in item || canAccess(user.role, moduleForPath(item.href))).map((item, i) =>
            "section" in item ? (
              <div key={i} className="px-3 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-widest text-brand-300">
                {item.section}
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive(item.href)
                    ? "bg-white/15 font-semibold text-white"
                    : "text-brand-100 hover:bg-white/5 hover:text-white"
                }`}
              >
                <item.icon size={17} strokeWidth={1.8} />
                <span className="flex-1">{item.label}</span>
                {item.badge && unread > 0 && (
                  <span className="rounded-full bg-harvest px-1.5 text-[11px] font-bold text-brand-900">{unread}</span>
                )}
              </Link>
            ),
          )}
        </nav>
        <div className="border-t border-white/10 px-5 py-4">
          <div className="truncate text-sm font-medium text-white">{user.name}</div>
          <div className="truncate text-xs text-brand-200">{user.email}</div>
          <div className="mt-1 text-[11px] text-brand-300">{ROLES[user.role]?.label ?? user.role}</div>
          <form action={logout}>
            <button className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-brand-200 hover:text-white">
              <LogOut size={14} /> Keluar
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
