"use client";

import { Info, AlertCircle, Sparkles, Image as ImageIcon } from "lucide-react";
import type { ConnectorField } from "./ColumnConnector";

interface ImportAnalysisBannerProps {
  analysisResult: {
    matched_fields: Record<string, { header: string | null; confidence: number }>;
    missing_fields: string[];
    defaults_applied: Record<string, unknown>;
    total_rows: number;
    has_embedded_images: boolean;
    embedded_image_count: number;
  };
  systemFields: ConnectorField[];
  defaultOverrides: Record<string, string>;
  onOverrideChange: (field: string, value: string) => void;
}

export function ImportAnalysisBanner({
  analysisResult,
  systemFields,
  defaultOverrides,
  onOverrideChange,
}: ImportAnalysisBannerProps) {
  const { missing_fields, defaults_applied, has_embedded_images, embedded_image_count } = analysisResult;

  if (missing_fields.length === 0 && !has_embedded_images) return null;

  return (
    <div className="space-y-4">
      {missing_fields.length > 0 && (
        <div className="rounded-[2rem] border border-amber-200 bg-amber-50/50 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest">Smart Gaps — Giá trị mặc định</h4>
              <p className="text-[10px] font-bold text-amber-600/80 uppercase tracking-widest">
                Phát hiện {missing_fields.length} cột còn thiếu. Chúng tôi sẽ tự động điền các giá trị dưới đây.
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {missing_fields.map((field) => {
              const fieldInfo = systemFields.find((f) => f.key === field);
              return (
                <div 
                  key={field} 
                  className="group flex items-center gap-3 rounded-2xl bg-white px-4 py-2.5 ring-1 ring-amber-100 shadow-sm transition-all hover:shadow-md hover:ring-amber-200"
                >
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                      {fieldInfo?.label || field}
                    </span>
                    <input
                      className="w-24 border-none bg-transparent p-0 text-xs font-black text-amber-700 placeholder:text-amber-200 focus:ring-0"
                      value={defaultOverrides[field] ?? String(defaults_applied[field] ?? "")}
                      onChange={(e) => onOverrideChange(field, e.target.value)}
                      placeholder="Mặc định..."
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {has_embedded_images && (
        <div className="rounded-[2rem] border border-violet-200 bg-violet-50/50 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                <ImageIcon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-violet-900 uppercase tracking-widest">Trích xuất hình ảnh</h4>
                <p className="text-[10px] font-bold text-violet-600/80 uppercase tracking-widest">
                  Phát hiện <span className="text-violet-700 font-black underline decoration-violet-300 underline-offset-2">{embedded_image_count} ảnh</span> được dán trong file.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-violet-100 px-4 py-1.5">
              <Sparkles className="h-3 w-3 text-violet-600" />
              <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest">Hỗ trợ bởi Salemate AI</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
