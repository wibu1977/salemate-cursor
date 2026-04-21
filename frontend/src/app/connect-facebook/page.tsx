"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";

import { pagesApi, formatApiError } from "@/lib/api";

type FbPage = { id: string; name: string; access_token: string };

export default function ConnectFacebookPage() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState<FbPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const runFacebookConnect = () => {
    const appId = (process.env.NEXT_PUBLIC_META_APP_ID || "").trim();
    if (!appId) {
      setError("Thiếu NEXT_PUBLIC_META_APP_ID.");
      return;
    }
    if (typeof window === "undefined" || window.location.protocol !== "https:") {
      setError("Cần HTTPS để dùng Facebook SDK.");
      return;
    }
    setError(null);
    setLoading(true);
    setPages([]);

    const deadline = Date.now() + 12_000;
    const waitFb = async () => {
      while (!window.FB && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 120));
      }
    };

    void (async () => {
      await waitFb();
      if (!window.FB) {
        setError("Facebook SDK chưa tải. Tắt AdBlock và tải lại trang.");
        setLoading(false);
        return;
      }

      window.FB!.login(
        async (resp: { authResponse?: { accessToken: string }; status?: string }) => {
          if (!resp.authResponse?.accessToken) {
            setError("Chưa có quyền Facebook hoặc đã hủy.");
            setLoading(false);
            return;
          }
          const token = resp.authResponse.accessToken;
          try {
            const url = new URL("https://graph.facebook.com/v21.0/me/accounts");
            url.searchParams.set("fields", "id,name,access_token");
            url.searchParams.set("access_token", token);
            const r = await fetch(url.toString());
            const data = (await r.json()) as { data?: FbPage[]; error?: { message: string } };
            if (data.error) {
              setError(data.error.message || "Graph API lỗi");
              setLoading(false);
              return;
            }
            setPages(data.data || []);
            if (!(data.data || []).length) {
              setError("Không thấy Facebook Page nào. Bạn cần quản trị Page và cấp quyền pages_show_list.");
            }
          } catch (e) {
            setError(formatApiError(e));
          } finally {
            setLoading(false);
          }
        },
        {
          scope:
            "pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement",
        }
      );
    })();
  };

  const connectOne = async (p: FbPage) => {
    setConnectingId(p.id);
    setError(null);
    try {
      await pagesApi.connectPage({
        page_id: p.id,
        page_name: p.name,
        page_access_token: p.access_token,
        platform: "facebook",
      });
      await queryClient.invalidateQueries({ queryKey: ["pages"] });
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Link href="/dashboard" className="text-sm text-primary-600 hover:underline">
        ← Về dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">Kết nối Facebook Page</h1>
      <p className="mt-2 text-gray-600">
        Đăng nhập Facebook (tài khoản quản trị Page), chọn Page để nhận tin nhắn và bật webhook.
      </p>

      <button
        type="button"
        onClick={runFacebookConnect}
        disabled={loading}
        className="mt-6 w-full rounded-lg bg-[#1877F2] px-6 py-3 font-medium text-white hover:bg-[#166FE5] disabled:opacity-50"
      >
        {loading ? "Đang mở Facebook…" : "Đăng nhập Facebook để chọn Page"}
      </button>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {pages.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {pages.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-sm"
            >
              <div>
                <div className="font-medium text-gray-900">{p.name}</div>
                <div className="text-xs text-gray-500">ID: {p.id}</div>
              </div>
              <button
                type="button"
                disabled={connectingId === p.id}
                onClick={() => void connectOne(p)}
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {connectingId === p.id ? "Đang kết nối…" : "Kết nối"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
