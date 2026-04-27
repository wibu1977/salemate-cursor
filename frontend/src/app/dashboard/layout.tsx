"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { clearAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Target,
  Facebook,
  Settings,
  LogOut,
  Search,
  Plus,
  ArrowUpRight,
  CalendarDays,
  User,
} from "lucide-react";

const navHome = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "Đơn hàng", icon: ShoppingBag },
  { href: "/dashboard/inventory", label: "Tồn kho", icon: Package },
];

const navGrowth = [
  { href: "/dashboard/campaigns", label: "Chiến dịch", icon: Target },
  { href: "/connect-facebook", label: "Kết nối Facebook", icon: Facebook },
  { href: "/dashboard/settings", label: "Cài đặt", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await clearAuth();
    router.push("/login");
  };

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const today = new Date();
  const dayNum = today.getDate();
  const weekday = today.toLocaleDateString("vi-VN", { weekday: "short" });
  const monthYear = today.toLocaleDateString("vi-VN", { month: "long" });

  return (
    <div className="flex min-h-screen bg-surface-page">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-[280px] flex-col border-r border-black/[0.06] bg-white px-5 pb-8 pt-8 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/25">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 18c2-4 4-6 6-6s4 2 6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M4 12c2.5-3 5-4.5 8-4.5s5.5 1.5 8 4.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.85"
              />
              <path
                d="M8 6c2-1.5 4.5-2.5 8-2.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.7"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold tracking-tight text-ink">Salemate</p>
            <p className="text-xs font-medium text-ink-muted">Bảng điều khiển</p>
          </div>
        </Link>

        <div className="mt-8 rounded-2xl bg-surface-page px-4 py-3.5">
          <p className="text-sm font-semibold text-ink">Xin chào, cần hỗ trợ? 👋</p>
          <p className="mt-0.5 text-xs text-ink-muted">Hỏi mình bất cứ điều gì nhé!</p>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-6 overflow-y-auto pr-1">
          <div>
            <p className="mb-2 flex items-center gap-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Trang chủ
            </p>
            <ul className="space-y-1">
              {navHome.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-colors",
                        active
                          ? "bg-ink text-white shadow-md"
                          : "text-ink-muted hover:bg-black/[0.04] hover:text-ink"
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0 opacity-90" />
                      <span className="flex-1">{item.label}</span>
                      {active && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Vận hành
              <Plus className="h-3.5 w-3.5 text-accent" strokeWidth={2.5} />
            </p>
            <ul className="space-y-1">
              {navGrowth.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-colors",
                        active
                          ? "bg-ink text-white shadow-md"
                          : "text-ink-muted hover:bg-black/[0.04] hover:text-ink"
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0 opacity-90" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        <div className="mt-4 space-y-3">
          <div className="overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 p-4 text-white shadow-lg ring-1 ring-white/10">
            <div className="mb-3 flex h-16 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <ArrowUpRight className="h-7 w-7 text-accent opacity-90" />
            </div>
            <p className="text-sm font-semibold">Mở khóa đầy đủ tính năng</p>
            <div className="mt-2 inline-flex rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              40+ chỉ số
            </div>
            <button
              type="button"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-2.5 text-xs font-bold text-ink transition hover:bg-neutral-100"
            >
              Dùng thử 15 ngày
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium text-ink-muted transition hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut className="h-5 w-5" />
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="ml-[280px] flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-[4.5rem] items-center gap-6 border-b border-black/[0.06] bg-white/90 px-8 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-[1600px] items-center gap-6">
            <div className="relative min-w-0 flex-1 max-w-xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                placeholder="Bắt đầu tìm kiếm..."
                className="h-12 w-full rounded-full border-0 bg-surface-page pl-11 pr-4 text-sm text-ink placeholder:text-ink-muted/80 outline-none ring-1 ring-black/[0.06] transition focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-surface-page px-4 py-2 ring-1 ring-black/[0.06]">
              <div className="text-right leading-tight">
                <p className="text-2xl font-bold tabular-nums text-ink">{dayNum}</p>
                <p className="text-[11px] font-medium capitalize text-ink-muted">
                  {weekday}, {monthYear}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/[0.06]">
                <CalendarDays className="h-5 w-5 text-ink-muted" />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 border-l border-black/[0.08] pl-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft ring-2 ring-white shadow-md">
                <User className="h-5 w-5 text-accent" />
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-semibold text-ink">Quản trị viên</p>
                <p className="truncate text-xs text-ink-muted">Salemate</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-8 py-8">
          <div className="mx-auto max-w-[1600px] animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
