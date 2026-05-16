"use client";

import { useState } from "react";
import { X, Layers, Check, Trash2 } from "lucide-react";

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onApplyCategory: (category: string) => void;
}

export function BulkActionBar({
  selectedCount,
  onClear,
  onApplyCategory,
}: BulkActionBarProps) {
  const [category, setCategory] = useState("");

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-12 left-1/2 z-50 flex -translate-x-1/2 items-center gap-6 rounded-[2.5rem] bg-slate-900 px-8 py-4 text-white shadow-2xl shadow-slate-900/40 animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="flex items-center gap-3 border-r border-slate-700 pr-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white font-black text-xs">
          {selectedCount}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Đang chọn</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative group">
          <Layers className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && category) {
                onApplyCategory(category);
                setCategory("");
              }
            }}
            placeholder="Gán danh mục..."
            className="w-48 rounded-2xl border-none bg-slate-800 py-3 pl-11 pr-4 text-xs font-bold text-white placeholder:text-slate-500 focus:ring-2 focus:ring-accent transition-all"
          />
        </div>

        <button
          onClick={() => {
            if (category) {
              onApplyCategory(category);
              setCategory("");
            }
          }}
          disabled={!category}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent/80 active:scale-95 disabled:opacity-30"
        >
          <Check className="h-5 w-5" />
        </button>
      </div>

      <button
        onClick={onClear}
        className="ml-2 flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 hover:bg-slate-800 hover:text-white transition-all"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
