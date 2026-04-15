"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CampaignPreview {
  id: string;
  name: string;
  status: string;
  message_template: string;
  segment_label: string | null;
  total_recipients: number;
  sent_count: number;
  opened_count: number;
  converted_count: number;
}

function CampaignWebviewContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const token = searchParams.get("token") || "";

  const [data, setData] = useState<CampaignPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !token) {
      setError("Thiếu liên kết hợp lệ (token).");
      setLoading(false);
      return;
    }

    fetch(`${API_URL}/webview/campaigns/${id}?token=${encodeURIComponent(token)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Không tải được chiến dịch.");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("Không tải được chiến dịch hoặc token đã hết hạn."))
      .finally(() => setLoading(false));
  }, [id, token]);

  const postAction = async (action: string) => {
    if (!id || !token) return;
    setBusy(true);
    setError(null);
    try {
      const body: { action: string; custom_message?: string | null } = { action };
      const msg = customMessage.trim();
      if (msg) body.custom_message = msg;

      const r = await fetch(
        `${API_URL}/webview/campaigns/${id}/action?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error((json as { detail?: string }).detail || "Thao tác thất bại.");
      }
      if (action === "approve") {
        setDone("Đã duyệt. Hệ thống đang gửi tin nhắn tới khách (Recurring Notification / Messenger).");
      } else if (action === "rewrite") {
        setDone("AI đã soạn lại. Kiểm tra nội dung mới bên dưới — bạn có thể duyệt khi sẵn sàng.");
        if ((json as { campaign_status?: string }).campaign_status === "pending_approval") {
          const nr = await fetch(
            `${API_URL}/webview/campaigns/${id}?token=${encodeURIComponent(token)}`
          );
          if (nr.ok) setData(await nr.json());
        }
      } else {
        setDone("Chiến dịch đã hủy.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="card max-w-md text-center text-sm text-red-600">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="card">
          <h1 className="text-lg font-bold text-gray-900">{data.name}</h1>
          <p className="mt-1 text-xs text-gray-500">
            Nhóm: {data.segment_label || "—"} · Dự kiến {data.total_recipients} người nhận
          </p>
          <p className="mt-1 text-xs font-medium text-amber-700">Trạng thái: {data.status}</p>
        </div>

        <div className="card">
          <p className="text-xs font-medium text-gray-500">Nội dung gửi</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{data.message_template}</p>
        </div>

        {data.status === "pending_approval" && !done?.includes("Đã duyệt") && !done?.includes("hủy") && (
          <div className="card space-y-3">
            <label className="block text-xs font-medium text-gray-600">
              Chỉnh sửa nội dung (tùy chọn, áp dụng khi duyệt)
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={3}
              placeholder="Để trống nếu giữ nguyên bản AI"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => postAction("approve")}
                className="btn-primary w-full py-2.5 text-sm"
              >
                {busy ? "Đang xử lý…" : "Duyệt & gửi"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => postAction("rewrite")}
                className="btn-secondary w-full py-2.5 text-sm"
              >
                Yêu cầu AI viết lại
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => postAction("cancel")}
                className="w-full rounded-lg border border-red-200 py-2.5 text-sm text-red-600 hover:bg-red-50"
              >
                Hủy chiến dịch
              </button>
            </div>
          </div>
        )}

        {done && (
          <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">{done}</div>
        )}
        {error && data && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {data.sent_count > 0 && (
          <p className="text-center text-xs text-gray-400">
            Đã gửi: {data.sent_count} · Xác nhận phân phối (Meta): {data.opened_count}
            {data.converted_count > 0 && ` · Chuyển đổi: ${data.converted_count}`}
          </p>
        )}
      </div>
    </div>
  );
}

export default function CampaignWebviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      }
    >
      <CampaignWebviewContent />
    </Suspense>
  );
}
