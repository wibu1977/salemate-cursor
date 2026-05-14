"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryApi, googleAuthApi, pollImportJob, formatApiError, type DuplicateStrategy } from "@/lib/api";
import { pickGoogleSpreadsheet } from "@/lib/googlePicker";
import { ColumnConnector, type ConnectorField } from "@/components/import/ColumnConnector";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { 
  Plus, 
  RefreshCw, 
  Table as TableIcon, 
  Search, 
  Edit3, 
  Box,
  Image as ImageIcon,
  Filter,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Layers,
  Sparkles,
  FolderOpen,
} from "lucide-react";

const PRODUCT_IMPORT_FIELDS: ConnectorField[] = [
  {
    key: "name",
    label: "Tên sản phẩm",
    required: true,
    icon: <Box className="h-4 w-4" />,
    description: "Dùng để nhận diện và cập nhật sản phẩm",
  },
  {
    key: "price",
    label: "Giá bán",
    icon: <DollarSign className="h-4 w-4" />,
    description: "Tiền tệ — hỗ trợ phân tách . ,",
  },
  {
    key: "quantity",
    label: "Số lượng",
    icon: <Layers className="h-4 w-4" />,
    description: "Tồn kho hiện tại",
  },
  {
    key: "stock_threshold",
    label: "Ngưỡng cảnh báo",
    icon: <AlertCircle className="h-4 w-4" />,
    description: "Báo động khi tồn thấp",
  },
  {
    key: "description",
    label: "Mô tả",
    icon: <ImageIcon className="h-4 w-4" />,
    description: "Chi tiết sản phẩm",
  },
  {
    key: "image_url",
    label: "Ảnh (URL)",
    icon: <ImageIcon className="h-4 w-4" />,
    description: "URL hình công khai",
  },
  {
    key: "category",
    label: "Danh mục",
    icon: <Layers className="h-4 w-4" />,
    description: "Phân loại / nhóm hàng",
  },
];

