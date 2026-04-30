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

/**
 * Facebook SDK Login: production needs HTTPS; Meta allows HTTP on localhost for dev.
 */
function canOpenFacebookLogin(): boolean {
  if (typeof window === "undefined") return false;
  const { protocol, hostname } = window.location;
  const host = hostname.replace(/^\[/, "").replace(/\]$/, "");
  const isLoopbackLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".localhost");
  if (isLoopbackLocal) return true;
  return protocol === "https:";
}

export default function ConnectFacebookPage() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState<FbPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const runFacebookConnect = () => {
    const appId = (process.env.NEXT_PUBLIC_META_APP_ID || "").trim();
    if (!appId) {
      setError("Missing NEXT_PUBLIC_META_APP_ID ? add in Railway/Vercel and rebuild.");
      return;
    }
    if (!canOpenFacebookLogin()) {
      setError(
        "Can dung HTTPS (tru localhost http). Neu dev: mo http://localhost:3000 hoac bat HTTPS."
      );
      return;
    }
    setError(null);
    setLoading(true);
    setPages([]);

    const deadline = Date.now() + 20_000;
    const waitFb = async () => {
      console.log("[Salemate] Waiting for window.FB...");
      while (!window.FB && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 200));
      }
    };

    void (async () => {
      await waitFb();
      if (!window.FB) {
        console.error("[Salemate] SDK timeout reached.");
        setError(
          "Facebook SDK failed to load. Please check your internet connection, disable ad blockers, " +
          "and ensure this domain is added to your Facebook App settings."
        );
        setLoading(false);
        return;
      }

      console.log("[Salemate] FB.login triggered.");
      window.FB!.login(
        async (resp: { authResponse?: { accessToken: string }; status?: string }) => {
          console.log("[Salemate] FB.login response:", resp.status);
          if (!resp.authResponse?.accessToken) {
            setError("Facebook login was cancelled or failed to provide a token.");
            setLoading(false);
            return;
          }
          const token = resp.authResponse.accessToken;
          try {
            console.log("[Salemate] Fetching accounts from Graph API...");
            const url = new URL("https://graph.facebook.com/v21.0/me/accounts");
            url.searchParams.set("fields", "id,name,access_token");
            url.searchParams.set("access_token", token);
            const r = await fetch(url.toString());
            const data = (await r.json()) as { data?: FbPage[]; error?: { message: string } };
            
            if (data.error) {
              console.error("[Salemate] Graph API error:", data.error);
              setError(`Facebook Error: ${data.error.message}`);
              setLoading(false);
              return;
            }
            
            setPages(data.data || []);
            if (!(data.data || []).length) {
              setError(
                "No Facebook Pages found. Make sure you are an admin of at least one Page and have granted permission."
              );
            }
          } catch (e) {
            console.error("[Salemate] Connection error:", e);
            setError(formatApiError(e));
          } finally {
            setLoading(false);
          }
        },
        {
          scope: "pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement",
          return_scopes: true,
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
          V?? DASHBOARD
        </Link>

        <div className="space-y-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-accent text-white shadow-xl shadow-accent/25">
            <Facebook className="h-10 w-10" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-ink">K?t n??i Fanpage</h1>
          <p className="max-w-md text-lg font-medium text-ink-muted">
            K?ch ho?t AI Sales Agent tr?n c?c k?nh b?n h?ng Facebook c?a b?n ch?? v??i v?i c? click.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[3rem] border border-black/[0.06] bg-white p-12 shadow-xl shadow-black/[0.04]">
          <div className="absolute right-0 top-0 h-40 w-40 translate-x-10 -translate-y-10 rounded-full bg-accent-soft blur-3xl" />

          {!pages.length ? (
            <div className="relative space-y-10">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <BenefitItem
                  icon={<ShieldCheck className="h-6 w-6" />}
                  title="B?o m?t tuy??t ????i"
                  desc="D? li??u m? h?a 256-bit chu?n Meta Business."
                />
                <BenefitItem
                  icon={<Zap className="h-6 w-6" />}
                  title="K?ch ho?t t?c th?"
                  desc="T? ????ng ????ng b?? tin nh?n & kh?ch h?ng."
                />
                <BenefitItem
                  icon={<MessageSquare className="h-6 w-6" />}
                  title="AI Sales 24/7"
                  desc="T? ????ng tr? l?i, ch??t ???n ngay c? khi b?n ng?."
                />
                <BenefitItem
                  icon={<CheckCircle2 className="h-6 w-6" />}
                  title="D?? d?ng qu?n l?"
                  desc="T?t c? Fanpage tr?n m??t dashboard duy nh?t."
                />
              </div>

              <div className="border-t border-slate-50 pt-6">
                <button
                  type="button"
                  onClick={runFacebookConnect}
                  disabled={loading}
                  className="ai-glow flex w-full items-center justify-center gap-4 rounded-2xl bg-[#1877F2] py-5 font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:-translate-y-1 hover:bg-[#166FE5] active:scale-95 disabled:opacity-70 disabled:cursor-wait"
                >
                  {loading ? (
                    <>
                      <div className="h-6 w-6 animate-spin rounded-full border-4 border-white border-t-transparent" />
                      ĐANG KẾT NỐI...
                    </>
                  ) : (
                    <>
                      <Facebook className="h-6 w-6" />
                      KẾT NỐI VỚI FACEBOOK
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
                <h3 className="text-xl font-black text-ink">Ch?n Page ???? k?ch ho?t</h3>
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
                          K?CH HO?T
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
                H?y v? l?m l?i
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
              <p className="text-xs font-black uppercase tracking-wider text-rose-900">C? l??i x?y ra</p>
              <p className="text-sm font-medium text-rose-600">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 opacity-60 sm:grid-cols-3">
          <FooterLabel icon={<Lock className="h-4 w-4" />} text="M? h?a d? li??u" />
          <FooterLabel icon={<ShieldCheck className="h-4 w-4" />} text="Meta Verified App" />
          <FooterLabel icon={<ExternalLink className="h-4 w-4" />} text="Tu?n th? GDPR" />
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
