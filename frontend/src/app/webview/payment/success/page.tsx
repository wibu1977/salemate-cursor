"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";
import { 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ShoppingBag, 
  ArrowRight,
  Sparkles
} from "lucide-react";
import Link from "next/link";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const paymentKey = searchParams.get("paymentKey");
  const orderId = searchParams.get("orderId");
  const amount = searchParams.get("amount");
  const memoCode = searchParams.get("memo_code");

  const [status, setStatus] = useState<"confirming" | "success" | "error">(
    "confirming"
  );
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!paymentKey || !orderId || !amount) {
      setStatus("error");
      setErrorMsg("Thiếu tham số thanh toán");
      return;
    }

    const confirm = async () => {
      try {
        const { data } = await api.post("/payments/toss/confirm", {
          payment_key: paymentKey,
          order_id: orderId,
          amount: Number(amount),
        });

        if (data.success) {
          setStatus("success");
        } else if (data.fallback === "bank_transfer_sent") {
          window.location.href = `/webview/payment/fail?code=PROVIDER_ERROR&memo_code=${memoCode || orderId}&fallback=bank_transfer_sent&message=${encodeURIComponent("Cổng thanh toán đang bảo trì")}`;
          return;
        } else {
          setStatus("error");
          setErrorMsg(data.error || "Xác nhận thất bại");
        }
      } catch {
        setStatus("error");
        setErrorMsg("Lỗi kết nối máy chủ");
      }
    };

    confirm();
  }, [paymentKey, orderId, amount, memoCode]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page p-6 relative overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-0 right-0 h-64 w-64 bg-emerald-100/50 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 h-64 w-64 bg-accent-soft/30 blur-3xl rounded-full -translate-x-1/2 translate-y-1/2" />

      <div className="relative z-10 w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-50 p-8 text-center animate-slide-up">
        {status === "confirming" && (
          <div className="space-y-6 py-12">
            <div className="relative inline-block">
              <div className="h-20 w-20 animate-spin rounded-full border-4 border-slate-100 border-t-accent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-accent animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-[1000] text-slate-900 uppercase tracking-tight">Đang xác nhận</h1>
              <p className="text-sm font-medium text-slate-400">Vui lòng không đóng cửa sổ này...</p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-8">
            <div className="relative inline-block">
              <div className="h-24 w-24 rounded-[2rem] bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              </div>
              <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-accent text-white flex items-center justify-center shadow-lg">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-[1000] text-slate-900 uppercase tracking-tighter leading-none">Thành công!</h1>
              <p className="text-sm font-medium text-slate-500">Thanh toán của bạn đã được ghi nhận.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-page rounded-2xl p-4 text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mã đơn hàng</p>
                <p className="text-sm font-mono font-bold text-slate-900">{memoCode || orderId?.split('-')[0]}</p>
              </div>
              <div className="bg-surface-page rounded-2xl p-4 text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Số tiền</p>
                <p className="text-sm font-bold text-slate-900">{Number(amount).toLocaleString()} KRW</p>
              </div>
            </div>

            <div className="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-100 text-left">
              <p className="text-xs font-medium text-emerald-800 leading-relaxed">
                Đơn hàng đã được xác nhận tự động. Cửa hàng sẽ chuẩn bị và giao hàng cho bạn sớm nhất có thể. Cảm ơn bạn!
              </p>
            </div>

            <Link
              href={`/webview/order/${orderId}`}
              className="flex items-center justify-center gap-3 w-full bg-slate-900 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-900/10 transition-all hover:bg-slate-800"
            >
              XEM CHI TIẾT ĐƠN
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-8">
            <div className="h-24 w-24 mx-auto rounded-[2rem] bg-rose-50 flex items-center justify-center">
              <AlertCircle className="h-12 w-12 text-rose-500" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-[1000] text-slate-900 uppercase tracking-tight">Lỗi xác nhận</h1>
              <p className="text-sm font-medium text-rose-500">{errorMsg}</p>
            </div>

            <div className="bg-rose-50/50 rounded-2xl p-5 border border-rose-100 text-left">
              <p className="text-xs font-medium text-rose-800 leading-relaxed">
                Tiền có thể đã bị trừ nhưng hệ thống gặp lỗi khi xác nhận. Đừng lo lắng, hãy liên hệ cửa hàng qua Messenger và gửi mã đơn này:
                <span className="block mt-2 font-mono font-bold text-rose-900">{memoCode || orderId}</span>
              </p>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all hover:bg-slate-800"
            >
              THỬ LẠI
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface-page">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
