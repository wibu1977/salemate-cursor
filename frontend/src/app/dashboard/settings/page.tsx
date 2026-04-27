"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi, formatApiError, pagesApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import {
  Store,
  Globe,
  Bell,
  Facebook,
  Instagram,
  Trash2,
  ShieldCheck,
  Settings,
  Clock,
  ExternalLink,
  Zap,
  CheckCircle2,
  Smartphone,
  Lock,
  HelpCircle,
  LogOut,
} from "lucide-react";

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
  const [pageForm, setPageForm] = useState({
    page_id: "",
    page_name: "",
    page_access_token: "",
    platform: "facebook",
  });

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
    onSuccess: () => toast("Cài đặt workspace đã được cập nhật", "success"),
    onError: (err) => toast(formatApiError(err), "error"),
  });

  const connectMutation = useMutation({
    mutationFn: () => pagesApi.connectPage(pageForm),
    onSuccess: () => {
      toast("Trang đã được kết nối thành công", "success");
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
    <div className="mx-auto max-w-5xl space-y-12 pb-20">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-[2rem] bg-slate-900 text-white shadow-2xl shadow-slate-200">
            <Settings className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Cài đặt</h1>
            <p className="mt-1 text-base font-medium text-slate-500">
              Cấu hình hệ thống và quản lý các kênh bán hàng
            </p>
          </div>
        </div>
        <button className="flex items-center gap-2 rounded-2xl bg-rose-50 px-6 py-3 text-sm font-black text-rose-600 transition-all hover:bg-rose-100 active:scale-95">
          <LogOut className="h-4 w-4" />
          ĐĂNG XUẤT
        </button>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-3">
          <p className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">DANH MỤC</p>
          <nav className="space-y-1">
            {[
              { label: "Workspace", icon: <Store className="h-5 w-5" />, active: true },
              { label: "Kênh kết nối", icon: <Globe className="h-5 w-5" />, active: false },
              { label: "Bảo mật", icon: <ShieldCheck className="h-5 w-5" />, active: false },
              { label: "Thông báo", icon: <Bell className="h-5 w-5" />, active: false },
              { label: "Trợ giúp", icon: <HelpCircle className="h-5 w-5" />, active: false },
            ].map((item, i) => (
              <button
                key={i}
                className={`flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-sm font-black transition-all ${
                  item.active
                    ? "bg-accent text-white shadow-xl shadow-accent/15"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="space-y-10 lg:col-span-9">
          <section className="card-premium relative space-y-8 overflow-hidden border-slate-100 bg-white p-10 shadow-2xl shadow-slate-200/50">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-accent-soft/30 blur-3xl" />

            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">Cấu hình Workspace</h2>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Thông tin cơ bản về thương hiệu của bạn
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
              <Field
                label="Tên thương hiệu / cửa hàng"
                value={shopName}
                onChange={setShopName}
                placeholder="Ví dụ: Salemate Premium Store"
                icon={<Store className="h-5 w-5" />}
              />

              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Ngôn ngữ hệ thống
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full cursor-pointer appearance-none rounded-[1.5rem] border-none bg-slate-50/50 py-4 pl-14 pr-10 text-sm font-black text-slate-900 shadow-inner outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-accent"
                    >
                      <option value="vi">Tiếng Việt</option>
                      <option value="ko">Tiếng Hàn (한국어)</option>
                      <option value="en">English (US)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Giờ nhận báo cáo AI
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <select
                      value={reportHour}
                      onChange={(e) => setReportHour(Number(e.target.value))}
                      className="w-full cursor-pointer appearance-none rounded-[1.5rem] border-none bg-slate-50/50 py-4 pl-14 pr-10 text-sm font-black text-slate-900 shadow-inner outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-accent"
                    >
                      {Array.from({ length: 24 }).map((_, h) => (
                        <option key={h} value={h}>
                          {h.toString().padStart(2, "0")}:00 KST (giờ Hàn Quốc)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!shopName || saveMutation.isPending}
                className="ai-glow flex w-full items-center justify-center gap-3 rounded-2xl bg-accent py-5 text-sm font-black uppercase tracking-[0.2em] text-white shadow-2xl shadow-accent/15 transition-all hover:-translate-y-1 hover:bg-accent-hover active:scale-95 disabled:opacity-50"
              >
                {saveMutation.isPending ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-3 border-white border-t-transparent" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
                Lưu cấu hình workspace
              </button>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                  <Zap className="h-5 w-5" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">
                  Kênh kết nối Facebook/Instagram
                </h2>
              </div>
              <button
                onClick={() => setShowConnect(true)}
                className="btn-premium px-6 py-3 text-[10px] tracking-widest"
              >
                Kết nối mới
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {pages?.length ? (
                pages.map((p: PageData) => (
                  <div
                    key={p.id}
                    className="group relative overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/40 transition-all hover:-translate-y-1 hover:shadow-2xl"
                  >
                    <div className="mb-8 flex items-start justify-between">
                      <div
                        className={`flex h-16 w-16 items-center justify-center rounded-[1.25rem] shadow-lg ${
                          p.platform === "facebook"
                            ? "bg-accent text-white shadow-accent/15"
                            : "bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 text-white shadow-rose-100"
                        }`}
                      >
                        {p.platform === "facebook" ? (
                          <Facebook className="h-8 w-8" />
                        ) : (
                          <Instagram className="h-8 w-8" />
                        )}
                      </div>
                      <div
                        className={`rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest ${
                          p.is_active
                            ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200"
                            : "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
                        }`}
                      >
                        {p.is_active ? "ACTIVE" : "OFFLINE"}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xl font-black text-slate-900 transition-colors group-hover:text-accent">
                          {p.page_name}
                        </h4>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          ID: {p.page_id}
                        </p>
                      </div>
                      <div className="flex gap-3 border-t border-slate-50 pt-4">
                        <button className="flex-1 rounded-xl bg-slate-50 py-3 text-xs font-black text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900">
                          Cấu hình
                        </button>
                        <button
                          onClick={() => disconnectMutation.mutate(p.id)}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-400 transition-all hover:bg-rose-600 hover:text-white"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center rounded-[2.5rem] border-4 border-dashed border-slate-100 bg-slate-50/30 py-20 md:col-span-2">
                  <Globe className="mb-4 h-12 w-12 text-slate-200" />
                  <p className="text-center text-sm font-black uppercase tracking-widest text-slate-400">
                    Chưa có kênh nào được kích hoạt.
                    <br />
                    <span className="text-[10px] opacity-70">
                      Bắt đầu bằng cách kết nối Fanpage của bạn
                    </span>
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <Modal open={showConnect} onClose={() => setShowConnect(false)} title="Kết nối nền tảng mới" size="lg">
        <div className="space-y-10">
          <div className="flex items-start gap-6 rounded-[2rem] bg-accent p-8 text-white shadow-2xl shadow-accent/15">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
              <Lock className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-black uppercase tracking-wider">Cấu hình API bảo mật</h4>
              <p className="text-xs font-bold leading-relaxed opacity-80">
                Yêu cầu access token có quyền <strong>pages_messaging</strong> và{" "}
                <strong>pages_read_engagement</strong>. Mọi dữ liệu được mã hóa chuẩn quân đội trước khi lưu
                trữ.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <div className="space-y-4">
              <label className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Lựa chọn nền tảng
              </label>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: "facebook", label: "FACEBOOK", icon: <Facebook className="h-6 w-6" />, color: "bg-accent" },
                  { id: "instagram", label: "INSTAGRAM", icon: <Instagram className="h-6 w-6" />, color: "bg-rose-500" },
                ].map((plt) => (
                  <button
                    key={plt.id}
                    type="button"
                    onClick={() => setPageForm({ ...pageForm, platform: plt.id })}
                    className={`relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-[1.5rem] border-4 p-6 transition-all duration-300 ${
                      pageForm.platform === plt.id
                        ? "scale-105 border-accent bg-white shadow-2xl shadow-accent/15"
                        : "border-slate-50 bg-slate-50 text-slate-400 opacity-60 grayscale hover:opacity-100 hover:grayscale-0"
                    }`}
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white ${plt.color}`}>
                      {plt.icon}
                    </div>
                    <span className="text-[10px] font-black tracking-widest">{plt.label}</span>
                    {pageForm.platform === plt.id && (
                      <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
                        <CheckCircle2 className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <Field
                label="Page / Account ID"
                value={pageForm.page_id}
                onChange={(v) => setPageForm({ ...pageForm, page_id: v })}
                placeholder="Ví dụ: 10459203..."
                icon={<Smartphone className="h-5 w-5" />}
              />
              <Field
                label="Tên hiển thị nội bộ"
                value={pageForm.page_name}
                onChange={(v) => setPageForm({ ...pageForm, page_name: v })}
                placeholder="Shop phụ kiện Hàn Quốc"
                icon={<Store className="h-5 w-5" />}
              />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <label className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                System access token
              </label>
              <textarea
                value={pageForm.page_access_token}
                onChange={(e) => setPageForm({ ...pageForm, page_access_token: e.target.value })}
                rows={4}
                placeholder="Dán token từ Facebook Graph API Explorer (EAAx...)"
                className="w-full rounded-[2rem] border-none bg-slate-50 px-8 py-6 font-mono text-sm font-bold shadow-inner outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-accent"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={() => setShowConnect(false)}
              className="flex-1 rounded-2xl border-2 border-slate-100 bg-white py-4 text-sm font-black uppercase tracking-widest text-slate-400 transition-all hover:bg-slate-50"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={() => connectMutation.mutate()}
              disabled={!pageForm.page_id || !pageForm.page_access_token || connectMutation.isPending}
              className="ai-glow flex flex-[2] items-center justify-center gap-3 rounded-2xl bg-accent py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-2xl shadow-accent/15 transition-all hover:-translate-y-1 hover:bg-accent-hover active:scale-95 disabled:opacity-50"
            >
              {connectMutation.isPending ? (
                <div className="h-5 w-5 animate-spin rounded-full border-3 border-white border-t-transparent" />
              ) : (
                <ExternalLink className="h-5 w-5" />
              )}
              Kích hoạt kết nối
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</label>
      <div className="relative">
        {icon && <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-[1.5rem] border-none bg-slate-50/50 py-4 text-sm font-black text-slate-900 shadow-inner outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-accent ${icon ? "pl-14" : "px-6"}`}
        />
      </div>
    </div>
  );
}
