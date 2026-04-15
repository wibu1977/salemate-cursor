import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "KRW"): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export const ORDER_STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: "Chờ xử lý", className: "badge-warning" },
  payment_sent: { label: "Đã thanh toán", className: "badge-info" },
  confirmed: { label: "Xác nhận", className: "badge-success" },
  flagged: { label: "Cảnh báo", className: "badge-danger" },
  rejected: { label: "Từ chối", className: "badge-danger" },
  cancelled: { label: "Đã hủy", className: "badge-danger" },
  completed: { label: "Hoàn thành", className: "badge-success" },
};
