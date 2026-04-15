"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { clearAuth } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Tổng quan" },
  { href: "/dashboard/orders", label: "Đơn hàng" },
  { href: "/dashboard/inventory", label: "Tồn kho" },
  { href: "/dashboard/campaigns", label: "Chiến dịch" },
  { href: "/dashboard/settings", label: "Cài đặt" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-10 w-60 border-r border-gray-100 bg-white">
        <div className="flex h-16 items-center px-6">
          <Link href="/dashboard" className="text-xl font-bold text-gray-900">
            Sale<span className="text-primary-600">mate</span>
          </Link>
        </div>
        <nav className="mt-2 space-y-1 px-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === item.href
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-100 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      <main className="ml-60 flex-1">
        <header className="sticky top-0 z-10 flex h-14 items-center border-b border-gray-100 bg-white/80 px-8 backdrop-blur-sm">
          <h2 className="text-base font-semibold text-gray-900">
            {navItems.find((i) => pathname.startsWith(i.href) && i.href !== "/dashboard")?.label ||
              navItems[0].label}
          </h2>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
