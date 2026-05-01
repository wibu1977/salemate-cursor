import axios, { type InternalAxiosRequestConfig } from "axios";
import { getToken, clearAuth } from "@/lib/auth";

/**
 * Trình duyệt luôn gọi same-origin `/api` → App Router proxy tới backend (BACKEND_INTERNAL_URL runtime).
 * Tránh CORS và tránh NEXT_PUBLIC_API_URL trỏ thẳng backend nhưng thiếu origin trong CORS.
 * SSR: gọi trực tiếp backend qua BACKEND_INTERNAL_URL / NEXT_PUBLIC_API_URL.
 */
function getApiBaseURL(): string {
  const serverEnv = (process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "")
    .replace(/\/$/, "");

  if (typeof window === "undefined") {
    if (serverEnv.startsWith("http://") || serverEnv.startsWith("https://")) {
      return serverEnv;
    }
    return "http://127.0.0.1:8000";
  }

  return "/api";
}

const api = axios.create({
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  config.baseURL = getApiBaseURL();
  if (typeof window !== "undefined") {
    const { getBrowserSupabase, isSupabaseAuthConfigured } = await import(
      "@/lib/supabase/browser"
    );
    if (isSupabaseAuthConfigured()) {
      const sb = getBrowserSupabase();
      if (sb) {
        const {
          data: { session },
        } = await sb.auth.getSession();
        if (session?.access_token) {
          config.headers.Authorization = `Bearer ${session.access_token}`;
          return config;
        }
      }
    }
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      const { getBrowserSupabase, isSupabaseAuthConfigured } = await import(
        "@/lib/supabase/browser"
      );
      if (isSupabaseAuthConfigured()) {
        const sb = getBrowserSupabase();
        if (sb) {
          const {
            data: { session },
          } = await sb.auth.getSession();
          if (session?.access_token) {
            /* Phiên Supabase vẫn có nhưng API trả 401 → gần như chắc backend thiếu/sai SUPABASE_JWT_SECRET
             * (hoặc JWT không HS256). Đừng signOut Supabase — chỉ báo để tránh “vừa đăng nhập đã văng”. */
            window.location.href =
              "/login?error=" +
              encodeURIComponent(
                "API từ chối token. Trên Railway → service Backend: đặt SUPABASE_JWT_SECRET = JWT Secret (Settings → API của Supabase, không phải anon key), rồi redeploy backend."
              );
            return Promise.reject(error);
          }
        }
      }
      await clearAuth();
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
    const onLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");
    if (onLocalhost) {
      return "Không kết nối được API. Hãy chạy backend (uvicorn trên 127.0.0.1:8000) và khởi động lại frontend.";
    }
    return (
      "Không kết nối được API. Trên Railway: (1) Service Frontend → Variables: " +
      "BACKEND_INTERNAL_URL = URL HTTPS của backend (vd. https://xxx.up.railway.app, không / cuối). " +
      "Biến này đọc khi chạy — thường không cần rebuild. " +
      "(2) Service Backend → CORS: thêm CORS_EXTRA_ORIGINS = URL dashboard (vd. https://your-frontend.up.railway.app) " +
      "hoặc mở rộng CORS_ORIGINS trong .env. " +
      "(3) F12 → Network: request tới /api/admin/... có status gì (502 = backend URL sai hoặc backend tắt)."
    );
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
  authMe: () => api.get<{ workspace_id: string; auth: string; email: string | null }>("/admin/auth/me"),
  facebookLogin: (accessToken: string) =>
    api.post("/admin/auth/facebook", { access_token: accessToken }),
  setupWorkspace: (data: Record<string, unknown>) =>
    api.post("/admin/auth/setup", data),
};
