"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";

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
      setErrorMsg("Missing payment parameters");
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
          setErrorMsg(data.error || "Confirmation failed");
        }
      } catch {
        setStatus("error");
        setErrorMsg("Network error");
      }
    };

    confirm();
  }, [paymentKey, orderId, amount]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-white p-4">
      <div className="card max-w-md text-center">
        {status === "confirming" && (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
            <p className="mt-4 text-sm text-gray-500">
              Đang xác nhận thanh toán...
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              Thanh toán thành công!
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Mã đơn: <span className="font-mono font-bold">{memoCode || orderId}</span>
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Số tiền: {Number(amount).toLocaleString()} KRW
            </p>
            <div className="mt-6 rounded-lg bg-green-50 p-4 text-left text-sm text-green-800">
              Đơn hàng đã được xác nhận. Cửa hàng sẽ chuẩn bị đơn hàng cho
              bạn. Cảm ơn bạn đã mua sắm!
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <p className="text-4xl">⚠️</p>
            <h1 className="mt-4 text-xl font-bold text-gray-900">
              Xác nhận thanh toán thất bại
            </h1>
            <p className="mt-2 text-sm text-red-500">{errorMsg}</p>
            <p className="mt-4 text-xs text-gray-400">
              Tiền có thể đã bị trừ. Vui lòng liên hệ cửa hàng qua Messenger
              với mã đơn: {memoCode || orderId}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-white p-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
