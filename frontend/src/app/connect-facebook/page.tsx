"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { pagesApi, formatApiError } from "@/lib/api";
import {
  Facebook,
  ChevronLeft,
  CheckCircle2,
  ShieldCheck,
  MessageSquare,
  Zap,
  Info,
  ExternalLink,
  Lock,
  ArrowRight,
} from "lucide-react";

type FbPage = { id: string; name: string; access_token: string };

export default function ConnectFacebookPage() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState<FbPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const runFacebookConnect = () => {
    const appId = (process.env.NEXT_PUBLIC_META_APP_ID || "").trim();
    if (!appId) {
      setError("Thi?u NEXT_PUBLIC_META_APP_ID.");
      return;
    }
    if (typeof window === "undefined" || window.location.protocol !== "https:") {
      setError("C?n HTTPS ?? dùng Facebook SDK.");
      return;
    }
    setError(null);
    setLoading(true);
    setPages([]);

    const deadline = Date.now() + 12_000;
    const waitFb = async () => {
      while (!window.FB && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 120));
      }
    };

    void (async () => {
      await waitFb();
      if (!window.FB) {
        setError("Facebook SDK ch?a t?i. T?t AdBlock và t?i l?i trang.");
        setLoading(false);
        return;
      }

      window.FB!.login(
        async (resp: { authResponse?: { accessToken: string }; status?: string }) => {
          if (!resp.authResponse?.accessToken) {
            setError("Ch?a có quy?n Facebook ho?c ?ã h?y.");
            setLoading(false);
            return;
          }
          const token = resp.authResponse.accessToken;
          try {
            const url = new URL("https://graph.facebook.com/v21.0/me/accounts");
            url.searchParams.set("fields", "id,name,access_token");
            url.searchParams.set("access_token", token);
            const r = await fetch(url.toString());
            const data = (await r.json()) as { data?: FbPage[]; error?: { message: string } };
            if (data.error) {
              setError(data.error.message || "Graph API l?i");
              setLoading(false);
              return;
            }
            setPages(data.data || []);
            if (!(data.data || []).length) {
              setError("Không th?y Facebook Page nào. B?n c?n qu?n tr? Page và c?p quy?n pages_show_list.");
            }
          } catch (e) {
            setError(formatApiError(e));
          } finally {
            setLoading(false);
          }
        },
        {
          scope:
            "pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement",
        }
      );
    })();
  };

  const connectOne = async (p: FbPage) => {
    setConnectingId(p.id);
    setError(null);
    try {
      await pagesApi.connectPage({
        page_id: p.id,
        page_name: p.name,
        page_access_token: p.access_token,
        platform: "facebook",
      });
      await queryClient.invalidateQueries({ queryKey: ["pages"] });
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-page p-6 sm:p-12">
      <div className="w-full max-w-2xl space-y-12">
        <Link
          href="/dashboard"
          className="group inline-flex items-center gap-2 text-sm font-black text-slate-400 transition-colors hover:text-accent"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/[0.06] bg-white shadow-sm group-hover:bg-accent-soft">
            <ChevronLeft className="h-4 w-4" />
          </div>
          V? DASHBOARD
        </Link>

        <div className="space-y-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-accent text-white shadow-xl shadow-accent/25">
            <Facebook className="h-10 w-10" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-ink">K?t n?i Fanpage</h1>
          <p className="max-w-md text-lg font-medium text-ink-muted">
            Kích ho?t AI Sales Agent trên các kênh bán hàng Facebook c?a b?n ch? v?i vài cú click.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[3rem] border border-black/[0.06] bg-white p-12 shadow-xl shadow-black/[0.04]">
          <div className="absolute right-0 top-0 h-40 w-40 translate-x-10 -translate-y-10 rounded-full bg-accent-soft blur-3xl" />

          {!pages.length ? (
            <div className="relative space-y-10">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <BenefitItem
                  icon={<ShieldCheck className="h-6 w-6" />}
                  title="B?o m?t tuy?t ??i"
                  desc="D? li?u mã hóa 256-bit chu?n Meta Business."
                />
                <BenefitItem
                  icon={<Zap className="h-6 w-6" />}
                  title="Kích ho?t t?c thì"
                  desc="T? ??ng ??ng b? tin nh?n & khách hàng."
                />
                <BenefitItem
                  icon={<MessageSquare className="h-6 w-6" />}
                  title="AI Sales 24/7"
                  desc="T? ??ng tr? l?i, ch?t ??n ngay c? khi b?n ng?."
                />
                <BenefitItem
                  icon={<CheckCircle2 className="h-6 w-6" />}
                  title="D? dàng qu?n lý"
                  desc="T?t c? Fanpage trên m?t dashboard duy nh?t."
                />
              </div>

              <div className="border-t border-slate-50 pt-6">
                <button
                  type="button"
                  onClick={runFacebookConnect}
                  disabled={loading}
                  className="ai-glow flex w-full items-center justify-center gap-4 rounded-2xl bg-[#1877F2] py-5 font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:-translate-y-1 hover:bg-[#166FE5] active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-3 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Facebook className="h-6 w-6" />
                      K?T N?I V?I FACEBOOK
                    </>
                  )}
                </button>
                <p className="mt-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                  By connecting, you agree to our <span className="text-ink underline">Terms of Service</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="relative space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-ink">Ch?n Page ?? kích ho?t</h3>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                  {pages.length} PAGES FOUND
                </span>
              </div>

              <ul className="space-y-4">
                {pages.map((p) => (
                  <li
                    key={p.id}
                    className="group flex items-center justify-between rounded-[2rem] border-2 border-slate-50 bg-slate-50/30 px-8 py-6 transition-all hover:border-accent hover:bg-white hover:shadow-2xl hover:shadow-accent/10"
                  >
                    <div className="flex items-center gap-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-accent shadow-sm transition-all group-hover:bg-accent group-hover:text-white">
                        <Facebook className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="font-black text-ink transition-colors group-hover:text-accent">{p.name}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">ID: {p.id}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={connectingId === p.id}
                      onClick={() => void connectOne(p)}
                      className={`flex items-center gap-2 rounded-xl px-6 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                        connectingId === p.id
                          ? "cursor-not-allowed bg-slate-100 text-slate-400"
                          : "bg-accent text-white shadow-lg shadow-accent/15 hover:bg-accent-hover active:scale-95"
                      }`}
                    >
                      {connectingId === p.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                      ) : (
                        <>
                          KÍCH HO?T
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => setPages([])}
                className="w-full text-center text-xs font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-accent"
              >
                H?y và làm l?i
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="flex animate-shake items-start gap-4 rounded-3xl border border-rose-100 bg-rose-50 p-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-rose-500 shadow-sm">
              <Info className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-wider text-rose-900">Có l?i x?y ra</p>
              <p className="text-sm font-medium text-rose-600">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 opacity-60 sm:grid-cols-3">
          <FooterLabel icon={<Lock className="h-4 w-4" />} text="Mã hóa d? li?u" />
          <FooterLabel icon={<ShieldCheck className="h-4 w-4" />} text="Meta Verified App" />
          <FooterLabel icon={<ExternalLink className="h-4 w-4" />} text="Tuân th? GDPR" />
        </div>
      </div>
    </div>
  );
}

function BenefitItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        {icon}
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-black uppercase tracking-wider text-ink">{title}</h4>
        <p className="text-xs font-medium leading-relaxed text-ink-muted">{desc}</p>
      </div>
    </div>
  );
}

function FooterLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
      {icon}
      {text}
    </div>
  );
}
