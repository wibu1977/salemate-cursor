"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, formatApiError } from "@/lib/api";
import { setAuth } from "@/lib/auth";

/** Facebook JS SDK chỉ cho phép FB.login / getLoginStatus trên HTTPS (kể cả localhost). */
function isFacebookSdkAllowed(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "https:";
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [needsHttps, setNeedsHttps] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.protocol === "http:") {
      setNeedsHttps(true);
    }
  }, []);

  const formatFbError = (err: unknown) => {
    if (err && typeof err === "object") {
      const o = err as Record<string, unknown>;
      if (typeof o.message === "string") return o.message;
      if (typeof o.error_message === "string") return o.error_message;
    }
    if (err instanceof Error) return err.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  };

  const handleFacebookLogin = async () => {
    if (!isFacebookSdkAllowed()) {
      alert(
        "Facebook Login chỉ hoạt động trên HTTPS.\n\n" +
          "Hãy dừng dev server và chạy lại: npm run dev\n" +
          "Sau đó mở https://localhost:3000 (chấp nhận cảnh báo chứng chỉ nếu trình duyệt hỏi).\n\n" +
          "Hoặc dùng URL HTTPS (ví dụ ngrok) đã thêm trong Meta App → Valid OAuth Redirect URIs."
      );
      return;
    }

    setLoading(true);
    try {
      if (!window.FB) {
        alert("Facebook SDK chưa được tải xong, hoặc bị chặn bởi trình chặn quảng cáo (AdBlock). Vui lòng tắt Adblock và tải lại trang!");
        setLoading(false);
        return;
      }

      try {
        window.FB.login(
          function (response: {
            authResponse?: { accessToken: string };
            status?: string;
          }) {
            if (response.authResponse) {
              void (async () => {
                try {
                  const { data } = await authApi.facebookLogin(
                    response.authResponse!.accessToken
                  );
                  setAuth(data.access_token, String(data.workspace_id));
                  router.push("/dashboard");
                } catch (err) {
                  console.error("API Error during login call:", err);
                  alert(`Đăng nhập thất bại: ${formatApiError(err)}`);
                } finally {
                  setLoading(false);
                }
              })();
            } else {
              const st = response.status;
              const hint =
                st === "not_authorized"
                  ? "Ứng dụng chưa được bạn chấp nhận trong Facebook. Mở Cài đặt Facebook → Ứng dụng và trang web → tìm app Salemate, bật quyền, rồi thử Đăng nhập lại."
                  : st === "unknown"
                    ? "Phiên Facebook chưa rõ trạng thái. Tải lại trang (F5), đăng nhập facebook.com trong tab khác nếu cần, rồi bấm đăng nhập lại."
                    : "Đăng nhập Facebook chưa hoàn tất (đã đóng cửa sổ, từ chối quyền, hoặc bấm Kết nối lại nhưng chưa xong). Hãy bấm lại nút đăng nhập và chấp nhận đủ quyền cho app.";
              alert(hint);
              setLoading(false);
            }
          },
          {
            scope:
              "pages_messaging,pages_manage_metadata,pages_read_engagement",
          }
        );
      } catch (err) {
        console.error("Lỗi khi gọi FB.login:", err);
        alert(
          `Đã xảy ra lỗi khi mở đăng nhập Facebook: ${formatFbError(err)}. Kiểm tra Meta App: thêm domain/ngrok vào App domains & Valid OAuth Redirect URIs.`
        );
        setLoading(false);
      }
    } catch (err) {
      console.error("Lỗi Facebook SDK:", err);
      alert(`Lỗi Facebook SDK: ${formatFbError(err)}`);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-white px-4">
      <div className="card w-full max-w-md text-center">
        {needsHttps && (
          <div
            className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm text-amber-900"
            role="status"
          >
            <strong className="font-semibold">Yêu cầu HTTPS:</strong> Facebook
            không cho đăng nhập trên <code className="rounded bg-amber-100 px-1">http://</code>.
            Dùng{" "}
            <code className="rounded bg-amber-100 px-1">npm run dev</code>{" "}
            (đã bật HTTPS) và mở{" "}
            <code className="rounded bg-amber-100 px-1">
              https://localhost:3000
            </code>
            .
          </div>
        )}
        <h1 className="text-3xl font-bold text-gray-900">
          Sale<span className="text-primary-600">mate</span>
        </h1>
        <p className="mt-2 text-gray-600">Đăng nhập để quản lý cửa hàng</p>

        <button
          onClick={handleFacebookLogin}
          disabled={loading}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg bg-[#1877F2] px-6 py-3 text-base font-medium text-white transition-colors hover:bg-[#166FE5] disabled:opacity-50"
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          {loading ? "Đang đăng nhập..." : "Đăng nhập bằng Facebook"}
        </button>
      </div>
    </div>
  );
}
