"use client";

import { useState } from "react";
import { Bot, X, ChevronRight, Facebook, CreditCard, Sparkles, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewType = "home" | "facebook" | "toss" | "features";

export function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<ViewType>("home");

  const views = {
    home: (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
        <p className="text-sm text-ink-muted leading-relaxed">
          Chào bạn! Mình là trợ lý Salemate. Bạn cần mình hướng dẫn về phần nào?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setView("facebook")}
            className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-neutral-50 transition border border-black/5 text-left group"
          >
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Facebook className="w-4 h-4 text-blue-600" />
            </div>
            <span className="flex-1 text-sm font-medium text-ink group-hover:text-blue-600 transition">
              Cách kết nối Facebook
            </span>
            <ChevronRight className="w-4 h-4 text-ink-muted opacity-0 group-hover:opacity-100 transition" />
          </button>
          
          <button
            onClick={() => setView("toss")}
            className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-neutral-50 transition border border-black/5 text-left group"
          >
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4 text-blue-600" />
            </div>
            <span className="flex-1 text-sm font-medium text-ink group-hover:text-blue-600 transition">
              Đăng ký và thiết lập Toss Pay
            </span>
            <ChevronRight className="w-4 h-4 text-ink-muted opacity-0 group-hover:opacity-100 transition" />
          </button>

          <button
            onClick={() => setView("features")}
            className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-neutral-50 transition border border-black/5 text-left group"
          >
            <div className="w-8 h-8 rounded-full bg-accent-soft flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <span className="flex-1 text-sm font-medium text-ink group-hover:text-accent transition">
              Các tính năng nổi bật
            </span>
            <ChevronRight className="w-4 h-4 text-ink-muted opacity-0 group-hover:opacity-100 transition" />
          </button>
        </div>
      </div>
    ),
    facebook: (
      <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
        <button 
          onClick={() => setView("home")}
          className="text-xs font-medium text-ink-muted hover:text-ink flex items-center gap-1"
        >
          <ChevronRight className="w-3 h-3 rotate-180" /> Quay lại
        </button>
        <div className="prose prose-sm prose-blue leading-relaxed text-ink-muted">
          <h4 className="text-ink font-bold text-base m-0 mb-2">Kết nối Facebook</h4>
          <ol className="pl-4 space-y-2 m-0">
            <li>Truy cập mục <strong>Kết nối Facebook</strong> ở menu bên trái.</li>
            <li>Nhấp vào nút <strong>Tiếp tục với Facebook</strong>.</li>
            <li>Đăng nhập vào tài khoản Facebook của bạn.</li>
            <li>Chọn các Trang (Pages) mà bạn muốn Salemate quản lý.</li>
            <li>Cấp các quyền cần thiết để AI có thể đọc và trả lời tin nhắn thay bạn.</li>
          </ol>
          <p className="mt-3 text-xs bg-blue-50 p-2 rounded-lg text-blue-700">
            <strong>Lưu ý:</strong> Đảm bảo tài khoản Facebook của bạn có quyền Quản trị viên (Admin) trên Trang đó.
          </p>
        </div>
      </div>
    ),
    toss: (
      <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
        <button 
          onClick={() => setView("home")}
          className="text-xs font-medium text-ink-muted hover:text-ink flex items-center gap-1"
        >
          <ChevronRight className="w-3 h-3 rotate-180" /> Quay lại
        </button>
        <div className="prose prose-sm prose-blue leading-relaxed text-ink-muted">
          <h4 className="text-ink font-bold text-base m-0 mb-2">Thiết lập Toss Pay</h4>
          <p className="m-0 mb-2">Để khách hàng có thể thanh toán tự động qua Toss, bạn cần cung cấp API Keys từ Toss Developers.</p>
          <ol className="pl-4 space-y-2 m-0">
            <li>Truy cập <a href="https://developers.tosspayments.com" target="_blank" rel="noreferrer" className="text-blue-600 font-medium">Toss Developer Portal</a>.</li>
            <li>Tạo một dự án mới cho cửa hàng của bạn.</li>
            <li>Lấy <strong>Client Key</strong> và <strong>Secret Key</strong> trong phần API Keys.</li>
            <li>Vào mục <strong>Cài đặt</strong> trên Salemate và dán các mã khóa này vào phần Cấu hình Thanh toán.</li>
          </ol>
        </div>
      </div>
    ),
    features: (
      <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
        <button 
          onClick={() => setView("home")}
          className="text-xs font-medium text-ink-muted hover:text-ink flex items-center gap-1"
        >
          <ChevronRight className="w-3 h-3 rotate-180" /> Quay lại
        </button>
        <div className="prose prose-sm prose-blue leading-relaxed text-ink-muted">
          <h4 className="text-ink font-bold text-base m-0 mb-2">Tính năng của Salemate</h4>
          <ul className="pl-4 space-y-2 m-0">
            <li><strong>AI Sales Agent:</strong> Tự động trả lời tin nhắn Facebook, tư vấn sản phẩm và tạo đơn hàng ngay trong khung chat.</li>
            <li><strong>Nhận diện hóa đơn:</strong> AI có thể đọc ảnh chụp màn hình thanh toán để xác nhận giao dịch.</li>
            <li><strong>Thanh toán Toss:</strong> Tích hợp link thanh toán nội địa Hàn nhanh chóng.</li>
            <li><strong>Quản lý đơn & tồn kho:</strong> Đồng bộ dữ liệu theo thời gian thực giúp bạn không bỏ sót bất kỳ đơn hàng nào.</li>
          </ul>
        </div>
      </div>
    )
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-xl shadow-ink/20 transition-all hover:scale-105 active:scale-95",
          isOpen && "scale-0 opacity-0 pointer-events-none"
        )}
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Chat Window */}
      <div
        className={cn(
          "fixed bottom-8 right-8 z-50 w-[360px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 transition-all duration-300 origin-bottom-right",
          isOpen ? "flex scale-100 opacity-100" : "scale-90 opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-ink px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">Hướng dẫn sử dụng</p>
              <p className="text-[11px] text-white/70">Trợ lý AI Salemate</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsOpen(false);
              setTimeout(() => setView("home"), 300); // Reset view after closing animation
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[400px] overflow-y-auto">
          {views[view]}
        </div>
        
        {/* Footer */}
        {view === "home" && (
          <div className="bg-neutral-50 p-4 border-t border-black/5 text-center">
            <p className="text-[11px] text-ink-muted">
              Được tự động hóa bởi AI Salemate
            </p>
          </div>
        )}
      </div>
    </>
  );
}
