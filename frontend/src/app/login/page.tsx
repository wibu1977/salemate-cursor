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

      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-accent"
        >
          <ChevronLeft className="h-3 w-3" />
          Quay l?i trang ch?
        </Link>

        <div className="overflow-hidden rounded-[3rem] border border-black/[0.06] bg-white p-10 shadow-2xl shadow-accent/5 sm:p-12">
          <div className="mb-8 flex flex-col items-center text-center">
            <Link href="/" className="mb-6 inline-flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                <Sparkles className="h-8 w-8" />
              </div>
            </Link>
            <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">??ng nh?p / ??ng k?</h1>
            <p className="mt-2 text-sm font-medium text-ink-muted">
              D?ng Google ho?c email ? kh?ng c?n m?t kh?u
            </p>
          </div>

          {supabaseOn ? (
            <div className="space-y-6">
              <button
                type="button"
                onClick={() => void handleGoogle()}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-black/[0.08] bg-white py-4 text-xs font-black uppercase tracking-widest text-ink shadow-sm transition-all hover:bg-surface-page hover:shadow-md disabled:opacity-50"
              >
                <Chrome className="h-5 w-5 text-blue-500" />
                Ti?p t?c v?i Google
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                    Ho?c email
                  </span>
                </div>
              </div>

              {emailSent ? (
                <div className="space-y-4 py-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-black text-ink">Ki?m tra email c?a b?n</p>
                  <p className="text-xs font-medium text-ink-muted">
                    Ch?ng t?i ?? g?i li?n k?t ??ng nh?p. Ki?m tra h?p th? ??n ho?c th? m?c spam.
                  </p>
                  <button
                    type="button"
                    onClick={() => setEmailSent(false)}
                    className="text-xs font-black uppercase tracking-widest text-accent hover:underline"
                  >
                    D?ng email kh?c
                  </button>
                </div>
              ) : (
                <form onSubmit={(e) => void handleMagicLink(e)} className="space-y-4">
                  <div className="space-y-2">
                    <label className="px-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full rounded-2xl border-none bg-surface-page py-4 pl-12 pr-4 text-sm font-semibold text-ink outline-none ring-1 ring-black/[0.06] transition-all focus:bg-white focus:ring-2 focus:ring-accent/30"
                        placeholder="ban@example.com"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="ai-glow flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-xs font-black uppercase tracking-[0.15em] text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-hover disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        G?i li?n k?t ??ng nh?p
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/50 p-6 text-center">
              <AlertCircle className="h-10 w-10 text-amber-500" />
              <p className="text-sm font-black text-ink">Ch?a c?u h?nh Supabase</p>
              <p className="text-xs text-ink-muted">
                Th?m NEXT_PUBLIC_SUPABASE_URL v? NEXT_PUBLIC_SUPABASE_ANON_KEY v?o .env ?? b?t ??ng nh?p Google v? email.
              </p>
            </div>
          )}

          <div className="mt-10 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">B?o m?t</span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 opacity-70">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <Lock className="h-3.5 w-3.5" />
              Secure
            </span>
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              GDPR
            </span>
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <Zap className="h-3.5 w-3.5" />
              Fast
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
