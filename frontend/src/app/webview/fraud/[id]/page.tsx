"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

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

const CHECK_LABELS: Record<string, string> = {
  time: "Thoi gian bill",
  memo: "Ma giao dich",
  amount: "So tien",
  duplicate: "Trung lap anh",
};

const RESULT_STYLE: Record<string, { label: string; className: string }> = {
  pass: { label: "OK", className: "badge-success" },
  flag: { label: "Canh bao", className: "badge-warning" },
  reject: { label: "Tu choi", className: "badge-danger" },
};

export default function FraudReviewWebview() {
  const { id } = useParams();
  const [data, setData] = useState<FraudData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

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
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-gray-400">Khong tim thay don hang</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Header */}
        <div className="card">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-red-600">
              Canh bao gian lan
            </h1>
            <span className="font-mono text-sm font-bold">
              {data.memo_code}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {formatCurrency(data.total_amount, data.currency)}
          </p>
          {data.flag_reason && (
            <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {data.flag_reason}
            </div>
          )}
        </div>

        {/* Bill Image */}
        {data.bill_image_url && (
          <div className="card p-2">
            <img
              src={data.bill_image_url}
              alt="Bill"
              className="w-full rounded-lg"
            />
            {data.ocr_data?.ocr_engine && (
              <p className="mt-2 text-center text-xs text-gray-400">
                OCR engine: {data.ocr_data.ocr_engine}
              </p>
            )}
          </div>
        )}

        {/* OCR Extracted Data */}
        {data.ocr_data && (
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700">
              Du lieu OCR trich xuat
            </h2>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Thoi gian bill</span>
                <span>{data.ocr_data.bill_time || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ma giao dich</span>
                <span className="font-mono">
                  {data.ocr_data.bill_memo || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">So tien</span>
                <span>
                  {data.ocr_data.bill_amount?.toLocaleString() || "—"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 4-Layer Fraud Check Results */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700">
            Ket qua kiem tra 4 lop
          </h2>
          <div className="mt-3 space-y-3">
            {data.fraud_logs?.map((log, i) => {
              const style = RESULT_STYLE[log.result] || RESULT_STYLE.flag;
              return (
                <div
                  key={i}
                  className="flex items-start justify-between rounded-lg bg-gray-50 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {CHECK_LABELS[log.check_type] || log.check_type}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {log.details}
                    </p>
                  </div>
                  <span className={style.className}>{style.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        {data.status === "flagged" && (
          <div className="flex gap-3">
            <button
              onClick={() => handleAction("approve")}
              disabled={acting}
              className="btn-primary flex-1 py-3"
            >
              {acting ? "..." : "Duyet don"}
            </button>
            <button
              onClick={() => handleAction("reject")}
              disabled={acting}
              className="flex-1 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              {acting ? "..." : "Tu choi"}
            </button>
          </div>
        )}

        {data.status !== "flagged" && (
          <div className="rounded-lg bg-gray-100 p-3 text-center text-sm text-gray-500">
            Trang thai hien tai:{" "}
            <span className="font-semibold">{data.status}</span>
          </div>
        )}
      </div>
    </div>
  );
}
