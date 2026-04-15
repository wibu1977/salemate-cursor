"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const TOSS_SERVER_ERROR_CODES = [
  "PROVIDER_ERROR",
  "FAILED_INTERNAL_SYSTEM_PROCESSING",
  "FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING",
  "UNKNOWN_PAYMENT_ERROR",
  "",
];

function PaymentFailContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") || "";
  const message = searchParams.get("message") || "Thanh toán không thành công";
  const memoCode = searchParams.get("memo_code") || "";
  const fallback = searchParams.get("fallback") || "";

  const isServerError =
    fallback === "bank_transfer_sent" ||
    TOSS_SERVER_ERROR_CODES.includes(code) ||
    code.startsWith("FAILED_") ||
    code.startsWith("PROVIDER_");

  const isUserCancel = code === "PAY_PROCESS_CANCELED" || code === "USER_CANCEL";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-white p-4">
      <div className="card max-w-md text-center">
        {isServerError ? (
          <>
            {/* Toss server error — guide to Messenger fallback */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <svg
                className="h-8 w-8 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="mt-4 text-xl font-bold text-gray-900">
              Cổng thanh toán đang bảo trì
            </h1>
            <div className="mt-4 rounded-lg bg-amber-50 p-4 text-left text-sm text-amber-800">
              Vui lòng đóng cửa sổ này và xem hướng dẫn chuyển khoản đính kèm
              trong tin nhắn Messenger của bạn.
            </div>
            {memoCode && (
              <p className="mt-4 text-xs text-gray-400">
                Mã đơn:{" "}
                <span className="font-mono font-bold">{memoCode}</span>
              </p>
            )}
          </>
        ) : (
          <>
            {/* User cancel or other payment error */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              {isUserCancel
                ? "Thanh toán đã hủy"
                : "Thanh toán thất bại"}
            </h1>
            <p className="mt-2 text-sm text-gray-500">{message}</p>
            {code && !isUserCancel && (
              <p className="mt-1 text-xs text-gray-400">Mã lỗi: {code}</p>
            )}

            <div className="mt-6 space-y-3">
              {memoCode && (
                <Link
                  href={`/webview/payment?order_id=${memoCode}`}
                  className="btn-primary block w-full py-3 text-center"
                >
                  Thử lại thanh toán
                </Link>
              )}
              <p className="text-xs text-gray-400">
                Bạn cũng có thể thanh toán bằng chuyển khoản.
                <br />
                Ghi nội dung:{" "}
                <span className="font-mono font-bold">{memoCode}</span>
                <br />
                Sau đó gửi ảnh bill cho cửa hàng qua Messenger.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-white p-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
        </div>
      }
    >
      <PaymentFailContent />
    </Suspense>
  );
}
