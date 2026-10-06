"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { divisionLabel, hasAny, moduleForPath, type Module } from "@/lib/access";
import { useState, useSyncExternalStore } from "react";
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
  Package,
  Weight,
  Tag,
  Banknote,
  Warehouse,
  ChevronDown,
  Camera,
  Handshake,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: typeof Mail; badge?: boolean; ownerOnly?: boolean; sub?: boolean };
type NavGroup = { key: string; title: string; items: NavItem[] };

const HOME: NavItem = { href: "/", label: "Dashboard", icon: LayoutDashboard };

// Menu dikelompokkan per alur kerja; tiap kelompok bisa dilipat.
const GROUPS: NavGroup[] = [
  {
    key: "penjualan",
    title: "Penjualan",
    items: [
      { href: "/penjualan", label: "Semua Penjualan", icon: ShoppingCart },
      { href: "/penjualan/kemasan", label: "Kemasan", icon: Package, sub: true },
      { href: "/penjualan/bulky", label: "Bulky", icon: Weight, sub: true },
      { href: "/penjualan/label", label: "Label", icon: Tag, sub: true },
      { href: "/penjualan/kerjasama", label: "Kerjasama Produksi", icon: Handshake, sub: true },
      { href: "/pengiriman", label: "Pengiriman", icon: PackageCheck },
      { href: "/pelanggan", label: "Pelanggan", icon: Users },
      { href: "/keluhan", label: "Keluhan Pelanggan", icon: MessageSquareWarning },
    ],
  },
  {
    key: "keuangan",
    title: "Keuangan",
    items: [
      { href: "/keuangan", label: "Piutang & Pembayaran", icon: Wallet },
      { href: "/kas", label: "Buku Kas", icon: Banknote },
      { href: "/pembayaran-benih", label: "Pembayaran Benih", icon: Receipt },
    ],
  },
  {
    key: "gudang",
    title: "Gudang & Produksi",
    items: [
      { href: "/inventori", label: "Gudang & Lot", icon: Boxes },
      { href: "/stok-bahan", label: "Stok Bahan Baku", icon: Warehouse },
      { href: "/produksi", label: "Produksi Benih", icon: Tractor },
      { href: "/pengambilan", label: "Pengambilan Benih", icon: Camera },
      { href: "/mitra", label: "Petani Mitra", icon: Wheat },
      { href: "/produk", label: "Produk / Varietas", icon: Sprout },
      { href: "/pembelian", label: "Pembelian", icon: Truck },
    ],
  },
  {
    key: "mutu",
    title: "Mutu",
    items: [
      { href: "/qc", label: "Lab / QC", icon: FlaskConical },
      { href: "/mutu", label: "Mutu & Audit ISO", icon: ShieldCheck },
      { href: "/temuan", label: "Temuan Audit", icon: ClipboardCheck },
    ],
  },
  {
    key: "organisasi",
    title: "Organisasi",
    items: [
      { href: "/sdm", label: "SDM / Karyawan", icon: IdCard },
      { href: "/pengguna", label: "Akun Pengguna", icon: KeyRound },
    ],
  },
  {
    key: "lainnya",
    title: "Lainnya",
    items: [
      { href: "/email", label: "Email", icon: Mail, badge: true },
      { href: "/laporan", label: "Laporan", icon: BarChart3 },
      { href: "/aktivitas", label: "Log Aktivitas", icon: History, ownerOnly: true },
      { href: "/pengaturan", label: "Pengaturan", icon: Settings },
    ],
  },
];

/** Kelompok & menu sesuai hak akses; kelompok tanpa isi disembunyikan. */
function visibleGroups(modules: Module[], role: string) {
  return GROUPS.map((g) => ({ ...g, items: g.items.filter((item) => (!item.ownerOnly || role === "owner") && hasAny(modules, moduleForPath(item.href))) })).filter((g) => g.items.length);
}

