import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getWorkspaceId } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Play, ChevronLeft, Plus, Zap, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import FlowCanvas from "@/components/automations/FlowCanvas";
import FlowSidebar from "@/components/automations/FlowSidebar";

let nodeCounter = 1;

function createNode(type, x = 100, y = 100) {
  return {
    id: `node_${Date.now()}_${nodeCounter++}`,
    type,
    label: "",
    subtype: "",
    value: "",
    x,
    y,
    nextId: null,
  };
}

export default function FlowBuilder() {
  const navigate = useNavigate();
  const [flows, setFlows] = useState([]);
  const [activeFlow, setActiveFlow] = useState(null); // null = list view
  const [nodes, setNodes] = useState([]);
  const [flowName, setFlowName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFlows();
  }, []);

  async function loadFlows() {
    setLoading(true);
    const accountId = await getWorkspaceId();
    const data = accountId
      ? await base44.entities.AutomationRule.filter({ workspace_id: accountId }, "-created_date", 50)
      : await base44.entities.AutomationRule.list("-created_date", 50);
    // Only show flow-type automations (those with flow_nodes)
    setFlows(data);
    setLoading(false);
  }

  function openNew() {
    setActiveFlow(null);
    setFlowName("Novo fluxo");
    // Start with a trigger node
    setNodes([createNode("trigger", 80, 80)]);
    setActiveFlow("new");
  }

  function openExisting(rule) {
    setFlowName(rule.name);
    try {
      const parsed = rule.flow_nodes ? JSON.parse(rule.flow_nodes) : [];
      setNodes(parsed.length > 0 ? parsed : [createNode("trigger", 80, 80)]);
    } catch {
      setNodes([createNode("trigger", 80, 80)]);
    }
    setActiveFlow(rule.id);
  }

  const handleAddNode = useCallback((type) => {
    const lastNode = nodes[nodes.length - 1];
    const x = lastNode ? Math.min(lastNode.x + 300, 800) : 80;
    const y = lastNode ? lastNode.y : 80;
    const newNode = createNode(type, x, y);
    setNodes(prev => [...prev, newNode]);
  }, [nodes]);

  const handleUpdateNode = useCallback((id, data) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...data } : n));
  }, []);

  const handleDeleteNode = useCallback((id) => {
    setNodes(prev => prev.filter(n => n.id !== id).map(n => ({ ...n, nextId: n.nextId === id ? null : n.nextId })));
  }, []);

  async function handleSave() {
    if (!flowName.trim()) { toast.error("Dê um nome ao fluxo"); return; }
    if (nodes.length === 0) { toast.error("Adicione pelo menos um nó"); return; }

    setSaving(true);
    const accountId = await getWorkspaceId();

    const triggerNode = nodes.find(n => n.type === "trigger");
    const actionNode = nodes.find(n => n.type === "action");

    const payload = {
      name: flowName,
      workspace_id: accountId,
      trigger: triggerNode?.subtype || "lead_created",
      trigger_value: triggerNode?.value || "",
      action: actionNode?.subtype || "send_whatsapp",
      action_value: actionNode?.value || "",
      is_active: true,
      flow_nodes: JSON.stringify(nodes),
    };

    try {
      if (activeFlow === "new") {
        const created = await base44.entities.AutomationRule.create(payload);
        setActiveFlow(created.id);
        setFlows(prev => [created, ...prev]);
        toast.success("Fluxo criado!");
      } else {
        await base44.entities.AutomationRule.update(activeFlow, payload);
        setFlows(prev => prev.map(f => f.id === activeFlow ? { ...f, ...payload } : f));
        toast.success("Fluxo salvo!");
      }
      // Auto-mark onboarding
      try {
        const me = await base44.auth.me();
        const list = await base44.entities.OnboardingProgress.filter({ user_id: me.id });
        if (list.length > 0 && !list[0].step_automation_created) {
          await base44.entities.OnboardingProgress.update(list[0].id, { step_automation_created: true });
        }
      } catch (_) {}
    } catch (err) {
      toast.error("Erro ao salvar: " + err.message);
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    await base44.entities.AutomationRule.delete(id);
    setFlows(prev => prev.filter(f => f.id !== id));
    toast.success("Fluxo removido");
  }

  async function handleToggle(rule) {
    await base44.entities.AutomationRule.update(rule.id, { is_active: !rule.is_active });
    setFlows(prev => prev.map(f => f.id === rule.id ? { ...f, is_active: !f.is_active } : f));
  }

  // ---- FLOW EDITOR VIEW ----
  if (activeFlow !== null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>
        {/* Toolbar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
          background: "#fff", borderBottom: "1px solid #e2e8f0", flexShrink: 0,
        }}>
          <button
            onClick={() => setActiveFlow(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", gap: 4, fontSize: 13, padding: "4px 8px", borderRadius: 6 }}
          >
            <ChevronLeft style={{ width: 16, height: 16 }} /> Voltar
          </button>
          <div style={{ width: 1, height: 20, background: "#e2e8f0" }} />
          <Input
            value={flowName}
            onChange={e => setFlowName(e.target.value)}
            placeholder="Nome do fluxo"
            className="h-8 text-sm font-semibold w-56 border-0 shadow-none focus-visible:ring-0 bg-transparent px-0"
          />
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{nodes.length} nó{nodes.length !== 1 ? "s" : ""}</div>
          <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={handleSave} disabled={saving}>
            <Save style={{ width: 13, height: 13 }} />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>

        {/* Canvas + Sidebar */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <FlowSidebar onAddNode={handleAddNode} />
          <FlowCanvas
            nodes={nodes}
            onAddNode={handleAddNode}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
          />
        </div>
      </div>
    );
  }

  // ---- LIST VIEW ----
  return (
    <div className="p-6 lg:p-8 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Automações</h1>
          <p className="text-sm text-muted-foreground mt-1">Crie fluxos automáticos visuais para seus leads</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Fluxo
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : flows.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <div className="w-20 h-20 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto">
            <Zap className="w-10 h-10 text-orange-500/60" />
          </div>
          <div>
            <p className="font-semibold text-base">Nenhum fluxo criado</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              Crie fluxos visuais com gatilhos, condições e ações para automatizar seu CRM.
            </p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" /> Criar meu primeiro fluxo
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {flows.map(rule => {
            let nodeCount = 0;
            try { nodeCount = JSON.parse(rule.flow_nodes || "[]").length; } catch {}
            return (
              <div
                key={rule.id}
                className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => openExisting(rule)}
              >
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{rule.name}</p>
                    <Badge variant="outline" className={rule.is_active ? "text-emerald-600 border-emerald-500/20 bg-emerald-500/10" : "text-muted-foreground"}>
                      {rule.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                    {nodeCount > 0 && (
                      <Badge variant="outline" className="text-blue-600 border-blue-500/20 bg-blue-500/10">
                        {nodeCount} nós
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Gatilho: <span className="text-foreground">{rule.trigger || "-"}</span>
                    {rule.action && <> → Ação: <span className="text-foreground">{rule.action}</span></>}
                  </p>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleToggle(rule)}
                    style={{
                      padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0",
                      background: rule.is_active ? "#dcfce7" : "#f1f5f9",
                      color: rule.is_active ? "#166534" : "#64748b",
                      fontSize: 11, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {rule.is_active ? "Pausar" : "Ativar"}
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", opacity: 0.6, padding: 4 }}
                  >
                    <Trash2 style={{ width: 15, height: 15 }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}