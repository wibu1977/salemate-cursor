"use client";

import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  MessageSquare,
  Zap,
  TrendingUp,
  ShieldCheck,
  Globe,
  ChevronRight,
  Play,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-surface-page font-sans">
      <nav className="fixed top-0 z-50 w-full border-b border-black/[0.06] bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 sm:px-12">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
              <Sparkles className="h-6 w-6" />
            </div>
            <span className="text-xl font-black tracking-tight text-ink">
              Sale<span className="text-accent">mate</span>
            </span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <Link
              href="#features"
              className="text-xs font-black uppercase tracking-widest text-ink-muted transition-colors hover:text-accent"
            >
              Tính năng
            </Link>
            <Link
              href="#how-it-works"
              className="text-xs font-black uppercase tracking-widest text-ink-muted transition-colors hover:text-accent"
            >
              Quy trình
            </Link>
            <Link
              href="/login"
              className="rounded-xl bg-surface-page px-6 py-2.5 text-xs font-black uppercase tracking-widest text-ink transition-all hover:bg-black/[0.04]"
            >
              Đăng nhập
            </Link>
            <Link
              href="/login"
              className="ai-glow rounded-xl bg-accent px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-accent/25 transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
            >
              Bắt đầu ngay
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative pb-32 pt-40 sm:pb-48 sm:pt-56">
        <div className="absolute left-1/2 top-0 w-full max-w-7xl -translate-x-1/2 px-6 sm:px-12">
          <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-accent-soft blur-[120px]" />
          <div className="absolute right-[-6rem] top-48 h-96 w-96 rounded-full bg-accent-soft blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 text-center sm:px-12">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-accent">
            <Zap className="h-3.5 w-3.5" />
            AI-POWERED SOCIAL CRM FOR SMEs
          </div>
          <h1 className="mx-auto max-w-4xl text-5xl font-[1000] leading-[1.05] tracking-tight text-ink sm:text-7xl lg:text-8xl">
            Bán hàng tự động trên{" "}
            <span className="bg-gradient-to-r from-accent to-accent-muted bg-clip-text italic text-transparent">
              Mọi Nền Tảng
            </span>
          </h1>
          <p className="mx-auto mt-10 max-w-2xl text-lg font-medium leading-relaxed text-ink-muted sm:text-xl">
            Biến tin nhắn thành đơn hàng với trợ lý AI thông minh. Tự động trả lời, quản lý tồn kho và chăm sóc khách hàng 24/7.
          </p>
          <div className="mt-12 flex flex-col items-center justify-center gap-6 sm:flex-row">
            <Link
              href="/login"
              className="ai-glow group flex items-center gap-3 rounded-2xl bg-accent px-10 py-5 text-sm font-black uppercase tracking-[0.2em] text-white shadow-2xl shadow-accent/20 transition-all hover:-translate-y-1 hover:bg-accent-hover active:scale-95"
            >
              TRẢI NGHIỆM MIỄN PHÍ
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <button
              type="button"
              className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-10 py-5 text-sm font-black uppercase tracking-[0.2em] text-ink shadow-sm transition-all hover:bg-surface-page hover:shadow-lg active:scale-95"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
                <Play className="ml-0.5 h-3 w-3 fill-white" />
              </div>
              XEM DEMO
            </button>
          </div>

          <div className="mt-20 flex flex-col items-center gap-6">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              TIN DÙNG BỞI HƠN 500+ CHỦ SHOP TẠI HÀN QUỐC
            </p>
            <div className="flex flex-wrap justify-center gap-8 opacity-40 grayscale contrast-125">
              <div className="text-xl font-black text-ink">META</div>
              <div className="text-xl font-black text-ink">STRIPE</div>
              <div className="text-xl font-black text-ink">SHOPIFY</div>
              <div className="text-xl font-black text-ink">KAKAO</div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="relative bg-white py-32 sm:py-48">
        <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-100 to-transparent" />
        <div className="mx-auto max-w-7xl px-6 sm:px-12">
          <div className="mb-24 text-center">
            <h2 className="mb-4 text-[10px] font-black uppercase tracking-[0.3em] text-accent">CÔNG NGHỆ ĐỘT PHÁ</h2>
            <h3 className="text-4xl font-[900] tracking-tight text-ink sm:text-5xl">Mọi thứ bạn cần để tăng trưởng</h3>
          </div>

          <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<MessageSquare className="h-8 w-8" />}
              title="AI Chat Agent"
              desc="Tự động tư vấn và chốt đơn theo kịch bản cá nhân hóa cho từng khách hàng."
              color="text-accent"
              bg="bg-accent-soft"
            />
            <FeatureCard
              icon={<Zap className="h-8 w-8" />}
              title="Quản lý tồn kho"
              desc="Đồng bộ kho hàng tự động mỗi khi có đơn hàng mới phát sinh từ Messenger."
              color="text-amber-600"
              bg="bg-amber-50"
            />
            <FeatureCard
              icon={<TrendingUp className="h-8 w-8" />}
              title="AI Outreach"
              desc="Tự động gửi tin nhắn chăm sóc khách hàng cũ để tăng tỷ lệ quay lại."
              color="text-emerald-600"
              bg="bg-emerald-50"
            />
            <FeatureCard
              icon={<ShieldCheck className="h-8 w-8" />}
              title="Thanh toán an toàn"
              desc="Tích hợp các cổng thanh toán phổ biến tại Hàn Quốc với độ bảo mật cao."
              color="text-blue-600"
              bg="bg-blue-50"
            />
            <FeatureCard
              icon={<Globe className="h-8 w-8" />}
              title="Đa ngôn ngữ"
              desc="Hỗ trợ tiếng Việt và tiếng Hàn mượt mà, phá bỏ rào cản ngôn ngữ."
              color="text-slate-700"
              bg="bg-slate-100"
            />
            <FeatureCard
              icon={<Sparkles className="h-8 w-8" />}
              title="Báo cáo thông minh"
              desc="Phân tích hành vi khách hàng và đề xuất chiến lược kinh doanh tối ưu."
              color="text-rose-600"
              bg="bg-rose-50"
            />
          </div>
        </div>
      </section>

      <section className="py-32 sm:py-48">
        <div className="mx-auto max-w-7xl px-6 sm:px-12">
          <div className="relative overflow-hidden rounded-[4rem] bg-slate-900 px-12 py-24 text-center shadow-[0_40px_100px_-20px_rgba(255,87,51,0.25)]">
            <div className="absolute right-0 top-0 h-96 w-96 translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-[100px]" />
            <div className="absolute bottom-0 left-0 h-96 w-96 -translate-x-1/2 translate-y-1/2 rounded-full bg-accent/10 blur-[100px]" />

            <div className="relative z-10 space-y-10">
              <h2 className="mx-auto max-w-2xl text-4xl font-black leading-tight tracking-tight text-white sm:text-6xl">
                Sẵn sàng để <span className="font-[1000] italic text-accent-muted">Bứt Phá</span> doanh thu?
              </h2>
              <p className="mx-auto max-w-lg text-lg font-medium text-slate-400">
                Tham gia cùng hàng trăm chủ shop đang thay đổi cách kinh doanh với Salemate. Miễn phí khởi tạo, không cam kết.
              </p>
              <div className="flex flex-col items-center justify-center gap-6 pt-6 sm:flex-row">
                <Link
                  href="/login"
                  className="ai-glow group flex items-center gap-4 rounded-2xl bg-white px-12 py-6 text-sm font-black uppercase tracking-[0.2em] text-ink shadow-2xl transition-all hover:-translate-y-1 hover:bg-slate-50 active:scale-95"
                >
                  BẮT ĐẦU NGAY BÂY GIỜ
                  <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <button
                  type="button"
                  className="text-sm font-black uppercase tracking-[0.2em] text-white transition-colors hover:text-accent-muted"
                >
                  LIÊN HỆ TƯ VẤN 1:1
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-white px-6 py-20 sm:px-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-12 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-xl font-black tracking-tight text-ink">
              Sale<span className="text-accent">mate</span>
            </span>
          </div>
          <div className="flex gap-10">
            <Link href="#" className="text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-accent">
              Điều khoản
            </Link>
            <Link href="#" className="text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-accent">
              Bảo mật
            </Link>
            <Link href="#" className="text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-accent">
              Liên hệ
            </Link>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">©2024 SALEMATE KOREA. ALL RIGHTS RESERVED.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  color,
  bg,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[3rem] border border-black/[0.06] bg-surface-page p-10 transition-all hover:-translate-y-2 hover:border-accent/25 hover:shadow-2xl hover:shadow-accent/10">
      <div
        className={`mb-8 flex h-16 w-16 items-center justify-center rounded-[1.5rem] shadow-sm transition-all group-hover:rotate-3 group-hover:scale-110 ${bg} ${color}`}
      >
        {icon}
      </div>
      <h4 className="mb-4 text-xl font-black uppercase tracking-tight text-ink transition-colors group-hover:text-accent">{title}</h4>
      <p className="text-base font-medium leading-relaxed text-ink-muted">{desc}</p>
      <div className="mt-8 flex translate-y-4 items-center gap-2 text-[10px] font-black uppercase tracking-widest text-accent opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
        Tìm hiểu thêm
        <ChevronRight className="h-3 w-3" />
      </div>
    </div>
  );
}
