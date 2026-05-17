"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inventoryApi, googleAuthApi, pollImportJob, formatApiError, type DuplicateStrategy } from "@/lib/api";
import { pickGoogleSpreadsheet } from "@/lib/googlePicker";
import { ColumnConnector, type ConnectorField } from "@/components/import/ColumnConnector";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
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
  X,
  Info,
  Check,
  ChevronRight,
  ChevronLeft,
  UploadCloud,
  ArrowRight,
} from "lucide-react";
import { ImportAnalysisBanner } from "@/components/import/ImportAnalysisBanner";
import { ImportRefineTable } from "@/components/import/ImportRefineTable";
import { ImportCategorySidebar } from "@/components/import/ImportCategorySidebar";
import { BulkActionBar } from "@/components/import/BulkActionBar";

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

interface ImportWizardModalProps {
  open: boolean;
  onClose: () => void;
  googleStatus?: {
    connected: boolean;
    oauth_configured: boolean;
  };
}

export function ImportWizardModal({ open, onClose, googleStatus }: ImportWizardModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Wizard State
  const [currentStep, setCurrentStep] = useState(1);
  const [importSource, setImportSource] = useState<"sheets" | "upload">("sheets");
  
  // Step 1: Selection State
  const [pickedSpreadsheetId, setPickedSpreadsheetId] = useState("");
  const [pickedSpreadsheetName, setPickedSpreadsheetName] = useState<string | null>(null);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [sheetName, setSheetName] = useState("Sheet1");
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Step 2: Mapping State
  const [headerRow, setHeaderRow] = useState(1);
  const [dataStartRow, setDataStartRow] = useState(2);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>("update");
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [filePreviewData, setFilePreviewData] = useState<{
    rows: unknown[][];
    header_row: number;
    data_start_row: number;
  } | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    matched_fields: Record<string, { header: string | null; confidence: number }>;
    missing_fields: string[];
    defaults_applied: Record<string, unknown>;
    total_rows: number;
    has_embedded_images: boolean;
    embedded_image_count: number;
  } | null>(null);
  const [defaultOverrides, setDefaultOverrides] = useState<Record<string, string>>({});

  // Step 3: AI Review State
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, string>>({});
  const [aiAccepted, setAiAccepted] = useState<Set<string>>(new Set());
  const [manualOverrides, setManualOverrides] = useState<Record<string, Record<string, any>>>({});

  // Step 4: Validation State
  const [validateSummary, setValidateSummary] = useState<{
    total_rows: number;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
    errors_total: number | null;
  } | null>(null);

  // Trigger dry-run automatically when entering Step 4
  useEffect(() => {
    if (currentStep === 4 && !validateSummary && !validateImportMutation.isPending) {
      validateImportMutation.mutate();
    }
  }, [currentStep, validateSummary]);

  // Reset validation when going back to refinement
  useEffect(() => {
    if (currentStep < 4 && validateSummary) {
      setValidateSummary(null);
    }
  }, [currentStep]);

  // --- Queries & Mutations ---
  const { data: tabData, isLoading: isLoadingTabs } = useQuery({
    queryKey: ["sheet-tabs", pickedSpreadsheetId],
    queryFn: () => inventoryApi.sheetTabs(pickedSpreadsheetId).then((r) => r.data),
    enabled: open && !!googleStatus?.connected && importSource === "sheets" && pickedSpreadsheetId.length >= 15,
  });

  const { data: previewData, isLoading: isLoadingPreview } = useQuery({
    queryKey: ["sheet-preview", pickedSpreadsheetId, sheetName],
    queryFn: () => inventoryApi.sheetPreview(pickedSpreadsheetId, sheetName, 10, "products").then((r) => r.data),
    enabled: open && importSource === "sheets" && !!googleStatus?.connected && !!pickedSpreadsheetId && !!sheetName && currentStep >= 2,
  });

  const filePreviewMutation = useMutation({
    mutationFn: (file: File) => inventoryApi.importFilePreview(file, 50, "products").then((r) => r.data),
    onSuccess: (data) => {
      setFilePreviewData(data);
      setHeaderRow(data.header_row);
      setDataStartRow(data.data_start_row);
      setValidateSummary(null);
    },
  });

  const analyzeFileMutation = useMutation({
    mutationFn: (file: File) => inventoryApi.analyzeImportFile(file, "products").then((r) => r.data),
    onSuccess: (data) => setAnalysisResult(data),
  });

  const categorizeMutation = useMutation({
    mutationFn: (names: string[]) => inventoryApi.categorizeProducts(names).then(r => r.data),
    onSuccess: (data) => {
      setAiSuggestions(data.suggestions);
    },
    onError: (e) => {
      toast(formatApiError(e), "error");
    }
  });

  const validateImportMutation = useMutation({
    mutationFn: async () => {
      const ai_categories: Record<string, string> = {};
      Object.keys(aiSuggestions).forEach(name => {
        if (aiAccepted.has(name)) {
          ai_categories[name] = manualOverrides[name]?.category || aiSuggestions[name];
        }
      });

      if (importSource === "sheets") {
        return inventoryApi.validateSheets({
          spreadsheet_id: pickedSpreadsheetId,
          sheet_name: sheetName,
          entity: "products",
          header_row: headerRow,
          data_start_row: dataStartRow,
          column_mapping: columnMapping,
           duplicate_strategy: duplicateStrategy,
          ai_categories,
          default_overrides: defaultOverrides,
          manual_overrides: manualOverrides,
        }).then(r => r.data);
      }
      return inventoryApi.validateImportGrid({
        entity: "products",
        rows: filePreviewData?.rows as unknown[][],
        header_row: headerRow,
        data_start_row: dataStartRow,
        column_mapping: columnMapping,
        duplicate_strategy: duplicateStrategy,
        ai_categories,
        default_overrides: defaultOverrides,
        manual_overrides: manualOverrides,
      }).then(r => r.data);
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
      toast("Dry-run hoàn tất", "success");
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const ai_categories: Record<string, string> = {};
      Object.keys(aiSuggestions).forEach(name => {
        if (aiAccepted.has(name)) {
          ai_categories[name] = manualOverrides[name]?.category || aiSuggestions[name];
        }
      });

      let start;
      if (importSource === "sheets") {
        const res = await inventoryApi.importSheets({
          spreadsheet_id: pickedSpreadsheetId,
          sheet_name: sheetName,
          entity: "products",
          header_row: headerRow,
          data_start_row: dataStartRow,
          column_mapping: columnMapping,
          duplicate_strategy: duplicateStrategy,
          ai_categories,
          default_overrides: defaultOverrides,
          manual_overrides: manualOverrides,
        });
        start = res.data;
      } else {
        const res = await inventoryApi.importFile({
          file: uploadFile!,
          entity: "products",
          header_row: headerRow,
          data_start_row: dataStartRow,
          column_mapping: columnMapping,
          duplicate_strategy: duplicateStrategy,
          ai_categories,
          default_overrides: defaultOverrides,
          manual_overrides: manualOverrides,
        });
        start = res.data;
      }
      return pollImportJob(String(start.job_id));
    },
    onSuccess: (job) => {
      if (job.status === "failed") {
        toast(job.error_message || "Import thất bại", "error");
        return;
      }
      toast(`Nhập dữ liệu thành công!`, "success");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
  });

  // --- Handlers ---
  const handleSheetPick = async () => {
    setPickerBusy(true);
    try {
      const { data: cfg } = await googleAuthApi.pickerConfig();
      const picked = await pickGoogleSpreadsheet(cfg.access_token, cfg.developer_key ?? "");
      if (picked) {
        setPickedSpreadsheetId(picked.id);
        setPickedSpreadsheetName(picked.name || picked.id);
      }
    } catch (e) {
      toast(formatApiError(e), "error");
    } finally {
      setPickerBusy(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadFile(f);
    setUploadFileName(f.name);
    filePreviewMutation.mutate(f);
    analyzeFileMutation.mutate(f);
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 4));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  // --- Helpers ---
  const activePreview = importSource === "sheets" ? previewData : filePreviewData;
  const previewHeaders = useMemo(() => {
    if (!activePreview?.rows?.length) return [];
    const idx = Math.max(0, headerRow - 1);
    const row = activePreview.rows[idx] as unknown[] | undefined;
    return row?.map((h, i) => String(h || "").trim() || `(Cột ${i + 1})`) || [];
  }, [activePreview, headerRow]);

  const sampleRow = useMemo(() => {
    if (!activePreview?.rows?.length) return undefined;
    const idx = Math.min(Math.max(dataStartRow - 1, 0), activePreview.rows.length - 1);
    return activePreview.rows[idx] as unknown[] | undefined;
  }, [activePreview, dataStartRow]);

  // --- Step Components ---

  const Step1_SourceSelection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setImportSource("sheets")}
          className={`flex flex-col items-center gap-4 rounded-[2rem] p-8 transition-all ${
            importSource === "sheets" 
              ? "bg-accent/5 ring-2 ring-accent shadow-xl shadow-accent/10" 
              : "bg-slate-50 hover:bg-slate-100 ring-1 ring-slate-200"
          }`}
        >
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${importSource === "sheets" ? "bg-accent text-white" : "bg-white text-slate-400"}`}>
            <TableIcon className="h-8 w-8" />
          </div>
          <div className="text-center">
            <span className="block text-sm font-black text-slate-900 uppercase tracking-widest">Google Sheets</span>
            <span className="text-[10px] font-bold text-slate-400">Kết nối trực tiếp</span>
          </div>
        </button>

        <button
          onClick={() => setImportSource("upload")}
          className={`flex flex-col items-center gap-4 rounded-[2rem] p-8 transition-all ${
            importSource === "upload" 
              ? "bg-accent/5 ring-2 ring-accent shadow-xl shadow-accent/10" 
              : "bg-slate-50 hover:bg-slate-100 ring-1 ring-slate-200"
          }`}
        >
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${importSource === "upload" ? "bg-accent text-white" : "bg-white text-slate-400"}`}>
            <UploadCloud className="h-8 w-8" />
          </div>
          <div className="text-center">
            <span className="block text-sm font-black text-slate-900 uppercase tracking-widest">Tải File Lên</span>
            <span className="text-[10px] font-bold text-slate-400">CSV, XLSX, XLS</span>
          </div>
        </button>
      </div>

      <div className="card-premium border-slate-100 bg-slate-50/50">
        {importSource === "sheets" ? (
          <div className="space-y-4">
            {!googleStatus?.connected ? (
              <div className="text-center py-4">
                <p className="text-sm font-bold text-slate-500 mb-4">Bạn chưa kết nối tài khoản Google</p>
                <button 
                  onClick={() => {
                    const next = typeof window !== "undefined" ? `${window.location.origin}/dashboard/inventory?google=connected` : "";
                    googleAuthApi.loginUrl(next).then(({ data }) => window.location.href = data.authorization_url);
                  }}
                  className="btn-premium"
                >
                  KẾT NỐI NGAY
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <button 
                  onClick={handleSheetPick}
                  disabled={pickerBusy}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition-all"
                >
                  {pickerBusy ? <RefreshCw className="h-5 w-5 animate-spin" /> : <FolderOpen className="h-5 w-5 text-accent" />}
                  {pickedSpreadsheetName || "CHỌN FILE TỪ DRIVE"}
                </button>

                {tabData?.titles && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Chọn Tab dữ liệu</label>
                    <div className="flex flex-wrap gap-2">
                      {tabData.titles.map(t => (
                        <button
                          key={t}
                          onClick={() => setSheetName(t)}
                          className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                            sheetName === t ? "bg-accent text-white shadow-lg" : "bg-white text-slate-500 ring-1 ring-slate-200"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[10px] font-semibold leading-relaxed text-slate-500 px-1">
                  <strong>Ảnh:</strong> Google Sheets chỉ nhập được nếu có <strong>cột URL dạng text</strong> (hoặc kết quả công thức là URL).
                  Ảnh chèn trực tiếp vào ô không được API đọc — dùng file <strong>XLSX có ảnh nhúng</strong> hoặc thêm ảnh sau khi nhập trong &quot;Kho hàng&quot;.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative group">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              />
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 group-hover:border-accent group-hover:bg-accent/5 transition-all">
                <UploadCloud className="h-8 w-8 text-slate-300 group-hover:text-accent" />
                <span className="text-sm font-black text-slate-600 uppercase tracking-widest">
                  {uploadFileName || "Nhấn hoặc kéo thả file vào đây"}
                </span>
                <span className="text-[10px] font-bold text-slate-400">Hỗ trợ .csv, .xlsx, .xls</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <button
          disabled={importSource === "sheets" ? !pickedSpreadsheetId : !uploadFile}
          onClick={nextStep}
          className="btn-premium flex items-center gap-2"
        >
          TIẾP THEO <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const Step2_Mapping = () => (
    <div className="space-y-8 max-h-[60vh] overflow-y-auto px-1 custom-scrollbar">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Dòng tiêu đề</label>
          <input 
            type="number" 
            value={headerRow} 
            onChange={e => setHeaderRow(Number(e.target.value))}
            className="w-full rounded-[1.5rem] border-none bg-white px-6 py-4 text-sm font-bold shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-accent transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Dòng bắt đầu dữ liệu</label>
          <input 
            type="number" 
            value={dataStartRow} 
            onChange={e => setDataStartRow(Number(e.target.value))}
            className="w-full rounded-[1.5rem] border-none bg-white px-6 py-4 text-sm font-bold shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-accent transition-all"
          />
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-2 px-1">
          <Layers className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Cấu hình ánh xạ</h3>
        </div>
        <ColumnConnector
          headers={previewHeaders}
          sampleRow={sampleRow}
          systemFields={PRODUCT_IMPORT_FIELDS}
          mapping={columnMapping}
          onChange={setColumnMapping}
        />
      </div>

      {analysisResult && (
        <ImportAnalysisBanner
          analysisResult={analysisResult}
          systemFields={PRODUCT_IMPORT_FIELDS}
          defaultOverrides={defaultOverrides}
          onOverrideChange={(field, val) => setDefaultOverrides(prev => ({ ...prev, [field]: val }))}
        />
      )}

      <div className="flex justify-between pt-6 border-t border-slate-100">
        <button onClick={prevStep} className="btn-glass flex items-center gap-2 text-xs py-3 px-8">
          <ChevronLeft className="h-4 w-4" /> QUAY LẠI
        </button>
        <button onClick={nextStep} className="btn-premium flex items-center gap-2 py-3 px-8">
          TIẾP THEO <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const Step3_Refine = () => {
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const nameCol = columnMapping.name;
    const nameIdx = nameCol ? previewHeaders.indexOf(nameCol) : -1;
    const dataRows = activePreview?.rows?.slice(Math.max(0, dataStartRow - 1)) || [];
    const names = nameIdx >= 0 ? [...new Set(dataRows.map((r: any) => String(r[nameIdx] || "").trim()).filter(Boolean))] : [];
    
    const runCategorization = () => {
      categorizeMutation.mutate(names as string[]);
    };

    const handleApplyBulkCategory = (cat: string) => {
      setManualOverrides(prev => {
        const next = { ...prev };
        selectedRows.forEach(name => {
          next[name] = { ...next[name], category: cat };
        });
        return next;
      });
      setAiAccepted(prev => {
        const next = new Set(prev);
        selectedRows.forEach(name => next.add(name));
        return next;
      });
      setSelectedRows(new Set());
    };

    return (
      <div className="relative space-y-6">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Table Area */}
          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex items-center justify-between gap-4 px-1">
              <div className="flex items-center gap-2">
                <TableIcon className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Dữ liệu sản phẩm</h3>
              </div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {names.length} Sản phẩm phát hiện
              </div>
            </div>

            <ImportRefineTable
              dataRows={dataRows}
              headers={previewHeaders}
              mapping={columnMapping}
              aiSuggestions={aiSuggestions}
              aiAccepted={aiAccepted}
              onOverrideChange={(name, cat) => {
                setManualOverrides(prev => ({
                  ...prev,
                  [name]: { ...prev[name], category: cat }
                }));
              }}
              onToggleAccept={(name) => {
                setAiAccepted(prev => {
                  const next = new Set(prev);
                  if (next.has(name)) next.delete(name); else next.add(name);
                  return next;
                });
              }}
              selectedRows={selectedRows}
              onToggleSelect={(name) => {
                setSelectedRows(prev => {
                  const next = new Set(prev);
                  if (next.has(name)) next.delete(name); else next.add(name);
                  return next;
                });
              }}
              onSelectAll={(all) => {
                if (selectedRows.size === all.length) setSelectedRows(new Set());
                else setSelectedRows(new Set(all));
              }}
              manualOverrides={manualOverrides}
              onManualOverrideChange={(name, field, val) => {
                setManualOverrides(prev => ({
                  ...prev,
                  [name]: { ...prev[name], [field]: val }
                }));
              }}
            />
          </div>

          {/* AI Sidebar */}
          <div className="w-full lg:w-80 shrink-0">
            <ImportCategorySidebar
              aiSuggestions={aiSuggestions}
              manualOverrides={manualOverrides}
              onRunAi={runCategorization}
              onAcceptAll={() => {
                const next = new Set(aiAccepted);
                names.forEach(n => next.add(String(n)));
                setAiAccepted(next);
              }}
              isPending={categorizeMutation.isPending}
              totalProducts={names.length}
              acceptedCount={aiAccepted.size}
            />
          </div>
        </div>

        <BulkActionBar
          selectedCount={selectedRows.size}
          onClear={() => setSelectedRows(new Set())}
          onApplyCategory={handleApplyBulkCategory}
        />

        <div className="flex justify-between pt-6 border-t border-slate-100">
          <button onClick={prevStep} className="btn-glass flex items-center gap-2 text-xs py-3 px-8">
            <ChevronLeft className="h-4 w-4" /> QUAY LẠI
          </button>
          <button onClick={nextStep} className="btn-premium flex items-center gap-2 py-3 px-8">
            XÁC NHẬN & KIỂM TRA <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  const Step4_Final = () => {
    const nameCol = columnMapping.name;
    const catCol = columnMapping.category;
    const qtyCol = columnMapping.quantity;
    
    const nameIdx = nameCol ? previewHeaders.indexOf(nameCol) : -1;
    const catIdx = catCol ? previewHeaders.indexOf(catCol) : -1;
    const qtyIdx = qtyCol ? previewHeaders.indexOf(qtyCol) : -1;
    
    const dataRows = activePreview?.rows?.slice(Math.max(0, dataStartRow - 1)) || [];
    
    // Summary data for comparison & distribution
    const { comparisonData, categoryDistribution, missingCategoryCount } = useMemo(() => {
      const compRows = dataRows.slice(0, 5).map((row: any) => {
        const name = String(row[nameIdx] || "");
        const rawCat = catIdx >= 0 ? String(row[catIdx] || "Trống") : "Trống";
        const finalCat = manualOverrides[name]?.category || (aiAccepted.has(name) ? aiSuggestions[name] : null) || (catIdx >= 0 ? row[catIdx] : null) || "Chưa phân loại";
        const rawQty = qtyIdx >= 0 ? String(row[qtyIdx] || "0") : "0";
        const finalQty = manualOverrides[name]?.quantity ?? (qtyIdx >= 0 ? rawQty : (defaultOverrides.quantity || analysisResult?.defaults_applied.quantity || "0"));
        
        return { name, rawCat, finalCat, rawQty, finalQty };
      });

      const dist: Record<string, number> = {};
      let missing = 0;
      dataRows.forEach((row: any) => {
        const name = String(row[nameIdx] || "");
        const cat = manualOverrides[name]?.category || (aiAccepted.has(name) ? aiSuggestions[name] : null) || (catIdx >= 0 ? row[catIdx] : null) || "Chưa phân loại";
        if (cat === "Chưa phân loại") missing++;
        dist[cat] = (dist[cat] || 0) + 1;
      });

      return { 
        comparisonData: compRows, 
        categoryDistribution: Object.entries(dist).sort((a, b) => b[1] - a[1]),
        missingCategoryCount: missing 
      };
    }, [dataRows, nameIdx, catIdx, qtyIdx, aiSuggestions, aiAccepted, defaultOverrides, manualOverrides, analysisResult]);

    return (
      <div className="space-y-6 max-h-[65vh] overflow-y-auto px-1 custom-scrollbar">
        {/* Quick Stats Banner */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl bg-violet-50 p-4 ring-1 ring-violet-100">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-violet-500" />
              <div>
                <div className="text-[10px] font-black text-violet-400 uppercase tracking-widest">AI Categorized</div>
                <div className="text-lg font-black text-violet-700">{Object.keys(aiSuggestions).length} sản phẩm</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100">
            <div className="flex items-center gap-3">
              <ImageIcon className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Images Extracted</div>
                <div className="text-lg font-black text-blue-700">{analysisResult?.embedded_image_count || 0} ảnh</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div>
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Total Rows</div>
                <div className="text-lg font-black text-emerald-700">{dataRows.length} dòng</div>
              </div>
            </div>
          </div>
        </div>

        {validateSummary ? (
          <div className="card-premium border-emerald-100 bg-emerald-50/30 p-8 space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-xl shadow-emerald-200">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-emerald-900 uppercase tracking-widest">Kiểm tra hoàn tất</h3>
                <p className="text-sm font-bold text-emerald-600">Dữ liệu đã sẵn sàng để nhập kho</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Tổng sản phẩm", val: validateSummary.total_rows, color: "slate" },
                { label: "Tạo mới", val: validateSummary.created, color: "emerald" },
                { label: "Cập nhật", val: validateSummary.updated, color: "blue" },
                { label: "Bỏ qua", val: validateSummary.skipped, color: "amber" },
              ].map(s => (
                <div key={s.label} className="text-center p-4 rounded-2xl bg-white shadow-sm ring-1 ring-emerald-100">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</span>
                  <span className={`text-2xl font-black text-${s.color}-600`}>{s.val}</span>
                </div>
              ))}
            </div>

            {validateSummary.errors.length > 0 && (
              <div className="rounded-2xl bg-rose-50 p-6 space-y-3">
                <div className="flex items-center gap-2 text-rose-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs font-black uppercase tracking-widest">Lưu ý ({validateSummary.errors_total} lỗi)</span>
                </div>
                <ul className="max-h-32 overflow-y-auto space-y-1.5">
                  {validateSummary.errors.slice(0, 10).map((err, i) => (
                    <li key={i} className="text-[11px] font-bold text-rose-800 leading-relaxed">• {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 space-y-4 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50">
            <RefreshCw className="h-8 w-8 text-slate-300 animate-spin" />
            <div className="text-center">
              <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Đang chạy kiểm tra dữ liệu...</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vui lòng đợi trong giây lát</p>
            </div>
            <button 
              onClick={() => validateImportMutation.mutate()} 
              className="text-[10px] font-black text-accent hover:underline uppercase tracking-widest"
            >
              Thử lại nếu quá lâu
            </button>
          </div>
        )}

        {/* Comparison & Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-slate-400" />
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">So sánh dữ liệu (Trước vs Sau)</h3>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse min-w-[400px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Sản phẩm</th>
                    <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Danh mục</th>
                    <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Số lượng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {comparisonData.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-bold text-slate-700 truncate max-w-[150px]">{row.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] text-slate-400 line-through decoration-slate-300">{row.rawCat}</span>
                          <span className={`rounded-lg px-2 py-0.5 font-black text-center ${
                            row.rawCat !== row.finalCat ? "bg-violet-50 text-violet-600 ring-1 ring-violet-100" : "text-slate-600"
                          }`}>
                            {row.finalCat}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] text-slate-400 line-through decoration-slate-300">{row.rawQty}</span>
                          <span className={`rounded-lg px-2 py-0.5 font-black text-center ${
                            row.rawQty !== row.finalQty ? "bg-amber-50 text-amber-600 ring-1 ring-amber-100" : "text-slate-600"
                          }`}>
                            {row.finalQty}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400" />
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Phân bổ danh mục cuối cùng</h3>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm max-h-[220px] overflow-y-auto custom-scrollbar">
              <div className="space-y-3">
                {categoryDistribution.map(([cat, count]) => (
                  <div key={cat} className="flex flex-col gap-1.5 group">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600">{cat}</span>
                      <span className="text-[10px] font-black text-slate-400">{count} SP</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className="h-full bg-accent transition-all duration-1000" 
                        style={{ width: `${(count / dataRows.length) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {missingCategoryCount > 0 && (
          <div className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
            <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
              Lưu ý: Còn <span className="font-black underline">{missingCategoryCount} sản phẩm</span> chưa có danh mục. 
              Chúng sẽ được xếp vào nhóm "Chưa phân loại" nếu bạn tiếp tục.
            </p>
          </div>
        )}

        <div className="flex justify-between pt-4 sticky bottom-0 bg-white py-4 border-t border-slate-100">
          <button onClick={prevStep} className="btn-glass flex items-center gap-2 text-xs py-3 px-8">
            <ChevronLeft className="h-4 w-4" /> QUAY LẠI
          </button>
          <button 
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending || !validateSummary}
            className={`ai-glow btn-premium flex-[2] ml-4 transition-all ${!validateSummary ? "opacity-50 grayscale" : "bg-accent"}`}
          >
            {importMutation.isPending ? (
              <span className="flex items-center justify-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> ĐANG NHẬP DỮ LIỆU...</span>
            ) : "XÁC NHẬN NHẬP KHO"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="WIZARD NHẬP KHO THÔNG MINH"
      size="lg"
    >
      <div className="space-y-8 pb-4">
        {/* Progress Stepper */}
        <div className="relative flex justify-between px-4">
          <div className="absolute top-5 left-10 right-10 h-0.5 bg-slate-100" />
          <div className="absolute top-5 left-10 right-10 h-0.5 bg-accent transition-all duration-500" style={{ width: `${(currentStep - 1) * 33.33}%` }} />
          {[
            { n: 1, label: "Kết nối" },
            { n: 2, label: "Ánh xạ" },
            { n: 3, label: "AI Review" },
            { n: 4, label: "Nhập kho" },
          ].map(s => (
            <div key={s.n} className="relative z-10 flex flex-col items-center gap-2">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-4 border-white font-black text-xs transition-all duration-500 ${
                currentStep >= s.n ? "bg-accent text-white shadow-lg shadow-accent/20" : "bg-slate-100 text-slate-400"
              }`}>
                {currentStep > s.n ? <Check className="h-5 w-5" /> : s.n}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${currentStep >= s.n ? "text-slate-900" : "text-slate-400"}`}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {currentStep === 1 && <Step1_SourceSelection />}
          {currentStep === 2 && <Step2_Mapping />}
          {currentStep === 3 && <Step3_Refine />}
          {currentStep === 4 && <Step4_Final />}
        </div>
      </div>
    </Modal>
  );
}
