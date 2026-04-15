"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError("Missing order_id");
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
          err instanceof Error ? err.message : "Failed to load checkout";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    initCheckout();
  }, [orderId]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="card max-w-md text-center">
          <p className="text-4xl">❌</p>
          <h1 className="mt-4 text-xl font-bold text-gray-900">
            Lỗi thanh toán
          </h1>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-500">
            Đang khởi tạo thanh toán...
          </p>
        </div>
      </div>
    );
  }

  return null;
}

export default function TossCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      }
    >
      <TossCheckoutContent />
    </Suspense>
  );
}