interface ProductData {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  currency: string;
  quantity: number;
  stock_threshold: number;
  image_url: string | null;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  category: "",
  price: 0,
  quantity: 0,
  stock_threshold: 5,
  image_url: "",
};

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductData | null>(null);
  const [showSync, setShowSync] = useState(false);
  const [importSource, setImportSource] = useState<"sheets" | "upload">("sheets");
  const [pickedSpreadsheetId, setPickedSpreadsheetId] = useState("");
  const [pickedSpreadsheetName, setPickedSpreadsheetName] = useState<string | null>(null);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [sheetName, setSheetName] = useState("Sheet1");
  const [importStep, setImportStep] = useState(0);
  const [headerRow, setHeaderRow] = useState(1);
  const [dataStartRow, setDataStartRow] = useState(2);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>("update");
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [filePreviewData, setFilePreviewData] = useState<{
    rows: unknown[][];
    header_row: number;
    data_start_row: number;
  } | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [validateSummary, setValidateSummary] = useState<{
    total_rows: number;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
    errors_total: number | null;
  } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: googleStatus } = useQuery({
    queryKey: ["google-oauth-status"],
    queryFn: () => googleAuthApi.status().then((r) => r.data),
  });

  const openGooglePickerForSheet = async () => {
    if (!googleStatus?.connected) {
      toast("Hãy kết nối Google trước.", "error");
      return;
    }
    setPickerBusy(true);
    try {
      const { data: cfg } = await googleAuthApi.pickerConfig();
      const key = cfg.developer_key?.trim();
      if (!key) {
        toast(
          "Thiếu GOOGLE_PICKER_API_KEY trên backend — cần khóa API Picker trong Google Cloud.",
          "error",
        );
        return;
      }
      const picked = await pickGoogleSpreadsheet(cfg.access_token, key);
      if (picked) {
        setPickedSpreadsheetId(picked.id);
        setPickedSpreadsheetName(picked.name || picked.id);
        setImportStep(0);
        setValidateSummary(null);
      }
    } catch (e: unknown) {
      toast(formatApiError(e), "error");
    } finally {
      setPickerBusy(false);
    }
  };

  const {
    data: tabData,
    isLoading: isLoadingTabs,
    isError: isTabsError,
    error: tabsError,
    refetch: refetchTabs,
  } = useQuery({
    queryKey: ["sheet-tabs", pickedSpreadsheetId],
    queryFn: () => inventoryApi.sheetTabs(pickedSpreadsheetId).then((r) => r.data),
    enabled:
      !!googleStatus?.connected &&
      importSource === "sheets" &&
      pickedSpreadsheetId.trim().length >= 15,
  });

  const {
    data: previewData,
    isLoading: isLoadingPreview,
    isError: isPreviewError,
    error: previewError,
    refetch: refetchPreview,
  } = useQuery({
    queryKey: ["sheet-preview", pickedSpreadsheetId, sheetName, importSource],
    queryFn: () =>
      inventoryApi.sheetPreview(pickedSpreadsheetId, sheetName, 10, "products").then((r) => r.data),
    enabled:
      importSource === "sheets" &&
      !!googleStatus?.connected &&
      !!pickedSpreadsheetId.trim() &&
      !!sheetName &&
      importStep === 1,
  });

  const filePreviewMutation = useMutation({
    mutationFn: (file: File) =>
      inventoryApi.importFilePreview(file, 50, "products").then((r) => r.data),
    onSuccess: (data) => {
      setFilePreviewData(data);
      setHeaderRow(data.header_row);
      setDataStartRow(data.data_start_row);
      setValidateSummary(null);
      setImportStep(1);
    },
    onError: (e: unknown) => toast(formatApiError(e), "error"),
  });

  const activePreview =
    importSource === "sheets" ? previewData : filePreviewData;
  const isLoadingActivePreview =
    importSource === "sheets" ? isLoadingPreview : filePreviewMutation.isPending;
  const isActivePreviewError =
    importSource === "sheets" ? isPreviewError : filePreviewMutation.isError;
  const activePreviewError =
    importSource === "sheets" ? previewError : filePreviewMutation.error;

  const previewHeaders = useMemo(() => {
    if (!activePreview?.rows?.length) return [];
    return activePreview.rows[0].map((h: unknown) => String(h ?? ""));
  }, [activePreview]);

  const sampleRowForConnector = useMemo(() => {
    if (!activePreview?.rows?.length) return undefined;
    const idx = Math.min(Math.max(dataStartRow - 1, 1), activePreview.rows.length - 1);
    return activePreview.rows[idx] as unknown[] | undefined;
  }, [activePreview, dataStartRow]);

  useEffect(() => {
    if (tabData?.titles?.length && !tabData.titles.includes(sheetName)) {
      setSheetName(tabData.titles[0]);
    }
  }, [tabData, sheetName]);

  useEffect(() => {
    if (importSource === "sheets" && previewData?.header_row != null) {
      setHeaderRow(previewData.header_row);
      setDataStartRow(previewData.data_start_row);
    }
  }, [importSource, previewData]);

  const previewHeaderKey = previewHeaders.join("|");

  useEffect(() => {
    if (!previewHeaders.length) return;
    let cancelled = false;
    inventoryApi
      .importColumnSuggest(previewHeaders, "products")
      .then(({ data }) => {
        if (cancelled) return;
        setColumnMapping((prev) => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(data.suggestions)) {
            if (v.header && v.confidence >= 0.65 && !next[k]) {
              next[k] = v.header;
            }
          }
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [previewHeaderKey]);

  useEffect(() => {
    if (!previewHeaders.length) return;
    setColumnMapping((mapping) => {
      const next = { ...mapping };
      const fields = [
        { key: "name", patterns: [/name/i, /tên/i, /product/i, /sản phẩm/i, /hàng/i] },
        { key: "price", patterns: [/price/i, /giá/i, /cost/i, /bán/i] },
        { key: "quantity", patterns: [/qty/i, /số lượng/i, /quantity/i, /stock/i, /tồn/i] },
        { key: "stock_threshold", patterns: [/threshold/i, /ngưỡng/i, /cảnh báo/i] },
        { key: "description", patterns: [/desc/i, /mô tả/i, /chi tiết/i, /note/i] },
        { key: "category", patterns: [/categor/i, /danh mục/i, /loại/i, /nhóm/i] },
      ];
      let changed = false;
      for (const f of fields) {
        if (!next[f.key]) {
          const found = previewHeaders.find((h) => f.patterns.some((p) => p.test(h)));
          if (found) {
            next[f.key] = found;
            changed = true;
          }
        }
      }
      return changed ? next : mapping;
    });
  }, [previewHeaderKey, sheetName, importSource]);

  const connectGoogle = () => {
    const next =
      typeof window !== "undefined"
        ? `${window.location.origin}/dashboard/inventory?google=connected`
        : "";
    googleAuthApi.loginUrl(next).then(({ data }) => {
      window.location.href = data.authorization_url;
    });
  };

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => inventoryApi.getProducts().then((r) => r.data),
  });

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchQuery) return products;
    const query = searchQuery.toLowerCase();
    return products.filter((p: ProductData) => 
      p.name.toLowerCase().includes(query) || 
      p.category?.toLowerCase().includes(query) ||
      p.id.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const stats = useMemo(() => {
    if (!products) return { total: 0, lowStock: 0, totalValue: 0 };
    return {
      total: products.length,
      lowStock: products.filter((p: ProductData) => p.quantity <= p.stock_threshold).length,
      totalValue: products.reduce((acc: number, p: ProductData) => acc + (p.price * p.quantity), 0)
    };
  }, [products]);

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) => inventoryApi.createProduct(data),
    onSuccess: () => {
      toast("Sản phẩm đã tạo thành công", "success");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setShowCreate(false);
      setForm(EMPTY_FORM);
    },
    onError: () => toast("Tạo sản phẩm thất bại", "error"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      inventoryApi.updateProduct(id, data),
    onSuccess: () => {
      toast("Cập nhật sản phẩm thành công", "success");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setEditProduct(null);
    },
    onError: () => toast("Cập nhật thất bại", "error"),
  });

  const validateImportMutation = useMutation({
    mutationFn: async () => {
      if (importSource === "sheets") {
        const { data } = await inventoryApi.validateSheets({
          spreadsheet_id: pickedSpreadsheetId,
          sheet_name: sheetName,
          entity: "products",
          header_row: headerRow,
          data_start_row: dataStartRow,
          column_mapping: columnMapping,
          duplicate_strategy: duplicateStrategy,
        });
        return data;
      }
      if (!filePreviewData?.rows?.length)
        throw new Error("Chưa có dữ liệu xem trước — chọn và tải file lại.");
      const { data } = await inventoryApi.validateImportGrid({
        entity: "products",
        rows: filePreviewData.rows as unknown[][],
        header_row: headerRow,
        data_start_row: dataStartRow,
        column_mapping: columnMapping,
        duplicate_strategy: duplicateStrategy,
      });
      return data;
    },
    onSuccess: (data) => {
      setValidateSummary({
        total_rows: data.total_rows,
        created: data.created,
        updated: data.updated,
        skipped: data.skipped ?? 0,
        errors: data.errors ?? [],
        errors_total: data.errors_total ?? data.errors?.length ?? 0,
      });
      toast("Kiểm tra thử (dry-run) xong — chưa ghi DB.", "success");
    },
    onError: (e: unknown) => toast(formatApiError(e), "error"),
  });

  const importSheetsMutation = useMutation({
    mutationFn: async () => {
      const { data: start } = await inventoryApi.importSheets({
        spreadsheet_id: pickedSpreadsheetId,
        sheet_name: sheetName,
        entity: "products",
        header_row: headerRow,
        data_start_row: dataStartRow,
        column_mapping: columnMapping,
        duplicate_strategy: duplicateStrategy,
      });
      return pollImportJob(String(start.job_id));
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ["google-oauth-status"] });
      if (job.status === "failed") {
        toast(job.error_message || "Import thất bại", "error");
        return;
      }
      const d = job.result;
      toast(
        `Đồng bộ xong: ${d?.created ?? 0} mới, ${d?.updated ?? 0} cập nhật, ${d?.skipped ?? 0} bỏ qua` +
          (d?.errors?.length ? ` (${d.errors.length} dòng lỗi mẫu)` : ""),
        "success"
      );
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setShowSync(false);
      setPickedSpreadsheetId("");
      setPickedSpreadsheetName(null);
      setImportStep(0);
      setColumnMapping({});
      setFilePreviewData(null);
      setUploadFileName(null);
      setValidateSummary(null);
    },
    onError: (e: unknown) => toast(formatApiError(e), "error"),
  });

  const importFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const { data: start } = await inventoryApi.importFile({
        file,
        entity: "products",
        header_row: headerRow,
        data_start_row: dataStartRow,
        column_mapping: columnMapping,
        duplicate_strategy: duplicateStrategy,
      });
      return pollImportJob(String(start.job_id));
    },
    onSuccess: (job) => {
      if (job.status === "failed") {
        toast(job.error_message || "Import file thất bại", "error");
        return;
      }
      const d = job.result;
      toast(
        `Nhập file xong: ${d?.created ?? 0} mới, ${d?.updated ?? 0} cập nhật, ${d?.skipped ?? 0} bỏ qua` +
          (d?.errors?.length ? ` (${d.errors.length} dòng lỗi mẫu)` : ""),
        "success"
      );
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setShowSync(false);
      setImportStep(0);
      setColumnMapping({});
      setFilePreviewData(null);
      setUploadFileName(null);
      setValidateSummary(null);
    },
    onError: (e: unknown) => toast(formatApiError(e), "error"),
  });

  const openEdit = (p: ProductData) => {
    setEditProduct(p);
    setForm({
      name: p.name,
      description: p.description || "",
      category: p.category || "",
      price: p.price,
      quantity: p.quantity,
      stock_threshold: p.stock_threshold,
      image_url: p.image_url || "",
    });
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowCreate(true);
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Header Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Quản lý kho hàng</h1>
          <p className="mt-2 text-base font-medium text-slate-500">Kiểm soát tồn kho và tự động đồng bộ với Google Sheets</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={() => setShowSync(!showSync)} 
            className="group flex items-center gap-3 rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 hover:ring-accent/25 active:scale-95"
          >
            <RefreshCw className={`h-5 w-5 text-accent group-hover:rotate-180 transition-transform duration-500 ${importSheetsMutation.isPending || importFileMutation.isPending ? 'animate-spin' : ''}`} />
            ĐỒNG BỘ SHEETS
          </button>
          <button 
            onClick={openCreate} 
            className="flex items-center gap-3 rounded-2xl bg-accent px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-accent/15 transition-all hover:bg-accent-hover hover:-translate-y-1 active:scale-95"
          >
            <Plus className="h-5 w-5" />
            THÊM SẢN PHẨM
          </button>
        </div>
      </div>

      {/* Sync Section Panel */}
      {showSync && (
        <div className="ai-glow relative overflow-hidden rounded-[2.5rem] border border-accent-soft bg-white p-8 shadow-2xl shadow-accent/15/50 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-soft/50 blur-3xl" />
          <div className="relative flex flex-col gap-8">
            <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-100/80 p-1.5 ring-1 ring-slate-200/60">
              <button
                type="button"
                onClick={() => {
                  setImportSource("sheets");
                  setImportStep(0);
                  setFilePreviewData(null);
                  setUploadFile(null);
                  setUploadFileName(null);
                  setValidateSummary(null);
                }}
                className={`rounded-xl px-5 py-2.5 text-xs font-black transition-all ${
                  importSource === "sheets"
                    ? "bg-white text-accent shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Google Sheets
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportSource("upload");
                  setImportStep(0);
                  setFilePreviewData(null);
                  setUploadFile(null);
                  setUploadFileName(null);
                  setValidateSummary(null);
                  setPickedSpreadsheetId("");
                  setPickedSpreadsheetName(null);
                }}
                className={`rounded-xl px-5 py-2.5 text-xs font-black transition-all ${
                  importSource === "upload"
                    ? "bg-white text-accent shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Tải file (CSV / Excel)
              </button>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                    <TableIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      {importSource === "sheets" ? "Google Sheets (OAuth)" : "Upload file"}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {importSource === "sheets"
                        ? "Chọn spreadsheet từ Google Drive → chọn tab → ánh xạ cột"
                        : "Chọn .csv, .xlsx hoặc .xls — cùng bước ánh xạ như Sheets"}
                    </p>
                  </div>
                </div>
                {googleStatus && !googleStatus.oauth_configured && (
                  <p className="text-sm font-medium text-amber-700">
                    Backend chưa cấu hình Google OAuth — cần GOOGLE_OAUTH_* trong biến môi trường.
                  </p>
                )}
                {googleStatus && googleStatus.oauth_configured && !googleStatus.connected && (
                  <button
                    type="button"
                    onClick={connectGoogle}
                    className="flex items-center justify-center gap-3 rounded-2xl bg-slate-900 px-8 py-4 text-sm font-black text-white shadow-xl transition hover:bg-black active:scale-95 lg:w-auto"
                  >
                    <Sparkles className="h-5 w-5 text-accent" />
                    KẾT NỐI GOOGLE
                  </button>
                )}
                {importSource === "sheets" && googleStatus?.connected && (
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                      <button
                        type="button"
                        disabled={pickerBusy}
                        onClick={() => void openGooglePickerForSheet()}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-8 py-3.5 text-sm font-black text-white shadow-lg transition hover:bg-black disabled:opacity-60"
                      >
                        {pickerBusy ? (
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                          <FolderOpen className="h-5 w-5 shrink-0 text-accent" />
                        )}
                        CHỌN FILE TỪ GOOGLE DRIVE
                      </button>
                      {pickedSpreadsheetId && (
                        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-50 px-5 py-3 text-xs ring-1 ring-emerald-200">
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                          <span className="max-w-[min(420px,80vw)] truncate font-black text-emerald-900">
                            {pickedSpreadsheetName || pickedSpreadsheetId}
                          </span>
                          <button
                            type="button"
                            onClick={() => void openGooglePickerForSheet()}
                            className="shrink-0 text-[11px] font-black uppercase tracking-wider text-accent underline-offset-4 hover:underline"
                          >
                            Đổi file
                          </button>
                        </div>
                      )}
                      {!pickedSpreadsheetId && !pickerBusy && (
                        <p className="text-xs font-bold text-slate-400">
                          Mở trình chọn file của Google và chọn trang tính cần nhập.
                        </p>
                      )}
                    </div>

                    {isTabsError && pickedSpreadsheetId ? (
                      <div className="space-y-3 rounded-2xl bg-rose-50 p-5 ring-1 ring-rose-100">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                          <div className="space-y-1">
                            <p className="text-sm font-black text-rose-900">Không đọc được danh sách tab</p>
                            <p className="text-xs font-medium text-rose-800/90">{formatApiError(tabsError)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void refetchTabs()}
                          className="rounded-xl bg-rose-900 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-rose-950"
                        >
                          Thử lại
                        </button>
                      </div>
                    ) : tabData?.titles?.length ? (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">
                            Chọn Tab (Worksheet)
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {tabData.titles.map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => {
                                  setSheetName(t);
                                  setImportStep(0);
                                }}
                                className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                                  sheetName === t
                                    ? "bg-accent text-white shadow-lg shadow-accent/20"
                                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                  }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>

                        {importStep === 0 && (
                          <button
                            type="button"
                            disabled={!pickedSpreadsheetId}
                            onClick={() => setImportStep(1)}
                            className="btn-premium w-full lg:w-auto disabled:opacity-50"
                          >
                            TIẾP THEO: ÁNH XẠ CỘT
                          </button>
                        )}
                      </div>
                    ) : pickedSpreadsheetId.trim().length >= 15 ? (
                      isLoadingTabs ? (
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
                          Đang đọc các tab...
                        </div>
                      ) : (
                        <p className="text-xs font-bold text-slate-400">
                          Spreadsheet không có tab hoặc chưa có dữ liệu tab.
                        </p>
                      )
                    ) : null}

                  </div>
                )}

                {importSource === "upload" && (
                  <div className="mt-2 space-y-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      File nguồn (.csv, .xlsx, .xls)
                    </label>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                      className="block w-full text-xs font-semibold file:mr-4 file:rounded-xl file:border-0 file:bg-accent file:px-4 file:py-2 file:font-black file:text-white"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setUploadFile(f);
                        setUploadFileName(f.name);
                        setValidateSummary(null);
                        filePreviewMutation.mutate(f);
                      }}
                    />
                    {uploadFileName ? (
                      <p className="text-xs font-bold text-slate-600">Đã chọn: {uploadFileName}</p>
                    ) : (
                      <p className="text-xs text-slate-400">Chọn file để xem trước và ánh xạ cột.</p>
                    )}
                  </div>
                )}

                {importStep === 1 &&
                  ((importSource === "sheets" &&
                    !!googleStatus?.connected &&
                    !!pickedSpreadsheetId.trim()) ||
                    (importSource === "upload" && !!filePreviewData)) && (
                  <div className="space-y-8 rounded-[2.5rem] bg-slate-50/50 p-8 ring-1 ring-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-wrap items-end gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Dòng tiêu đề (1-based)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={headerRow}
                          onChange={(e) => setHeaderRow(Number(e.target.value) || 1)}
                          className="mt-1 w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Dòng dữ liệu đầu
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={dataStartRow}
                          onChange={(e) => setDataStartRow(Number(e.target.value) || 2)}
                          className="mt-1 w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                        />
                      </div>
                      <div className="min-w-[200px] flex-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Trùng lặp (sản phẩm theo tên)
                        </label>
                        <select
                          value={duplicateStrategy}
                          onChange={(e) =>
                            setDuplicateStrategy(e.target.value as DuplicateStrategy)
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-black"
                        >
                          <option value="update">Cập nhật bản ghi trùng</option>
                          <option value="skip">Bỏ qua dòng trùng</option>
                          <option value="create_all">Luôn tạo mới</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-accent" />
                          Ánh xạ cột dữ liệu
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400">
                          Bấm cột trong file (trái), rồi bấm trường hệ thống (phải) để nối
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            inventoryApi
                              .saveImportTemplate({
                                entity: "products",
                                name: "default",
                                column_mapping: columnMapping,
                              })
                              .then(() => toast("Đã lưu mẫu ánh xạ (default).", "success"))
                              .catch((e: unknown) => toast(formatApiError(e), "error"))
                          }
                          className="rounded-xl bg-white px-3 py-2 text-[10px] font-black text-slate-600 ring-1 ring-slate-200"
                        >
                          Lưu mẫu
                        </button>
                        <button
                          onClick={() => setImportStep(0)}
                          className="group flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-[10px] font-black text-slate-500 shadow-sm ring-1 ring-slate-100 transition-all hover:bg-slate-50 hover:text-accent"
                        >
                          QUAY LẠI
                        </button>
                      </div>
                    </div>

                    {isLoadingActivePreview ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                          Đang phân tích dữ liệu...
                        </p>
                      </div>
                    ) : isActivePreviewError ? (
                      <div className="space-y-4 rounded-2xl bg-rose-50 p-6 ring-1 ring-rose-100">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                          <div className="space-y-1">
                            <p className="text-sm font-black text-rose-900">Không tải được xem trước</p>
                            <p className="text-xs font-medium text-rose-800/90">
                              {formatApiError(activePreviewError)}
                            </p>
                          </div>
                        </div>
                        {importSource === "sheets" && (
                          <button
                            type="button"
                            onClick={() => void refetchPreview()}
                            className="rounded-xl bg-rose-900 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-rose-950"
                          >
                            Thử lại
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="space-y-6">
                          <ColumnConnector
                            headers={previewHeaders}
                            sampleRow={sampleRowForConnector}
                            systemFields={PRODUCT_IMPORT_FIELDS}
                            mapping={columnMapping}
                            onChange={setColumnMapping}
                          />

                          {activePreview?.rows && activePreview.rows.length > 1 && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between px-1">
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                  Dữ liệu nguồn thực tế
                                </h5>
                                <span className="text-[9px] font-bold text-slate-300">
                                  Đang hiển thị 5 dòng đầu
                                </span>
                              </div>
                              <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm ring-1 ring-slate-200/50">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-[10px] font-bold">
                                    <thead>
                                      <tr className="border-b border-slate-50 bg-slate-50/50">
                                        {previewHeaders.map((h, i) => {
                                          const isMapped = Object.values(columnMapping).includes(
                                            h
                                          );
                                          return (
                                            <th
                                              key={i}
                                              className={`whitespace-nowrap px-6 py-4 transition-colors ${
                                                isMapped
                                                  ? "bg-accent/5 text-accent"
                                                  : "text-slate-400"
                                              }`}
                                            >
                                              <div className="flex items-center gap-2">
                                                {isMapped && <CheckCircle2 className="h-3 w-3" />}
                                                {h}
                                              </div>
                                            </th>
                                          );
                                        })}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                      {activePreview.rows.slice(1, 6).map((row: unknown[], i: number) => (
                                        <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                                          {row.map((cell, j) => {
                                            const isMapped = Object.values(columnMapping).includes(
                                              previewHeaders[j]
                                            );
                                            return (
                                              <td
                                                key={j}
                                                className={`whitespace-nowrap px-6 py-4 transition-colors ${
                                                  isMapped
                                                    ? "bg-accent/[0.02] text-slate-900"
                                                    : "text-slate-500 font-medium"
                                                }`}
                                              >
                                                {String(cell || "")}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {validateSummary && (
                      <div className="rounded-2xl bg-emerald-50/50 p-4 ring-1 ring-emerald-100">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">
                          Kết quả kiểm tra (dry-run)
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-700">
                          Tạo: {validateSummary.created} · Cập nhật: {validateSummary.updated} · Bỏ qua:{" "}
                          {validateSummary.skipped} · Dòng lỗi:{" "}
                          {validateSummary.errors_total ?? validateSummary.errors.length}
                        </p>
                        {validateSummary.errors.length > 0 && (
                          <ul className="mt-2 max-h-28 list-inside list-disc overflow-y-auto text-[10px] text-rose-700">
                            {validateSummary.errors.slice(0, 8).map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => validateImportMutation.mutate()}
                        disabled={validateImportMutation.isPending}
                        className="flex-1 rounded-2xl border-2 border-slate-200 bg-white py-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        {validateImportMutation.isPending ? "Đang kiểm tra..." : "KIỂM TRA (DRY-RUN)"}
                      </button>
                      <button
                        onClick={() => {
                          if (importSource === "upload") {
                            if (!uploadFile) {
                              toast("Chưa có file.", "error");
                              return;
                            }
                            importFileMutation.mutate(uploadFile);
                          } else {
                            importSheetsMutation.mutate();
                          }
                        }}
                        disabled={
                          importSheetsMutation.isPending ||
                          importFileMutation.isPending ||
                          (!columnMapping.name &&
                            !previewHeaders.some((h) => /name|tên|product/i.test(h)))
                        }
                        className="ai-glow flex-[2] rounded-2xl bg-accent py-4 text-sm font-black text-white shadow-2xl shadow-accent/20 transition-all hover:bg-accent-hover hover:-translate-y-1 active:scale-95 disabled:opacity-50 uppercase tracking-[0.2em]"
                      >
                        {importSheetsMutation.isPending || importFileMutation.isPending ? (
                          <div className="flex items-center justify-center gap-3">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ĐANG CHẠY...
                          </div>
                        ) : importSource === "upload" ? (
                          "NHẬP TỪ FILE"
                        ) : (
                          "BẮT ĐẦU NHẬP DỮ LIỆU"
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="card-premium group">
          <div className="flex items-center justify-between">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-900 group-hover:bg-accent group-hover:text-white transition-all duration-500">
              <Layers className="h-7 w-7" />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tổng sản phẩm</p>
              <p className="text-3xl font-black text-slate-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="card-premium group border-rose-100 bg-rose-50/10">
          <div className="flex items-center justify-between">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-all duration-500">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500/70">Sắp hết hàng</p>
              <p className="text-3xl font-black text-slate-900">{stats.lowStock}</p>
            </div>
          </div>
        </div>
        <div className="card-premium group border-accent-soft bg-accent-soft/10">
          <div className="flex items-center justify-between">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent group-hover:bg-accent group-hover:text-white transition-all duration-500">
              <DollarSign className="h-7 w-7" />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/70">Tổng giá trị kho</p>
              <p className="text-3xl font-black text-slate-900">{formatCurrency(stats.totalValue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Tìm theo tên, ID, danh mục..."
              className="w-full rounded-2xl border-none bg-white py-3.5 pl-12 pr-4 text-sm font-semibold shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-accent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-slate-600 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50">
              <Filter className="h-4 w-4" />
              LỌC DANH MỤC
            </button>
          </div>
        </div>

        <div className="card-premium overflow-hidden border-slate-100 p-0 shadow-2xl shadow-slate-200/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Sản phẩm</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Danh mục</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Giá bán</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tồn kho</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Trạng thái</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={6} className="px-8 py-8 text-center">
                          <div className="h-10 w-full animate-pulse rounded-2xl bg-slate-50" />
                        </td>
                      </tr>
                    ))
                  : filteredProducts.length
                    ? filteredProducts.map((p: ProductData) => {
                        const isLowStock = p.quantity <= p.stock_threshold;
                        const stockPercent = Math.min((p.quantity / (p.stock_threshold * 4)) * 100, 100);
                        
                        return (
                          <tr key={p.id} className="group transition-all hover:bg-accent-soft/30">
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-5">
                                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-4 ring-white shadow-sm">
                                  {p.image_url ? (
                                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                                      <ImageIcon className="h-6 w-6" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-base font-black text-slate-900 group-hover:text-accent transition-colors">{p.name}</span>
                                  <span className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-widest">SKU: {p.id.slice(0, 8)}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                {p.category || "GENERAL"}
                              </span>
                            </td>
                            <td className="px-8 py-6 font-black text-slate-900 text-sm">{formatCurrency(p.price, p.currency)}</td>
                            <td className="px-8 py-6">
                              <div className="flex flex-col gap-2 min-w-[120px]">
                                <div className="flex items-center justify-between">
                                  <span className={`text-sm font-black ${isLowStock ? 'text-rose-600' : 'text-slate-900'}`}>{p.quantity} <span className="text-[10px] text-slate-400 font-bold uppercase">đv</span></span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Ngưỡng: {p.stock_threshold}</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-1000 ${isLowStock ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                                    style={{ width: `${stockPercent}%` }} 
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              {isLowStock ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-1.5 text-[10px] font-black text-rose-600 ring-1 ring-rose-200">
                                  <div className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
                                  SẮP HẾT
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-[10px] font-black text-emerald-600 ring-1 ring-emerald-200">
                                  <CheckCircle2 className="h-3 w-3" />
                                  CÒN HÀNG
                                </span>
                              )}
                            </td>
                            <td className="px-8 py-6 text-right">
                              <button 
                                onClick={() => openEdit(p)} 
                                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 transition-all hover:bg-accent hover:text-white"
                              >
                                <Edit3 className="h-5 w-5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    : (
                      <tr>
                        <td colSpan={6} className="px-8 py-32 text-center">
                          <div className="mx-auto flex max-w-sm flex-col items-center gap-6">
                            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-50 text-slate-200 ring-4 ring-white shadow-inner">
                              <Box className="h-10 w-10" />
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-black text-slate-900 uppercase tracking-widest">Kho hàng đang trống</p>
                              <p className="text-sm font-medium text-slate-400 leading-relaxed">Bắt đầu bằng cách thêm sản phẩm mới hoặc đồng bộ hóa với Google Sheets.</p>
                            </div>
                            <button onClick={openCreate} className="btn-premium px-8">TẠO SẢN PHẨM ĐẦU TIÊN</button>
                          </div>
                        </td>
                      </tr>
                    )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      <Modal
        open={showCreate || !!editProduct}
        onClose={() => { setShowCreate(false); setEditProduct(null); }}
        title={editProduct ? "CHỈNH SỬA SẢN PHẨM" : "SẢN PHẨM MỚI"}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Left Column: Visuals */}
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-4">
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 px-2">Hình ảnh đại diện</h4>
              <div className="group relative aspect-square w-full overflow-hidden rounded-[2.5rem] border-8 border-slate-50 bg-slate-100 shadow-2xl shadow-slate-200 transition-all hover:shadow-accent/15/50">
                {form.image_url ? (
                  <img src={form.image_url} alt="Preview" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-slate-300">
                    <ImageIcon className="h-16 w-16" />
                    <p className="text-xs font-black uppercase tracking-widest">Chưa có ảnh</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-xs font-black text-white border-2 border-white/50 rounded-full px-6 py-2 backdrop-blur-sm">CẬP NHẬT ẢNH</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-accent-soft/50 p-6 space-y-4">
              <div className="flex items-center gap-3 text-accent">
                <AlertCircle className="h-5 w-5" />
                <h5 className="text-xs font-black uppercase tracking-widest">Gợi ý AI cho kho</h5>
              </div>
              <p className="text-xs font-bold leading-relaxed text-slate-600">
                Sản phẩm này có nhu cầu cao vào cuối tuần. Hãy cân nhắc đặt ngưỡng cảnh báo tồn kho ở mức{" "}
                <strong>15 đơn vị</strong> để tránh gián đoạn kinh doanh.
              </p>
            </div>
          </div>

          {/* Right Column: Form */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-6">
              <Field 
                label="Tên sản phẩm" 
                value={form.name} 
                onChange={(v) => setForm({ ...form, name: v })} 
                placeholder="Ví dụ: Cơm cuộn Hàn Quốc - Kimchi"
                icon={<Box className="h-5 w-5" />}
              />
              
              <div className="grid grid-cols-2 gap-6">
                <Field 
                  label="Danh mục" 
                  value={form.category} 
                  onChange={(v) => setForm({ ...form, category: v })} 
                  placeholder="Thực phẩm"
                />
                <Field 
                  label="Giá bán (KRW)" 
                  value={String(form.price)} 
                  onChange={(v) => setForm({ ...form, price: Number(v) || 0 })} 
                  type="number" 
                  icon={<DollarSign className="h-5 w-5" />}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <Field 
                  label="Tồn kho hiện tại" 
                  value={String(form.quantity)} 
                  onChange={(v) => setForm({ ...form, quantity: Number(v) || 0 })} 
                  type="number" 
                />
                <Field 
                  label="Ngưỡng cảnh báo" 
                  value={String(form.stock_threshold)} 
                  onChange={(v) => setForm({ ...form, stock_threshold: Number(v) || 0 })} 
                  type="number" 
                />
              </div>

              <Field 
                label="Mô tả sản phẩm" 
                value={form.description} 
                onChange={(v) => setForm({ ...form, description: v })} 
                isTextArea
                placeholder="Chi tiết về thành phần, hương vị..."
              />

              <Field 
                label="Đường dẫn ảnh (URL)" 
                value={form.image_url} 
                onChange={(v) => setForm({ ...form, image_url: v })} 
                placeholder="https://images.unsplash.com/photo-..."
                icon={<ImageIcon className="h-5 w-5" />}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={() => { setShowCreate(false); setEditProduct(null); }}
                className="flex-1 rounded-2xl bg-white border-2 border-slate-100 py-4 text-sm font-black text-slate-500 transition-all hover:bg-slate-50 active:scale-95 uppercase tracking-widest"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  if (editProduct) {
                    updateMutation.mutate({ id: editProduct.id, data: form });
                  } else {
                    createMutation.mutate(form);
                  }
                }}
                disabled={!form.name || createMutation.isPending || updateMutation.isPending}
                className="ai-glow flex-[2] rounded-2xl bg-accent py-4 text-sm font-black text-white shadow-2xl shadow-accent/20 transition-all hover:bg-accent-hover hover:-translate-y-1 active:scale-95 disabled:opacity-50 uppercase tracking-[0.2em]"
              >
                {createMutation.isPending || updateMutation.isPending ? "ĐANG LƯU..." : editProduct ? "Lưu thay đổi" : "Tạo sản phẩm"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, icon, isTextArea = false
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; icon?: React.ReactNode; isTextArea?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">{label}</label>
      <div className="relative">
        {icon && (
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </div>
        )}
        {isTextArea ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-32 w-full rounded-[1.5rem] border-none bg-slate-50/50 px-6 py-4 text-sm font-semibold shadow-inner outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-accent"
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full rounded-[1.5rem] border-none bg-slate-50/50 ${icon ? 'pl-14' : 'px-6'} py-4 text-sm font-semibold shadow-inner outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-accent`}
          />
        )}
      </div>
    </div>
  );
}