// Kelompok yang dilipat diingat per perangkat (localStorage), dibaca lewat useSyncExternalStore agar aman saat render server.
const STORE_KEY = "haraka-sidebar-tutup";
const STORE_EVENT = "haraka-sidebar";
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(STORE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(STORE_EVENT, cb);
  };
};
const readClosed = () => {
  try {
    return localStorage.getItem(STORE_KEY) ?? "";
  } catch {
    return "";
  }
};
function toggleGroup(key: string) {
  // Baca nilai terkini, bukan hasil render terakhir, supaya dua klik beruntun tidak saling menimpa.
  const closed = readClosed().split(",").filter(Boolean);
  const next = closed.includes(key) ? closed.filter((k) => k !== key) : [...closed, key];
  try {
    localStorage.setItem(STORE_KEY, next.join(","));
  } catch {
    // penyimpanan diblokir: kelompok tetap bisa dilipat sampai halaman dimuat ulang
  }
  window.dispatchEvent(new Event(STORE_EVENT));
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

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
  const closed = useSyncExternalStore(subscribe, readClosed, () => "")
    .split(",")
    .filter(Boolean);
  const groups = visibleGroups(user.modules, user.role);
  // Menu aktif = href terpanjang yang cocok (mis. /pembayaran-benih/pb tidak ikut menyalakan menu lain).
  const matches = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  const best = [HOME, ...groups.flatMap((g) => g.items)].filter((i) => matches(i.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const link = (item: NavItem) => {
    const active = item.href === best;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        aria-current={active ? "page" : undefined}
        className={`group flex items-center gap-2.5 rounded-lg transition-colors ${item.sub ? "py-1.5 pl-2.5 pr-2 text-[13px]" : "px-2.5 py-2 text-sm"} ${
          active ? "bg-linear-to-r from-accent to-gold font-semibold text-accent-ink shadow-md shadow-accent/25" : "text-brand-100 hover:bg-white/10 hover:text-white"
        }`}
      >
        <item.icon size={item.sub ? 14 : 17} strokeWidth={1.8} className={`shrink-0 ${active ? "" : "text-brand-300 group-hover:text-white"}`} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.badge && unread > 0 && <span className="rounded-full bg-gold px-1.5 text-[11px] font-bold text-accent-ink">{unread}</span>}
      </Link>
    );
  };

  /** Sub-menu (jenis penjualan) digambar menjorok dengan garis penghubung ke menu induknya. */
  const renderItems = (items: NavItem[]) => {
    const out: React.ReactNode[] = [];
    for (let i = 0; i < items.length; i++) {
      if (!items[i].sub) {
        out.push(link(items[i]));
        continue;
      }
      const subs: NavItem[] = [];
      while (i < items.length && items[i].sub) subs.push(items[i++]);
      i--;
      out.push(
        <div key={`sub-${subs[0].href}`} className="ml-[1.15rem] space-y-0.5 border-l border-white/15 pl-2">
          {subs.map(link)}
        </div>,
      );
    }
    return out;
  };

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
        <Link href="/" className="relative z-10 flex items-center gap-3 border-b border-white/10 px-5 py-4" onClick={() => setOpen(false)}>
          <span className="inline-flex rounded-lg bg-white p-1.5 shadow-md shadow-black/20">
            <Image src="/logo.png" alt="Logo Haraka" width={28} height={28} />
          </span>
          <div>
            <div className="text-sm font-bold tracking-wider text-white">HARAKA SEED</div>
            <div className="text-[11px] text-brand-200">Enterprise Resource Planning</div>
          </div>
        </Link>
        <nav className="sidebar-scroll relative z-10 flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {link(HOME)}
          {groups.map((g) => {
            // Kelompok yang memuat halaman aktif selalu terbuka supaya posisi pengguna tetap terlihat.
            const hasActive = g.items.some((i) => i.href === best);
            const isOpen = hasActive || !closed.includes(g.key);
            return (
              <section key={g.key} className="pt-2">
                <button
                  type="button"
                  onClick={() => toggleGroup(g.key)}
                  aria-expanded={isOpen}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.14em] text-orange-300/90 hover:bg-white/5 hover:text-orange-200"
                >
                  <span className="flex-1">{g.title}</span>
                  {!isOpen && <span className="rounded-full bg-white/10 px-1.5 text-[10px] font-medium tracking-normal text-brand-100">{g.items.length}</span>}
                  <ChevronDown size={13} className={`transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                </button>
                {isOpen && <div className="mt-0.5 space-y-0.5">{renderItems(g.items)}</div>}
              </section>
            );
          })}
        </nav>
        <div className="relative z-10 border-t border-white/10 bg-navy/40 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-accent to-gold text-xs font-bold text-accent-ink">{initials(user.name)}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{user.name}</div>
              <div className="truncate text-[11px] text-orange-300/90">{divisionLabel(user.role)}</div>
            </div>
            <form action={logout}>
              <button className="flex cursor-pointer items-center justify-center rounded-lg p-2 text-brand-200 hover:bg-white/10 hover:text-white" aria-label="Keluar" title="Keluar">
                <LogOut size={16} />
              </button>
            </form>
          </div>
          <div className="mt-1.5 truncate pl-12 text-[11px] text-brand-200/80">{user.email}</div>
        </div>
      </aside>
    </>
  );
}
