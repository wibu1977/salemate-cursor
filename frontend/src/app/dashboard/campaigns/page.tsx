"use client";

import { useState } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { campaignApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { 
  Zap, 
  Plus, 
  Users, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Sparkles,
  BarChart3,
  MousePointer2,
  Calendar,
  ChevronRight,
  TrendingUp,
  Target,
  Filter,
  RefreshCw,
  MoreHorizontal,
  Info,
} from "lucide-react";

const STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; color: string; ring: string }> = {
  draft: { label: "BáşŁn nhĂĄp", icon: <Clock className="h-3.5 w-3.5" />, color: "bg-slate-100 text-slate-600", ring: "ring-slate-200" },
  pending_approval: { label: "Cháť duyáťt", icon: <Clock className="h-3.5 w-3.5" />, color: "bg-amber-50 text-amber-600", ring: "ring-amber-200" },
  approved: { label: "ÄĂŁ duyáťt", icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "bg-accent-soft text-accent", ring: "ring-accent/25" },
  sending: { label: "Äang gáť­i", icon: <Send className="h-3.5 w-3.5 animate-pulse" />, color: "bg-accent-soft text-accent", ring: "ring-accent/25" },
  completed: { label: "HoĂ n thĂ nh", icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "bg-emerald-50 text-emerald-600", ring: "ring-emerald-200" },
  cancelled: { label: "ÄĂŁ háť§y", icon: <XCircle className="h-3.5 w-3.5" />, color: "bg-rose-50 text-rose-600", ring: "ring-rose-200" },
};

interface Segment {
  id: string;
  label: string;
  description: string | null;
  recommendation: string | null;
  customer_count: number;
  avg_orders: number;
  avg_spent: number;
}

