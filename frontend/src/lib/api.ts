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

export type DuplicateStrategy = "skip" | "update" | "create_all";

export type ImportJobSummaryResult = {
  total_rows: number;
  created: number;
  updated: number;
  skipped?: number;
  errors: string[];
  errors_total?: number | null;
  error_csv?: string | null;
  dry_run?: boolean | null;
};

export const inventoryApi = {
  getProducts: () => api.get("/admin/inventory/products"),
  createProduct: (data: Record<string, unknown>) =>
    api.post("/admin/inventory/products", data),
  updateProduct: (id: string, data: Record<string, unknown>) =>
    api.patch(`/admin/inventory/products/${id}`, data),
  uploadProductImage: (productId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post<{
      id: string;
      image_url: string | null;
      name: string;
      description: string | null;
      category: string | null;
      price: number;
      currency: string;
      quantity: number;
      stock_threshold: number;
      is_active: boolean;
    }>(`/admin/inventory/products/${productId}/image`, fd);
  },
  sheetTabs: (spreadsheetId: string) =>
    api.get<{ titles: string[] }>(
      `/admin/inventory/google/spreadsheets/tabs`,
      { params: { spreadsheet_id: spreadsheetId } }
    ),
  sheetPreview: (
    spreadsheetId: string,
    sheetName: string,
    limit: number = 10,
    entity: string = "products"
  ) =>
    api.get<{
      rows: unknown[][];
      header_row: number;
      data_start_row: number;
    }>(`/admin/inventory/google/spreadsheets/preview`, {
      params: { spreadsheet_id: spreadsheetId, sheet_name: sheetName, limit, entity },
    }),
  importColumnSuggest: (headers: string[], entity: string = "products") =>
    api.post<{ suggestions: Record<string, { header: string | null; confidence: number }> }>(
      "/admin/inventory/import/columns/suggest",
      { headers, entity }
    ),
  listImportTemplates: (entity?: string) =>
    api.get<
      {
        id: string;
        entity: string;
        name: string;
        column_mapping: Record<string, string>;
        duplicate_strategy: string;
      }[]
    >("/admin/inventory/import/templates", { params: entity ? { entity } : undefined }),
  saveImportTemplate: (body: {
    entity?: string;
    name?: string;
    column_mapping: Record<string, string>;
    duplicate_strategy?: DuplicateStrategy;
  }) =>
    api.post("/admin/inventory/import/templates", {
      entity: body.entity ?? "products",
      name: body.name ?? "default",
      column_mapping: body.column_mapping,
      duplicate_strategy: body.duplicate_strategy ?? "update",
    }),
  validateSheets: (data: {
    spreadsheet_id: string;
    sheet_name: string;
    entity?: string;
    header_row: number;
    data_start_row: number;
    range_a1?: string | null;
    column_mapping?: Record<string, string>;
    duplicate_strategy?: DuplicateStrategy;
    ai_categories?: Record<string, string>;
    default_overrides?: Record<string, any>;
    manual_overrides?: Record<string, Record<string, any>>;
  }) => api.post<ImportJobSummaryResult>("/admin/inventory/import/sheets/validate", data),
  /** Dry-run validation for uploaded grids (rows từ bước preview). Corresponds POST /admin/inventory/import/validate. */
  validateImportGrid: (body: {
    entity?: string;
    rows: unknown[][];
    header_row: number;
    data_start_row: number;
    column_mapping?: Record<string, string>;
    duplicate_strategy?: DuplicateStrategy;
    ai_categories?: Record<string, string>;
    default_overrides?: Record<string, any>;
    manual_overrides?: Record<string, Record<string, any>>;
  }) =>
    api.post<ImportJobSummaryResult>("/admin/inventory/import/validate", body),
  importSheets: (data: {
    spreadsheet_id: string;
    sheet_name: string;
    entity?: string;
    header_row?: number;
    data_start_row?: number;
    range_a1?: string | null;
    column_mapping?: Record<string, string>;
    duplicate_strategy?: DuplicateStrategy;
    ai_categories?: Record<string, string>;
    default_overrides?: Record<string, any>;
    manual_overrides?: Record<string, Record<string, any>>;
  }) => api.post<{ job_id: string }>("/admin/inventory/import/sheets", data),
  importFilePreview: (file: File, maxRows: number = 50, entity: string = "products") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("max_rows", String(maxRows));
    fd.append("entity", entity);
    return api.post<{
      rows: unknown[][];
      header_row: number;
      data_start_row: number;
    }>("/admin/inventory/import/file/preview", fd);
  },
  analyzeImportFile: (file: File, entity: string = "products") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("entity", entity);
    return api.post<{
      matched_fields: Record<string, { header: string | null; confidence: number }>;
      missing_fields: string[];
      defaults_applied: Record<string, unknown>;
      total_rows: number;
      has_embedded_images: boolean;
      embedded_image_count: number;
    }>("/admin/inventory/import/analyze", fd);
  },
  categorizeProducts: (productNames: string[]) =>
    api.post<{ suggestions: Record<string, string> }>(
      "/admin/inventory/import/categorize",
      { product_names: productNames },
    ),
  importFile: (params: {
    file: File;
    entity?: string;
    header_row: number;
    data_start_row: number;
    column_mapping?: Record<string, string>;
    duplicate_strategy?: DuplicateStrategy;
    ai_categories?: Record<string, string>;
    default_overrides?: Record<string, any>;
    manual_overrides?: Record<string, Record<string, any>>;
  }) => {
    const fd = new FormData();
    fd.append("file", params.file);
    fd.append("entity", params.entity ?? "products");
    fd.append("header_row", String(params.header_row));
    fd.append("data_start_row", String(params.data_start_row));
    if (params.column_mapping && Object.keys(params.column_mapping).length) {
      fd.append("column_mapping_json", JSON.stringify(params.column_mapping));
    }
    fd.append("duplicate_strategy", params.duplicate_strategy ?? "update");
    if (params.ai_categories && Object.keys(params.ai_categories).length) {
      fd.append("ai_categories_json", JSON.stringify(params.ai_categories));
    }
    if (params.default_overrides && Object.keys(params.default_overrides).length) {
      fd.append("default_overrides_json", JSON.stringify(params.default_overrides));
    }
    if (params.manual_overrides && Object.keys(params.manual_overrides).length) {
      fd.append("manual_overrides_json", JSON.stringify(params.manual_overrides));
    }
    return api.post<{ job_id: string }>("/admin/inventory/import/file", fd);
  },
  importJob: (jobId: string) =>
    api.get<{
      id: string;
      status: string;
      progress_percent: number;
      result: ImportJobSummaryResult | null;
      error_message: string | null;
    }>(`/admin/inventory/import/jobs/${jobId}`),
};

