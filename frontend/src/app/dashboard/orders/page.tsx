"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import { formatCurrency, formatDate, ORDER_STATUS_MAP } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

const FILTER_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "pending", label: "Chờ xử lý" },
  { value: "confirmed", label: "Xác nhận" },
  { value: "flagged", label: "Cảnh báo" },
  { value: "rejected", label: "Từ chối" },
  { value: "completed", label: "Hoàn thành" },
];

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface OrderData {
  id: string;
  memo_code: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  total_amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  bill_image_url: string | null;
  flag_reason: string | null;
  items: OrderItem[];
  fraud_logs: { check_type: string; result: string; details: string }[];
  created_at: string;
  confirmed_at: string | null;
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", filter],
    queryFn: () =>
      dashboardApi.getOrders(filter ? { status: filter } : undefined).then((r) => r.data),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["order-detail", selectedId],
    queryFn: () => dashboardApi.getOrderDetail(selectedId!).then((r) => r.data),
    enabled: !!selectedId,
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      dashboardApi.orderAction(id, action),
    onSuccess: (_, { action }) => {
      toast(action === "approve" ? "Đơn hàng đã duyệt" : "Đơn hàng đã từ chối", "success");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-detail", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: () => toast("Thao tác thất bại", "error"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Đơn hàng</h1>
        <div className="flex gap-2">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === opt.value
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              {["Mã đơn", "Khách hàng", "Số tiền", "Trạng thái", "Ngày tạo"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-5 py-4"><div className="h-4 w-full animate-pulse rounded bg-gray-100" /></td></tr>
                ))
              : orders?.length
                ? orders.map((o: OrderData) => {
                    const st = ORDER_STATUS_MAP[o.status] || { label: o.status, className: "badge-info" };
                    return (
                      <tr
                        key={o.id}
                        onClick={() => setSelectedId(o.id)}
                        className="cursor-pointer transition-colors hover:bg-gray-50/50"
                      >
                        <td className="px-5 py-3 font-mono text-sm font-medium text-primary-600">{o.memo_code}</td>
                        <td className="px-5 py-3 text-sm text-gray-700">{o.customer_name || "—"}</td>
                        <td className="px-5 py-3 text-sm font-medium">{formatCurrency(o.total_amount)}</td>
                        <td className="px-5 py-3"><span className={st.className}>{st.label}</span></td>
                        <td className="px-5 py-3 text-sm text-gray-500">{formatDate(o.created_at)}</td>
                      </tr>
                    );
                  })
                : (
                    <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">Chưa có đơn hàng nào</td></tr>
                  )}
          </tbody>
        </table>
      </div>

      {/* Order Detail Modal */}
      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} title="Chi tiết đơn hàng" size="lg">
        {detailLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : detail ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-lg font-bold">{detail.memo_code}</span>
              <span className={(ORDER_STATUS_MAP[detail.status] || { className: "badge-info" }).className}>
                {(ORDER_STATUS_MAP[detail.status] || { label: detail.status }).label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">SĐT:</span> {detail.customer_phone || "—"}</div>
              <div><span className="text-gray-500">Phương thức:</span> {detail.payment_method?.toUpperCase() || "—"}</div>
              <div className="col-span-2"><span className="text-gray-500">Địa chỉ:</span> {detail.customer_address || "—"}</div>
            </div>

            {detail.items?.length > 0 && (
              <div className="rounded-lg border border-gray-100 p-3">
                {detail.items.map((item: OrderItem, i: number) => (
                  <div key={i} className="flex justify-between py-1 text-sm">
                    <span>{item.product_name} x{item.quantity}</span>
                    <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 font-bold">
                  <span>Tổng</span>
                  <span className="text-primary-600">{formatCurrency(detail.total_amount)}</span>
                </div>
              </div>
            )}

            {detail.bill_image_url && (
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500">Ảnh hóa đơn</p>
                <img src={detail.bill_image_url} alt="Bill" className="max-h-48 rounded-lg border" />
              </div>
            )}

            {detail.flag_reason && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                Lý do cảnh báo: {detail.flag_reason}
              </div>
            )}

            {detail.fraud_logs?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">Kiểm tra gian lận</p>
                {detail.fraud_logs.map((log: { check_type: string; result: string; details: string }, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-xs">
                    <span className="font-medium">{log.check_type}</span>
                    <span className={log.result === "pass" ? "text-green-600" : log.result === "reject" ? "text-red-600" : "text-amber-600"}>
                      {log.result.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {detail.status === "flagged" && (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => actionMutation.mutate({ id: detail.id, action: "approve" })}
                  disabled={actionMutation.isPending}
                  className="btn-primary flex-1 py-2.5"
                >
                  Duyệt đơn
                </button>
                <button
                  onClick={() => actionMutation.mutate({ id: detail.id, action: "reject" })}
                  disabled={actionMutation.isPending}
                  className="flex-1 rounded-lg border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Từ chối
                </button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
