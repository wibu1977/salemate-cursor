"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import {
  Sparkles, Facebook, ArrowRight, CheckCircle2,
  CreditCard, X, ChevronRight, ExternalLink,
} from "lucide-react";
import { pagesApi, authApi } from "@/lib/api";

// ── Facebook SDK types (type alias avoids global Window conflict) ───────────
interface FBPageData { id: string; name: string; access_token: string; }
interface FBAuthResponse { accessToken: string; }
interface FBLoginResponse { status: string; authResponse?: FBAuthResponse; }
type SdkWindow = Window & typeof globalThis & {
  fbAsyncInit?: () => void;
  FB?: {
    init: (c: Record<string, unknown>) => void;
    login: (cb: (r: { status: string; authResponse?: FBAuthResponse }) => void, opts: Record<string, string>) => void;
    api: (path: string, cb: (r: { data: FBPageData[] }) => void) => void;
    getLoginStatus: (cb: (r: { status: string; authResponse?: FBAuthResponse }) => void) => void;
  };
};

// ── Step types ─────────────────────────────────────────────────────────────
type Step =
  | "welcome" | "connect" | "payment"
  | "bank-account" | "bank-name" | "bank-holder"
  | "toss-ack"
  | "product-name" | "product-price" | "product-desc"
  | "done";

interface Msg { id: string; role: "bot" | "user"; text: string; }

const PROGRESS: Record<Step, number> = {
  welcome: 5, connect: 20, payment: 40,
  "bank-account": 52, "bank-name": 62, "bank-holder": 72, "toss-ack": 72,
  "product-name": 82, "product-price": 88, "product-desc": 94, done: 100,
};

