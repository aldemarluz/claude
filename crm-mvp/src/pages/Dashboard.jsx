import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getWorkspaceId } from "@/lib/workspace";
import { Users, TrendingUp, DollarSign, Target, MessageSquare, Wifi, WifiOff, MessageCircle } from "lucide-react";
import MetricCard from "../components/dashboard/MetricCard";
import LeadsByStatusChart from "../components/dashboard/LeadsByStatusChart";
import ConversionFunnel from "../components/dashboard/ConversionFunnel";
import RecentLeads from "../components/dashboard/RecentLeads";
import ChecklistWidget from "../components/dashboard/ChecklistWidget";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [waChannels, setWaChannels] = useState([]);
  const [waUnread, setWaUnread] = useState(0);
  const [waMsgsToday, setWaMsgsToday] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const accountId = await getWorkspaceId();
        if (!accountId) {
          if (!cancelled) setLoading(false);
          return;
        }
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const [data, channels, convs, msgs] = await Promise.all([
          base44.entities.Lead.filter({ account_id: accountId }, "-created_date", 200),
          base44.entities.WhatsAppChannel.filter({ workspace_id: accountId }),
          base44.entities.WhatsAppConversation.filter({ workspace_id: accountId }, "-atualizado_em", 200),
          base44.entities.WhatsAppMessage.filter({ workspace_id: accountId }, "-timestamp", 200),
        ]);
        if (cancelled) return;
        setLeads(data || []);
        setWaChannels(channels || []);
        setWaUnread((convs || []).filter(c => c.nao_lido).length);
        setWaMsgsToday((msgs || []).filter(m => m.timestamp && new Date(m.timestamp) >= today).length);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const totalLeads = leads.length;
  const closedLeads = leads.filter((l) => l.status === "fechado").length;
  const conversionRate = totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0;
  const revenue = leads
    .filter((l) => l.status === "fechado")
    .reduce((sum, l) => sum + (l.estimated_value || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do seu CRM</p>
      </div>

      {/* CRM Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total de Leads" value={totalLeads} icon={Users} />
        <MetricCard title="Conversões" value={closedLeads} icon={Target} />
        <MetricCard title="Taxa de Conversão" value={`${conversionRate}%`} icon={TrendingUp} />
        <MetricCard
          title="Receita Estimada"
          value={`R$ ${revenue.toLocaleString("pt-BR")}`}
          icon={DollarSign}
        />
      </div>

      {/* WhatsApp overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Channels status */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Canais WhatsApp</p>
          {waChannels.length === 0 ? (
            <div className="flex items-center gap-3 py-1">
              <WifiOff className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nenhum canal</p>
                <button className="text-xs text-primary hover:underline" onClick={() => navigate("/whatsapp-channels")}>Conectar agora →</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {waChannels.map(ch => (
                <div key={ch.id} className="flex items-center gap-2">
                  {ch.status === "conectado"
                    ? <Wifi className="w-4 h-4 text-emerald-500 shrink-0" />
                    : <WifiOff className="w-4 h-4 text-slate-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ch.nome}</p>
                    <p className="text-xs text-muted-foreground">{ch.status === "conectado" ? (ch.phone_number ? `+${ch.phone_number}` : "conectado") : "desconectado"}</p>
                  </div>
                </div>
              ))}
              <button className="text-xs text-primary hover:underline" onClick={() => navigate("/whatsapp-channels")}>Gerenciar →</button>
            </div>
          )}
        </div>

        {/* Unread conversations */}
        <div
          className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => navigate("/unified-inbox")}
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <MessageSquare className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{waUnread}</p>
            <p className="text-sm text-muted-foreground">Conversas não lidas</p>
            {waUnread > 0 && <p className="text-xs text-primary font-medium mt-0.5">Responder agora →</p>}
          </div>
        </div>

        {/* Messages today */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <MessageCircle className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{waMsgsToday}</p>
            <p className="text-sm text-muted-foreground">Mensagens hoje</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadsByStatusChart leads={leads} />
        <ConversionFunnel leads={leads} />
      </div>

      <ChecklistWidget />
      <RecentLeads leads={leads} />
    </div>
  );
}