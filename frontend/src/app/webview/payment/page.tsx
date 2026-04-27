"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";
import {
  CreditCard,
  ShieldCheck,
  Lock,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Zap,
} from "lucide-react";
import Link from "next/link";

declare global {
  interface Window {
    TossPayments: (clientKey: string) => {
      requestPayment: (
        method: string,
        options: Record<string, unknown>
      ) => Promise<void>;
    };
  }
}

function TossCheckoutContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const [, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError("Thiếu mã đơn hàng (order_id)");
      setLoading(false);
      return;
    }

    const initCheckout = async () => {
      try {
        const { data } = await api.post("/payments/toss/checkout", {
          order_id: orderId,
        });

        const script = document.createElement("script");
        script.src = "https://js.tosspayments.com/v1/payment";
        script.onload = () => {
          const tossPayments = window.TossPayments(data.toss_client_key);
          tossPayments.requestPayment("카드", {
            amount: data.amount,
            orderId: data.memo_code,
            orderName: data.order_name,
            customerName: data.customer_name,
            customerEmail: data.customer_email,
            successUrl: data.success_url,
            failUrl: data.fail_url,
          });
        };
        document.head.appendChild(script);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Không thể khởi tạo thanh toán";
        setError(message);
      } finally {
        // We keep loading true while Toss is opening
      }
    };

    initCheckout();
  }, [orderId]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-page p-6 text-center">
        <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-50">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-500">
            <AlertCircle className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-[1000] text-slate-900 uppercase tracking-tight">Lỗi thanh toán</h1>
            <p className="text-sm font-medium text-slate-500 leading-relaxed">{error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all hover:bg-slate-800"
          >
            THỬ LẠI NGAY
          </button>
          <Link
            href={`/webview/order/${orderId}`}
            className="flex items-center justify-center gap-2 text-xs font-black text-slate-400 hover:text-accent transition-colors uppercase tracking-widest group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Quay lại đơn hàng
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page relative overflow-hidden">
      <div className="absolute top-0 left-0 h-[400px] w-[400px] bg-accent-soft/50 blur-[100px] rounded-full -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 h-[400px] w-[400px] bg-accent-soft blur-[100px] rounded-full translate-x-1/2 translate-y-1/2" />

      <div className="relative z-10 max-w-sm w-full p-6 text-center space-y-8">
        <div className="relative inline-block">
          <div className="h-24 w-24 flex items-center justify-center rounded-3xl bg-white shadow-2xl shadow-slate-200 border border-slate-50">
            <CreditCard className="h-10 w-10 text-accent" />
          </div>
          <div className="absolute -bottom-2 -right-2 h-8 w-8 flex items-center justify-center rounded-full bg-accent text-white shadow-lg animate-bounce">
            <Zap className="h-4 w-4" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Loader2 className="h-4 w-4 text-accent animate-spin" />
            <span className="text-[10px] font-black text-accent uppercase tracking-[0.3em]">Secure Gateway</span>
          </div>
          <h1 className="text-2xl font-[1000] text-slate-900 uppercase tracking-tighter leading-none">Khởi tạo thanh toán</h1>
          <p className="text-sm font-medium text-slate-500 leading-relaxed px-4">
            Đang kết nối an toàn với hệ thống thanh toán Toss... Vui lòng không đóng trình duyệt.
          </p>
        </div>

        <div className="pt-8 grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bảo mật SSL</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400">
              <Lock className="h-5 w-5" />
            </div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mã hóa 256-bit</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TossCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface-page">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      }
    >
      <TossCheckoutContent />
    </Suspense>
  );
}
