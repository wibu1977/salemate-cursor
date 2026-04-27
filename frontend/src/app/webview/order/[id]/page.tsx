"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import { formatCurrency, formatDate, ORDER_STATUS_MAP } from "@/lib/utils";
import { 
  Package, 
  MapPin, 
  Phone, 
  CreditCard, 
  Calendar, 
  ChevronLeft,
  ShoppingBag,
  CheckCircle2,
  Clock,
  AlertCircle,
  QrCode,
  ArrowRight,
  ExternalLink
} from "lucide-react";
import Link from "next/link";

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
      <div className="flex min-h-screen items-center justify-center bg-surface-page">
        <div className="relative">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-100 border-t-accent" />
          <ShoppingBag className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-accent" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-page p-6 text-center">
        <div className="space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500">
            <AlertCircle className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-black text-slate-900 uppercase">Không tìm thấy</h1>
            <p className="text-sm font-medium text-slate-500">Đơn hàng có thể đã bị xóa hoặc link không chính xác.</p>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = ORDER_STATUS_MAP[order.status] || {
    label: order.status,
    className: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="min-h-screen bg-surface-page pb-20 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 right-0 h-[300px] w-[300px] bg-accent-soft/50 blur-[80px] rounded-full translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 h-[300px] w-[300px] bg-accent-soft blur-[80px] rounded-full -translate-x-1/3 translate-y-1/3" />

      <div className="relative z-10 max-w-xl mx-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-surface-page/80 backdrop-blur-xl border-b border-slate-50 p-4 flex items-center justify-between mb-6">
           <div className="flex items-center gap-3">
             <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-accent text-white shadow-lg shadow-accent/15">
                <Package className="h-5 w-5" />
             </div>
             <div>
               <h1 className="text-sm font-black text-slate-900 uppercase tracking-tighter">Chi tiết đơn hàng</h1>
               <p className="text-[10px] font-bold text-slate-400 tracking-widest">{order.memo_code}</p>
             </div>
           </div>
           <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${statusInfo.className}`}>
             {statusInfo.label}
           </div>
        </div>

        <div className="px-4 space-y-6">
          {/* Status Timeline - Simplified */}
          <div className="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/40 border border-slate-50 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <QrCode className="h-20 w-20" />
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 uppercase">Trạng thái: {statusInfo.label}</p>
                  <p className="text-xs font-medium text-slate-500">Cập nhật lần cuối: {formatDate(order.confirmed_at || order.created_at)}</p>
                </div>
              </div>
              
              {order.status === "PENDING" && (
                <Link 
                  href={`/webview/payment?order_id=${order.id}`}
                  className="ai-glow flex items-center justify-center gap-3 w-full bg-accent text-white py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-accent/15 transition-all hover:-translate-y-1"
                >
                  THANH TOÁN NGAY
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>

          {/* Delivery Info */}
          <div className="grid grid-cols-1 gap-4">
            <InfoCard 
              icon={<MapPin className="h-5 w-5 text-accent" />} 
              label="Địa chỉ giao hàng" 
              value={order.customer_address || "Chưa cung cấp"} 
            />
            <div className="grid grid-cols-2 gap-4">
              <InfoCard 
                icon={<Phone className="h-5 w-5 text-emerald-500" />} 
                label="Số điện thoại" 
                value={order.customer_phone || "—"} 
              />
              <InfoCard 
                icon={<CreditCard className="h-5 w-5 text-amber-500" />} 
                label="Thanh toán" 
                value={order.payment_method?.toUpperCase() || "Tiền mặt"} 
              />
            </div>
          </div>

          {/* Items Summary */}
          <div className="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/40 border border-slate-50 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Sản phẩm đã chọn</h2>
              <span className="text-[10px] font-bold text-slate-300">{order.items?.length} Món</span>
            </div>
            
            <div className="divide-y divide-slate-50">
              {order.items?.map((item, i) => (
                <div key={i} className="py-4 flex justify-between items-center group">
                  <div className="space-y-1">
                    <p className="text-sm font-black text-slate-900 group-hover:text-accent transition-colors">{item.product_name}</p>
                    <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Số lượng: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-black text-slate-900">
                    {formatCurrency(item.subtotal, order.currency)}
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t-2 border-dashed border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tạm tính</span>
                <span className="text-sm font-black text-slate-900">{formatCurrency(order.total_amount, order.currency)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Phí vận chuyển</span>
                <span className="text-sm font-black text-emerald-500 uppercase">Miễn phí</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm font-black text-slate-900 uppercase tracking-tighter">Tổng cộng</span>
                <span className="text-2xl font-[1000] text-accent tracking-tighter">
                  {formatCurrency(order.total_amount, order.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Help Footer */}
          <div className="p-8 text-center space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-900 uppercase">Cần hỗ trợ?</p>
              <p className="text-[10px] font-medium text-slate-400">Vui lòng nhắn tin trực tiếp cho cửa hàng qua Messenger.</p>
            </div>
            <button className="inline-flex items-center gap-2 text-[10px] font-black text-accent uppercase tracking-widest hover:underline">
              XEM LẠI CHAT
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-[1.5rem] p-5 shadow-lg shadow-slate-200/30 border border-slate-50 space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xs font-black text-slate-900 line-clamp-2 leading-relaxed">{value}</p>
    </div>
  );
}
