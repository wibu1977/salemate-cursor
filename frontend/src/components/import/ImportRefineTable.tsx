"use client";

import { useMemo } from "react";
import { Sparkles, Check, Image as ImageIcon, Search, Filter, DollarSign, Layers } from "lucide-react";

interface ImportRefineTableProps {
  dataRows: unknown[][];
  headers: string[];
  mapping: Record<string, string>;
  aiSuggestions: Record<string, string>;
  aiAccepted: Set<string>;
  onOverrideChange: (name: string, category: string) => void;
  onToggleAccept: (name: string) => void;
  selectedRows: Set<string>;
  onToggleSelect: (name: string) => void;
  onSelectAll: (names: string[]) => void;
  manualOverrides: Record<string, Record<string, any>>;
  onManualOverrideChange: (name: string, field: string, value: any) => void;
}

export function ImportRefineTable({
  dataRows,
  headers,
  mapping,
  aiSuggestions,
  aiAccepted,
  onOverrideChange,
  onToggleAccept,
  selectedRows,
  onToggleSelect,
  onSelectAll,
  manualOverrides,
  onManualOverrideChange,
}: ImportRefineTableProps) {
  const nameIdx = useMemo(() => (mapping.name ? headers.indexOf(mapping.name) : -1), [mapping.name, headers]);
  const priceIdx = useMemo(() => (mapping.price ? headers.indexOf(mapping.price) : -1), [mapping.price, headers]);
  const qtyIdx = useMemo(() => (mapping.quantity ? headers.indexOf(mapping.quantity) : -1), [mapping.quantity, headers]);
  const imgIdx = useMemo(() => (mapping.image_url ? headers.indexOf(mapping.image_url) : -1), [mapping.image_url, headers]);
  const thrIdx = useMemo(() => (mapping.stock_threshold ? headers.indexOf(mapping.stock_threshold) : -1), [mapping.stock_threshold, headers]);

  const rows = useMemo(() => {
    if (nameIdx === -1) return [];
    return dataRows.map((row, idx) => {
      const name = String(row[nameIdx] || "").trim();
      if (!name) return null;
      return {
        id: `${name}-${idx}`,
        name,
        price: row[priceIdx],
        quantity: row[qtyIdx],
        threshold: thrIdx >= 0 ? row[thrIdx] : undefined,
        imageUrl: row[imgIdx],
        originalRow: row,
      };
    }).filter(Boolean) as any[];
  }, [dataRows, nameIdx, priceIdx, qtyIdx, imgIdx, thrIdx]);

  const allNames = useMemo(() => rows.map(r => r.name), [rows]);

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-100">
      <div className="max-h-[50vh] overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md">
            <tr className="border-b border-slate-200">
              <th className="w-12 px-6 py-4">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded-md border-slate-300 text-accent focus:ring-accent"
                  checked={selectedRows.size === allNames.length && allNames.length > 0}
                  onChange={() => onSelectAll(allNames)}
                />
              </th>
              <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">Sản phẩm</th>
              <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">Danh mục AI</th>
              <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-right">Tồn kho</th>
              <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-right w-24">Ngưỡng</th>
              <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-center">Ảnh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const suggested = aiSuggestions[row.name] || "Chưa phân loại";
              const isAccepted = aiAccepted.has(row.name);
              const isSelected = selectedRows.has(row.name);

              return (
                <tr 
                  key={row.id} 
                  className={`group transition-colors hover:bg-slate-50/50 ${isSelected ? "bg-accent/[0.02]" : ""}`}
                >
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded-md border-slate-300 text-accent focus:ring-accent"
                      checked={isSelected}
                      onChange={() => onToggleSelect(row.name)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-black text-slate-900 line-clamp-1">{row.name}</span>
                      <div className="relative mt-1">
                        <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={manualOverrides[row.name]?.price ?? row.price ?? ""}
                          onChange={(e) => onManualOverrideChange(row.name, "price", e.target.value)}
                          placeholder="Giá"
                          className="w-24 rounded-lg border-none bg-slate-50 pl-6 pr-2 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-100 focus:ring-2 focus:ring-accent"
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          value={manualOverrides[row.name]?.category ?? suggested}
                          onChange={(e) => onManualOverrideChange(row.name, "category", e.target.value)}
                          className={`w-full rounded-xl border-none px-4 py-2 text-[11px] font-black transition-all ring-1 focus:ring-2 ${
                            isAccepted 
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200 focus:ring-emerald-500" 
                              : "bg-slate-50 text-slate-600 ring-slate-100 focus:ring-accent"
                          }`}
                        />
                        {isAccepted && (
                          <Check className="absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-emerald-500" />
                        )}
                      </div>
                      <button
                        onClick={() => onToggleAccept(row.name)}
                        className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                          isAccepted 
                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-100" 
                            : "bg-slate-100 text-slate-400 hover:bg-violet-100 hover:text-violet-600"
                        }`}
                      >
                        {isAccepted ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end">
                      <input
                        type="number"
                        value={manualOverrides[row.name]?.quantity ?? row.quantity ?? "0"}
                        onChange={(e) => onManualOverrideChange(row.name, "quantity", e.target.value)}
                        className={`w-16 rounded-lg border-none px-2 py-1 text-center text-[10px] font-black ring-1 transition-all focus:ring-2 ${
                          Number(manualOverrides[row.name]?.quantity ?? row.quantity ?? 0) > 0 
                            ? "bg-blue-50 text-blue-600 ring-blue-100 focus:ring-blue-500" 
                            : "bg-slate-100 text-slate-400 ring-slate-200 focus:ring-accent"
                        }`}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end">
                      <input
                        type="number"
                        value={manualOverrides[row.name]?.stock_threshold ?? row.originalRow[headers.indexOf(mapping.stock_threshold || "")] ?? "5"}
                        onChange={(e) => onManualOverrideChange(row.name, "stock_threshold", e.target.value)}
                        className="w-12 rounded-lg border-none bg-slate-50 px-2 py-1 text-center text-[10px] font-bold text-slate-500 ring-1 ring-slate-100 focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      {row.imageUrl ? (
                        <div className="h-10 w-10 overflow-hidden rounded-xl ring-1 ring-slate-100">
                          <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-200">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Search className="mb-4 h-12 w-12 opacity-20" />
          <p className="text-sm font-bold uppercase tracking-widest">Không có dữ liệu hiển thị</p>
        </div>
      )}
    </div>
  );
}