export const googleAuthApi = {
  loginUrl: (next?: string) =>
    api.get<{ authorization_url: string }>("/admin/auth/google/login", {
      params: next ? { next } : undefined,
    }),
  status: () =>
    api.get<{ connected: boolean; oauth_configured: boolean }>(
      "/admin/auth/google/status"
    ),
  pickerConfig: () =>
    api.get<{
      access_token: string;
      client_id: string;
      developer_key: string | null;
    }>("/admin/auth/google/picker-config"),
};

export async function pollImportJob(
  jobId: string,
  options?: { intervalMs?: number; maxAttempts?: number }
): Promise<{
  id: string;
  status: string;
  progress_percent: number;
  result: ImportJobSummaryResult | null;
  error_message: string | null;
}> {
  const intervalMs = options?.intervalMs ?? 600;
  const maxAttempts = options?.maxAttempts ?? 180;
  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await inventoryApi.importJob(jobId);
    if (data.status === "completed" || data.status === "failed") {
      return data;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Import timeout — thử lại sau.");
}

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
  authMe: () =>
    api.get<{
      workspace_id: string;
      auth: string;
      email: string | null;
      onboarding_completed: boolean;
    }>("/admin/auth/me"),
  facebookLogin: (accessToken: string) =>
    api.post("/admin/auth/facebook", { access_token: accessToken }),
  setupWorkspace: (data: Record<string, unknown>) =>
    api.post("/admin/auth/setup", data),
};
