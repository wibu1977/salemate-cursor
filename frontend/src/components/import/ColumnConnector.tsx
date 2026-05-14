"use client";

import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { Link2, Unlink2 } from "lucide-react";

export interface ConnectorField {
  key: string;
  label: string;
  required?: boolean;
  description?: string;
  icon?: ReactNode;
}

export interface ColumnConnectorProps {
  headers: string[];
  sampleRow: unknown[] | undefined;
  systemFields: ConnectorField[];
  mapping: Record<string, string>;
  onChange: (mapping: Record<string, string>) => void;
}

/** Click a sheet header, then click a target field on the right to link. Same header replaces old links. */
export function ColumnConnector({
  headers,
  sampleRow,
  systemFields,
  mapping,
  onChange,
}: ColumnConnectorProps) {
  const [selectedHeader, setSelectedHeader] = useState<string | null>(null);

  const toggleHeaderSelection = useCallback((h: string) => {
    const trimmed = (h || "").trim();
    if (!trimmed) return;
    setSelectedHeader((prev) => (prev === trimmed ? null : trimmed));
  }, []);

  const fieldForMappedHeader = useCallback(
    (headerLabel: string) => {
      for (const f of systemFields) {
        if (mapping[f.key] === headerLabel) return f;
      }
      return null;
    },
    [mapping, systemFields]
  );

  const unlinkField = useCallback(
    (fieldKey: string) => {
      const next = { ...mapping };
      delete next[fieldKey];
      onChange(next);
    },
    [mapping, onChange]
  );

  const unlinkHeader = useCallback(
    (headerLabel: string) => {
      const next = { ...mapping };
      for (const k of Object.keys(next)) {
        if (next[k] === headerLabel) delete next[k];
      }
      onChange(next);
    },
    [mapping, onChange]
  );

  const linkToField = useCallback(
    (fieldKey: string) => {
      if (!selectedHeader) return;
      const next = { ...mapping };
      for (const k of Object.keys(next)) {
        if (next[k] === selectedHeader) delete next[k];
      }
      next[fieldKey] = selectedHeader;
      onChange(next);
      setSelectedHeader(null);
    },
    [mapping, onChange, selectedHeader]
  );

  const sampleForHeader = useCallback(
    (header: string, colIndex: number) => {
      if (sampleRow == null || colIndex < 0 || colIndex >= sampleRow.length) return "";
      const v = sampleRow[colIndex];
      const s = v == null ? "" : String(v).trim();
      return s.slice(0, 80);
    },
    [sampleRow]
  );

  if (!headers.length) {
    return (
      <p className="text-center text-xs font-bold text-slate-400">Chưa có dòng tiêu đề.</p>
    );
  }

  return (
    <div className="space-y-4">
      {!selectedHeader && (
        <p className="rounded-xl bg-accent-soft/40 px-4 py-2 text-center text-[10px] font-black uppercase tracking-widest text-accent">
          Bấm một cột bên trái, rồi bấm trường bên phải để nối
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left — sheet columns */}
        <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-100">
          <h5 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Cột trong file ({headers.length})
          </h5>
          <div className="scrollbar-thin max-h-[340px] space-y-2 overflow-y-auto pr-1">
            {headers.map((h, i) => {
              const label = String(h ?? "").trim() || `(Cột ${i + 1})`;
              const linked = fieldForMappedHeader(label);
              const selected = selectedHeader === label;

              return (
                <button
                  key={`${label}-${i}`}
                  type="button"
                  onClick={() => toggleHeaderSelection(label)}
                  className={`flex w-full flex-col gap-1 rounded-2xl border-2 px-4 py-3 text-left transition-all ${
                    selected
                      ? "border-accent bg-accent-soft/60 shadow-inner"
                      : linked
                        ? "border-accent/30 bg-accent/[0.04]"
                        : "border-slate-100 bg-slate-50/80 hover:border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-900">{label}</span>
                    {linked && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          unlinkHeader(label);
                        }}
                        className="flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-accent ring-1 ring-accent/25 transition hover:bg-rose-100 hover:text-rose-600 hover:ring-rose-200"
                        title="Huỷ nối"
                      >
                        <Unlink2 className="h-3 w-3" />
                        {linked.label}
                      </button>
                    )}
                  </div>
                  <span className="truncate text-[9px] font-bold text-slate-400">
                    Mẫu: {sampleForHeader(label, i) || "(trống)"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right — system fields */}
        <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-100">
          <h5 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Trường hệ thống
          </h5>
          <div className="scrollbar-thin max-h-[340px] space-y-2 overflow-y-auto pr-1">
            {systemFields.map((field) => {
              const mappedCol = mapping[field.key];

              return (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => {
                    if (selectedHeader) {
                      linkToField(field.key);
                    } else if (mappedCol) {
                      unlinkField(field.key);
                    }
                  }}
                  className={`group flex w-full flex-col gap-1 rounded-2xl border-2 px-4 py-3 text-left transition-all ${
                    selectedHeader
                      ? "cursor-pointer border-dashed border-accent/50 bg-accent-soft/20 hover:border-accent hover:bg-accent-soft/40"
                      : mappedCol
                        ? "cursor-pointer border-emerald-200/80 bg-emerald-50/40 hover:border-rose-200 hover:bg-rose-50/50"
                        : "border-slate-100 bg-slate-50/50 hover:border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {field.icon && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 group-hover:bg-accent-soft group-hover:text-accent">
                        {field.icon}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-black uppercase tracking-wide text-slate-800">
                        {field.label}
                        {field.required && <span className="text-rose-500"> *</span>}
                      </div>
                      {field.description && (
                        <p className="text-[9px] font-bold text-slate-400">{field.description}</p>
                      )}
                    </div>
                    {mappedCol && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-700 ring-1 ring-emerald-200">
                        <Link2 className="h-3 w-3" />
                        {mappedCol}
                      </span>
                    )}
                  </div>
                  {selectedHeader && (
                    <p className="text-[9px] font-black uppercase tracking-wide text-accent">
                      ← Bấm để gắn &quot;{selectedHeader}&quot;
                    </p>
                  )}
                  {!selectedHeader && mappedCol && (
                    <p className="text-[9px] font-bold text-slate-400">Bấm để huỷ nối</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <button
          type="button"
          onClick={() => setSelectedHeader(null)}
          className="text-[10px] font-black uppercase tracking-widest text-slate-400 transition hover:text-slate-700"
          disabled={!selectedHeader}
        >
          Bỏ chọn cột
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedHeader(null);
            onChange({});
          }}
          className="text-[10px] font-black uppercase tracking-widest text-slate-400 transition hover:text-rose-500"
        >
          Xóa tất cả ánh xạ
        </button>
      </div>
    </div>
  );
}
