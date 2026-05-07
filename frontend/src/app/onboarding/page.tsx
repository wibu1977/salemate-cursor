"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { pagesApi, authApi, inventoryApi, googleAuthApi, pollImportJob, formatApiError } from "@/lib/api";
import { pickGoogleSpreadsheet } from "@/lib/googlePicker";
import { Table as TableIcon, Instagram, Sparkles, ArrowRight, X, Facebook, ExternalLink, ChevronRight, CheckCircle2, CreditCard } from "lucide-react";

// ── Facebook SDK types (type alias avoids global Window conflict) ───────────
interface FBPageData { id: string; name: string; access_token: string; }
interface FBAuthResponse { accessToken: string; }
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
  | "product-name" | "product-price" | "product-desc" | "product-sheet"
  | "done";

interface Msg { id: string; role: "bot" | "user"; text: string; component?: React.ReactNode; }

const PROGRESS: Record<Step, number> = {
  welcome: 5, connect: 20, payment: 40,
  "bank-account": 52, "bank-name": 62, "bank-holder": 72, "toss-ack": 72,
  "product-name": 82, "product-price": 86, "product-desc": 90, "product-sheet": 94, done: 100,
};

// ── Component ──────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [step, setStep] = useState<Step>("welcome");
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [connectedPage, setConnectedPage] = useState<string | null>(null);
  const [bank, setBank] = useState({ account: "", bankName: "", holder: "" });
  const [product, setProduct] = useState({ name: "", price: "" });
  const googleReturnHandled = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const botMsg = useCallback((text: string, delay = 900, component?: React.ReactNode): Promise<void> =>
    new Promise((res) => {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setMsgs((p) => [...p, { id: crypto.randomUUID(), role: "bot", text, component }]);
        res();
      }, delay);
    }), []);

  const userMsg = useCallback((text: string) =>
    setMsgs((p) => [...p, { id: crypto.randomUUID(), role: "user", text }]), []);

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

  useEffect(() => {
    if (googleReturnHandled.current) return;
    if (searchParams?.get("google") !== "connected") return;
    googleReturnHandled.current = true;
    void (async () => {
      await botMsg("Đã kết nối Google! Hãy chọn trang tính từ Google Drive của bạn để bắt đầu.", 400);
      setStep("product-sheet");
      setTimeout(() => inputRef.current?.focus(), 500);
    })();
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams, botMsg]);


  // ── Initial greeting ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      await botMsg("Xin chào! 👋 Tôi là Salemate AI — trợ lý bán hàng thông minh của bạn.", 700);
      await botMsg(
        "Hãy để tôi giúp bạn thiết lập cửa hàng chỉ trong vài phút 🚀", 
        1300,
        <button onClick={startSetup} className="btn-premium flex items-center gap-2 text-base">
          Bắt đầu thôi! <ArrowRight className="h-5 w-5" />
        </button>
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step handlers ────────────────────────────────────────────────────────
  const startSetup = async () => {
    userMsg("Bắt đầu thôi! 🚀");
    await botMsg("Đầu tiên, hãy kết nối kênh bán hàng Facebook hoặc Instagram của bạn 📱");
    await botMsg(
      "Salemate sẽ tự động đồng bộ tin nhắn và chốt đơn 24/7 trên các kênh này.", 
      1500,
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-[10px] font-medium text-amber-700">
            <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
            <span>
              Bạn chưa có Fanpage?{" "}
              <a href="https://www.facebook.com/pages/create" target="_blank" rel="noopener noreferrer"
                className="font-black underline hover:text-amber-900">
                Tạo miễn phí ngay →
              </a>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => connectChannel("facebook")}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#1877F2] px-3 py-3 text-xs font-black text-white shadow-lg shadow-[#1877F2]/30 transition-all hover:-translate-y-0.5 hover:bg-[#1565D8]">
              <Facebook className="h-4 w-4" />
              Facebook
            </button>
            <button onClick={() => connectChannel("instagram")}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-tr from-[#FF3040] via-[#D300C5] to-[#7638FA] px-3 py-3 text-xs font-black text-white shadow-lg shadow-purple-500/30 transition-all hover:-translate-y-0.5 opacity-90 hover:opacity-100">
              <Instagram className="h-4 w-4" />
              Instagram
            </button>
          </div>
          <button onClick={skipConnect}
            className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 transition-colors hover:text-slate-600">
            <ChevronRight className="h-3 w-3" />
            Bỏ qua, thiết lập sau
          </button>
        </div>
      </div>
    );
    setStep("connect");
  };

  const connectChannel = (platform: "facebook" | "instagram" = "facebook") => {
    console.log(`Connecting ${platform}...`);
    const fb = (window as SdkWindow).FB;
    if (!fb) { 
      botMsg("⚠️ SDK Facebook chưa sẵn sàng hoặc bị chặn. Bạn vui lòng thử lại sau giây lát hoặc kiểm tra trình chặn quảng cáo nhé!");
      return; 
    }
    
    fb.login((rawRes) => {
      (async () => {
        console.log("FB Login response:", rawRes);
        const res = rawRes as { status: string; authResponse?: { accessToken: string } };
        if (res.status !== "connected" || !res.authResponse?.accessToken) {
          botMsg("⚠️ Bạn chưa hoàn tất kết nối. Hãy thử lại khi bạn sẵn sàng nhé.");
          return;
        }
        
        await botMsg("Đang lấy danh sách Fanpage của bạn... 🔄", 600);
        fb.api("/me/accounts", (data) => {
          (async () => {
            if (!data?.data?.[0]) {
              await botMsg("❌ Không tìm thấy Fanpage nào. Hãy đảm bảo bạn đã tạo Fanpage và cấp quyền cho Salemate.");
              return;
            }
            const page = data.data[0];
            try {
              await pagesApi.connectPage({ 
                platform, 
                page_id: page.id, 
                page_name: page.name, 
                page_access_token: page.access_token 
              });
              setConnectedPage(page.name);
              userMsg(`Đã kết nối ${platform === "facebook" ? "Facebook" : "Instagram"}: ${page.name}`);
              await botMsg(`🎉 Đã kết nối ${page.name} thành công! Salemate AI sẽ trực chiến 24/7 cho bạn.`);
              await goPayment();
            } catch (err) {
              console.error("Connect page error:", err);
              await botMsg("❌ Có lỗi xảy ra khi kết nối với hệ thống. Bạn có thể thử lại hoặc bỏ qua bước này.");
            }
          })();
        });
      })();
    }, { scope: "pages_messaging,pages_show_list,pages_read_engagement,pages_manage_metadata,instagram_basic,instagram_manage_messages" });
  };

  const skipConnect = async () => {
    userMsg("Bỏ qua, thiết lập sau");
    await botMsg("Không sao! Bạn có thể kết nối Fanpage bất kỳ lúc nào trong Cài đặt.");
    await goPayment();
  };

  const goPayment = async () => {
    setStep("payment");
    await botMsg(
      "Tiếp theo, khách hàng sẽ thanh toán cho bạn qua đâu? 💳",
      900,
      <div className="flex flex-col gap-2">
        <button onClick={() => choosePayment("ocr")}
          className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-left transition-all hover:border-emerald-200 hover:bg-emerald-50">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          <div>
            <div className="text-sm font-black text-emerald-900">Chuyển khoản ngân hàng (OCR)</div>
            <div className="text-[10px] font-medium text-emerald-600">AI tự xác nhận ảnh • Miễn phí</div>
          </div>
        </button>
        <button onClick={() => choosePayment("toss")}
          className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-left transition-all hover:border-blue-200 hover:bg-blue-50">
          <CreditCard className="h-5 w-5 shrink-0 text-blue-500" />
          <div>
            <div className="text-sm font-black text-blue-900">Toss / Naver / Kakao Pay</div>
            <div className="text-[10px] font-medium text-blue-600">Thanh toán hiện đại tại Hàn Quốc</div>
          </div>
        </button>
      </div>
    );
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

    // Basic validation
    if (field === "account" && !/^\d+$/.test(val.replace(/\s|-/g, ""))) {
      await botMsg("⚠️ Số tài khoản thường chỉ bao gồm các chữ số. Bạn vui lòng kiểm tra lại nhé?");
      return;
    }
    if (field === "holder" && val.length < 2) {
      await botMsg("⚠️ Tên chủ tài khoản có vẻ hơi ngắn. Bạn vui lòng nhập đầy đủ nhé?");
      return;
    }

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
        await authApi.setupWorkspace({ 
          bank_account: full.account, 
          bank_name: full.bankName, 
          bank_holder: full.holder 
        });
        await botMsg(`✅ Tuyệt vời! Tôi đã lưu thông tin thanh toán của bạn:\n• Số TK: ${full.account}\n• Ngân hàng: ${full.bankName}\n• Chủ TK: ${full.holder}`, 800);
        setTimeout(() => goProduct(), 1600);
      } catch (err) {
        console.error("Failed to save bank info:", err);
        await botMsg("Có lỗi nhỏ khi lưu thông tin, nhưng chúng ta vẫn có thể tiếp tục nhé!", 800);
        setTimeout(() => goProduct(), 1200);
      }
    }
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  const goProduct = async () => {
    setStep("product-name");
    await botMsg("Gần xong rồi! Hãy thêm sản phẩm đầu tiên để tôi có thể bắt đầu bán hàng cho bạn nhé 🛍️", 600);
    await botMsg(
      "Bạn muốn nhập tay sản phẩm hay đồng bộ từ Google Sheets?", 
      1200,
      <div className="flex flex-col gap-2">
        <button onClick={startSheetSync}
          className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-left transition-all hover:border-emerald-200 hover:bg-emerald-50">
          <TableIcon className="h-5 w-5 shrink-0 text-emerald-500" />
          <div>
            <div className="text-sm font-black text-emerald-900">Đồng bộ từ Google Sheets</div>
            <div className="text-[10px] font-medium text-emerald-600">Tự động nhập hàng loạt từ trang tính</div>
          </div>
        </button>
        <div className="flex items-center gap-2 py-1 px-2">
          <div className="h-px flex-1 bg-slate-100" />
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">Hoặc tiếp tục thiết lập</span>
          <div className="h-px flex-1 bg-slate-100" />
        </div>
      </div>
    );
    setTimeout(() => inputRef.current?.focus(), 1400);
  };

  const connectGoogle = async () => {
    const nextUrl = `${window.location.origin}/onboarding`;
    const { data } = await googleAuthApi.loginUrl(nextUrl);
    window.location.href = data.authorization_url;
  };

  const onSheetSelected = async (id: string) => {
    await botMsg("Đang đọc các trang tính (tabs) trong file của bạn... 🔍", 600);
    try {
      const { data: tabs } = await inventoryApi.sheetTabs(id);
      if (tabs.titles.length === 0) {
        await botMsg("⚠️ File này có vẻ không có trang tính nào hợp lệ.");
        return;
      }
      if (tabs.titles.length === 1) {
        await startImport(id, tabs.titles[0]);
      } else {
        await botMsg(
          "Tuyệt! File này có nhiều trang tính. Bạn muốn nhập từ trang nào?",
          800,
          <div className="flex flex-wrap gap-2">
            {tabs.titles.map((t) => (
              <button
                key={t}
                onClick={() => startImport(id, t)}
                className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
              >
                {t}
              </button>
            ))}
          </div>
        );
      }
    } catch (e: unknown) {
      await botMsg(`❌ Lỗi khi đọc file: ${formatApiError(e)}`);
    }
  };

  const startImport = async (id: string, tabName: string) => {
    userMsg(`Nhập từ trang tính: ${tabName}`);
    setTyping(true);
    try {
      const { data: start } = await inventoryApi.importSheets({
        spreadsheet_id: id,
        sheet_name: tabName,
        entity: "products",
        header_row: 1,
        data_start_row: 2,
      });
      const job = await pollImportJob(String(start.job_id));
      if (job.status === "failed") {
        await botMsg(`❌ ${job.error_message || "Import thất bại."}`, 600);
        return;
      }
      const d = job.result;
      if (!d) {
        await botMsg("❌ Không có kết quả import.", 600);
        return;
      }
      const errHint =
        d.errors?.length > 0
          ? `\n\n${d.errors.slice(0, 5).join("\n")}${d.errors.length > 5 ? "\n…" : ""}`
          : "";
      await botMsg(
        `🎉 Hoàn tất! Đã thêm ${d.created} sản phẩm, cập nhật ${d.updated}.${errHint}`,
        900
      );
      setTimeout(() => void finishOnboarding(), 1200);
    } catch (err: unknown) {
      await botMsg(`❌ ${formatApiError(err)}\n\nĐảm bảo bạn có quyền xem trang tính này.`);
    } finally {
      setTyping(false);
    }
  };

  const openPicker = async () => {
    try {
      const { data: cfg } = await googleAuthApi.pickerConfig();
      if (!cfg.developer_key) {
        await botMsg("⚠️ Tính năng chọn file (Google Picker) chưa được cấu hình API Key. Hãy liên hệ quản trị viên.", 600);
        return;
      }
      const id = await pickGoogleSpreadsheet(cfg.access_token, cfg.developer_key);
      if (id) await onSheetSelected(id);
    } catch (e: unknown) {
      await botMsg(formatApiError(e), 600);
    }
  };

  const startSheetSync = async () => {
    userMsg("Nhập từ Google Sheets 📊");
    await botMsg(
      "Salemate sẽ đồng bộ sản phẩm từ Google Sheets của bạn. Rất nhanh và an toàn qua Google OAuth.",
      700
    );
    try {
      const { data: st } = await googleAuthApi.status();
      if (!st.oauth_configured) {
        await botMsg(
          "⚠️ Hệ thống chưa được cấu hình Google OAuth. Vui lòng liên hệ quản trị viên.",
          600
        );
        return;
      }
      if (!st.connected) {
        await botMsg("Trước tiên, hãy kết nối tài khoản Google của bạn nhé:", 800, (
          <button type="button" onClick={() => void connectGoogle()} className="btn-premium w-full flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4" /> Kết nối Google
          </button>
        ));
      } else {
        await botMsg("Bạn đã kết nối Google! Hãy chọn file trang tính từ Google Drive của bạn:", 800, (
          <button
            type="button"
            onClick={() => void openPicker()}
            className="w-full rounded-2xl border-2 border-emerald-200 bg-white px-4 py-4 text-sm font-black text-emerald-800 shadow-lg shadow-emerald-500/10 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
          >
            <TableIcon className="h-5 w-5" /> Chọn trang tính (Drive)
          </button>
        ));
      }
    } catch {
      await botMsg("Không kiểm tra được trạng thái Google. Thử đăng nhập lại.", 600);
    }
  };

  const submitProduct = async (field: "name" | "price" | "desc", skipDesc?: boolean) => {
    const val = skipDesc ? "" : input.trim();
    if (!skipDesc && !val && field !== "desc") return;

    if (field === "price" && (isNaN(Number(val)) || Number(val) < 0)) {
      await botMsg("⚠️ Giá sản phẩm phải là một con số hợp lệ. Bạn nhập lại nhé?");
      return;
    }

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
      try {
        await inventoryApi.createProduct({
          name: product.name,
          price: parseInt(product.price) || 0,
          description: val || undefined,
          quantity: 100, // Default for onboarding
        });
        await botMsg(`✅ Đã thêm sản phẩm "${product.name}" vào kho hàng của bạn!`, 800);
      } catch (err) {
        console.error("Failed to save product:", err);
        await botMsg("Có lỗi khi lưu sản phẩm, nhưng không sao, chúng ta tiếp tục nhé!", 800);
      }
      setTimeout(() => finishOnboarding(), 1500);
    }
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  const finishOnboarding = async () => {
    setStep("done");
    await botMsg("🎉 Cửa hàng của bạn đã sẵn sàng!", 600);
    await botMsg("Salemate AI đang lắng nghe mọi tin nhắn và sẵn sàng chốt đơn 24/7 cho bạn.", 1300);
    await botMsg(
      "Chào mừng đến với Salemate! Hãy vào Dashboard để xem tổng quan 🚀", 
      2000,
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
    if (typeof window !== "undefined") localStorage.setItem("salemate_onboarding_done", "1");
    try {
      await authApi.setupWorkspace({}); // Mark as completed on server
    } catch (err) {
      console.error("Failed to mark onboarding as completed on server", err);
    }
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
      case "bank-account": return inputField("VD: 1234567890", () => submitBank("account"));
      case "bank-name":    
        return inputField("Tên ngân hàng (VD: Vietcombank, BIDV...)", () => submitBank("bank"));
      case "bank-holder":  return inputField("Tên chủ tài khoản", () => submitBank("holder"));
      case "product-name":  return inputField("Hoặc nhập tên sản phẩm...", () => submitProduct("name"));
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
          onClick={async () => { 
            localStorage.setItem("salemate_onboarding_done", "1"); 
            try { await authApi.setupWorkspace({}); } catch { /* bỏ qua nếu đã setup */ }
            router.push("/dashboard"); 
          }}
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
                {m.component && <div className="mt-4">{m.component}</div>}
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
