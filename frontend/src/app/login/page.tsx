"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, formatApiError } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { getBrowserSupabase, isSupabaseAuthConfigured } from "@/lib/supabase/browser";

/** Facebook JS SDK chỉ cho phép FB.login / getLoginStatus trên HTTPS (kể cả localhost). */
function isFacebookSdkAllowed(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "https:";
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [needsHttps, setNeedsHttps] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.protocol === "http:") {
      setNeedsHttps(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const err = new URLSearchParams(window.location.search).get("error");
    if (err) {
      alert(decodeURIComponent(err));
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

  const redirectAfterAuth = () => {
    router.push("/dashboard");
    router.refresh();
  };

  const handleGoogle = async () => {
    const sb = getBrowserSupabase();
    if (!sb) {
      alert("Chưa cấu hình Supabase (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).");
      return;
    }
    setLoading(true);
    const origin = window.location.origin;
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);
    if (error) {
      alert(error.message);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getBrowserSupabase();
    if (!sb) {
      alert("Chưa cấu hình Supabase.");
      return;
    }
    if (!email.trim()) return;
    setLoading(true);
    const origin = window.location.origin;
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    setEmailSent(true);
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

    const appId = (process.env.NEXT_PUBLIC_META_APP_ID || "").trim();
    if (!appId) {
      alert(
        "Chưa cấu hình NEXT_PUBLIC_META_APP_ID trên hosting.\n\n" +
          "Railway → service Frontend → Variables: thêm NEXT_PUBLIC_META_APP_ID = App ID Meta (số trong Meta Developer), sau đó Deploy lại / Redeploy để Next.js embed biến vào build."
      );
      return;
    }

    setLoading(true);
    try {
      const deadline = Date.now() + 12_000;
      while (!window.FB && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 120));
      }
      if (!window.FB) {
        alert(
          "Facebook SDK chưa tải được sau vài giây.\n\n" +
            "• Tắt AdBlock / Privacy Badger / uBlock cho domain Railway của bạn, rồi F5.\n" +
            "• Mở DevTools (F12) → tab Network: tìm connect.facebook.net/sdk.js — nếu bị chặn (blocked) thì do tiện ích hoặc mạng.\n" +
            "• Kiểm tra App ID Meta đúng và domain đã thêm trong Meta App (App domains + OAuth Redirect URIs)."
        );
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
                  redirectAfterAuth();
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

  const supabaseOn = isSupabaseAuthConfigured();

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

        {supabaseOn ? (
          <div className="mt-8 space-y-4 text-left">
            <button
              type="button"
              onClick={() => void handleGoogle()}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-6 py-3 text-base font-medium text-gray-800 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Đăng nhập với Google
            </button>
            {emailSent ? (
              <p className="text-center text-sm text-gray-600">
                Đã gửi link đăng nhập tới email của bạn. Kiểm tra hộp thư và bấm link
                (có thể nằm trong thư mục spam).
              </p>
            ) : (
              <form onSubmit={(e) => void handleMagicLink(e)} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Email (magic link)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-primary-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                >
                  {loading ? "Đang gửi..." : "Gửi link đăng nhập"}
                </button>
              </form>
            )}
          </div>
        ) : null}

        {supabaseOn ? (
          <p className="mt-6 text-xs text-gray-500">
            Sau khi đăng nhập, vào <strong>Kết nối Facebook</strong> để nối Page Messenger.
          </p>
        ) : (
          <p className="mt-6 text-xs text-amber-800">
            <strong>Chưa thấy Supabase trên bản build này.</strong> Trên Railway: thêm{" "}
            <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> và{" "}
            <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> vào service
            Frontend, rồi <strong>Deploy lại / chạy build mới</strong> (Next chỉ nhúng{" "}
            <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_*</code> lúc{" "}
            <code className="rounded bg-amber-100 px-1">npm run build</code>
            — chỉ restart container là chưa đủ).
          </p>
        )}

        {supabaseOn ? (
          <details className="mt-8 border-t border-gray-100 pt-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              Đăng nhập bằng Facebook (tài khoản cũ) — tùy chọn
            </summary>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => void handleFacebookLogin()}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#1877F2] px-6 py-3 text-base font-medium text-white transition-colors hover:bg-[#166FE5] disabled:opacity-50"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                {loading ? "Đang xử lý..." : "Đăng nhập bằng Facebook"}
              </button>
            </div>
          </details>
        ) : (
          <div className="mt-10 border-t border-gray-100 pt-6">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
              Đăng nhập bằng Facebook
            </p>
            <button
              type="button"
              onClick={() => void handleFacebookLogin()}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#1877F2] px-6 py-3 text-base font-medium text-white transition-colors hover:bg-[#166FE5] disabled:opacity-50"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              {loading ? "Đang xử lý..." : "Đăng nhập bằng Facebook"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
