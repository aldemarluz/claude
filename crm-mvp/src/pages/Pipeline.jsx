import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { getWorkspaceId } from "@/lib/workspace";
import { DragDropContext } from "@hello-pangea/dnd";
import { Plus, Filter, X, Users, Settings2, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import LeadModal from "../components/pipeline/LeadModal";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import PipelineColumn from "../components/pipeline/PipelineColumn";
import AddLeadDialog from "../components/pipeline/AddLeadDialog";
import PipelineManagerDialog from "../components/pipeline/PipelineManagerDialog";

const DEFAULT_STAGES = [
  { key: "novo", label: "Novo Lead", color: "blue", order: 0 },
  { key: "contato_iniciado", label: "Contato Iniciado", color: "amber", order: 1 },
  { key: "qualificado", label: "Qualificado", color: "violet", order: 2 },
  { key: "proposta_enviada", label: "Proposta Enviada", color: "cyan", order: 3 },
  { key: "fechado", label: "Fechado", color: "emerald", order: 4 },
];

export default function Pipeline() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [filters, setFilters] = useState({ deal_status: "all", dateFrom: "", dateTo: "", search: "", origin: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [showPipelineManager, setShowPipelineManager] = useState(false);
  const [pipelines, setPipelines] = useState([]);
  const [activePipeline, setActivePipeline] = useState(null);
  const [showPipelineMenu, setShowPipelineMenu] = useState(false);

  const stages = useMemo(() => {
    if (activePipeline?.stages?.length) {
      return [...activePipeline.stages].sort((a, b) => a.order - b.order);
    }
    return DEFAULT_STAGES;
  }, [activePipeline]);

  const stageConfig = useMemo(() => {
    const cfg = {};
    stages.forEach(s => { cfg[s.key] = s; });
    return cfg;
  }, [stages]);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (filters.deal_status !== "all" && l.deal_status !== filters.deal_status) return false;
      if (filters.search && !l.name?.toLowerCase().includes(filters.search.toLowerCase()) && !l.company?.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.origin && !l.origin?.toLowerCase().includes(filters.origin.toLowerCase())) return false;
      if (filters.dateFrom && new Date(l.created_date) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(l.created_date) > new Date(filters.dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [leads, filters]);

  const setFilter = (key, val) => setFilters((prev) => ({ ...prev, [key]: val }));
  const clearFilters = () => setFilters({ deal_status: "all", dateFrom: "", dateTo: "", search: "", origin: "" });
  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && v !== "all").length;

  const handleQuickAction = async (lead, deal_status) => {
    const previousDealStatus = lead.deal_status;
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, deal_status } : l));
    try {
      await base44.entities.Lead.update(lead.id, { deal_status });
      const labels = { ganho: "Ganho 🏆", perdido: "Perdido", abandonado: "Abandonado" };
      toast.success(`Lead marcado como ${labels[deal_status] || deal_status}`);
    } catch (err) {
      console.error("Failed to update lead deal_status:", err);
      // Rollback the optimistic update.
      setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, deal_status: previousDealStatus } : l));
      toast.error("Não foi possível atualizar o lead. Tente novamente.");
    }
  };

  const handleLeadUpdate = (updated) => {
    setLeads((prev) => prev.map((l) => l.id === updated.id ? updated : l));
    setSelectedLead(updated);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const wsId = await getWorkspaceId();
      if (!wsId) {
        setLeads([]);
        setPipelines([]);
        setActivePipeline(null);
        return;
      }
      const [leadsData, pipelinesData] = await Promise.all([
        base44.entities.Lead.filter({ account_id: wsId }, "-created_date", 500),
        base44.entities.PipelineConfig.filter({ workspace_id: wsId }),
      ]);
      setLeads(leadsData || []);
      setPipelines(pipelinesData || []);
      const def = (pipelinesData || []).find(p => p.is_default) || (pipelinesData || [])[0] || null;
      setActivePipeline(def);
    } catch (err) {
      console.error("Failed to load pipeline data:", err);
      toast.error("Erro ao carregar o pipeline.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const { draggableId, source, destination } = result;
    // Same column, same position — nothing to do.
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newStatus = destination.droppableId;
    const lead = leads.find((l) => l.id === draggableId);
    if (!lead) return;

    const previousStatus = lead.status;
    if (previousStatus === newStatus) return;

    // Optimistic update.
    setLeads((prev) => prev.map((l) => (l.id === draggableId ? { ...l, status: newStatus } : l)));
    try {
      await base44.entities.Lead.update(draggableId, { status: newStatus });
      // Log the status change as an interaction, but don't fail the UI if this
      // call fails — the main update already succeeded.
      base44.entities.Interaction.create({
        lead_id: draggableId,
        type: "status_change",
        content: `Status alterado para ${newStatus}`,
        from_status: previousStatus,
        to_status: newStatus,
      }).catch((err) => console.error("Failed to log status change interaction:", err));
    } catch (err) {
      console.error("Failed to update lead status:", err);
      setLeads((prev) => prev.map((l) => (l.id === draggableId ? { ...l, status: previousStatus } : l)));
      toast.error("Não foi possível mover o lead. Tente novamente.");
    }
  };

  const handleAddLead = async (form) => {
    const accountId = await getWorkspaceId();
    if (!accountId) {
      toast.error("Não foi possível identificar sua conta. Recarregue a página.");
      return;
    }
    const firstStageKey = stages[0]?.key || "novo";
    try {
      const newLead = await base44.entities.Lead.create({
        ...form,
        account_id: accountId,
        status: form.status || firstStageKey,
      });
      setLeads((prev) => [newLead, ...prev]);
      // Best-effort audit trail & onboarding progress — don't block the UI.
      base44.entities.Interaction.create({ lead_id: newLead.id, type: "note", content: "Lead criado" })
        .catch((err) => console.error("Failed to create 'lead created' interaction:", err));
      (async () => {
        try {
          const me = await base44.auth.me();
          const list = await base44.entities.OnboardingProgress.filter({ user_id: me.id });
          if (list.length > 0 && !list[0].step_first_lead_created) {
            await base44.entities.OnboardingProgress.update(list[0].id, { step_first_lead_created: true });
          }
        } catch (err) {
          console.error("Failed to update onboarding progress:", err);
        }
      })();
    } catch (err) {
      console.error("Failed to create lead:", err);
      toast.error("Não foi possível criar o lead. Tente novamente.");
    }
  };

  const handleSetDefault = async (p) => {
    const previous = pipelines;
    // Only update pipelines whose is_default flag actually changes.
    const toUpdate = pipelines.filter(pl => Boolean(pl.is_default) !== (pl.id === p.id));
    // Optimistic update.
    setPipelines(prev => prev.map(pl => ({ ...pl, is_default: pl.id === p.id })));
    setActivePipeline(p);
    try {
      await Promise.all(toUpdate.map(pl =>
        base44.entities.PipelineConfig.update(pl.id, { is_default: pl.id === p.id })
      ));
      toast.success(`"${p.name}" definido como padrão`);
    } catch (err) {
      console.error("Failed to set default pipeline:", err);
      setPipelines(previous);
      const prevDefault = previous.find(pl => pl.is_default) || previous[0] || null;
      setActivePipeline(prevDefault);
      toast.error("Não foi possível definir o pipeline padrão.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isEmpty = leads.length === 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Pipeline</h1>
            <p className="text-sm text-muted-foreground">{leads.length} leads no total</p>
          </div>
          {/* Pipeline selector */}
          {pipelines.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowPipelineMenu(p => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/60 hover:bg-muted rounded-lg border border-border text-sm font-medium transition-colors"
              >
                {activePipeline?.name || "Pipeline"}
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              {showPipelineMenu && (
                <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[180px] overflow-hidden">
                  {pipelines.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setActivePipeline(p); setShowPipelineMenu(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between gap-2 ${activePipeline?.id === p.id ? "bg-primary/5 text-primary font-medium" : ""}`}
                    >
                      {p.name}
                      {p.is_default && <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">Padrão</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowPipelineManager(true); setShowPipelineMenu(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors text-muted-foreground"
            title="Gerenciar Pipelines"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Pipelines
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
              showFilters || activeFilterCount > 0 ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {activeFilterCount > 0 && <span className="bg-white text-primary text-[10px] font-bold rounded-full px-1.5">{activeFilterCount}</span>}
          </button>
          <Button onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Lead
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      {showFilters && (
        <div className="px-6 py-3 border-b border-border bg-muted/30 flex flex-wrap items-center gap-3 shrink-0">
          <Input
            placeholder="Buscar por nome ou empresa..."
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            className="h-8 text-xs w-48"
          />
          <select
            value={filters.deal_status}
            onChange={(e) => setFilter("deal_status", e.target.value)}
            className="h-8 text-xs border border-border rounded-md px-2 bg-background outline-none"
          >
            <option value="all">Todos os status</option>
            <option value="aberto">Aberto</option>
            <option value="ganho">Ganho</option>
            <option value="perdido">Perdido</option>
            <option value="abandonado">Abandonado</option>
          </select>
          <Input
            placeholder="Origem..."
            value={filters.origin}
            onChange={(e) => setFilter("origin", e.target.value)}
            className="h-8 text-xs w-36"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Criado de:</span>
            <input type="date" value={filters.dateFrom} onChange={(e) => setFilter("dateFrom", e.target.value)} className="h-8 text-xs border border-border rounded-md px-2 bg-background outline-none" />
            <span className="text-xs text-muted-foreground">até:</span>
            <input type="date" value={filters.dateTo} onChange={(e) => setFilter("dateTo", e.target.value)} className="h-8 text-xs border border-border rounded-md px-2 bg-background outline-none" />
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
              <X className="w-3.5 h-3.5" /> Limpar
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Users className="w-10 h-10 text-primary/60" />
          </div>
          <h2 className="text-lg font-semibold mb-1">Nenhum lead ainda</h2>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            Adicione seu primeiro lead para começar a gerenciar suas oportunidades de venda.
          </p>
          <Button onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Criar meu primeiro lead
          </Button>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4" onClick={() => showPipelineMenu && setShowPipelineMenu(false)}>
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 h-full">
              {stages.map((stage) => (
                <PipelineColumn
                  key={stage.key}
                  status={stage.key}
                  stageConfig={stage}
                  leads={filteredLeads.filter((l) => l.status === stage.key)}
                  totalStages={stages.length}
                  onCardClick={setSelectedLead}
                  onQuickAction={handleQuickAction}
                />
              ))}
            </div>
          </DragDropContext>
        </div>
      )}

      <AddLeadDialog open={showAdd} onClose={() => setShowAdd(false)} onSave={handleAddLead} />

      {selectedLead && (
        <LeadModal lead={selectedLead} onClose={() => setSelectedLead(null)} onUpdate={handleLeadUpdate} />
      )}

      <PipelineManagerDialog
        open={showPipelineManager}
        onOpenChange={setShowPipelineManager}
        pipelines={pipelines}
        onSaved={loadAll}
        onSetDefault={handleSetDefault}
      />
    </div>
  );
}