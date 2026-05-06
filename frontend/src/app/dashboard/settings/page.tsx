"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Script from "next/script";
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
  HelpCircle,
  LogOut,
  CreditCard,
  ScanSearch,
  BookOpen,
  Wallet,
  AlertCircle,
} from "lucide-react";

interface FBAuthResponse {
  accessToken: string;
  userID: string;
  expiresIn: number;
  signedRequest: string;
}

interface FBLoginResponse {
  authResponse: FBAuthResponse | null;
  status: string;
}

interface FBPageData {
  id: string;
  name: string;
  access_token: string;
}

interface FBAccountsResponse {
  data?: FBPageData[];
  error?: { message: string };
}

type FBWindow = Window & {
  fbAsyncInit?: () => void;
  FB?: {
    init: (config: Record<string, unknown>) => void;
    login: (callback: (res: FBLoginResponse) => void, opts: Record<string, string>) => void;
    api: (path: string, callback: (res: FBAccountsResponse) => void) => void;
  };
};

interface PageData {
  id: string;
  page_id: string;
  page_name: string;
  platform: string;
  is_active: boolean;
}

function SettingsContent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [shopName, setShopName] = useState("");
  const [reportHour, setReportHour] = useState(9);
  const [language, setLanguage] = useState("vi");
  const [activeTab, setActiveTab] = useState("workspace");
  const [showConnect, setShowConnect] = useState(false);


  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
    
    const action = searchParams.get("action");
    if (action === "connect-facebook") setShowConnect(true);
  }, [searchParams]);

  useEffect(() => {
    (window as FBWindow).fbAsyncInit = function () {
      (window as FBWindow).FB?.init({
        appId: process.env.NEXT_PUBLIC_META_APP_ID,
        cookie: true,
        xfbml: true,
        version: "v21.0",
      });
    };
  }, []);

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
    mutationFn: (data: Record<string, unknown>) => pagesApi.connectPage(data),
    onSuccess: () => {
      toast("Trang đã được kết nối thành công", "success");
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      setShowConnect(false);
    },
    onError: (err) => toast(formatApiError(err), "error"),
  });

  const handleFacebookLogin = (platform: "facebook" | "instagram" = "facebook") => {
    const fb = (window as FBWindow).FB;
    if (!fb) {
      toast("Facebook SDK chưa được tải, vui lòng tải lại trang.", "error");
      return;
    }

    toast(`Đang mở trang đăng nhập ${platform === "facebook" ? "Facebook" : "Instagram"}...`, "success");
    fb.login(
      function (response: FBLoginResponse) {
        if (response.authResponse) {
          toast("Đang đồng bộ thông tin trang...", "success");
          fb.api("/me/accounts", function (resp: FBAccountsResponse) {
            if (resp && !resp.error && resp.data && resp.data.length > 0) {
              // Lấy trang đầu tiên (nếu có nhiều trang, có thể làm UI chọn trang sau)
              const page = resp.data[0];
              connectMutation.mutate({
                platform: platform,
                page_id: page.id,
                page_name: page.name,
                page_access_token: page.access_token,
              });
            } else {
              toast("Không tìm thấy Fanpage nào hoặc thiếu quyền truy cập.", "error");
            }
          });
        } else {
          toast("Bạn chưa cấp quyền truy cập.", "error");
        }
      },
      { scope: "pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging" }
    );
  };

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
      <Script
        strategy="lazyOnload"
        crossOrigin="anonymous"
        src="https://connect.facebook.net/en_US/sdk.js"
      />
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
              { id: "workspace", label: "Workspace", icon: <Store className="h-5 w-5" /> },
              { id: "channels", label: "Kênh kết nối", icon: <Globe className="h-5 w-5" /> },
              { id: "payment", label: "Thanh toán", icon: <CreditCard className="h-5 w-5" /> },
              { id: "security", label: "Bảo mật", icon: <ShieldCheck className="h-5 w-5" /> },
              { id: "notifications", label: "Thông báo", icon: <Bell className="h-5 w-5" /> },
              { id: "help", label: "Trợ giúp", icon: <HelpCircle className="h-5 w-5" /> },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-sm font-black transition-all ${
                  activeTab === item.id
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
          {activeTab === "workspace" && (
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
          )}

          {activeTab === "channels" && (
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
          )}

          {activeTab === "payment" && (
            <section className="space-y-8">
              <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Phương thức thanh toán</h2>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Cấu hình nhận thanh toán từ khách hàng
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {/* OCR Method */}
                <div className="relative overflow-hidden rounded-[2.5rem] border-2 border-accent bg-white p-8 shadow-xl shadow-accent/10">
                  <div className="absolute right-0 top-0 rounded-bl-[2rem] bg-accent px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-accent/20">
                    Mặc định
                  </div>
                  <div className="flex flex-col gap-6 md:flex-row md:items-start">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] bg-accent-soft text-accent">
                      <ScanSearch className="h-8 w-8" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <h3 className="text-lg font-black text-slate-900">Trợ lý AI Quét ảnh chuyển khoản (OCR)</h3>
                      <p className="text-sm font-medium leading-relaxed text-slate-500">
                        Hệ thống AI tiên tiến sẽ <strong>tự động đọc và xác thực hóa đơn chuyển khoản</strong> thông qua hình ảnh khách hàng gửi trong chat. 
                        Phương thức này được bật sẵn, hoàn toàn miễn phí và không cần cài đặt phức tạp. Giúp bạn chốt đơn nhanh chóng, tiện lợi và tiết kiệm tối đa phí giao dịch.
                      </p>
                      <div className="flex items-center gap-2 pt-2">
                        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600 ring-1 ring-emerald-200">
                          <CheckCircle2 className="h-4 w-4" />
                          Đang hoạt động
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Toss Pay Method */}
                <div className="group relative overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/40 transition-all hover:-translate-y-1 hover:shadow-2xl hover:border-blue-100">
                  <div className="flex flex-col gap-6 md:flex-row md:items-start">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] bg-blue-50 text-blue-600">
                      <Wallet className="h-8 w-8" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <h3 className="text-lg font-black text-slate-900 transition-colors group-hover:text-blue-600">Cổng thanh toán đa kênh (Toss Pay)</h3>
                      <p className="text-sm font-medium leading-relaxed text-slate-500">
                        Nâng tầm trải nghiệm mua sắm với cổng thanh toán toàn diện. Hỗ trợ đa dạng phương thức phổ biến nhất Hàn Quốc bao gồm <strong>Naver Pay, Kakao Pay và Toss</strong>. Giúp tăng tỷ lệ chuyển đổi chốt đơn, cho phép khách hàng thanh toán nhanh chóng chỉ với 1 chạm.
                      </p>
                      
                      <div className="flex flex-col items-start gap-4 pt-4 sm:flex-row sm:items-center">
                        <button className="ai-glow flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95">
                          Thiết lập Toss Pay
                        </button>
                        <a href="#" className="flex items-center gap-2 text-xs font-bold text-slate-400 transition-colors hover:text-blue-600">
                          <BookOpen className="h-4 w-4" />
                          Tài liệu hướng dẫn đăng ký
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      <Modal open={showConnect} onClose={() => setShowConnect(false)} title="Thêm kênh bán hàng mới" size="md">
        <div className="space-y-8">
          <div className="text-center space-y-2 pt-2">
            <h4 className="text-lg font-black text-slate-900">Chọn nền tảng kết nối</h4>
            <p className="text-sm font-medium text-slate-500">
              Salemate sử dụng chuẩn xác thực OAuth an toàn để kết nối với các kênh bán hàng của bạn.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Facebook Button */}
            <button
              type="button"
              onClick={() => handleFacebookLogin("facebook")}
              disabled={connectMutation.isPending}
              className="group relative flex items-center gap-4 overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50 transition-all hover:-translate-y-1 hover:border-[#1877F2]/30 hover:shadow-xl hover:shadow-[#1877F2]/10 disabled:opacity-50"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-[#1877F2] text-white">
                <Facebook className="h-8 w-8" />
              </div>
              <div className="flex-1 text-left">
                <h5 className="font-black text-slate-900 transition-colors group-hover:text-[#1877F2]">Facebook Messenger</h5>
                <p className="mt-0.5 text-xs font-bold text-slate-400">Kết nối Fanpage để trả lời tin nhắn</p>
              </div>
              <div className="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors group-hover:bg-[#1877F2] group-hover:text-white">
                <ExternalLink className="h-4 w-4" />
              </div>
            </button>

            {/* Instagram Button */}
            <button
              type="button"
              onClick={() => handleFacebookLogin("instagram")}
              disabled={connectMutation.isPending}
              className="group relative flex items-center gap-4 overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50 transition-all hover:-translate-y-1 hover:border-rose-300 hover:shadow-xl hover:shadow-rose-500/10 disabled:opacity-50"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 text-white">
                <Instagram className="h-8 w-8" />
              </div>
              <div className="flex-1 text-left">
                <h5 className="font-black text-slate-900 transition-colors group-hover:text-rose-500">Instagram Direct</h5>
                <p className="mt-0.5 text-xs font-bold text-slate-400">Quản lý tin nhắn IG tự động</p>
              </div>
              <div className="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors group-hover:bg-rose-500 group-hover:text-white">
                <ExternalLink className="h-4 w-4" />
              </div>
            </button>
          </div>

          {/* Fanpage Notice */}
          <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-800">Chỉ hỗ trợ Facebook Page (Fanpage)</p>
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-amber-700">
                  Salemate kết nối với <strong>Fanpage doanh nghiệp</strong>, không phải tài khoản cá nhân. Nếu bạn đang bán qua profile cá nhân, hãy tạo một Fanpage — hoàn toàn miễn phí và giúp bạn tiếp cận nhiều khách hàng hơn qua Facebook Ads.
                </p>
                <a
                  href="https://www.facebook.com/pages/create"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-black text-amber-700 underline underline-offset-2 hover:text-amber-900"
                >
                  <ExternalLink className="h-3 w-3" />
                  Tạo Fanpage miễn phí ngay →
                </a>
              </div>
            </div>
          </div>

          {/* Security note */}
          <div className="rounded-[1.5rem] bg-slate-50 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <p className="text-xs font-bold text-slate-700">Kết nối an toàn &amp; bảo mật</p>
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">
                  Chúng tôi không bao giờ lưu trữ mật khẩu của bạn. Mọi quyền truy cập đều tuân thủ chính sách bảo vệ dữ liệu nghiêm ngặt của Meta.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Đang tải cài đặt...</div>}>
      <SettingsContent />
    </Suspense>
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
