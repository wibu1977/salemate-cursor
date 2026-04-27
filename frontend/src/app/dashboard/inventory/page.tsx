"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { 
  Package, 
  Plus, 
  RefreshCw, 
  Table as TableIcon, 
  Search, 
  MoreHorizontal, 
  Edit3, 
  TrendingDown, 
  Box,
  Image as ImageIcon,
  ChevronRight,
  Filter,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Layers
} from "lucide-react";

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
  const [sheetId, setSheetId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState("");

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
      lowStock: products.filter((p: any) => p.quantity <= p.stock_threshold).length,
      totalValue: products.reduce((acc: number, p: any) => acc + (p.price * p.quantity), 0)
    };
  }, [products]);

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) => inventoryApi.createProduct(data),
    onSuccess: () => {
      toast("S?n ph?m ð? t?o th?nh công", "success");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setShowCreate(false);
      setForm(EMPTY_FORM);
    },
    onError: () => toast("T?o s?n ph?m th?t b?i", "error"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      inventoryApi.updateProduct(id, data),
    onSuccess: () => {
      toast("C?p nh?t s?n ph?m th?nh công", "success");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setEditProduct(null);
    },
    onError: () => toast("C?p nh?t th?t b?i", "error"),
  });

  const syncMutation = useMutation({
    mutationFn: () => inventoryApi.syncSheets(sheetId),
    onSuccess: (res) => {
      const d = res.data;
      toast(`Ð?ng b??ho?n t?t: ${d.created} m?i, ${d.updated} c?p nh?t`, "success");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setShowSync(false);
      setSheetId("");
    },
    onError: () => toast("Ð?ng b??d??li?u th?t b?i", "error"),
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
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Qu?n lý Kho h?ng</h1>
          <p className="mt-2 text-base font-medium text-slate-500">Ki?m soát t?n kho v? t??ð?ng hóa ð?ng b??v?i Google Sheets</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={() => setShowSync(!showSync)} 
            className="group flex items-center gap-3 rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 hover:ring-accent/25 active:scale-95"
          >
            <RefreshCw className={`h-5 w-5 text-accent group-hover:rotate-180 transition-transform duration-500 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Ð?NG B??SHEETS
          </button>
          <button 
            onClick={openCreate} 
            className="flex items-center gap-3 rounded-2xl bg-accent px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-accent/15 transition-all hover:bg-accent-hover hover:-translate-y-1 active:scale-95"
          >
            <Plus className="h-5 w-5" />
            TH?M S?N PH?M
          </button>
        </div>
      </div>

      {/* Sync Section Panel */}
      {showSync && (
        <div className="ai-glow relative overflow-hidden rounded-[2.5rem] border border-accent-soft bg-white p-8 shadow-2xl shadow-accent/15/50 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-soft/50 blur-3xl" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                  <TableIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">K?t n?i Google Sheets</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">S??d?ng ID trang tính ð??nh?p d??li?u h?ng lo?t</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  placeholder="Nh?p Google Spreadsheet ID (ví d?? 1BxiMVs0XRA5...)"
                  className="w-full rounded-2xl border-none bg-slate-50 py-4 pl-6 pr-4 text-sm font-semibold shadow-inner outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-accent"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                  ID: {sheetId.slice(0, 10)}...
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => syncMutation.mutate()} 
                disabled={!sheetId || syncMutation.isPending} 
                className="flex items-center justify-center gap-3 rounded-2xl bg-slate-900 px-10 py-4 text-sm font-black text-white shadow-xl transition-all hover:bg-black hover:-translate-y-1 active:scale-95 disabled:opacity-50"
              >
                {syncMutation.isPending ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-3 border-white border-t-transparent" />
                ) : <RefreshCw className="h-5 w-5" />}
                B?T Ð?U Ð?NG B??              </button>
              <a href="#" className="flex items-center justify-center gap-2 text-xs font-bold text-accent hover:underline">
                H??ng d?n ð?nh d?ng t?p <ExternalLink className="h-3 w-3" />
              </a>
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
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">T?ng s?n ph?m</p>
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
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500/70">S?p h?t h?ng</p>
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
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/70">T?ng giá tr??kho</p>
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
              placeholder="T?m theo t?n, ID, danh m?c..."
              className="w-full rounded-2xl border-none bg-white py-3.5 pl-12 pr-4 text-sm font-semibold shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-accent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-slate-600 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50">
              <Filter className="h-4 w-4" />
              L?C DANH M?C
            </button>
          </div>
        </div>

        <div className="card-premium overflow-hidden border-slate-100 p-0 shadow-2xl shadow-slate-200/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">S?n ph?m</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Danh m?c</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Giá bán</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">T?n kho</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tr?ng thái</th>
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
                                  <span className={`text-sm font-black ${isLowStock ? 'text-rose-600' : 'text-slate-900'}`}>{p.quantity} <span className="text-[10px] text-slate-400 font-bold uppercase">ðv</span></span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Ng??ng: {p.stock_threshold}</span>
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
                                  S?P H?T
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-[10px] font-black text-emerald-600 ring-1 ring-emerald-200">
                                  <CheckCircle2 className="h-3 w-3" />
                                  C?N H?NG
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
                              <p className="text-lg font-black text-slate-900 uppercase tracking-widest">Kho h?ng ðang tr?ng</p>
                              <p className="text-sm font-medium text-slate-400 leading-relaxed">B?t ð?u b?ng cách th?m s?n ph?m m?i ho?c ð?ng b??hóa v?i Google Sheets.</p>
                            </div>
                            <button onClick={openCreate} className="btn-premium px-8">T?O S?N PH?M Ð?U TI?N</button>
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
        title={editProduct ? "CH?NH S?A S?N PH?M" : "S?N PH?M M?I"}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Left Column: Visuals */}
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-4">
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 px-2">H?nh ?nh ð?i di?n</h4>
              <div className="group relative aspect-square w-full overflow-hidden rounded-[2.5rem] border-8 border-slate-50 bg-slate-100 shadow-2xl shadow-slate-200 transition-all hover:shadow-accent/15/50">
                {form.image_url ? (
                  <img src={form.image_url} alt="Preview" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-slate-300">
                    <ImageIcon className="h-16 w-16" />
                    <p className="text-xs font-black uppercase tracking-widest">Ch?a có ?nh</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-xs font-black text-white border-2 border-white/50 rounded-full px-6 py-2 backdrop-blur-sm">C?P NH?T ?NH</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-accent-soft/50 p-6 space-y-4">
              <div className="flex items-center gap-3 text-accent">
                <AlertCircle className="h-5 w-5" />
                <h5 className="text-xs font-black uppercase tracking-widest">G?i ý AI cho Kho</h5>
              </div>
              <p className="text-xs font-bold leading-relaxed text-slate-600">
                S?n ph?m n?y c? nhu c?u cao v?o cu?i tu?n. H?y c?n nh?c ??t ng??ng c?nh b?o t?n kho ? m?c{" "}
                <strong>15 ??n v?</strong> ?? tr?nh gi?n ?o?n kinh doanh.
              </p>
            </div>
          </div>

          {/* Right Column: Form */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-6">
              <Field 
                label="T?n s?n ph?m" 
                value={form.name} 
                onChange={(v) => setForm({ ...form, name: v })} 
                placeholder="Ví d?? C?m Cu?n H?n Qu?c - Kimchi"
                icon={<Box className="h-5 w-5" />}
              />
              
              <div className="grid grid-cols-2 gap-6">
                <Field 
                  label="Danh m?c" 
                  value={form.category} 
                  onChange={(v) => setForm({ ...form, category: v })} 
                  placeholder="Th?c ph?m"
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
                  label="T?n kho hi?n t?i" 
                  value={String(form.quantity)} 
                  onChange={(v) => setForm({ ...form, quantity: Number(v) || 0 })} 
                  type="number" 
                />
                <Field 
                  label="Ng??ng c?nh báo" 
                  value={String(form.stock_threshold)} 
                  onChange={(v) => setForm({ ...form, stock_threshold: Number(v) || 0 })} 
                  type="number" 
                />
              </div>

              <Field 
                label="Mô t??s?n ph?m" 
                value={form.description} 
                onChange={(v) => setForm({ ...form, description: v })} 
                isTextArea
                placeholder="Chi ti?t v??th?nh ph?n, h??ng v??.."
              />

              <Field 
                label="Ð??ng d?n ?nh (URL)" 
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
                H?y b??              </button>
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
                {createMutation.isPending || updateMutation.isPending ? "ÐANG L?U..." : editProduct ? "L?u thay ð?i" : "T?o s?n ph?m"}
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
