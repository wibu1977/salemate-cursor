"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { 
  Rocket, 
  Target, 
  MessageSquare, 
  CheckCircle2, 
  RotateCcw, 
  XCircle,
  Zap,
  Loader2,
  AlertCircle,
  Users,
  Send,
  Eye,
  Trophy
} from "lucide-react";

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
        setDone("Chiến dịch đã được duyệt. Hệ thống đang tiến hành gửi tin nhắn.");
      } else if (action === "rewrite") {
        setDone("AI đã soạn lại nội dung mới. Vui lòng kiểm tra lại bên dưới.");
        if ((json as { campaign_status?: string }).campaign_status === "pending_approval") {
          const nr = await fetch(
            `${API_URL}/webview/campaigns/${id}?token=${encodeURIComponent(token)}`
          );
          if (nr.ok) setData(await nr.json());
        }
      } else {
        setDone("Chiến dịch đã được hủy bỏ.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-page">
        <div className="relative">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-100 border-t-accent" />
          <Rocket className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-accent" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-page p-6 text-center">
         <div className="max-w-md w-full space-y-6 bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-50">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-500">
            <AlertCircle className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-[1000] text-slate-900 uppercase tracking-tight">Lỗi truy cập</h1>
            <p className="text-sm font-medium text-slate-500 leading-relaxed">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-surface-page pb-20 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 h-[400px] w-[400px] bg-accent-soft/50 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
      <div className="absolute top-1/2 left-0 h-[300px] w-[300px] bg-accent-soft blur-[100px] rounded-full -translate-x-1/2" />

      <div className="relative z-10 max-w-xl mx-auto pt-10 px-4 space-y-8">
        {/* Header Card */}
        <div className="text-center space-y-4">
           <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-white shadow-2xl shadow-accent/20 mb-2">
              <Rocket className="h-8 w-8" />
           </div>
           <div className="space-y-2">
             <div className="flex items-center justify-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.3em]">Chờ phê duyệt</span>
             </div>
             <h1 className="text-3xl font-[1000] text-slate-900 tracking-tighter uppercase">{data.name}</h1>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chiến dịch AI Outreach</p>
           </div>
        </div>

        {/* Campaign Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <StatBox icon={<Users className="h-4 w-4" />} label="Đối tượng" value={data.segment_label || "Tất cả"} color="accent" />
          <StatBox icon={<Send className="h-4 w-4" />} label="Dự kiến" value={data.total_recipients.toString()} color="emerald" />
          <StatBox icon={<Zap className="h-4 w-4" />} label="Hành động" value="Messenger" color="amber" />
        </div>

        {/* Message Preview */}
        <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl shadow-slate-200/40 border border-slate-50 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03]">
             <MessageSquare className="h-32 w-32" />
          </div>
          
          <div className="relative flex items-center justify-between">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Nội dung tin nhắn</h2>
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full">
               <Zap className="h-3 w-3 text-emerald-500" />
               <span className="text-[9px] font-black text-emerald-600 uppercase">AI Optimized</span>
            </div>
          </div>

          <div className="relative bg-slate-50/50 rounded-3xl p-6 border border-slate-50">
             <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap italic">
               "{data.message_template}"
             </p>
          </div>

          {data.status === "pending_approval" && !done && (
            <div className="space-y-6 pt-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Ghi chú chỉnh sửa (tùy chọn)</label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border-none bg-slate-50 pl-6 pr-6 py-4 text-sm font-bold text-slate-900 shadow-inner outline-none focus:bg-white focus:ring-2 focus:ring-accent transition-all placeholder:text-slate-300"
                  placeholder="Ví dụ: Thêm chương trình giảm giá 10% cho khách cũ..."
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => postAction("approve")}
                  disabled={busy}
                  className="ai-glow group flex items-center justify-center gap-3 bg-accent text-white py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-accent/15 transition-all hover:bg-accent-hover active:scale-95 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  PHÊ DUYỆT & GỬI NGAY
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => postAction("rewrite")}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 bg-slate-100 text-slate-900 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-200 active:scale-95 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    AI VIẾT LẠI
                  </button>
                  <button
                    onClick={() => postAction("cancel")}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 bg-rose-50 text-rose-600 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-rose-100 active:scale-95 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    HỦY BỎ
                  </button>
                </div>
              </div>
            </div>
          )}

          {done && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex items-start gap-4">
               <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
                  <CheckCircle2 className="h-6 w-6" />
               </div>
               <div className="space-y-1">
                  <p className="text-sm font-black text-emerald-900 uppercase">Thành công!</p>
                  <p className="text-xs font-medium text-emerald-600/80 leading-relaxed">{done}</p>
               </div>
            </div>
          )}
        </div>

        {/* Live Tracking (If already sent) */}
        {data.sent_count > 0 && (
          <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl space-y-6">
             <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Chỉ số thời gian thực</h2>
                <div className="flex items-center gap-2 text-emerald-400">
                   <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                   <span className="text-[9px] font-black uppercase tracking-widest">Live</span>
                </div>
             </div>

             <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Đã gửi</p>
                   <p className="text-2xl font-[1000] tracking-tighter">{data.sent_count}</p>
                </div>
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Phân phối</p>
                   <p className="text-2xl font-[1000] tracking-tighter text-accent-muted">{data.opened_count}</p>
                </div>
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Chuyển đổi</p>
                   <p className="text-2xl font-[1000] tracking-tighter text-emerald-400">{data.converted_count}</p>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: "accent" | "emerald" | "amber" }) {
  const colors = {
    accent: "bg-accent-soft text-accent",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600"
  };

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-50 shadow-lg shadow-slate-200/20 space-y-2">
      <div className={`h-8 w-8 flex items-center justify-center rounded-xl ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-black text-slate-900 truncate">{value}</p>
      </div>
    </div>
  );
}

export default function CampaignWebviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface-page">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      }
    >
      <CampaignWebviewContent />
    </Suspense>
  );
}
