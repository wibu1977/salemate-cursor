"use client";

import { useMemo } from "react";
import { Sparkles, LayoutGrid, CheckCircle2, AlertCircle } from "lucide-react";

interface ImportCategorySidebarProps {
  aiSuggestions: Record<string, string>;
  manualOverrides: Record<string, Record<string, any>>;
  onRunAi: () => void;
  onAcceptAll: () => void;
  isPending: boolean;
  totalProducts: number;
  acceptedCount: number;
}

export function ImportCategorySidebar({
  aiSuggestions,
  manualOverrides,
  onRunAi,
  onAcceptAll,
  isPending,
  totalProducts,
  acceptedCount,
}: ImportCategorySidebarProps) {
  const categories = useMemo(() => {
    const groups: Record<string, number> = {};
    Object.entries(aiSuggestions).forEach(([name, cat]) => {
      const finalCat = manualOverrides[name]?.category || cat;
      groups[finalCat] = (groups[finalCat] || 0) + 1;
    });
    return Object.entries(groups).sort((a, b) => b[1] - a[1]);
  }, [aiSuggestions, manualOverrides]);

  const hasSuggestions = Object.keys(aiSuggestions).length > 0;
  const progress = totalProducts > 0 ? (acceptedCount / totalProducts) * 100 : 0;

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header / Stats */}
      <div className="rounded-[2rem] bg-violet-600 p-6 text-white shadow-xl shadow-violet-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest">Salemate AI</h4>
            <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Tự động phân loại</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
            <span>Tiến độ</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
            <div 
              className="h-full bg-white transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] font-bold opacity-70">
            Đã duyệt {acceptedCount}/{totalProducts} sản phẩm
          </p>
        </div>
      </div>

      {/* Action Area */}
      {!hasSuggestions ? (
        <div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
          <Sparkles className="mb-4 h-10 w-10 text-slate-300" />
          <h5 className="mb-2 text-xs font-black text-slate-900 uppercase tracking-widest">Khởi tạo AI</h5>
          <p className="mb-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            AI sẽ phân tích tên sản phẩm và gợi ý danh mục phù hợp
          </p>
          <button
            onClick={onRunAi}
            disabled={isPending}
            className="w-full rounded-2xl bg-slate-900 px-6 py-4 text-[10px] font-black text-white shadow-xl transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50"
          >
            {isPending ? "ĐANG PHÂN TÍCH..." : "CHẠY PHÂN LOẠI AI"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col flex-1 gap-6 min-h-0">
          <button
            onClick={onAcceptAll}
            className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-[10px] font-black text-white shadow-xl shadow-emerald-100 transition-all hover:bg-emerald-700 active:scale-95"
          >
            <CheckCircle2 className="h-4 w-4" /> CHẤP NHẬN TẤT CẢ GỢI Ý
          </button>

          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-2 px-1 mb-3">
              <LayoutGrid className="h-4 w-4 text-slate-400" />
              <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Danh mục gợi ý</h5>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {categories.map(([name, count]) => (
                <div 
                  key={name}
                  className="flex items-center justify-between rounded-2xl bg-white p-3 ring-1 ring-slate-100 shadow-sm transition-all hover:ring-violet-200"
                >
                  <span className="text-[11px] font-black text-slate-700 line-clamp-1">{name}</span>
                  <span className="rounded-lg bg-violet-50 px-2 py-1 text-[10px] font-black text-violet-600">
                    {count}
                  </span>
                </div>
              ))}
              {categories.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                  <AlertCircle className="mb-2 h-6 w-6 opacity-20" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Trống</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
