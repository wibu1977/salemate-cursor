"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { campaignApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  draft: { label: "Nháp", className: "badge-info" },
  pending_approval: { label: "Chờ duyệt", className: "badge-warning" },
  approved: { label: "Đã duyệt", className: "badge-success" },
  sending: { label: "Đang gửi", className: "badge-info" },
  completed: { label: "Hoàn thành", className: "badge-success" },
  cancelled: { label: "Đã hủy", className: "badge-danger" },
};

interface Segment {
  id: string;
  label: string;
  description: string | null;
  recommendation: string | null;
  customer_count: number;
  avg_orders: number;
  avg_spent: number;
}

interface CampaignData {
  id: string;
  name: string;
  target_cluster: string | null;
  target_segment_id: string | null;
  segment_label: string | null;
  segment_description: string | null;
  status: string;
  message_template: string;
  total_recipients: number;
  sent_count: number;
  opened_count: number;
  converted_count: number;
  ai_generated: boolean;
  created_at: string;
}

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ name: "", target_segment_id: "", message_template: "" });

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => campaignApi.getCampaigns().then((r) => r.data),
  });

  const { data: segments } = useQuery({
    queryKey: ["segments"],
    queryFn: () => campaignApi.getSegments().then((r) => r.data),
  });

  const { data: detail } = useQuery({
    queryKey: ["campaign-detail", selectedId],
    queryFn: () => campaignApi.getCampaign(selectedId!).then((r) => r.data),
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) => campaignApi.createCampaign(data),
    onSuccess: () => {
      toast(
        "Chiến dịch đã tạo. Kiểm tra Messenger Salemate để duyệt qua webview (nếu đã cấu hình).",
        "success"
      );
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setShowCreate(false);
      setCreateForm({ name: "", target_segment_id: "", message_template: "" });
    },
    onError: () => toast("Tạo thất bại", "error"),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, action, msg }: { id: string; action: string; msg?: string }) =>
      campaignApi.approveCampaign(id, action, msg),
    onSuccess: (_, { action }) => {
      const labels: Record<string, string> = {
        approve: "Đã duyệt — đang gửi",
        rewrite: "AI đang viết lại",
        cancel: "Đã hủy",
      };
      toast(labels[action] || "Thành công", "success");
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-detail", selectedId] });
    },
    onError: () => toast("Thao tác thất bại", "error"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Chiến dịch Outreach</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-xs">
          + Thêm chiến dịch
        </button>
      </div>

      {/* Segment overview */}
      {segments?.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {segments.map((seg: Segment) => (
            <div key={seg.id} className="card p-4">
              <p className="text-sm font-semibold text-gray-900">{seg.label}</p>
              <p className="mt-0.5 text-xs text-gray-500">{seg.customer_count} khách</p>
              <p className="mt-1 text-xs text-gray-400">{seg.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Campaign cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card animate-pulse"><div className="h-4 w-28 rounded bg-gray-200" /><div className="mt-3 h-16 rounded bg-gray-100" /></div>
            ))
          : campaigns?.map((c: CampaignData) => {
              const st = STATUS_MAP[c.status] || { label: c.status, className: "badge-info" };
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="card cursor-pointer transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-gray-900">{c.name}</h3>
                    <span className={st.className}>{st.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {c.segment_label || c.target_cluster || "—"} — {c.total_recipients} người nhận
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm text-gray-600">{c.message_template}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                    <span>{c.ai_generated ? "AI soạn" : "Tự chỉnh"}</span>
                    <span>{formatDate(c.created_at)}</span>
                  </div>
                  {c.sent_count > 0 && (
                    <div className="mt-2 space-y-0.5 text-xs font-medium text-green-600">
                      <div>
                        Đã gửi: {c.sent_count} / {c.total_recipients}
                      </div>
                      <div className="text-gray-500">
                        Phân phối (Meta delivery): {c.opened_count ?? 0} / {c.sent_count}
                        {(c.converted_count ?? 0) > 0 && (
                          <span className="ml-1">· Chuyển đổi: {c.converted_count}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
      </div>

      {/* Create Campaign Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo chiến dịch mới" size="md">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Tên chiến dịch</label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="Khuyến mãi tháng 4"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Chọn nhóm khách hàng</label>
            <div className="space-y-2">
              {segments?.map((seg: Segment) => (
                <label
                  key={seg.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                    createForm.target_segment_id === seg.id
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="segment"
                    checked={createForm.target_segment_id === seg.id}
                    onChange={() => setCreateForm({ ...createForm, target_segment_id: seg.id })}
                    className="accent-primary-600"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{seg.label}</p>
                    <p className="text-xs text-gray-500">{seg.customer_count} khách — {seg.description}</p>
                  </div>
                  {seg.recommendation && (
                    <span className="text-xs text-primary-600">{seg.recommendation}</span>
                  )}
                </label>
              ))}
              {!segments?.length && (
                <p className="text-sm text-gray-400">Chưa có phân khúc. Chạy gom nhóm (clustering) trước.</p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Nội dung tin nhắn (để trống để AI tự soạn)
            </label>
            <textarea
              value={createForm.message_template}
              onChange={(e) => setCreateForm({ ...createForm, message_template: e.target.value })}
              rows={3}
              placeholder="Để trống — AI sẽ tự soạn dựa trên đặc điểm nhóm khách hàng"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <button
            onClick={() => createMutation.mutate(createForm)}
            disabled={!createForm.name || !createForm.target_segment_id || createMutation.isPending}
            className="btn-primary w-full py-2.5"
          >
            {createMutation.isPending ? "Đang tạo..." : "Tạo chiến dịch"}
          </button>
        </div>
      </Modal>

      {/* Campaign Detail / Approve Modal */}
      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} title="Chi tiết chiến dịch" size="lg">
        {detail ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{detail.name}</h3>
              <span className={(STATUS_MAP[detail.status] || { className: "badge-info" }).className}>
                {(STATUS_MAP[detail.status] || { label: detail.status }).label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Nhóm:</span> {detail.segment_label || detail.target_cluster}</div>
              <div><span className="text-gray-500">Người nhận:</span> {detail.total_recipients}</div>
              <div><span className="text-gray-500">Đã gửi:</span> {detail.sent_count}</div>
              <div><span className="text-gray-500">Soạn bởi:</span> {detail.ai_generated ? "AI" : "Thủ công"}</div>
            </div>
            {detail.sent_count > 0 && (
              <div className="rounded-lg border border-gray-100 bg-white p-3 text-sm text-gray-700">
                <span className="font-medium text-gray-600">Phân phối (Meta delivery):</span>{" "}
                {detail.opened_count ?? 0} / {detail.sent_count}
                {detail.converted_count != null && detail.converted_count > 0 && (
                  <span className="ml-3 text-green-700">
                    Chuyển đổi: {detail.converted_count}
                  </span>
                )}
              </div>
            )}

            {detail.segment_description && (
              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                Đặc điểm nhóm: {detail.segment_description}
              </div>
            )}

            <div className="rounded-lg bg-gray-50 p-4">
              <p className="mb-1 text-xs font-medium text-gray-500">Nội dung tin nhắn</p>
              <p className="whitespace-pre-wrap text-sm text-gray-800">{detail.message_template}</p>
            </div>

            {detail.status === "pending_approval" && (
              <div className="flex gap-3">
                <button
                  onClick={() => approveMutation.mutate({ id: detail.id, action: "approve" })}
                  disabled={approveMutation.isPending}
                  className="btn-primary flex-1 py-2.5"
                >
                  Duyệt & gửi
                </button>
                <button
                  onClick={() => approveMutation.mutate({ id: detail.id, action: "rewrite" })}
                  disabled={approveMutation.isPending}
                  className="btn-secondary flex-1 py-2.5"
                >
                  AI viết lại
                </button>
                <button
                  onClick={() => approveMutation.mutate({ id: detail.id, action: "cancel" })}
                  disabled={approveMutation.isPending}
                  className="flex-1 rounded-lg border border-red-200 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  Hủy
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        )}
      </Modal>
    </div>
  );
}
