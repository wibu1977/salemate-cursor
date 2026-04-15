"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DashboardPage() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => dashboardApi.getSummary().then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 w-20 rounded bg-gray-200" />
            <div className="mt-3 h-8 w-28 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  const s = summary;
  const revenueChartData = [
    { name: "Hôm nay", value: s?.total_revenue_today || 0 },
    { name: "Tuần", value: s?.total_revenue_week || 0 },
    { name: "Tháng", value: s?.total_revenue_month || 0 },
  ];

  const orderChartData = [
    { name: "Chờ xử lý", value: s?.orders_pending || 0, fill: "#f59e0b" },
    { name: "Xác nhận", value: s?.orders_confirmed || 0, fill: "#10b981" },
    { name: "Cảnh báo", value: s?.orders_flagged || 0, fill: "#ef4444" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Doanh thu hôm nay" value={formatCurrency(s?.total_revenue_today || 0)} color="primary" />
        <KPICard label="Doanh thu tuần" value={formatCurrency(s?.total_revenue_week || 0)} color="primary" />
        <KPICard label="Doanh thu tháng" value={formatCurrency(s?.total_revenue_month || 0)} color="primary" />
        <KPICard label="Đơn chờ xử lý" value={String(s?.orders_pending || 0)} color="warning" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Doanh thu</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" fill="#0c8ce9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Trạng thái đơn hàng</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={orderChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {orderChartData.map((entry, i) => (
                  <rect key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick panels */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700">Đơn xác nhận / cảnh báo</h3>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{s?.orders_confirmed || 0}</p>
              <p className="mt-1 text-xs text-green-700">Đã xác nhận</p>
            </div>
            <div className="rounded-lg bg-red-50 p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{s?.orders_flagged || 0}</p>
              <p className="mt-1 text-xs text-red-700">Cảnh báo</p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700">Cảnh báo tồn kho</h3>
          {s?.low_stock_alerts?.length ? (
            <ul className="mt-3 space-y-2">
              {s.low_stock_alerts.map(
                (a: { name: string; quantity: number; threshold: number }, i: number) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{a.name}</span>
                    <span className="badge-danger">{a.quantity} / {a.threshold}</span>
                  </li>
                )
              )}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-green-600 font-medium">Tất cả sản phẩm đủ hàng</p>
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, color }: { label: string; value: string; color: "primary" | "warning" }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color === "primary" ? "text-primary-600" : "text-amber-600"}`}>
        {value}
      </p>
    </div>
  );
}