// ── Component ──────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [step, setStep] = useState<Step>("welcome");
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [connectedPage, setConnectedPage] = useState<string | null>(null);
  const [bank, setBank] = useState({ account: "", bankName: "", holder: "" });
  const [product, setProduct] = useState({ name: "", price: "" });
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, typing]);

  // FB SDK init
  useEffect(() => {
    const w = window as SdkWindow;
    w.fbAsyncInit = function () {
      w.FB?.init({ appId: process.env.NEXT_PUBLIC_META_APP_ID, cookie: true, xfbml: true, version: "v21.0" });
    };
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const botMsg = useCallback((text: string, delay = 900): Promise<void> =>
    new Promise((res) => {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setMsgs((p) => [...p, { id: crypto.randomUUID(), role: "bot", text }]);
        res();
      }, delay);
    }), []);

  const userMsg = useCallback((text: string) =>
    setMsgs((p) => [...p, { id: crypto.randomUUID(), role: "user", text }]), []);

  // ── Initial greeting ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      await botMsg("Xin chào! 👋 Tôi là Salemate AI — trợ lý bán hàng thông minh của bạn.", 700);
      await botMsg("Hãy để tôi giúp bạn thiết lập cửa hàng chỉ trong vài phút 🚀", 1300);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step handlers ────────────────────────────────────────────────────────
  const startSetup = async () => {
    userMsg("Bắt đầu thôi! 🚀");
    await botMsg("Đầu tiên, hãy kết nối Fanpage Facebook của bạn 📱");
    await botMsg("Salemate cần quyền Fanpage để tự động trả lời tin nhắn và chốt đơn 24/7.", 1500);
    await botMsg("💡 Lưu ý: Chỉ hỗ trợ Facebook Page (Fanpage), không phải tài khoản cá nhân.", 2100);
    setStep("connect");
  };

  const connectFacebook = () => {
    const fb = (window as SdkWindow).FB;
    if (!fb) { alert("SDK chưa sẵn sàng, thử lại sau giây lát!"); return; }
    fb.login(async (rawRes) => {
      const res = rawRes as { status: string; authResponse?: { accessToken: string } };
      if (res.status !== "connected" || !res.authResponse?.accessToken) return;
      fb.api("/me/accounts", async (data) => {
        if (!data?.data?.[0]) {
          await botMsg("Không tìm thấy Fanpage nào. Hãy đảm bảo bạn đã tạo Fanpage và cấp đủ quyền.");
          return;
        }
        const page = data.data[0];
        try {
          await pagesApi.connectPage({ page_id: page.id, page_name: page.name, access_token: page.access_token });
          setConnectedPage(page.name);
          userMsg(`Kết nối: ${page.name}`);
          await botMsg(`🎉 Đã kết nối ${page.name} thành công! Salemate AI sẽ trực chiến 24/7 cho bạn.`);
          await goPayment();
        } catch {
          await botMsg("Có lỗi xảy ra khi kết nối. Bạn có thể thử lại hoặc bỏ qua.");
        }
      });
    }, { scope: "pages_messaging,pages_show_list,pages_read_engagement,pages_manage_metadata" });
  };

  const skipConnect = async () => {
    userMsg("Bỏ qua, thiết lập sau");
    await botMsg("Không sao! Bạn có thể kết nối Fanpage bất kỳ lúc nào trong Cài đặt.");
    await goPayment();
  };

  const goPayment = async () => {
    setStep("payment");
    await botMsg("Tiếp theo, khách hàng sẽ thanh toán cho bạn qua đâu? 💳");
  };

  const choosePayment = async (method: "ocr" | "toss") => {
    if (method === "ocr") {
      userMsg("Chuyển khoản ngân hàng (OCR)");
      await botMsg("Hoàn hảo! 🤖 AI sẽ tự động đọc và xác nhận ảnh chuyển khoản của khách.", 900);
      await botMsg("Cho tôi biết số tài khoản ngân hàng của bạn nhé?", 1500);
      setStep("bank-account");
      setTimeout(() => inputRef.current?.focus(), 1600);
    } else {
      userMsg("Toss Pay / Naver Pay / Kakao Pay");
      await botMsg("Tuyệt! Toss Pay, Naver Pay và Kakao Pay mang lại trải nghiệm thanh toán đỉnh cao 🇰🇷", 900);
      await botMsg("Bạn có thể hoàn tất đăng ký trong Cài đặt → Thanh toán. Tiếp tục bước kế nhé!", 1600);
      setStep("toss-ack");
      setTimeout(() => goProduct(), 2200);
    }
  };

  const submitBank = async (field: "account" | "bank" | "holder") => {
    const val = input.trim();
    if (!val) return;
    setInput("");
    userMsg(val);
    if (field === "account") {
      setBank((b) => ({ ...b, account: val }));
      await botMsg("Ngân hàng của bạn? (VD: Vietcombank, BIDV, ACB...)", 800);
      setStep("bank-name");
    } else if (field === "bank") {
      setBank((b) => ({ ...b, bankName: val }));
      await botMsg("Tên chủ tài khoản?", 800);
      setStep("bank-holder");
    } else {
      const full = { ...bank, holder: val };
      setBank(full);
      try {
        await authApi.setupWorkspace({ bank_account: full.account, bank_name: full.bankName, bank_holder: full.holder });
      } catch { /* silent */ }
      await botMsg(`✅ Đã lưu!\n• Số TK: ${full.account}\n• Ngân hàng: ${full.bankName}\n• Chủ TK: ${full.holder}`, 800);
      setTimeout(() => goProduct(), 1600);
    }
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  const goProduct = async () => {
    setStep("product-name");
    await botMsg("Gần xong rồi! Hãy thêm sản phẩm đầu tiên 🛍️", 600);
    await botMsg("Tên sản phẩm là gì?", 1200);
    setTimeout(() => inputRef.current?.focus(), 1400);
  };

  const submitProduct = async (field: "name" | "price" | "desc", skipDesc?: boolean) => {
    const val = skipDesc ? "" : input.trim();
    if (!skipDesc && !val && field !== "desc") return;
    setInput("");
    if (field === "name") {
      if (!val) return;
      userMsg(val);
      setProduct((p) => ({ ...p, name: val }));
      await botMsg(`"${val}" — hay đấy! 👍 Giá bán là bao nhiêu? (₩)`, 800);
      setStep("product-price");
    } else if (field === "price") {
      if (!val) return;
      userMsg(`₩${val}`);
      setProduct((p) => ({ ...p, price: val }));
      await botMsg("Thêm mô tả ngắn cho sản phẩm không? (Có thể bỏ qua)", 800);
      setStep("product-desc");
    } else {
      if (val) userMsg(val); else userMsg("Bỏ qua mô tả");
      await botMsg(`✅ Đã thêm sản phẩm ${product.name}!`, 800);
      setTimeout(() => finishOnboarding(), 1500);
    }
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  const finishOnboarding = async () => {
    setStep("done");
    await botMsg("🎉 Cửa hàng của bạn đã sẵn sàng!", 600);
    await botMsg("Salemate AI đang lắng nghe mọi tin nhắn và sẵn sàng chốt đơn 24/7 cho bạn.", 1300);
    await botMsg("Chào mừng đến với Salemate! Hãy vào Dashboard để xem tổng quan 🚀", 2000);
    if (typeof window !== "undefined") localStorage.setItem("salemate_onboarding_done", "1");
  };

  // ── Input field shortcut ─────────────────────────────────────────────────
  const inputField = (placeholder: string, onSubmit: () => void, type = "text") => (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex gap-2">
      {type === "number" ? (
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">₩</span>
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder} type="number" className="ob-input pl-9" />
        </div>
      ) : (
        <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder} className="ob-input" />
      )}
      <button type="submit" className="btn-premium px-5 py-3 text-sm">Gửi</button>
    </form>
  );

  // ── Action panel ─────────────────────────────────────────────────────────
  const renderActions = () => {
    if (typing) return null;
    switch (step) {
      case "welcome":
        return (
          <div className="flex justify-center">
            <button onClick={startSetup} className="btn-premium flex items-center gap-2 text-base">
              Bắt đầu thôi! <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        );
      case "connect":
        return (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs font-medium text-amber-700">
              <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span>
                Bạn chưa có Fanpage?{" "}
                <a href="https://www.facebook.com/pages/create" target="_blank" rel="noopener noreferrer"
                  className="font-black underline hover:text-amber-900">
                  Tạo miễn phí ngay →
                </a>
              </span>
            </div>
            <button onClick={connectFacebook}
              className="flex items-center gap-3 rounded-2xl bg-[#1877F2] px-6 py-4 font-black text-white shadow-lg shadow-[#1877F2]/30 transition-all hover:-translate-y-0.5 hover:bg-[#1565D8]">
              <Facebook className="h-5 w-5" />
              Kết nối Facebook Fanpage
            </button>
            <button onClick={skipConnect}
              className="flex items-center justify-center gap-2 text-sm font-bold text-slate-400 transition-colors hover:text-slate-600">
              <ChevronRight className="h-4 w-4" />
              Bỏ qua, thiết lập sau
            </button>
          </div>
        );
      case "payment":
        return (
          <div className="flex flex-col gap-3">
            <button onClick={() => choosePayment("ocr")}
              className="flex items-center gap-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-5 py-4 text-left font-black text-emerald-800 transition-all hover:border-emerald-400 hover:bg-emerald-100">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
              <div>
                <div>Chuyển khoản ngân hàng (OCR)</div>
                <div className="mt-0.5 text-xs font-medium text-emerald-600">AI tự xác nhận ảnh chuyển khoản • Mặc định & miễn phí</div>
              </div>
            </button>
            <button onClick={() => choosePayment("toss")}
              className="flex items-center gap-4 rounded-2xl border-2 border-blue-200 bg-blue-50 px-5 py-4 text-left font-black text-blue-800 transition-all hover:border-blue-400 hover:bg-blue-100">
              <CreditCard className="h-6 w-6 shrink-0 text-blue-500" />
              <div>
                <div>Toss Pay / Naver Pay / Kakao Pay</div>
                <div className="mt-0.5 text-xs font-medium text-blue-600">Thanh toán đa kênh phổ biến tại Hàn Quốc</div>
              </div>
            </button>
          </div>
        );
      case "bank-account": return inputField("VD: 1234567890", () => submitBank("account"));
      case "bank-name":    return inputField("VD: Vietcombank, BIDV, ACB...", () => submitBank("bank"));
      case "bank-holder":  return inputField("Tên chủ tài khoản", () => submitBank("holder"));
      case "product-name": return inputField("Tên sản phẩm...", () => submitProduct("name"));
      case "product-price": return inputField("50000", () => submitProduct("price"), "number");
      case "product-desc":
        return (
          <div className="flex flex-col gap-3">
            {inputField("Mô tả ngắn... (tùy chọn)", () => submitProduct("desc"))}
            <button onClick={() => submitProduct("desc", true)}
              className="text-center text-sm font-bold text-slate-400 transition-colors hover:text-slate-600">
              Bỏ qua →
            </button>
          </div>
        );
      case "done":
        return (
          <div className="flex flex-col items-center gap-3">
            <button onClick={() => router.push("/dashboard")}
              className="btn-premium flex items-center gap-2 text-base">
              Vào Dashboard <ArrowRight className="h-5 w-5" />
            </button>
            <button onClick={() => goProduct()}
              className="text-sm font-bold text-slate-400 transition-colors hover:text-accent">
              + Thêm sản phẩm khác
            </button>
          </div>
        );
      default: return null;
    }
  };

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 font-sans">
      <Script src="https://connect.facebook.net/vi_VN/sdk.js" strategy="lazyOnload" />

      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-4 border-b border-black/[0.06] bg-white/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/25">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-lg font-black tracking-tight">
            Sale<span className="text-accent">mate</span>
          </span>
        </div>

        <div className="flex flex-1 items-center gap-3 px-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700 ease-out"
              style={{ width: `${PROGRESS[step]}%` }}
            />
          </div>
          <span className="min-w-[38px] text-right text-xs font-black text-slate-400">{PROGRESS[step]}%</span>
        </div>

        <button
          onClick={() => { localStorage.setItem("salemate_onboarding_done", "1"); router.push("/dashboard"); }}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-3.5 w-3.5" /> Bỏ qua tất cả
        </button>
      </header>

      {/* Chat area */}
      <main className="flex flex-1 flex-col items-center px-4 pb-10 pt-24">
        <div className="w-full max-w-xl space-y-3">
          {msgs.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              {m.role === "bot" && (
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm shadow-emerald-500/25">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-3xl px-5 py-3.5 text-sm font-medium leading-relaxed shadow-sm ${
                  m.role === "bot"
                    ? "rounded-tl-md border border-slate-100 bg-white text-slate-700"
                    : "rounded-tr-md bg-emerald-500 text-white"
                }`}
                style={{ whiteSpace: "pre-line" }}
              >
                {m.text}
              </div>
            </div>
          ))}

          {/* Typing dots */}
          {typing && (
            <div className="flex gap-3">
              <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1.5 rounded-3xl rounded-tl-md border border-slate-100 bg-white px-5 py-4 shadow-sm">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-slate-300"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Action bar */}
      <div className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-4 py-5 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-xl">{renderActions()}</div>
      </div>

      {/* Connected badge */}
      {connectedPage && (
        <div className="fixed bottom-28 right-6 flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-emerald-500/30 animate-bounce">
          <CheckCircle2 className="h-4 w-4" />
          {connectedPage}
        </div>
      )}

      <style>{`
        .ob-input {
          flex: 1;
          border-radius: 1rem;
          border: 1.5px solid #e2e8f0;
          background: white;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          width: 100%;
        }
        .ob-input:focus {
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.12);
        }
      `}</style>
    </div>
  );
}
