"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import { formatCurrency, formatDate, ORDER_STATUS_MAP } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { 
  Search, 
  Filter, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronRight,
  ShoppingBag,
  User,
  CreditCard,
  MapPin,
  FileText,
  Zap,
  MoreHorizontal,
  ArrowUpRight,
  ShieldCheck,
  TrendingUp,
  Package,
  Calendar,
} from "lucide-react";

interface OrderItem {
  product_name: string;
  quantity: number;
  subtotal: number;
}

interface OrderData {
  id: string;
  memo_code: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total_amount: number;
  status: string;
  created_at: string;
  payment_method?: string;
  bill_image_url?: string;
  items?: OrderItem[];
  fraud_logs?: { check_type: string; result: string; details: string }[];
}

const FILTER_OPTIONS = [
  { label: "Tất cả", value: "" },
  { label: "Chờ duyệt", value: "flagged" },
  { label: "Đã xong", value: "completed" },
  { label: "Đã hủy", value: "cancelled" },
];

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", filter],
    queryFn: () =>
      dashboardApi.getOrders(filter ? { status: filter } : undefined).then((r) => r.data),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["order-detail", selectedId],
    queryFn: () => dashboardApi.getOrderDetail(selectedId!).then((r) => r.data),
    enabled: !!selectedId,
  });

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (!searchQuery) return orders;
    const query = searchQuery.toLowerCase();
    return orders.filter((o: OrderData) => 
      o.memo_code.toLowerCase().includes(query) || 
      o.customer_name?.toLowerCase().includes(query) ||
      o.customer_phone?.includes(query)
    );
  }, [orders, searchQuery]);

  const stats = useMemo(() => {
    if (!orders) return { total: 0, pending: 0, revenue: 0 };
    return {
      total: orders.length,
      pending: orders.filter((o: any) => o.status === "flagged").length,
      revenue: orders.reduce((acc: number, o: any) => acc + (o.status === "completed" ? o.total_amount : 0), 0)
    };
  }, [orders]);

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      dashboardApi.orderAction(id, action),
    onSuccess: (_, { action }) => {
      toast(action === "approve" ? "Đơn hàng đã được duyệt thành công" : "Đã từ chối đơn hàng", "success");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-detail", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: () => toast("Thao tác xử lý thất bại", "error"),
  });

  return (
    <div className="space-y-10 pb-20">
      {/* Header & Title */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-ink">Quản lý Đơn hàng</h1>
          <p className="mt-2 text-base font-medium text-ink-muted">Giám sát giao dịch và xử lý phê duyệt thanh toán AI theo thời gian thực</p>
        </div>
        
        {/* Search Bar */}
        <div className="relative w-full max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Tìm theo mã đơn, tên, số điện thoại..."
            className="w-full rounded-2xl border-none bg-white py-3.5 pl-12 pr-4 text-sm font-semibold shadow-sm shadow-slate-200 outline-none ring-1 ring-slate-200 transition-all focus:ring-2 focus:ring-accent focus:shadow-md"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="card-premium flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Package className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Tổng đơn hàng</p>
            <p className="text-2xl font-black text-slate-900">{stats.total}</p>
          </div>
        </div>
        <div className="card-premium flex items-center gap-5 border-amber-100 bg-amber-50/10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Clock className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-amber-600/60">Chờ phê duyệt</p>
            <p className="text-2xl font-black text-slate-900">{stats.pending}</p>
          </div>
        </div>
        <div className="card-premium flex items-center gap-5 border-emerald-100 bg-emerald-50/10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <TrendingUp className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600/60">Doanh thu thực</p>
            <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.revenue)}</p>
          </div>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`rounded-xl px-6 py-2.5 text-xs font-black transition-all ${
                  filter === opt.value
                    ? "bg-accent text-white shadow-lg shadow-accent/20"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {opt.label.toUpperCase()}
              </button>
            ))}
          </div>
          
          <button className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-slate-600 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50">
            <Calendar className="h-4 w-4" />
            HÔM NAY
          </button>
        </div>

        <div className="card-premium overflow-hidden border-slate-100 p-0 shadow-2xl shadow-slate-200/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Giao dịch</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Khách hàng</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tổng tiền</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Trạng thái</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Thời gian</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={6} className="px-8 py-8">
                          <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-100/50" />
                        </td>
                      </tr>
                    ))
                  : filteredOrders.length
                    ? filteredOrders.map((o: OrderData) => {
                        const st = ORDER_STATUS_MAP[o.status] || { label: o.status, className: "bg-slate-100 text-slate-600" };
                        return (
                          <tr
                            key={o.id}
                            onClick={() => setSelectedId(o.id)}
                            className="group cursor-pointer transition-all hover:bg-accent-soft/30"
                          >
                            <td className="px-8 py-7">
                              <div className="flex items-center gap-4">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent ring-1 ring-accent-soft transition-all group-hover:bg-accent group-hover:text-white group-hover:scale-110">
                                  <ShoppingBag className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-mono text-sm font-black text-slate-900">{o.memo_code}</span>
                                  <span className="text-[10px] font-bold text-slate-400">ID: {o.id.slice(0, 8)}...</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-7">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs ring-1 ring-slate-200">
                                  {o.customer_name?.[0]?.toUpperCase() || "?"}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-sm font-black text-slate-900">{o.customer_name || "Khách ẩn danh"}</span>
                                  <span className="text-[10px] font-bold text-slate-400">{o.customer_phone || "—"}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-7">
                              <span className="text-sm font-black text-slate-900">{formatCurrency(o.total_amount)}</span>
                            </td>
                            <td className="px-8 py-7">
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider ${st.className} ring-1 ring-current/10`}>
                                <div className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                                {st.label}
                              </span>
                            </td>
                            <td className="px-8 py-7">
                              <span className="text-xs font-bold text-slate-500">{formatDate(o.created_at)}</span>
                            </td>
                            <td className="px-8 py-7 text-right">
                              <div className="flex justify-end">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 transition-all group-hover:bg-slate-900 group-hover:text-white">
                                  <ChevronRight className="h-5 w-5" />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    : (
                        <tr>
                          <td colSpan={6} className="px-8 py-32 text-center">
                            <div className="mx-auto flex max-w-sm flex-col items-center gap-6">
                              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-50 text-slate-200 ring-4 ring-white shadow-inner">
                                <Search className="h-10 w-10" />
                              </div>
                              <div className="space-y-2">
                                <p className="text-lg font-black text-slate-900 uppercase tracking-widest">Không tìm thấy kết quả</p>
                                <p className="text-sm font-medium leading-relaxed text-slate-400">Chúng tôi không tìm thấy đơn hàng nào khớp với tìm kiếm của bạn. Thử dùng từ khóa khác hoặc xóa bộ lọc.</p>
                              </div>
                              {searchQuery && (
                                <button 
                                  onClick={() => setSearchQuery("")}
                                  className="text-xs font-black text-accent hover:underline"
                                >
                                  XÓA TÌM KIẾM
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} title="Bảng điều khiển giao dịch" size="lg">
        {detailLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-accent border-t-transparent shadow-xl" />
            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Đang đồng bộ AI Core...</p>
          </div>
        ) : detail ? (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="space-y-8 lg:col-span-7">
              {/* Header Info */}
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-10">
                <div className="flex items-center gap-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-white shadow-xl shadow-accent/15">
                    <ShoppingBag className="h-8 w-8" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Mã giao dịch</span>
                    <h3 className="text-4xl font-black text-slate-900">{detail.memo_code}</h3>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <span className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-black uppercase tracking-[0.1em] ${(ORDER_STATUS_MAP[detail.status] || {}).className} ring-1 ring-current/20`}>
                    <div className="h-2 w-2 rounded-full bg-current" />
                    {(ORDER_STATUS_MAP[detail.status] || { label: detail.status }).label}
                  </span>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDate(detail.created_at)}
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-5">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-slate-900" />
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Chi tiết sản phẩm</h4>
                  </div>
                  <span className="text-xs font-bold text-slate-400">{detail.items?.length || 0} ITEMS</span>
                </div>
                <div className="rounded-[2.5rem] border border-slate-100 bg-slate-50/40 p-8">
                  <div className="space-y-6">
                    {detail.items?.map((item: OrderItem, i: number) => (
                      <div key={i} className="flex items-center justify-between group">
                        <div className="flex items-center gap-5">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white font-black text-accent shadow-sm border border-slate-100 transition-all group-hover:scale-110">
                            {item.quantity}
                          </div>
                          <div>
                            <p className="text-base font-black text-slate-900">{item.product_name}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SKU: SM-{Math.floor(Math.random()*10000)} | {formatCurrency(item.subtotal / item.quantity)} / cái</p>
                          </div>
                        </div>
                        <span className="text-base font-black text-slate-900">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-10 space-y-4 border-t border-slate-200/60 pt-8">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-2">
                      <span className="uppercase tracking-widest">Tạm tính</span>
                      <span>{formatCurrency(detail.total_amount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-2">
                      <span className="uppercase tracking-widest">Phí vận chuyển</span>
                      <span className="text-emerald-600">MIỄN PHÍ</span>
                    </div>
                    <div className="flex items-center justify-between pt-4 px-2">
                      <span className="text-base font-black uppercase tracking-[0.2em] text-slate-400">Tổng cộng</span>
                      <span className="text-4xl font-black text-accent drop-shadow-sm">{formatCurrency(detail.total_amount)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fraud Analysis */}
              {detail.fraud_logs?.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 px-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 ring-4 ring-emerald-50/50">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">AI Trust Analysis</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {detail.fraud_logs.map((log: any, i: number) => (
                      <div key={i} className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-100/50 hover:-translate-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{log.check_type}</span>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                            log.result === "pass" ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100" : 
                            log.result === "reject" ? "bg-rose-50 text-rose-600 ring-1 ring-rose-100" : 
                            "bg-amber-50 text-amber-600 ring-1 ring-amber-100"
                          }`}>
                            {log.result}
                          </span>
                        </div>
                        <p className="text-xs font-bold leading-relaxed text-slate-600">{log.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-8 lg:col-span-5">
              {/* Customer Card */}
              <div className="space-y-5">
                <h4 className="px-2 text-sm font-black uppercase tracking-widest text-slate-900">Thông tin khách hàng</h4>
                <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-2xl shadow-slate-300">
                  {/* Decorative AI Glow */}
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/20 blur-3xl" />
                  <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-accent/15 blur-3xl" />
                  
                  <div className="relative flex items-center gap-5 mb-8">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-white/10 backdrop-blur-xl ring-1 ring-white/20">
                      <User className="h-8 w-8 text-accent/70" />
                    </div>
                    <div>
                      <p className="text-xl font-black tracking-tight">{detail.customer_name || "—"}</p>
                      <p className="text-sm font-bold text-slate-400">{detail.customer_phone || "—"}</p>
                    </div>
                  </div>
                  
                  <div className="relative space-y-6 text-sm border-t border-white/10 pt-8">
                    <div className="flex gap-4">
                      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent/70">
                        <MapPin className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-bold leading-relaxed opacity-80">{detail.customer_address || "Chưa cung cấp địa chỉ"}</span>
                    </div>
                    <div className="flex gap-4">
                      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent/70">
                        <CreditCard className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black uppercase tracking-widest text-accent-muted">Phương thức</span>
                        <span className="font-bold opacity-80">{detail.payment_method || "Chuyển khoản ngân hàng"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Evidence / Receipt */}
              {detail.bill_image_url && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between px-2">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Minh chứng bill</h4>
                    <span className="text-[10px] font-black text-accent uppercase tracking-widest">AI VERIFIED</span>
                  </div>
                  <div className="group relative aspect-[3/4] overflow-hidden rounded-[2.5rem] border-8 border-white bg-slate-100 shadow-2xl shadow-slate-200 ring-1 ring-slate-100">
                    <img src={detail.bill_image_url} alt="Receipt" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900/60 opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:opacity-100">
                      <a href={detail.bill_image_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl bg-white px-6 py-3 text-xs font-black text-slate-900 shadow-xl transition-all hover:scale-105 active:scale-95">
                        <Eye className="h-5 w-5" />
                        XEM ẢNH GỐC
                      </a>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Click để xem chi tiết</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              {detail.status === "flagged" && (
                <div className="space-y-4 pt-6">
                  <button
                    onClick={() => actionMutation.mutate({ id: detail.id, action: "approve" })}
                    disabled={actionMutation.isPending}
                    className="ai-glow group flex w-full items-center justify-center gap-4 rounded-3xl bg-accent py-5 text-sm font-black text-white shadow-2xl shadow-accent/20 transition-all hover:bg-accent-hover hover:-translate-y-1 active:scale-95 disabled:opacity-50"
                  >
                    {actionMutation.isPending ? (
                      <div className="h-6 w-6 animate-spin rounded-full border-4 border-white border-t-transparent" />
                    ) : (
                      <CheckCircle2 className="h-6 w-6 transition-transform group-hover:scale-125" />
                    )}
                    <span className="uppercase tracking-[0.2em]">PHÊ DUYỆT ĐƠN HÀNG</span>
                  </button>
                  <button
                    onClick={() => actionMutation.mutate({ id: detail.id, action: "reject" })}
                    disabled={actionMutation.isPending}
                    className="flex w-full items-center justify-center gap-4 rounded-3xl bg-white border-2 border-rose-100 py-5 text-sm font-black text-rose-600 transition-all hover:bg-rose-50 hover:border-rose-200 active:scale-95 disabled:opacity-50"
                  >
                    <XCircle className="h-6 w-6" />
                    <span className="uppercase tracking-[0.2em]">TỪ CHỐI GIAO DỊCH</span>
                  </button>
                  <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">Hành động này không thể hoàn tác</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
