"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  FileText, 
  CreditCard,
  Eye,
  ArrowLeft,
  Hash,
  Wallet
} from "lucide-react";

interface FraudData {
  id: string;
  memo_code: string;
  status: string;
  total_amount: number;
  currency: string;
  flag_reason: string | null;
  bill_image_url: string | null;
  ocr_data: {
    raw_text?: string;
    bill_time?: string;
    bill_memo?: string;
    bill_amount?: number;
    ocr_engine?: string;
  } | null;
  fraud_logs: {
    check_type: string;
    result: string;
    details: string;
  }[];
}

const CHECK_CONFIG: Record<string, { label: string; icon: any }> = {
  time: { label: "Thời gian bill", icon: Clock },
  memo: { label: "Mã giao dịch", icon: Hash },
  amount: { label: "Số tiền", icon: Wallet },
  duplicate: { label: "Trùng lặp ảnh", icon: FileText },
};

const RESULT_VARIANT: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  pass: { label: "Hợp lệ", bg: "bg-emerald-50", text: "text-emerald-700", icon: CheckCircle2 },
  flag: { label: "Cảnh báo", bg: "bg-amber-50", text: "text-amber-700", icon: AlertTriangle },
  reject: { label: "Từ chối", bg: "bg-rose-50", text: "text-rose-700", icon: XCircle },
};

