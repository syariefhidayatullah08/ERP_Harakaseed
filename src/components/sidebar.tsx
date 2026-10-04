"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { divisionLabel, hasAny, moduleForPath, type Module } from "@/lib/access";
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
  Wallet,
  PackageCheck,
  FlaskConical,
  ShieldCheck,
  IdCard,
  KeyRound,
  MessageSquareWarning,
  ClipboardCheck,
  Receipt,
  History,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: typeof Mail; badge?: boolean; ownerOnly?: boolean } | { section: string };

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { section: "Penjualan & Keuangan" },
  { href: "/penjualan", label: "Penjualan", icon: ShoppingCart },
  { href: "/pelanggan", label: "Pelanggan", icon: Users },
  { href: "/keluhan", label: "Keluhan Pelanggan", icon: MessageSquareWarning },
  { href: "/keuangan", label: "Keuangan", icon: Wallet },
  { href: "/pembayaran-benih", label: "Pembayaran Benih", icon: Receipt },
  { section: "Operasional" },
  { href: "/pengiriman", label: "Pengiriman", icon: PackageCheck },
  { href: "/inventori", label: "Gudang & Lot", icon: Boxes },
  { href: "/produksi", label: "Produksi Benih", icon: Tractor },
  { href: "/mitra", label: "Petani Mitra", icon: Wheat },
  { href: "/qc", label: "Lab / QC", icon: FlaskConical },
  { href: "/mutu", label: "Mutu & Audit ISO", icon: ShieldCheck },
  { href: "/pembelian", label: "Pembelian", icon: Truck },
  { href: "/produk", label: "Produk / Varietas", icon: Sprout },
  { section: "Organisasi" },
  { href: "/sdm", label: "SDM / Karyawan", icon: IdCard },
  { href: "/pengguna", label: "Akun Pengguna", icon: KeyRound },
  { section: "Lainnya" },
  { href: "/temuan", label: "Temuan Audit", icon: ClipboardCheck },
  { href: "/email", label: "Email", icon: Mail, badge: true },
  { href: "/laporan", label: "Laporan", icon: BarChart3 },
  { href: "/aktivitas", label: "Log Aktivitas", icon: History, ownerOnly: true },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings },
];

/** Menu sesuai hak akses; judul bagian yang tidak punya isi ikut disembunyikan. */
function visibleNav(modules: Module[], role: string) {
  const items = NAV.filter((item) => "section" in item || ((!item.ownerOnly || role === "owner") && hasAny(modules, moduleForPath(item.href))));
  return items.filter((item, i) => !("section" in item) || (items[i + 1] !== undefined && !("section" in items[i + 1])));
}

export function Sidebar({
  user,
  unread,
  logout,
}: {
  user: { name: string; email: string; role: string; modules: Module[] };
  unread: number;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Menu aktif = href terpanjang yang cocok (mis. /pembayaran-benih/pb tidak ikut menyalakan menu lain).
  const matches = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  const best = NAV.filter((i): i is Extract<NavItem, { href: string }> => "href" in i && matches(i.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const isActive = (href: string) => href === best;

  return (
    <>
      <div className="no-print sticky top-0 z-30 flex items-center justify-between bg-linear-to-r from-navy via-brand-900 to-brand-800 px-4 py-3 shadow-md lg:hidden">
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
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-hidden bg-linear-to-b from-navy via-brand-900 to-[#0b5276] transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Cahaya dekoratif: biru di atas, oranye di bawah */}
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-brand-500/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-20 size-80 rounded-full bg-accent/30 blur-3xl" />
        <Link href="/" className="relative z-10 flex items-center gap-3 px-5 py-5" onClick={() => setOpen(false)}>
          <span className="inline-flex rounded-lg bg-white p-1.5">
            <Image src="/logo.png" alt="Logo Haraka" width={28} height={28} />
          </span>
          <div>
            <div className="text-sm font-bold tracking-wider text-white">HARAKA SEED</div>
            <div className="text-[11px] text-brand-200">Enterprise Resource Planning</div>
          </div>
        </Link>
        <nav className="relative z-10 flex-1 overflow-y-auto px-3 pb-4">
          {visibleNav(user.modules, user.role).map((item, i) =>
            "section" in item ? (
              <div key={i} className="px-3 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-widest text-orange-300/90">
                {item.section}
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive(item.href)
                    ? "bg-linear-to-r from-accent to-gold font-semibold text-accent-ink shadow-md shadow-accent/30"
                    : "text-brand-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <item.icon size={17} strokeWidth={1.8} />
                <span className="flex-1">{item.label}</span>
                {item.badge && unread > 0 && (
                  <span className="rounded-full bg-gold px-1.5 text-[11px] font-bold text-accent-ink">{unread}</span>
                )}
              </Link>
            ),
          )}
        </nav>
        <div className="relative z-10 border-t border-white/10 bg-navy/30 px-5 py-4 backdrop-blur-sm">
          <div className="truncate text-sm font-medium text-white">{user.name}</div>
          <div className="truncate text-xs text-brand-200">{user.email}</div>
          <div className="mt-1 text-[11px] text-orange-300/90">{divisionLabel(user.role)}</div>
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
