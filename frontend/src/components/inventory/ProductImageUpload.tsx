"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { inventoryApi, formatApiError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

export type ProductImageUploadProps = {
  /** Null while creating a new product — uploads run after save */
  productId: string | null;
  /** Current canonical URL from form */
  imageUrl: string;
  onImageUrlChange: (url: string) => void;
  pendingFile: File | null;
  onPendingFileChange: (file: File | null) => void;
  disabled?: boolean;
};

export function ProductImageUpload({
  productId,
  imageUrl,
  onImageUrlChange,
  pendingFile,
  onPendingFileChange,
  disabled,
}: ProductImageUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [blobPreviewUrl, setBlobPreviewUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!pendingFile) {
      setBlobPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setBlobPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  useEffect(() => {
    if (!cameraOpen) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [cameraOpen]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const uploadIfEditing = async (file: File) => {
    if (!productId) {
      onPendingFileChange(file);
      return;
    }
    setUploading(true);
    try {
      const { data } = await inventoryApi.uploadProductImage(productId, file);
      const url = data.image_url ?? "";
      if (!url) {
        toast("Tải ảnh lên nhưng không nhận được URL.", "error");
        return;
      }
      onImageUrlChange(url);
      onPendingFileChange(null);
      toast("Đã cập nhật ảnh sản phẩm", "success");
    } catch (e) {
      toast(formatApiError(e), "error");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChosen = async (file: File | null) => {
    if (!file || disabled || uploading) return;
    if (!file.type.startsWith("image/")) {
      toast("Vui lòng chọn file ảnh.", "error");
      return;
    }
    await uploadIfEditing(file);
  };

  const openCamera = async () => {
    if (disabled || uploading) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      toast("Không mở được camera (quyền trình duyệt hoặc HTTPS).", "error");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      toast("Camera chưa sẵn sàng.", "error");
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        stopCamera();
        if (!blob) {
          toast("Không tạo được ảnh.", "error");
          return;
        }
        const file = new File([blob], `product-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        void handleFileChosen(file);
      },
      "image/jpeg",
      0.92,
    );
  };

  const clearPending = () => {
    onPendingFileChange(null);
  };

  const displaySrc = blobPreviewUrl || imageUrl.trim() || "";

  return (
    <div className="space-y-4">
      <div className="group relative aspect-square w-full overflow-hidden rounded-[2.5rem] border-8 border-slate-50 bg-slate-100 shadow-2xl shadow-slate-200 transition-all hover:shadow-accent/15">
        {uploading ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="h-12 w-12 animate-spin" />
            <p className="text-xs font-black uppercase tracking-widest">Đang tải ảnh...</p>
          </div>
        ) : displaySrc ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={displaySrc} alt="Preview" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
            {pendingFile && !productId && (
              <button
                type="button"
                onClick={() => !disabled && clearPending()}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
                aria-label="Xóa ảnh nháp"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-slate-300">
            <ImagePlus className="h-16 w-16" />
            <p className="text-xs font-black uppercase tracking-widest">Chưa có ảnh</p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = "";
          void handleFileChosen(f);
        }}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <ImagePlus className="h-4 w-4" />
          Chọn ảnh
        </button>
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => void openCamera()}
          className="inline-flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
          Chụp ảnh
        </button>
      </div>

      {cameraOpen && (
        <div className="space-y-3 rounded-3xl bg-slate-900 p-4 text-white">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => capturePhoto()}
              disabled={uploading}
              className="flex-1 rounded-xl bg-accent py-3 text-xs font-black uppercase tracking-widest disabled:opacity-50"
            >
              Chụp
            </button>
            <button
              type="button"
              onClick={() => stopCamera()}
              className="rounded-xl bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-widest"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
