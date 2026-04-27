"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Share2,
  Clock,
  Lock,
  BarChart3,
  Activity,
  MoreHorizontal,
  Maximize2,
  ListFilter,
  Sun,
  ChevronDown,
  CreditCard,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  Cell,
} from "recharts";

function DotMatrix({
  cols = 10,
  rows = 5,
  mode = "ratio",
  ratio = 0.5,
}: {
  cols?: number;
  rows?: number;
  mode?: "ratio" | "trendUp";
  ratio?: number;
}) {
  const total = cols * rows;
  const activeCount = Math.round(total * ratio);

  return (
    <div
      className="grid w-full max-w-[200px] gap-1"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        let active = false;
        if (mode === "trendUp") {
          const h = row / Math.max(rows - 1, 1);
          active = h > 0.25 && col / Math.max(cols - 1, 1) + h * 0.5 > 0.45;
        } else {
          active = i >= total - activeCount;
        }
        return (
          <div
            key={i}
            className={cn(
              "aspect-square max-h-[7px] rounded-full",
              active ? "bg-accent" : "bg-neutral-200"
            )}
          />
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => dashboardApi.getSummary().then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-2/3 rounded-2xl bg-neutral-200" />
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="h-56 rounded-[1.75rem] bg-neutral-200 lg:col-span-4" />
          <div className="h-56 rounded-[1.75rem] bg-neutral-200 lg:col-span-4" />
          <div className="h-56 rounded-[1.75rem] bg-neutral-200 lg:col-span-3" />
          <div className="h-56 rounded-[1.75rem] bg-neutral-200 lg:col-span-1" />
        </div>
        <div className="h-64 rounded-[1.75rem] bg-neutral-200" />
      </div>
    );
  }

  const s = summary;
  const revenueToday = s?.total_revenue_today ?? 0;
  const revenueMonth = s?.total_revenue_month ?? 0;
  const pending = s?.orders_pending ?? 0;

  const lineData = [
    { x: "T2", y: revenueToday * 0.6 },
    { x: "T3", y: revenueToday * 0.72 },
    { x: "T4", y: revenueToday * 0.55 },
    { x: "T5", y: revenueToday * 0.9 },
    { x: "T6", y: revenueToday * 0.85 },
    { x: "T7", y: revenueToday },
    { x: "CN", y: revenueToday * 0.95 },
  ];

  const compareBars = [
    { name: "Trước", v: revenueMonth * 0.72 },
    { name: "Hiện tại", v: revenueMonth },
  ];

  const activityBars = [
    { name: "A", v: 40 },
    { name: "B", v: 72 },
    { name: "C", v: 55 },
    { name: "D", v: 88 },
  ];

  const growthPct =
    revenueMonth > 0
      ? Math.min(99, Math.round((revenueToday / Math.max(revenueMonth, 1)) * 100))
      : 36;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
            Tổng quan tài chính
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            <span className="text-ink-muted">Trang chủ</span>
            <span className="mx-2 text-neutral-300">/</span>
            <span className="font-medium text-ink">Tổng quan</span>
          </p>
        </div>
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-full bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.06] transition hover:bg-neutral-50 sm:self-auto"
          aria-label="Chia sẻ"
        >
          <Share2 className="h-5 w-5 text-ink-muted" />
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-12 lg:grid-rows-[auto_auto]">
        {/* Account card */}
        <div className="rounded-[1.75rem] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05] lg:col-span-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold italic tracking-widest text-ink">VISA</span>
              <button
                type="button"
                className="flex items-center gap-1 rounded-full bg-surface-page px-2.5 py-1 text-[11px] font-medium text-ink-muted ring-1 ring-black/[0.06]"
              >
                Tài khoản
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
            <CreditCard className="h-5 w-5 text-ink-muted" />
          </div>
          <p className="mt-4 text-sm text-ink-muted">Liên kết tài khoản chính</p>
          <p className="mt-1 font-mono text-lg font-semibold tracking-wider text-ink">
            •••• 8829
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              className="rounded-full bg-ink px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
            >
              Nhận tiền
            </button>
            <button
              type="button"
              className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-xs font-semibold text-ink transition hover:bg-neutral-50"
            >
              Chi tiêu
            </button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] pt-4 text-xs">
            <span className="text-ink-muted">
              Phí cố định:{" "}
              <span className="font-semibold text-ink">{formatCurrency(25000)}</span>
            </span>
            <button type="button" className="flex items-center gap-1.5 font-medium text-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Giới hạn thẻ
            </button>
          </div>
        </div>

        {/* Revenue stat */}
        <div className="rounded-[1.75rem] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05] lg:col-span-4">
          <div className="flex items-center justify-between">
            <Clock className="h-5 w-5 text-ink-muted" />
            <button
              type="button"
              className="flex items-center gap-1 rounded-full bg-surface-page px-2.5 py-1 text-[11px] font-medium text-ink-muted ring-1 ring-black/[0.06]"
            >
              Tuần này
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-4 flex justify-center">
            <DotMatrix mode="trendUp" ratio={0.5} />
          </div>
          <p className="mt-4 text-sm font-medium text-ink-muted">Doanh thu gộp</p>
          <p className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
            {formatCurrency(revenueToday)}
          </p>
        </div>

        {/* Orders / throughput */}
        <div className="rounded-[1.75rem] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05] lg:col-span-2">
          <div className="flex items-center justify-between">
            <Clock className="h-5 w-5 text-ink-muted" />
            <button
              type="button"
              className="flex items-center gap-1 rounded-full bg-surface-page px-2.5 py-1 text-[11px] font-medium text-ink-muted ring-1 ring-black/[0.06]"
            >
              Hôm nay
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-4 flex justify-center">
            <DotMatrix mode="ratio" ratio={0.72} />
          </div>
          <p className="mt-4 text-sm font-medium text-ink-muted">Đơn chờ xử lý</p>
          <p className="text-2xl font-bold tracking-tight text-ink md:text-3xl">{pending}</p>
        </div>

        {/* System lock / growth */}
        <div className="flex flex-col justify-between rounded-[1.75rem] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05] lg:col-span-2 lg:min-h-[220px]">
          <div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-page">
              <Lock className="h-4 w-4 text-ink-muted" />
            </div>
            <p className="mt-3 text-xs font-semibold text-ink">Bảo mật</p>
            <p className="mt-2 text-lg font-bold text-ink">{growthPct}%</p>
            <p className="text-[11px] text-ink-muted">Tỷ lệ xử lý</p>
          </div>
          <div className="mt-4 h-14 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityBars} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Bar dataKey="v" radius={[3, 3, 0, 0]}>
                  {activityBars.map((_, i) => (
                    <Cell key={i} fill={i % 2 === 0 ? "#E5E5E5" : "#FF5733"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Time block */}
        <div className="rounded-[1.75rem] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05] lg:col-span-4">
          <Clock className="h-5 w-5 text-ink-muted" />
          <p className="mt-4 text-3xl font-bold text-ink">7 ngày</p>
          <p className="text-sm text-ink-muted">Chu kỳ báo cáo gần nhất</p>
          <div className="mt-5">
            <DotMatrix cols={10} rows={4} mode="ratio" ratio={0.4} />
          </div>
        </div>

        {/* Year comparison */}
        <div className="rounded-[1.75rem] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05] lg:col-span-8">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-ink-muted" />
            <span className="text-sm font-semibold text-ink">So sánh tháng</span>
          </div>
          <div className="mt-6 h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compareBars} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#757575" }} />
                <YAxis hide />
                <Bar dataKey="v" radius={[8, 8, 0, 0]} barSize={28}>
                  <Cell fill="#D4D4D4" />
                  <Cell fill="#FF5733" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Main chart */}
        <div className="rounded-[1.75rem] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05] lg:col-span-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-accent" />
              <div>
                <p className="text-2xl font-bold text-ink">{formatCurrency(revenueMonth)}</p>
                <p className="text-sm text-ink-muted">Doanh thu tháng</p>
              </div>
            </div>
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">
              + 9.3%
            </span>
          </div>
          <div className="mt-6 h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="orbixArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF5733" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#FF5733" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="x" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#757575" }} />
                <YAxis hide />
                <Area type="monotone" dataKey="y" stroke="#FF5733" strokeWidth={2} fill="url(#orbixArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity manager */}
        <div className="rounded-[1.75rem] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05] lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-ink">Quản lý hoạt động</h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-full p-2 text-ink-muted hover:bg-surface-page"
                aria-label="Thêm"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="rounded-full p-2 text-ink-muted hover:bg-surface-page"
                aria-label="Mở rộng"
              >
                <Maximize2 className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="rounded-full p-2 text-ink-muted hover:bg-surface-page"
                aria-label="Lọc"
              >
                <ListFilter className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="relative min-w-0 flex-1">
              <input
                type="search"
                placeholder="Tìm trong hoạt động..."
                className="h-10 w-full rounded-full border-0 bg-surface-page pl-4 pr-4 text-sm outline-none ring-1 ring-black/[0.06] focus:ring-2 focus:ring-accent/25"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-page px-3 py-1.5 text-xs font-medium ring-1 ring-black/[0.06]">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Đội ngũ
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-page px-3 py-1.5 text-xs font-medium ring-1 ring-black/[0.06]">
                AI ×
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-page px-3 py-1.5 text-xs font-medium ring-1 ring-black/[0.06]">
                Hôm nay ×
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs font-medium text-ink-muted">Ước tính</p>
              <p className="text-xl font-bold text-ink">{formatCurrency(revenueToday * 0.02)}</p>
            </div>
            <div className="h-16 w-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityBars} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Bar dataKey="v" radius={[2, 2, 0, 0]}>
                    {activityBars.map((_, i) => (
                      <Cell key={i} fill={i % 2 === 0 ? "#FF5733" : "#E5E5E5"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-8 grid gap-6 border-t border-black/[0.06] pt-6 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-ink">Quy trình</p>
              <ul className="mt-3 space-y-2 text-sm text-ink-muted">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <button type="button" className="flex flex-1 items-center justify-between text-left font-medium text-ink hover:text-accent">
                    Vận đơn &amp; thanh toán
                    <ChevronDown className="h-4 w-4 text-ink-muted" />
                  </button>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>Kế toán &amp; đối soát</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>Chăm sóc khách hàng</span>
                </li>
              </ul>
            </div>
            <div className="rounded-2xl bg-surface-page p-4 ring-1 ring-black/[0.05]">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/[0.06]">
                  <Sun className="h-5 w-5 text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">Xác minh ví</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    Bật xác thực hai lớp cho giao dịch an toàn hơn.
                  </p>
                  <button
                    type="button"
                    className="mt-3 w-full rounded-xl bg-accent py-2.5 text-xs font-bold text-white shadow-md shadow-accent/25 transition hover:bg-accent-muted"
                  >
                    Bật ngay
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Low stock quick strip — keep data useful */}
      {s?.low_stock_alerts?.length ? (
        <div className="rounded-[1.75rem] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05]">
          <p className="text-sm font-semibold text-ink">Cảnh báo tồn kho</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {s.low_stock_alerts.slice(0, 6).map((a: { name?: string; quantity?: number }, i: number) => (
              <span
                key={i}
                className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent"
              >
                {a.name} ({a.quantity})
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
