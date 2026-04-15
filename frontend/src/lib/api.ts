import axios, { type InternalAxiosRequestConfig } from "axios";
import { getToken, clearAuth } from "@/lib/auth";

/**
 * Trên trình duyệt, nếu gọi thẳng http://127.0.0.1:8000 từ trang https://localhost
 * thì bị chặn mixed content (và CORS preflight dễ lỗi). next.config.js đã rewrite
 * /api/* → backend; dùng baseURL "/api" trên client khi API là HTTP local.
 * Production: NEXT_PUBLIC_API_URL=https://api... → gọi trực tiếp HTTPS.
 */
function getApiBaseURL(): string {
  const env = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

  if (typeof window === "undefined") {
    return env || "http://127.0.0.1:8000";
  }

  if (env.startsWith("https://")) {
    return env;
  }

  if (!env || env.startsWith("http://")) {
    return "/api";
  }

  return env;
}

const api = axios.create({
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.baseURL = getApiBaseURL();
  if (typeof window !== "undefined") {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      clearAuth();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

/** Thông báo lỗi hiển thị cho người dùng (đăng nhập, dashboard). */
export function formatApiError(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : String(err);
  }
  if (err.code === "ERR_NETWORK" || err.message === "Network Error") {
    return "Không kết nối được API. Hãy chạy backend (uvicorn trên 127.0.0.1:8000) và khởi động lại frontend.";
  }

  const raw = err.response?.data;
  // Một số proxy / lỗi ASGI trả về text thuần, không phải JSON { detail }
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }

  const data = raw as { detail?: unknown } | undefined;
  if (data?.detail !== undefined) {
    const d = data.detail;
    if (typeof d === "string") return d;
    if (d && typeof d === "object" && "message" in d) {
      const m = (d as { message?: string }).message;
      if (typeof m === "string") return m;
    }
    return JSON.stringify(d);
  }

  const status = err.response?.status;
  if (status) {
    const empty =
      raw === "" ||
      raw === undefined ||
      (typeof raw === "object" && raw !== null && Object.keys(raw).length === 0);
    if (empty) {
      return (
        `Lỗi máy chủ (HTTP ${status}). Phản hồi trống — thường do Next.js không proxy được tới backend ` +
        `hoặc có nhiều tiến trình chiếm cổng 8000. Tắt hết uvicorn, chỉ chạy một lệnh trong thư mục backend, ` +
        `rồi thử lại (và xem terminal uvicorn có dòng POST /admin/auth/facebook không).`
      );
    }
    return `Lỗi máy chủ (HTTP ${status}).`;
  }
  return err.message || "Lỗi không xác định";
}

export default api;

export const dashboardApi = {
  getSummary: () => api.get("/admin/dashboard/summary"),
  getOrders: (params?: Record<string, string>) =>
    api.get("/admin/orders", { params }),
  getOrderDetail: (id: string) => api.get(`/admin/orders/${id}`),
  orderAction: (id: string, action: string, note?: string) =>
    api.post(`/admin/orders/${id}/action`, { action, note }),
};

export const inventoryApi = {
  getProducts: () => api.get("/admin/inventory/products"),
  createProduct: (data: Record<string, unknown>) =>
    api.post("/admin/inventory/products", data),
  updateProduct: (id: string, data: Record<string, unknown>) =>
    api.patch(`/admin/inventory/products/${id}`, data),
  syncSheets: (spreadsheetId: string, sheetName?: string) =>
    api.post("/admin/inventory/sync", {
      spreadsheet_id: spreadsheetId,
      sheet_name: sheetName || "Sheet1",
    }),
};

export const campaignApi = {
  getSegments: () => api.get("/admin/campaigns/segments"),
  getCampaigns: () => api.get("/admin/campaigns"),
  getCampaign: (id: string) => api.get(`/admin/campaigns/${id}`),
  createCampaign: (data: Record<string, unknown>) =>
    api.post("/admin/campaigns", data),
  approveCampaign: (id: string, action: string, customMessage?: string) =>
    api.post(`/admin/campaigns/${id}/approve`, {
      action,
      custom_message: customMessage,
    }),
  updateCampaign: (id: string, data: { name?: string; message_template?: string }) =>
    api.patch(`/admin/campaigns/${id}`, data),
  deleteCampaign: (id: string) => api.delete(`/admin/campaigns/${id}`),
};

export const pagesApi = {
  listPages: () => api.get("/admin/pages"),
  connectPage: (data: Record<string, unknown>) =>
    api.post("/admin/pages", data),
  disconnectPage: (id: string) => api.delete(`/admin/pages/${id}`),
};

export const authApi = {
  facebookLogin: (accessToken: string) =>
    api.post("/admin/auth/facebook", { access_token: accessToken }),
  setupWorkspace: (data: Record<string, unknown>) =>
    api.post("/admin/auth/setup", data),
};