interface CampaignData {
  id: string;
  name: string;
  target_cluster: string | null;
  target_segment_id: string | null;
  segment_label: string | null;
  segment_description: string | null;
  status: string;
  message_template: string;
  total_recipients: number;
  sent_count: number;
  opened_count: number;
  converted_count: number;
  ai_generated: boolean;
  created_at: string;
}

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ name: "", target_segment_id: "", message_template: "" });

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => campaignApi.getCampaigns().then((r) => r.data),
  });

  const { data: segments } = useQuery({
    queryKey: ["segments"],
    queryFn: () => campaignApi.getSegments().then((r) => r.data),
  });

  const { data: detail } = useQuery({
    queryKey: ["campaign-detail", selectedId],
    queryFn: () => campaignApi.getCampaign(selectedId!).then((r) => r.data),
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) => campaignApi.createCampaign(data),
    onSuccess: () => {
      toast("Chiáşżn dáťch ÄĂŁ ÄĆ°áťŁc táşĄo thĂ nh cĂ´ng", "success");
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setShowCreate(false);
      setCreateForm({ name: "", target_segment_id: "", message_template: "" });
    },
    onError: () => toast("KhĂ´ng tháť táşĄo chiáşżn dáťch", "error"),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, action, msg }: { id: string; action: string; msg?: string }) =>
      campaignApi.approveCampaign(id, action, msg),
    onSuccess: (_, { action }) => {
      const labels: Record<string, string> = {
        approve: "Chiáşżn dáťch ÄĂŁ ÄĆ°áťŁc duyáťt vĂ  báşŻt Äáş§u gáť­i",
        rewrite: "AI Äang tiáşżn hĂ nh viáşżt láşĄi náťi dung",
        cancel: "Chiáşżn dáťch ÄĂŁ ÄĆ°áťŁc háť§y",
      };
      toast(labels[action] || "Thao tĂĄc thĂ nh cĂ´ng", "success");
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-detail", selectedId] });
    },
    onError: () => toast("Thao tĂĄc tháşĽt báşĄi", "error"),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-12 pb-20">
      {/* Page Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-[2rem] bg-accent text-white shadow-2xl shadow-accent/20">
            <Target className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Chiáşżn dáťch Outreach</h1>
            <p className="mt-1 text-base font-medium text-slate-500">Tiáşżp cáş­n khĂĄch hĂ ng thĂ´ng minh váťi sáťŠc máşĄnh AI</p>
          </div>
        </div>
        <button 
          onClick={() => setShowCreate(true)} 
          className="ai-glow group flex items-center gap-3 rounded-2xl bg-accent px-8 py-4 text-sm font-black text-white shadow-2xl shadow-accent/20 transition-all hover:bg-accent-hover hover:-translate-y-1 active:scale-95"
        >
          <Plus className="h-5 w-5 transition-transform group-hover:rotate-90" />
          KHáťI Táş O CHIáşžN DáťCH
        </button>
      </div>

      {/* Intelligent Segmentation Overview */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Users className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">PhĂ˘n khĂşc khĂĄch hĂ ng máťĽc tiĂŞu</h2>
          </div>
          <button className="text-xs font-black text-accent hover:underline">Xem táşĽt cáşŁ phĂ˘n khĂşc</button>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {segments?.map((seg: Segment) => (
            <div key={seg.id} className="group relative overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/40 transition-all hover:border-accent/25 hover:shadow-2xl hover:-translate-y-1">
              <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-accent-soft/30 blur-2xl opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-accent group-hover:text-white transition-all">
                    <Users className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    AI CLUSTER
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-accent transition-colors">{seg.label}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900">{seg.customer_count}</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">KhĂĄch hĂ ng</span>
                  </div>
                </div>
                <p className="text-xs font-medium leading-relaxed text-slate-400 line-clamp-2">{seg.description}</p>
                
                {seg.recommendation && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-600">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    {seg.recommendation.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Campaigns List */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Chiáşżn dáťch gáş§n ÄĂ˘y</h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">
              <Filter className="h-3.5 w-3.5" />
              Báť LáťC
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-[400px] animate-pulse rounded-[2.5rem] bg-slate-100/50" />
              ))
            : campaigns?.map((c: CampaignData) => {
                const st = STATUS_MAP[c.status] || { label: c.status, icon: <Clock />, color: "bg-slate-100 text-slate-600", ring: "ring-slate-200" };
                const progress = c.total_recipients > 0 ? (c.sent_count / c.total_recipients) * 100 : 0;
                
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className="group relative cursor-pointer overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/40 transition-all hover:border-accent/35 hover:shadow-2xl hover:shadow-accent/15/30 hover:-translate-y-1"
                  >
                    <div className="absolute right-0 top-0 h-40 w-40 bg-slate-50/50 blur-3xl rounded-full translate-x-10 -translate-y-10" />
                    
                    <div className="relative space-y-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h3 className="text-xl font-black text-slate-900 group-hover:text-accent transition-colors leading-tight">{c.name}</h3>
                          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(c.created_at)}
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest ring-1 ${st.color} ${st.ring}`}>
                          {st.icon}
                          {st.label}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tiáşżn Äáť tiáşżp cáş­n</span>
                          <span className="text-xs font-black text-slate-900">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                          <div 
                            className="h-full bg-accent transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(255,87,51,0.35)]" 
                            style={{ width: `${progress}%` }} 
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <StatSmall label="TARGET" value={c.total_recipients} color="text-slate-900" />
                        <StatSmall label="SENT" value={c.sent_count} color="text-accent" />
                        <StatSmall label="OPENED" value={c.opened_count ?? 0} color="text-emerald-600" />
                      </div>

                      <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                        <div className="flex items-center gap-2">
                          {c.ai_generated ? (
                            <div className="flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-1.5 text-[10px] font-black text-accent ring-1 ring-accent-soft">
                              <Sparkles className="h-3.5 w-3.5" />
                              AI OPTIMIZED
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 text-[10px] font-black text-slate-500 ring-1 ring-slate-100">
                              <Users className="h-3.5 w-3.5" />
                              MANUAL
                            </div>
                          )}
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 group-hover:bg-accent group-hover:text-white transition-all">
                          <ChevronRight className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
        </div>

        {!isLoading && campaigns?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 rounded-[3rem] border-4 border-dashed border-slate-100 bg-white shadow-2xl shadow-slate-200/30">
            <div className="relative mb-8">
              <div className="absolute inset-0 scale-150 bg-accent-soft blur-3xl rounded-full" />
              <Target className="relative h-20 w-20 text-accent/25" />
            </div>
            <h3 className="text-2xl font-black text-slate-900">ChĆ°a cĂł chiáşżn dáťch nĂ o</h3>
            <p className="mt-2 text-base font-medium text-slate-500 text-center max-w-sm">
              BáşŻt Äáş§u kĂ­ch hoáşĄt AI Äáť tiáşżp cáş­n khĂĄch hĂ ng máťt cĂĄch thĂ´ng minh vĂ  táťi Ć°u doanh sáť
            </p>
            <button 
              onClick={() => setShowCreate(true)}
              className="mt-10 btn-premium px-10 py-4 text-sm tracking-widest"
            >
              Táş O CHIáşžN DáťCH ÄáşŚU TIĂN
            </button>
          </div>
        )}
      </section>

      {/* Create Campaign Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="THIáşžT LáşŹP CHIáşžN DáťCH AI" size="lg">
        <div className="space-y-10">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Äáťnh danh chiáşżn dáťch</label>
                <div className="relative">
                  <Zap className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-accent" />
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="VĂ­ dáťĽ: Re-engagement thĂĄng 5"
                    className="w-full rounded-[1.5rem] border-none bg-slate-50/50 pl-14 pr-6 py-5 text-sm font-black text-slate-900 shadow-inner outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-accent"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Láťąa cháťn phĂ˘n khĂşc máťĽc tiĂŞu</label>
                <div className="grid grid-cols-1 gap-4">
                  {segments?.map((seg: Segment) => (
                    <div
                      key={seg.id}
                      onClick={() => setCreateForm({ ...createForm, target_segment_id: seg.id })}
                      className={`group relative cursor-pointer overflow-hidden rounded-3xl border-4 p-6 transition-all ${
                        createForm.target_segment_id === seg.id
                          ? "border-accent bg-white shadow-2xl shadow-accent/15"
                          : "border-slate-50 bg-slate-50/50 hover:border-slate-100 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${createForm.target_segment_id === seg.id ? 'bg-accent text-white' : 'bg-white text-slate-300'}`}>
                            <Users className="h-5 w-5" />
                          </div>
                          <span className="font-black text-slate-900">{seg.label}</span>
                        </div>
                        {createForm.target_segment_id === seg.id && (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{seg.customer_count} KHĂCH HĂNG</p>
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Náťi dung tiáşżp cáş­n</label>
                  <div className="flex items-center gap-1.5 rounded-lg bg-accent-soft px-2 py-1 text-[10px] font-black text-accent">
                    <Sparkles className="h-3 w-3" />
                    AI ASSISTANT
                  </div>
                </div>
                <div className="relative">
                  <textarea
                    value={createForm.message_template}
                    onChange={(e) => setCreateForm({ ...createForm, message_template: e.target.value })}
                    rows={12}
                    placeholder="Äáť tráťng Äáť AI táťą Äáťng phĂ˘n tĂ­ch hĂ nh vi vĂ  soáşĄn tháşŁo tin nháşŻn cĂĄ nhĂ˘n hĂła cho táťŤng khĂĄch hĂ ng trong nhĂłm..."
                    className="w-full rounded-[2rem] border-none bg-slate-50/50 p-8 text-sm font-medium leading-relaxed text-slate-700 shadow-inner outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-accent"
                  />
                  <div className="absolute bottom-6 right-6">
                    <button className="flex items-center gap-2 rounded-xl bg-white/80 px-4 py-2 text-[10px] font-black text-accent shadow-lg backdrop-blur-sm hover:bg-white">
                      <RefreshCw className="h-3.5 w-3.5" />
                      GENERATE BY AI
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-slate-900 p-8 text-white shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Info className="h-5 w-5 text-accent-muted" />
                  <h4 className="text-sm font-black uppercase tracking-widest">LĆ°u Ă˝ báşŁo máş­t</h4>
                </div>
                <p className="text-xs font-medium leading-relaxed opacity-60">
                  Chiáşżn dáťch sáş˝ ÄĆ°áťŁc gáť­i qua Facebook Messenger. ÄáşŁm báşŁo náťi dung tuĂ˘n tháť§ chĂ­nh sĂĄch cáť§a Meta. AI sáş˝ táťą Äáťng Äiáťu cháťnh táťc Äáť gáť­i Äáť trĂĄnh spam.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-6 border-t border-slate-100">
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 rounded-2xl bg-white border-2 border-slate-100 py-5 text-sm font-black text-slate-400 transition-all hover:bg-slate-50 uppercase tracking-widest"
            >
              Háť§y báť
            </button>
            <button
              onClick={() => createMutation.mutate(createForm)}
              disabled={!createForm.name || !createForm.target_segment_id || createMutation.isPending}
              className="ai-glow flex-[2] flex items-center justify-center gap-3 rounded-2xl bg-accent py-5 text-sm font-black text-white shadow-2xl shadow-accent/15 transition-all hover:bg-accent-hover hover:-translate-y-1 active:scale-95 disabled:opacity-50 uppercase tracking-[0.2em]"
            >
              {createMutation.isPending ? (
                <div className="h-5 w-5 animate-spin rounded-full border-3 border-white border-t-transparent" />
              ) : <Send className="h-5 w-5" />}
              KĂCH HOáş T CHIáşžN DáťCH
            </button>
          </div>
        </div>
      </Modal>

      {/* Campaign Detail Modal */}
      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} title="PHĂN TĂCH HIáťU QUáş˘ CHIáşžN DáťCH" size="lg">
        {detail ? (
          <div className="space-y-12">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <div className={`flex h-16 w-16 items-center justify-center rounded-3xl ${STATUS_MAP[detail.status]?.color || 'bg-slate-100'} ring-1 ${STATUS_MAP[detail.status]?.ring}`}>
                  {STATUS_MAP[detail.status]?.icon}
                </div>
                <div>
                  <h3 className="text-3xl font-black text-slate-900 leading-none">{detail.name}</h3>
                  <div className="mt-3 flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {formatDate(detail.created_at)}</span>
                    <span className="flex items-center gap-1.5 text-accent bg-accent-soft px-2 py-0.5 rounded-lg">{detail.segment_label || detail.target_cluster}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100">
                  <MoreHorizontal className="h-6 w-6" />
                </button>
                <div className={`rounded-2xl px-6 py-3 text-xs font-black uppercase tracking-widest ${STATUS_MAP[detail.status]?.color || 'bg-slate-100'} ring-1 ${STATUS_MAP[detail.status]?.ring}`}>
                  {STATUS_MAP[detail.status]?.label}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="TáťNG NGĆŻáťI NHáşŹN" value={detail.total_recipients} icon={<Users className="h-5 w-5" />} color="text-slate-900" bg="bg-slate-50" />
              <StatCard label="TIN NHáşŽN ÄĂ GáťŹI" value={detail.sent_count} icon={<Send className="h-5 w-5" />} color="text-accent" bg="bg-accent-soft" />
              <StatCard label="Táťś Láť Máť (READ)" value={`${Math.round((detail.opened_count / detail.sent_count) * 100) || 0}%`} icon={<MousePointer2 className="h-5 w-5" />} color="text-blue-600" bg="bg-blue-50" />
              <StatCard label="CHUYáťN ÄáťI (CONV)" value={detail.converted_count ?? 0} icon={<TrendingUp className="h-5 w-5" />} color="text-emerald-600" bg="bg-emerald-50" />
            </div>

            <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-3 text-sm font-black text-slate-900 uppercase tracking-widest">
                    <MessageSquare className="h-5 w-5 text-accent" />
                    Náťi dung truyáťn thĂ´ng
                  </h4>
                  {detail.ai_generated && (
                    <span className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-1.5 text-[10px] font-black text-accent">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI OPTIMIZED CONTENT
                    </span>
                  )}
                </div>
                <div className="relative overflow-hidden rounded-[2.5rem] border-2 border-slate-50 bg-slate-50/30 p-10">
                  <div className="absolute right-0 top-0 h-40 w-40 bg-accent-soft/50 blur-3xl rounded-full translate-x-20 -translate-y-20" />
                  <p className="relative whitespace-pre-wrap text-base font-medium leading-relaxed text-slate-700">
                    {detail.message_template}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="flex items-center gap-3 text-sm font-black text-slate-900 uppercase tracking-widest">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                  Dáťą kiáşżn káşżt quáşŁ
                </h4>
                <div className="space-y-4 rounded-[2rem] bg-slate-900 p-8 text-white shadow-2xl">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Táťś Láť PHáş˘N HáťI Dáť° KIáşžN</p>
                    <p className="text-3xl font-black">12.5% <span className="text-xs font-bold text-emerald-400">(+2.1%)</span></p>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">DOANH THU Dáť° TĂNH</p>
                    <p className="text-3xl font-black text-accent-muted">âŠ450,000</p>
                  </div>
                </div>
              </div>
            </div>

            {detail.status === "pending_approval" && (
              <div className="flex flex-col gap-4 pt-10 border-t border-slate-100 sm:flex-row sm:justify-end">
                <button
                  onClick={() => approveMutation.mutate({ id: detail.id, action: "cancel" })}
                  disabled={approveMutation.isPending}
                  className="rounded-2xl bg-white border-2 border-slate-100 px-8 py-5 text-sm font-black text-rose-500 transition-all hover:bg-rose-50 active:scale-95 disabled:opacity-50 uppercase tracking-widest"
                >
                  HáťŚY CHIáşžN DáťCH
                </button>
                <button
                  onClick={() => approveMutation.mutate({ id: detail.id, action: "rewrite" })}
                  disabled={approveMutation.isPending}
                  className="flex items-center justify-center gap-3 rounded-2xl bg-white border-2 border-accent px-8 py-5 text-sm font-black text-accent transition-all hover:bg-accent-soft active:scale-95 disabled:opacity-50 uppercase tracking-widest"
                >
                  <RefreshCw className="h-4 w-4" />
                  AI VIáşžT Láş I MáťI
                </button>
                <button
                  onClick={() => approveMutation.mutate({ id: detail.id, action: "approve" })}
                  disabled={approveMutation.isPending}
                  className="ai-glow flex items-center justify-center gap-3 rounded-2xl bg-accent px-12 py-5 text-sm font-black text-white shadow-2xl shadow-accent/20 transition-all hover:bg-accent-hover hover:-translate-y-1 active:scale-95 disabled:opacity-50 uppercase tracking-[0.2em]"
                >
                  <Send className="h-5 w-5" />
                  DUYáťT & GáťŹI NGAY
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
            <div className="relative">
              <div className="absolute inset-0 h-16 w-16 animate-ping rounded-full bg-accent/30 opacity-75" />
              <div className="relative h-16 w-16 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Initializing Data Stream...</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatSmall({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-[1.5rem] bg-slate-50/50 border border-slate-50 p-4 text-center transition-all group-hover:bg-white group-hover:shadow-lg group-hover:shadow-slate-100/50">
      <div className="text-[9px] font-black text-slate-400 tracking-widest">{label}</div>
      <div className={`mt-1 text-base font-black ${color}`}>{value}</div>
    </div>
  );
}

function StatCard({ label, value, icon, color, bg }: { label: string; value: number | string; icon: React.ReactNode; color: string; bg: string }) {
  return (
    <div className={`rounded-[2.5rem] ${bg} p-8 border border-white/50 transition-all hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-1`}>
      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
        {icon}
        {label}
      </div>
      <div className={`mt-3 text-3xl font-black ${color}`}>{value}</div>
    </div>
  );
}
