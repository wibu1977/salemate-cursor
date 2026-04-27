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
  Plus, 
  Trash2, 
  ShieldCheck, 
  Settings,
  Clock,
  ExternalLink,
  Info,
  ChevronRight,
  Zap,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Lock,
  Mail,
  HelpCircle,
  LogOut
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
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-[2rem] bg-slate-900 text-white shadow-2xl shadow-slate-200">
            <Settings className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Cài đặt</h1>
            <p className="mt-1 text-base font-medium text-slate-500">Cấu hình hệ thống và quản lý các kênh bán hàng</p>
          </div>
        </div>
        <button className="flex items-center gap-2 rounded-2xl bg-rose-50 px-6 py-3 text-sm font-black text-rose-600 transition-all hover:bg-rose-100 active:scale-95">
          <LogOut className="h-4 w-4" />
          ĐĂNG XUẤT
        </button>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        {/* Left Nav */}
        <div className="lg:col-span-3 space-y-3">
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

        {/* Right Content */}
        <div className="lg:col-span-9 space-y-10">
          {/* Workspace Settings */}
          <section className="card-premium relative overflow-hidden space-y-8 border-slate-100 bg-white p-10 shadow-2xl shadow-slate-200/50">
            <div className="absolute right-0 top-0 h-40 w-40 bg-accent-soft/30 blur-3xl rounded-full" />
            
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">Cấu hình Workspace</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Thông tin cơ bản về thương hiệu của bạn</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
              <Field 
                label="Tên Thương hiệu / Cửa hàng"
                value={shopName}
                onChange={setShopName}
                placeholder="Ví dụ: Salemate Premium Store"
                icon={<Store className="h-5 w-5" />}
              />

              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Ngôn ngữ hệ thống</label>
                  <div className="relative">
                    <Globe className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full appearance-none rounded-[1.5rem] border-none bg-slate-50/50 pl-14 pr-10 py-4 text-sm font-black text-slate-900 shadow-inner outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-accent cursor-pointer"
                    >
                      <option value="vi">Tiếng Việt</option>
                      <option value="ko">Tiếng Hàn (한국어)</option>
                      <option value="en">English (US)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Giờ nhận báo cáo AI</label>
                  <div className="relative">
                    <Clock className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <select
                      value={reportHour}
                      onChange={(e) => setReportHour(Number(e.target.value))}
                      className="w-full appearance-none rounded-[1.5rem] border-none bg-slate-50/50 pl-14 pr-10 py-4 text-sm font-black text-slate-900 shadow-inner outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-accent cursor-pointer"
                    >
                      {Array.from({ length: 24 }).map((_, h) => (
                        <option key={h} value={h}>{h.toString().padStart(2, "0")}:00 KST (Giờ Hàn Quốc)</option>
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
                className="ai-glow flex w-full items-center justify-center gap-3 rounded-2xl bg-accent py-5 text-sm font-black text-white shadow-2xl shadow-accent/15 transition-all hover:bg-accent-hover hover:-translate-y-1 active:scale-95 disabled:opacity-50 uppercase tracking-[0.2em]"
              >
                {saveMutation.isPending ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-3 border-white border-t-transparent" />
                ) : <CheckCircle2 className="h-5 w-5" />}
                LƯU CẤU HÌNH WORKSPACE
              </button>
            </div>
          </section>

          {/* Social Channels Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                  <Zap className="h-5 w-5" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Kênh kết nối Facebook/Instagram</h2>
              </div>
              <button 
                onClick={() => setShowConnect(true)} 
                className="btn-premium px-6 py-3 text-[10px] tracking-widest"
              >
                KẾT NỐI MỚI
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {pages?.length ? (
                pages.map((p: PageData) => (
                  <div key={p.id} className="group relative overflow-hidden rounded-[2.5rem] bg-white p-8 border border-slate-100 shadow-xl shadow-slate-200/40 transition-all hover:shadow-2xl hover:-translate-y-1">
                    <div className="flex items-start justify-between mb-8">
                      <div className={`flex h-16 w-16 items-center justify-center rounded-[1.25rem] shadow-lg ${
                        p.platform === 'facebook' ? 'bg-accent text-white shadow-accent/15' : 'bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 text-white shadow-rose-100'
                      }`}>
                        {p.platform === 'facebook' ? <Facebook className="h-8 w-8" /> : <Instagram className="h-8 w-8" />}
                      </div>
                      <div className={`rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest ${
                        p.is_active ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200' : 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
                      }`}>
                        {p.is_active ? 'ACTIVE' : 'OFFLINE'}
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xl font-black text-slate-900 group-hover:text-accent transition-colors">{p.page_name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {p.page_id}</p>
                      </div>
                      <div className="flex gap-3 pt-4 border-t border-slate-50">
                        <button 
                          className="flex-1 rounded-xl bg-slate-50 py-3 text-xs font-black text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900"
                        >
                          CẤU HÌNH
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
                <div className="md:col-span-2 flex flex-col items-center justify-center py-20 rounded-[2.5rem] border-4 border-dashed border-slate-100 bg-slate-50/30">
                  <Globe className="h-12 w-12 text-slate-200 mb-4" />
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest text-center">Chưa có kênh nào được kích hoạt.<br/><span className="text-[10px] opacity-70">Bắt đầu bằng cách kết nối Fanpage của bạn</span></p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Connect Modal */}
      <Modal open={showConnect} onClose={() => setShowConnect(false)} title="KẾT NỐI NỀN TẢNG MỚI" size="lg">
        <div className="space-y-10">
          <div className="flex items-start gap-6 rounded-[2rem] bg-accent p-8 text-white shadow-2xl shadow-accent/15">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
              <Lock className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-black uppercase tracking-wider">Cấu hình API Bảo mật</h4>
              <p className="text-xs font-bold leading-relaxed opacity-80">
                Yêu cầu Access Token có quyền <strong>pages_messaging</strong> và <strong>pages_read_engagement</strong>. Mọi dữ liệu được mã hóa chuẩn quân đội trước khi lưu trữ
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Lựa chọn nền tảng</label>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: 'facebook', label: 'FACEBOOK', icon: <Facebook className="h-6 w-6" />, color: 'bg-accent' },
                  { id: 'instagram', label: 'INSTAGRAM', icon: <Instagram className="h-6 w-6" />, color: 'bg-rose-500' },
                ].map((plt) => (
                  <button
                    key={plt.id}
                    onClick={() => setPageForm({ ...pageForm, platform: plt.id })}
                    className={`relative overflow-hidden flex flex-col items-center justify-center gap-4 rounded-[1.5rem] border-4 p-6 transition-all duration-300 ${
                      pageForm.platform === plt.id 
                        ? 'border-accent bg-white shadow-2xl shadow-accent/15 scale-105' 
                        : 'border-slate-50 bg-slate-50 text-slate-400 grayscale opacity-60 hover:opacity-100 hover:grayscale-0'
                    }`}
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white ${plt.color}`}>
                      {plt.icon}
                    </div>
                    <span className="text-[10px] font-black tracking-widest">{plt.label}</span>
                    {pageForm.platform === plt.id && (
                      <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
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
                placeholder="Shop Phụ kiện Hàn Quốc"
                icon={<Store className="h-5 w-5" />}
              />
            </div>

            <div className="lg:col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">System Access Token</label>
              <textarea
                value={pageForm.page_access_token}
                onChange={(e) => setPageForm({ ...pageForm, page_access_token: e.target.value })}
                rows={4}
                placeholder="Dán token từ Facebook Graph API Explorer (EAAx...)"
                className="w-full rounded-[2rem] border-none bg-slate-50 py-6 px-8 text-sm font-mono font-bold shadow-inner outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-accent"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-6">
            <button
              onClick={() => setShowConnect(false)}
              className="flex-1 rounded-2xl bg-white border-2 border-slate-100 py-4 text-sm font-black text-slate-400 transition-all hover:bg-slate-50 uppercase tracking-widest"
            >
              Hủy bỏ
            </button>
            <button
              onClick={() => connectMutation.mutate()}
              disabled={!pageForm.page_id || !pageForm.page_access_token || connectMutation.isPending}
              className="ai-glow flex-[2] flex items-center justify-center gap-3 rounded-2xl bg-accent py-4 text-sm font-black text-white shadow-2xl shadow-accent/15 transition-all hover:bg-accent-hover hover:-translate-y-1 active:scale-95 disabled:opacity-50 uppercase tracking-[0.2em]"
            >
              {connectMutation.isPending ? (
                <div className="h-5 w-5 animate-spin rounded-full border-3 border-white border-t-transparent" />
              ) : <ExternalLink className="h-5 w-5" />}
              Kích hoạt kết nối
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, icon
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">{label}</label>
      <div className="relative">
        {icon && (
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-[1.5rem] border-none bg-slate-50/50 ${icon ? 'pl-14' : 'px-6'} py-4 text-sm font-black text-slate-900 shadow-inner outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-accent`}
        />
      </div>
    </div>
  );
}
