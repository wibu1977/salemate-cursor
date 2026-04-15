"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi, formatApiError, pagesApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";

interface PageData {
  id: string;
  page_id: string;
  page_name: string;
  platform: string;
  is_active: boolean;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [shopName, setShopName] = useState("");
  const [reportHour, setReportHour] = useState(9);
  const [language, setLanguage] = useState("vi");
  const [showConnect, setShowConnect] = useState(false);
  const [pageForm, setPageForm] = useState({ page_id: "", page_name: "", page_access_token: "", platform: "facebook" });

  const { data: pages } = useQuery({
    queryKey: ["pages"],
    queryFn: () => pagesApi.listPages().then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      authApi.setupWorkspace({
        name: shopName,
        language,
        report_hour: reportHour,
        page_ids: [],
      }),
    onSuccess: () => toast("Cài đặt đã lưu", "success"),
    onError: (err) => toast(formatApiError(err), "error"),
  });

  const connectMutation = useMutation({
    mutationFn: () => pagesApi.connectPage(pageForm),
    onSuccess: () => {
      toast("Trang đã kết nối thành công", "success");
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      setShowConnect(false);
      setPageForm({ page_id: "", page_name: "", page_access_token: "", platform: "facebook" });
    },
    onError: (err) => toast(formatApiError(err), "error"),
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => pagesApi.disconnectPage(id),
    onSuccess: () => {
      toast("Đã ngắt kết nối trang", "success");
      queryClient.invalidateQueries({ queryKey: ["pages"] });
    },
    onError: (err) => toast(formatApiError(err), "error"),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Cài đặt workspace</h1>

      {/* General settings */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Thông tin chung</h2>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Tên cửa hàng</label>
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Quan Cuon Seoul"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Giờ gửi báo cáo</label>
            <select
              value={reportHour}
              onChange={(e) => setReportHour(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>{h.toString().padStart(2, "0")}:00 KST</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Ngôn ngữ chatbot</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="vi">Tiếng Việt</option>
              <option value="ko">Tiếng Hàn</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!shopName || saveMutation.isPending}
          className="btn-primary w-full py-2.5"
        >
          {saveMutation.isPending ? "Đang lưu..." : "Lưu cài đặt"}
        </button>
      </div>

      {/* Connected Pages */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Facebook / Instagram Pages</h2>
          <button onClick={() => setShowConnect(true)} className="btn-secondary text-xs">
            + Kết nối trang
          </button>
        </div>

        {pages?.length ? (
          <div className="space-y-2">
            {pages.map((p: PageData) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.page_name}</p>
                  <p className="text-xs text-gray-500">
                    {p.platform.toUpperCase()} — ID: {p.page_id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {p.is_active
                    ? <span className="badge-success">Đang hoạt động</span>
                    : <span className="badge-danger">Tạm ngưng</span>}
                  <button
                    onClick={() => disconnectMutation.mutate(p.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Ngắt kết nối
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Chưa có trang nào được kết nối.</p>
        )}
      </div>

      {/* Connect Page Modal */}
      <Modal open={showConnect} onClose={() => setShowConnect(false)} title="Kết nối Facebook Page">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Page ID</label>
            <input
              type="text"
              value={pageForm.page_id}
              onChange={(e) => setPageForm({ ...pageForm, page_id: e.target.value })}
              placeholder="123456789012345"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Page Name</label>
            <input
              type="text"
              value={pageForm.page_name}
              onChange={(e) => setPageForm({ ...pageForm, page_name: e.target.value })}
              placeholder="Quan Cuon Seoul"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Page Access Token</label>
            <textarea
              value={pageForm.page_access_token}
              onChange={(e) => setPageForm({ ...pageForm, page_access_token: e.target.value })}
              rows={2}
              placeholder="EAAx..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Platform</label>
            <select
              value={pageForm.platform}
              onChange={(e) => setPageForm({ ...pageForm, platform: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="facebook">Facebook Messenger</option>
              <option value="instagram">Instagram DM</option>
            </select>
          </div>
          <button
            onClick={() => connectMutation.mutate()}
            disabled={!pageForm.page_id || !pageForm.page_access_token || connectMutation.isPending}
            className="btn-primary w-full py-2.5"
          >
            {connectMutation.isPending ? "Đang kết nối..." : "Kết nối trang"}
          </button>
          <p className="text-xs text-gray-400">
            Khi kết nối, hệ thống sẽ tự động đăng ký webhook, đặt nút Get Started và Persistent Menu cho trang.
          </p>
        </div>
      </Modal>
    </div>
  );
}