export default function FraudReviewWebview() {
  const { id } = useParams();
  const [data, setData] = useState<FraudData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/admin/orders/${id}`)
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = async (action: "approve" | "reject") => {
    if (!id) return;
    setActing(true);
    try {
      await api.post(`/admin/orders/${id}/action`, { action });
      const { data: updated } = await api.get(`/admin/orders/${id}`);
      setData(updated);
    } catch {
      // Error handling
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-page">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <p className="font-medium text-ink/40 animate-pulse">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-surface-page">
        <div className="rounded-full bg-rose-50 p-4 mb-4">
          <ShieldAlert className="h-8 w-8 text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-ink mb-2">Không tìm thấy dữ liệu</h2>
        <p className="text-center text-ink/60 mb-6">Đơn hàng này không tồn tại hoặc bạn không có quyền truy cập.</p>
        <button 
          onClick={() => window.history.back()}
          className="flex items-center gap-2 font-bold text-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-page pb-32">
      {/* Header Banner */}
      <div className="bg-rose-500 p-6 text-white pt-12 pb-16">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <ShieldAlert className="h-3 w-3" />
            Kiểm soát rủi ro
          </div>
          <span className="text-white/60 text-[10px] font-medium tracking-widest uppercase">SALE MATE V1</span>
        </div>
        <h1 className="text-3xl font-[1000] leading-tight">
          Cảnh báo <br />Giao dịch nghi vấn
        </h1>
      </div>

      <div className="px-4 -mt-8 space-y-6">
        {/* Main Info Card */}
        <div className="bg-white rounded-[2rem] shadow-xl shadow-rose-900/5 p-6 border border-rose-100 animate-slide-up">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-[10px] font-bold text-ink/40 uppercase tracking-widest mb-1">Số tiền đơn hàng</p>
              <h2 className="text-4xl font-[1000] text-accent">
                {formatCurrency(data.total_amount, data.currency)}
              </h2>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-accent/5 flex items-center justify-center">
              <CreditCard className="h-7 w-7 text-accent" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-page rounded-2xl p-4">
              <p className="text-[10px] font-bold text-ink/40 uppercase tracking-wider mb-1">Mã đối soát</p>
              <p className="font-mono text-sm font-bold text-ink">{data.memo_code}</p>
            </div>
            <div className="bg-surface-page rounded-2xl p-4">
              <p className="text-[10px] font-bold text-ink/40 uppercase tracking-wider mb-1">Trạng thái</p>
              <div className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase",
                data.status === 'flagged' ? "bg-rose-500 text-white" : "bg-emerald-500 text-white"
              )}>
                {data.status}
              </div>
            </div>
          </div>

          {data.flag_reason && (
            <div className="mt-6 flex items-start gap-3 bg-rose-50 rounded-2xl p-4 border border-rose-100">
              <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-rose-900 leading-relaxed">
                {data.flag_reason}
              </p>
            </div>
          )}
        </div>

        {/* 4-Layer Checks */}
        <div className="space-y-3 animate-slide-up">
          <h3 className="px-2 text-[10px] font-bold text-ink/40 uppercase tracking-widest">Hệ thống đối soát 4 lớp</h3>
          <div className="grid gap-3">
            {data.fraud_logs?.map((log, i) => {
              const config = CHECK_CONFIG[log.check_type] || { label: log.check_type, icon: ShieldAlert };
              const variant = RESULT_VARIANT[log.result] || RESULT_VARIANT.flag;
              const Icon = config.icon;
              const StatusIcon = variant.icon;

              return (
                <div key={i} className="bg-white rounded-[1.5rem] p-4 flex items-center justify-between border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-surface-page flex items-center justify-center text-ink/40">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink">{config.label}</p>
                      <p className="text-[11px] text-ink/50 font-medium">{log.details}</p>
                    </div>
                  </div>
                  <div className={cn("px-3 py-1 rounded-full flex items-center gap-1.5", variant.bg, variant.text)}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-tighter">{variant.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bill Image Section */}
        {data.bill_image_url && (
          <div className="space-y-3 animate-slide-up">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-bold text-ink/40 uppercase tracking-widest">Minh chứng thanh toán</h3>
              <button 
                onClick={() => setShowFullImage(true)}
                className="text-[11px] font-bold text-accent flex items-center gap-1"
              >
                <Eye className="h-3 w-3" /> Xem ảnh gốc
              </button>
            </div>
            <div className="relative group bg-white p-2 rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
              <div className="aspect-[3/4] relative rounded-[1.5rem] overflow-hidden bg-surface-page">
                <Image
                  src={data.bill_image_url}
                  alt="Bill"
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                   <p className="text-white text-[10px] font-bold uppercase tracking-wider">Nhấn để xem chi tiết</p>
                </div>
              </div>
              {data.ocr_data?.ocr_engine && (
                <div className="mt-3 flex items-center justify-center gap-2 py-1 px-3 bg-surface-page rounded-full w-fit mx-auto">
                  <div className="h-1 w-1 rounded-full bg-accent animate-ping" />
                  <span className="text-[10px] font-bold text-ink/30 uppercase tracking-tighter">AI OCR ENGINE: {data.ocr_data.ocr_engine}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* OCR Details */}
        {data.ocr_data && (
          <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm animate-slide-up">
            <h3 className="text-xs font-bold text-ink/40 uppercase tracking-widest mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent" />
              Thông tin trích xuất (AI)
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                <span className="text-[11px] font-bold text-ink/30 uppercase tracking-widest">Thời gian bill</span>
                <span className="text-sm font-bold text-ink">{data.ocr_data.bill_time || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                <span className="text-[11px] font-bold text-ink/30 uppercase tracking-widest">Nội dung chuyển</span>
                <span className="text-sm font-mono font-bold text-accent">{data.ocr_data.bill_memo || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-ink/30 uppercase tracking-widest">Số tiền khớp</span>
                <span className="text-sm font-bold text-ink">{data.ocr_data.bill_amount?.toLocaleString() || "0"} {data.currency}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-gray-100 flex gap-4 z-50">
        {data.status === "flagged" ? (
          <>
            <button
              onClick={() => handleAction("reject")}
              disabled={acting}
              className="flex-[1] h-16 rounded-2xl border-2 border-rose-100 flex items-center justify-center gap-2 text-rose-500 font-bold hover:bg-rose-50 transition-colors disabled:opacity-50"
            >
              {acting ? <div className="h-5 w-5 animate-spin border-2 border-rose-500 border-t-transparent rounded-full" /> : <XCircle className="h-5 w-5" />}
              Hủy
            </button>
            <button
              onClick={() => handleAction("approve")}
              disabled={acting}
              className="flex-[2] h-16 rounded-2xl bg-accent text-white flex items-center justify-center gap-2 font-[1000] text-lg shadow-lg shadow-accent/20 hover:bg-accent-hover transition-all transform active:scale-95 disabled:opacity-50"
            >
              {acting ? <div className="h-6 w-6 animate-spin border-2 border-white border-t-transparent rounded-full" /> : <CheckCircle2 className="h-6 w-6" />}
              Duyệt đơn
            </button>
          </>
        ) : (
          <div className="w-full h-16 rounded-2xl bg-surface-page flex items-center justify-center gap-2 text-ink/40 font-bold">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ĐÃ XỬ LÝ: {data.status.toUpperCase()}
          </div>
        )}
      </div>

      {/* Image Modal */}
      {showFullImage && data.bill_image_url && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col p-4 animate-fade-in">
          <div className="flex justify-end p-4">
            <button 
              onClick={() => setShowFullImage(false)}
              className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-white"
            >
              <XCircle className="h-6 w-6" />
            </button>
          </div>
          <div className="flex-1 relative w-full h-full">
            <Image
              src={data.bill_image_url}
              alt="Bill Full"
              fill
              className="object-contain"
              unoptimized
            />
          </div>
        </div>
      )}
    </div>
  );
}
