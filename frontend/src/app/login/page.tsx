"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAuthRedirectOrigin } from "@/lib/auth-redirect-origin";
import { getBrowserSupabase, isSupabaseAuthConfigured } from "@/lib/supabase/browser";
import {
  Sparkles,
  Mail,
  ArrowRight,
  AlertCircle,
  Chrome,
  ChevronLeft,
  ShieldCheck,
  Zap,
  Lock,
  CheckCircle2,
} from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const err = new URLSearchParams(window.location.search).get("error");
    if (err) console.error(decodeURIComponent(err));
  }, []);

  const handleGoogle = async () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    setLoading(true);
    const origin = getAuthRedirectOrigin();
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);
    if (error) console.error(error.message);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getBrowserSupabase();
    if (!sb || !email.trim()) return;
    setLoading(true);
    const origin = getAuthRedirectOrigin();
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);
    if (error) {
      console.error(error.message);
      return;
    }
    setEmailSent(true);
  };

  const supabaseOn = isSupabaseAuthConfigured();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-surface-page p-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-[1000px] w-[1000px] rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[1000px] w-[1000px] rounded-full bg-accent/5 blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-md px-1">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-accent sm:mb-8"
        >
          <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Quay lại trang chủ</span>
        </Link>

        <div className="overflow-hidden rounded-[3rem] border border-black/[0.06] bg-white p-8 shadow-2xl shadow-accent/5 sm:p-12">
          <div className="mb-8 flex flex-col items-center text-center sm:mb-10">
            <Link href="/" className="mb-5 inline-flex items-center gap-3 sm:mb-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                <Sparkles className="h-8 w-8" />
              </div>
            </Link>
            <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">
              Đăng nhập / Đăng ký
            </h1>
            <p className="mx-auto mt-3 max-w-[22rem] text-pretty text-sm font-medium leading-relaxed text-ink-muted">
              Dùng Google hoặc email — không cần mật khẩu
            </p>
          </div>

          {supabaseOn ? (
            <div className="space-y-8">
              <button
                type="button"
                onClick={() => void handleGoogle()}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-black/[0.08] bg-white px-4 py-4 text-xs font-black uppercase tracking-widest text-ink shadow-sm transition-all hover:bg-surface-page hover:shadow-md disabled:opacity-50"
              >
                <Chrome className="h-5 w-5 shrink-0 text-blue-500" aria-hidden />
                Tiếp tục với Google
              </button>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-5 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                    Hoặc email
                  </span>
                </div>
              </div>

              {emailSent ? (
                <div className="space-y-5 py-2 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-black text-ink">Kiểm tra email của bạn</p>
                  <p className="mx-auto max-w-xs text-pretty text-xs font-medium leading-relaxed text-ink-muted">
                    Chúng tôi đã gửi liên kết đăng nhập. Kiểm tra hộp thư đến hoặc thư mục spam.
                  </p>
                  <button
                    type="button"
                    onClick={() => setEmailSent(false)}
                    className="text-xs font-black uppercase tracking-widest text-accent hover:underline"
                  >
                    Dùng email khác
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => void handleMagicLink(e)}
                  className="space-y-5 pt-1"
                >
                  <div className="space-y-2.5">
                    <label
                      htmlFor="login-email"
                      className="block px-1 text-center text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 sm:text-left"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />
                      <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="w-full rounded-2xl border-none bg-surface-page py-4 pl-12 pr-4 text-sm font-semibold text-ink outline-none ring-1 ring-black/[0.06] transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-accent/30"
                        placeholder="ban@example.com"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="ai-glow mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-xs font-black uppercase tracking-[0.15em] text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-hover disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        Gửi liên kết đăng nhập
                        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/50 p-6 text-center">
              <AlertCircle className="h-10 w-10 text-amber-500" />
              <p className="text-sm font-black text-ink">Chưa cấu hình Supabase</p>
              <p className="max-w-sm text-pretty text-xs text-ink-muted">
                Thêm NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY vào .env để bật đăng nhập Google và email.
              </p>
            </div>
          )}

          <div className="mt-10 flex items-center gap-4 sm:mt-12">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
              Bảo mật
            </span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 opacity-80">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              An toàn
            </span>
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
              GDPR
            </span>
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Nhanh
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
