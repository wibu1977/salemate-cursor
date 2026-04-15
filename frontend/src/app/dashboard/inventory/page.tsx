"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

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
  is_active: boolean;
}

const EMPTY_FORM = { name: "", description: "", category: "", price: 0, quantity: 0, stock_threshold: 5, image_url: "" };

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductData | null>(null);
  const [showSync, setShowSync] = useState(false);
  const [sheetId, setSheetId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => inventoryApi.getProducts().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) => inventoryApi.createProduct(data),
    onSuccess: () => {
      toast("Sản phẩm đã tạo", "success");
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
      toast("Cập nhật thành công", "success");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setEditProduct(null);
    },
    onError: () => toast("Cập nhật thất bại", "error"),
  });

  const syncMutation = useMutation({
    mutationFn: () => inventoryApi.syncSheets(sheetId),
    onSuccess: (res) => {
      const d = res.data;
      toast(`Đồng bộ xong: ${d.created} mới, ${d.updated} cập nhật`, "success");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setShowSync(false);
      setSheetId("");
    },
    onError: () => toast("Đồng bộ thất bại", "error"),
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Tồn kho</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowSync(!showSync)} className="btn-secondary text-xs">
            Đồng bộ Google Sheets
          </button>
          <button onClick={openCreate} className="btn-primary text-xs">+ Thêm sản phẩm</button>
        </div>
      </div>

      {showSync && (
        <div className="card flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-600">Google Sheets ID</label>
            <input
              type="text"
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <button onClick={() => syncMutation.mutate()} disabled={!sheetId || syncMutation.isPending} className="btn-primary">
            {syncMutation.isPending ? "Đang đồng bộ..." : "Đồng bộ"}
          </button>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              {["Sản phẩm", "Danh mục", "Giá", "SL", "Ngưỡng", "Trạng thái", ""].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-4 w-full animate-pulse rounded bg-gray-100" /></td></tr>
                ))
              : products?.length
                ? products.map((p: ProductData) => (
                    <tr key={p.id} className="transition-colors hover:bg-gray-50/50">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                      <td className="px-5 py-3 text-sm text-gray-500">{p.category || "—"}</td>
                      <td className="px-5 py-3 text-sm">{formatCurrency(p.price, p.currency)}</td>
                      <td className="px-5 py-3 text-sm font-medium">{p.quantity}</td>
                      <td className="px-5 py-3 text-sm text-gray-500">{p.stock_threshold}</td>
                      <td className="px-5 py-3">
                        {p.quantity <= p.stock_threshold
                          ? <span className="badge-danger">Sắp hết</span>
                          : <span className="badge-success">Còn hàng</span>}
                      </td>
                      <td className="px-5 py-3">
                        <button onClick={() => openEdit(p)} className="text-xs font-medium text-primary-600 hover:underline">
                          Sửa
                        </button>
                      </td>
                    </tr>
                  ))
                : <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">Chưa có sản phẩm</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={showCreate || !!editProduct}
        onClose={() => { setShowCreate(false); setEditProduct(null); }}
        title={editProduct ? `Sửa: ${editProduct.name}` : "Thêm sản phẩm mới"}
      >
        <div className="space-y-3">
          <Field label="Tên sản phẩm" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Mô tả" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Danh mục" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
            <Field label="Giá (KRW)" value={String(form.price)} onChange={(v) => setForm({ ...form, price: Number(v) || 0 })} type="number" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Số lượng" value={String(form.quantity)} onChange={(v) => setForm({ ...form, quantity: Number(v) || 0 })} type="number" />
            <Field label="Ngưỡng cảnh báo" value={String(form.stock_threshold)} onChange={(v) => setForm({ ...form, stock_threshold: Number(v) || 0 })} type="number" />
          </div>
          <Field label="URL hình ảnh" value={form.image_url} onChange={(v) => setForm({ ...form, image_url: v })} placeholder="https://..." />
          <button
            onClick={() => {
              if (editProduct) {
                updateMutation.mutate({ id: editProduct.id, data: form });
              } else {
                createMutation.mutate(form);
              }
            }}
            disabled={!form.name || createMutation.isPending || updateMutation.isPending}
            className="btn-primary w-full py-2.5"
          >
            {createMutation.isPending || updateMutation.isPending ? "Đang lưu..." : editProduct ? "Cập nhật" : "Tạo sản phẩm"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
    </div>
  );
}
