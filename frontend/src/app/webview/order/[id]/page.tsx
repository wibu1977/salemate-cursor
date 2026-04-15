"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import { formatCurrency, formatDate, ORDER_STATUS_MAP } from "@/lib/utils";

interface OrderData {
  id: string;
  memo_code: string;
  status: string;
  total_amount: number;
  currency: string;
  customer_phone: string;
  customer_address: string;
  customer_note: string;
  payment_method: string | null;
  created_at: string;
  confirmed_at: string | null;
  items: { product_name: string; quantity: number; unit_price: number; subtotal: number }[];
}

export default function OrderDetailWebview() {
  const { id } = useParams();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/admin/orders/${id}`)
      .then((r) => setOrder(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-gray-400">Khong tim thay don hang</p>
      </div>
    );
  }

  const statusInfo = ORDER_STATUS_MAP[order.status] || {
    label: order.status,
    className: "badge-info",
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-lg">
        <div className="card">
          <div className="flex items-center justify-between">
            <h1 className="font-mono text-lg font-bold">{order.memo_code}</h1>
            <span className={statusInfo.className}>{statusInfo.label}</span>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Ngay tao</span>
              <span>{formatDate(order.created_at)}</span>
            </div>
            {order.confirmed_at && (
              <div className="flex justify-between">
                <span className="text-gray-500">Xac nhan</span>
                <span>{formatDate(order.confirmed_at)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">SĐT</span>
              <span>{order.customer_phone || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Dia chi</span>
              <span className="text-right">{order.customer_address || "—"}</span>
            </div>
            {order.payment_method && (
              <div className="flex justify-between">
                <span className="text-gray-500">Thanh toan</span>
                <span className="uppercase">{order.payment_method}</span>
              </div>
            )}
          </div>

          <hr className="my-4 border-gray-100" />

          <div className="space-y-2">
            {order.items?.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>
                  {item.product_name} x{item.quantity}
                </span>
                <span className="font-medium">
                  {formatCurrency(item.subtotal, order.currency)}
                </span>
              </div>
            ))}
          </div>

          <hr className="my-4 border-gray-100" />

          <div className="flex justify-between text-base font-bold">
            <span>Tong</span>
            <span className="text-primary-600">
              {formatCurrency(order.total_amount, order.currency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
