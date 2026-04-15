import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getWorkspaceId } from "@/lib/workspace";
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

// ═══ DESIGN SYSTEM ═══
const C = {
  bg: "hsl(220, 20%, 97%)",
  card: "#ffffff",
  cardHover: "#f8fafc",
  border: "#e2e8f0",
  text: "#0f172a",
  textMuted: "#64748b",
  textDim: "#94a3b8",
  accent: "#3B82F6",
  green: "#10B981",
  orange: "#F59E0B",
  purple: "#8B5CF6",
  red: "#EF4444",
  pink: "#EC4899",
};

const TRIGGERS = {
  first_message: { label: "Primeira mensagem", icon: "👋", desc: "Contato novo manda a primeira mensagem", color: C.green },
  message_received: { label: "Mensagem recebida", icon: "💬", desc: "Qualquer mensagem recebida", color: C.accent },
  message_contains: { label: "Palavra-chave", icon: "🔑", desc: "Mensagem contém texto específico", color: C.orange },
  no_response: { label: "Sem resposta", icon: "⏰", desc: "Conversa sem resposta há X horas", color: C.red },
  lead_created: { label: "Lead criado", icon: "🎯", desc: "Novo lead adicionado ao pipeline", color: C.purple },
  status_changed: { label: "Status alterado", icon: "🔄", desc: "Lead muda de etapa no pipeline", color: C.pink },
};

const ACTIONS = {
  send_whatsapp: { label: "Enviar WhatsApp", icon: "📱", color: "#25D366" },
  add_tag: { label: "Adicionar tag", icon: "🏷️", color: C.orange },
  change_status: { label: "Alterar status", icon: "📊", color: C.purple },
  create_lead: { label: "Criar lead", icon: "➕", color: C.accent },
  notify_team: { label: "Notificar equipe", icon: "🔔", color: C.pink },
};

const TEMPLATES = [
  {
    id: "welcome",
    name: "Boas-vindas automática",
    desc: "Responde instantaneamente quando um contato novo manda a primeira mensagem",
    trigger: "first_message",
    action: "send_whatsapp",
    action_value: "Olá! Obrigado por entrar em contato. Em breve um atendente vai te responder. 😊",
    popular: true,
    runs: 847,
  },
  {
    id: "keyword_price",
    name: "Resposta por palavra-chave",
    desc: "Quando a mensagem contém 'preço' ou 'orçamento', envia tabela de preços",
    trigger: "message_contains",
    trigger_value: "preço|orçamento|valor|quanto custa",
    action: "send_whatsapp",
    action_value: "Nossos planos começam a partir de R$197/mês. Quer que eu envie uma proposta personalizada?",
    popular: true,
    runs: 523,
  },
  {
    id: "followup",
    name: "Follow-up 2 horas",
    desc: "Se ninguém respondeu em 2 horas, envia lembrete educado",
    trigger: "no_response",
    trigger_value: "2",
    action: "send_whatsapp",
    action_value: "Oi! Vi que ainda não conseguimos te responder. Desculpa a demora! Posso te ajudar com algo?",
    runs: 312,
  },
  {
    id: "auto_lead",
    name: "Criar lead automático",
    desc: "Quando contato novo manda mensagem, cria lead automaticamente no pipeline",
    trigger: "first_message",
    action: "create_lead",
    action_value: "",
    runs: 1204,
  },
  {
    id: "tag_interest",
    name: "Taguear por interesse",
    desc: "Quando mensagem contém 'site', adiciona tag 'interesse-site' no contato",
    trigger: "message_contains",
    trigger_value: "site|landing page|página",
    action: "add_tag",
    action_value: "interesse-site",
    runs: 189,
  },
];

function TriggerBadge({ trigger, small }) {
  const t = TRIGGERS[trigger];
  if (!t) return null;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: small ? 4 : 6,
      padding: small ? "3px 8px" : "5px 12px",
      borderRadius: 8, background: `${t.color}15`,
      fontSize: small ? 11 : 12, fontWeight: 600, color: t.color,
    }}>
      <span style={{ fontSize: small ? 11 : 13 }}>{t.icon}</span>
      {t.label}
    </div>
  );
}

function ActionBadge({ action, small }) {
  const a = ACTIONS[action];
  if (!a) return null;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: small ? 4 : 6,
      padding: small ? "3px 8px" : "5px 12px",
      borderRadius: 8, background: `${a.color}15`,
      fontSize: small ? 11 : 12, fontWeight: 600, color: a.color,
    }}>
      <span style={{ fontSize: small ? 11 : 13 }}>{a.icon}</span>
      {a.label}
    </div>
  );
}

function FlowArrow() {
  return (
    <svg width="20" height="12" viewBox="0 0 20 12" style={{ margin: "0 4px", opacity: 0.3 }}>
      <path d="M0 6h16M12 1l5 5-5 5" stroke={C.textMuted} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TemplateCard({ template, onActivate, isActive }) {
  const [hover, setHover] = useState(false);
  const t = TRIGGERS[template.trigger];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: isActive ? `${C.green}08` : hover ? C.cardHover : C.card,
        border: `1px solid ${isActive ? C.green + "40" : hover ? C.border + "80" : C.border}`,
        borderRadius: 16, padding: 20, cursor: "pointer",
        transition: "all 0.25s ease", position: "relative", overflow: "hidden",
      }}
      onClick={() => onActivate(template)}
    >
      {template.popular && (
        <div style={{
          position: "absolute", top: 12, right: 12,
          background: "linear-gradient(135deg, #F59E0B, #EF4444)",
          color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 8px",
          borderRadius: 6, textTransform: "uppercase", letterSpacing: 0.5,
        }}>Popular</div>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${t?.color || C.accent}15`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, flexShrink: 0,
        }}>{t?.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{template.name}</div>
          <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5, marginBottom: 12 }}>{template.desc}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <TriggerBadge trigger={template.trigger} small />
            <FlowArrow />
            <ActionBadge action={template.action} small />
          </div>
        </div>
      </div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}`,
      }}>
        <span style={{ fontSize: 11, color: C.textDim }}>{template.runs?.toLocaleString()} execuções na comunidade</span>
        <button
          onClick={(e) => { e.stopPropagation(); onActivate(template); }}
          style={{
            padding: "6px 16px", borderRadius: 8, border: "none",
            background: isActive ? C.green : C.accent,
            color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}
        >{isActive ? "✓ Ativo" : "Ativar"}</button>
      </div>
    </div>
  );
}

function ActiveRuleCard({ rule, onToggle, onDelete }) {
  const [hover, setHover] = useState(false);
  const t = TRIGGERS[rule.trigger];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? C.cardHover : C.card,
        border: `1px solid ${rule.is_active ? C.green + "30" : C.border}`,
        borderRadius: 14, padding: "16px 20px",
        transition: "all 0.2s ease",
        display: "flex", alignItems: "center", gap: 14,
      }}
    >
      <div style={{
        width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
        background: rule.is_active ? C.green : C.textDim,
        boxShadow: rule.is_active ? `0 0 8px ${C.green}60` : "none",
        transition: "all 0.3s",
      }} />
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: `${t?.color || C.accent}12`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 17, flexShrink: 0,
      }}>{t?.icon || "⚡"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{rule.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
          <TriggerBadge trigger={rule.trigger} small />
          <FlowArrow />
          <ActionBadge action={rule.action} small />
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, marginRight: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{rule.executions || 0}</div>
        <div style={{ fontSize: 10, color: C.textDim }}>execuções</div>
      </div>
      <div
        onClick={() => onToggle(rule)}
        style={{
          width: 44, height: 24, borderRadius: 12, cursor: "pointer",
          background: rule.is_active ? C.green : C.textDim + "40",
          display: "flex", alignItems: "center", padding: 2,
          transition: "background 0.3s", flexShrink: 0,
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: 10, background: "#fff",
          transform: rule.is_active ? "translateX(20px)" : "translateX(0)",
          transition: "transform 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }} />
      </div>
      <button
        onClick={() => onDelete(rule)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: hover ? C.red : "transparent",
          transition: "color 0.2s", padding: 4, fontSize: 16,
        }}
      >🗑</button>
    </div>
  );
}

function CreateDialog({ open, onClose, onSave }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", trigger: "", trigger_value: "", action: "", action_value: "" });

  if (!open) return null;

  const handleSave = () => {
    onSave(form);
    onClose();
    setStep(1);
    setForm({ name: "", trigger: "", trigger_value: "", action: "", action_value: "" });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, backdropFilter: "blur(4px)",
    }} onClick={onClose}>
      <div style={{
        background: "#ffffff", border: `1px solid ${C.border}`,
        borderRadius: 20, width: 520, maxHeight: "85vh", overflow: "auto",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
            {step === 1 ? "Escolha o gatilho" : step === 2 ? "Escolha a ação" : "Configure a mensagem"}
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Passo {step} de 3</div>
          <div style={{ height: 3, background: C.border, borderRadius: 2, marginTop: 12 }}>
            <div style={{ height: 3, background: C.accent, borderRadius: 2, width: `${(step / 3) * 100}%`, transition: "width 0.3s" }} />
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {step === 1 && (
            <div style={{ display: "grid", gap: 10 }}>
              {Object.entries(TRIGGERS).map(([key, t]) => (
                <div key={key} onClick={() => { setForm({ ...form, trigger: key }); setStep(2); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                    border: `1px solid ${form.trigger === key ? t.color : C.border}`,
                    background: form.trigger === key ? `${t.color}10` : C.card,
                    transition: "all 0.2s",
                  }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${t.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{t.icon}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{t.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "grid", gap: 10 }}>
              {form.trigger === "message_contains" && (
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 6 }}>Palavras-chave (separe com |)</label>
                  <input value={form.trigger_value} onChange={e => setForm({ ...form, trigger_value: e.target.value })}
                    placeholder="orçamento|preço|valor"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "#f8fafc", border: `1px solid ${C.border}`, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
              )}
              {form.trigger === "no_response" && (
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 6 }}>Horas sem resposta</label>
                  <input type="number" value={form.trigger_value} onChange={e => setForm({ ...form, trigger_value: e.target.value })}
                    placeholder="2"
                    style={{ width: 100, padding: "10px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, outline: "none" }} />
                </div>
              )}
              {Object.entries(ACTIONS).map(([key, a]) => (
                <div key={key} onClick={() => { setForm({ ...form, action: key }); setStep(3); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                    border: `1px solid ${form.action === key ? a.color : C.border}`,
                    background: form.action === key ? `${a.color}10` : C.card,
                    transition: "all 0.2s",
                  }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${a.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{a.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{a.label}</div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 6 }}>Nome da automação</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Boas-vindas WhatsApp"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              {(form.action === "send_whatsapp") && (
                <div>
                  <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 6 }}>Mensagem WhatsApp</label>
                  <textarea value={form.action_value} onChange={e => setForm({ ...form, action_value: e.target.value })}
                    placeholder="Olá! Obrigado por entrar em contato..." rows={4}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>Use {"{{nome}}"} pro nome do contato</div>
                </div>
              )}
              {form.action === "add_tag" && (
                <div>
                  <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 6 }}>Tag</label>
                  <input value={form.action_value} onChange={e => setForm({ ...form, action_value: e.target.value })}
                    placeholder="interesse-site"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
              )}
              {form.action === "change_status" && (
                <div>
                  <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 6 }}>Novo status</label>
                  <select value={form.action_value} onChange={e => setForm({ ...form, action_value: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, outline: "none" }}>
                    <option value="">Selecione</option>
                    <option value="contato_iniciado">Contato iniciado</option>
                    <option value="qualificado">Qualificado</option>
                    <option value="proposta_enviada">Proposta enviada</option>
                    <option value="fechado">Fechado</option>
                  </select>
                </div>
              )}
              <div style={{ background: C.card, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.textDim, marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Preview do fluxo</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <TriggerBadge trigger={form.trigger} />
                  <FlowArrow />
                  <ActionBadge action={form.action} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between" }}>
          <button onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            style={{ padding: "8px 20px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 13, cursor: "pointer" }}>
            {step > 1 ? "← Voltar" : "Cancelar"}
          </button>
          {step === 3 && (
            <button onClick={handleSave} disabled={!form.name || !form.trigger || !form.action}
              style={{
                padding: "8px 24px", borderRadius: 10, border: "none",
                background: form.name && form.trigger && form.action ? C.accent : C.textDim,
                color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: form.name ? "pointer" : "default", opacity: form.name ? 1 : 0.5,
              }}>Criar Automação</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Automations() {
  const [tab, setTab] = useState("templates");
  const [showCreate, setShowCreate] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activatingTemplate, setActivatingTemplate] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [flowName, setFlowName] = useState("Novo fluxo");
  const [saving, setSaving] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);

  useEffect(() => { loadRules(); }, []);

  async function loadRules() {
    setLoading(true);
    try {
      const wsId = await getWorkspaceId();
      let data = wsId
        ? await base44.entities.AutomationRule.filter({ workspace_id: wsId })
        : await base44.entities.AutomationRule.list("-created_date", 100);
      setRules(data);
    } catch (_) {}
    setLoading(false);
  }

  async function handleActivateTemplate(template) {
    const existing = rules.find(r => r._templateId === template.id || r.name === template.name);
    if (existing) {
      await base44.entities.AutomationRule.delete(existing.id);
      setRules(prev => prev.filter(r => r.id !== existing.id));
      return;
    }
    setActivatingTemplate(template.id);
    try {
      const wsId = await getWorkspaceId();
      const user = await base44.auth.me().catch(() => null);
      const created = await base44.entities.AutomationRule.create({
        name: template.name,
        trigger: template.trigger,
        trigger_value: template.trigger_value || "",
        action: template.action,
        action_value: template.action_value || "",
        is_active: true,
        executions: 0,
        workspace_id: wsId || null,
        owner_email: user?.email || null,
        _templateId: template.id,
      });
      setRules(prev => [...prev, { ...created, _templateId: template.id }]);
      setTab("active");
    } catch (_) {}
    setActivatingTemplate(null);
  }

  async function handleToggle(rule) {
    await base44.entities.AutomationRule.update(rule.id, { is_active: !rule.is_active });
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
  }

  async function handleDelete(rule) {
    await base44.entities.AutomationRule.delete(rule.id);
    setRules(prev => prev.filter(r => r.id !== rule.id));
  }

  async function handleCreate(form) {
    const wsId = await getWorkspaceId();
    const user = await base44.auth.me().catch(() => null);
    const created = await base44.entities.AutomationRule.create({
      ...form, is_active: true, executions: 0,
      workspace_id: wsId || null,
      owner_email: user?.email || null,
    });
    setRules(prev => [...prev, created]);
    setTab("active");
  }

  async function handleSaveFlow() {
    if (!flowName.trim()) { alert("Dê um nome ao fluxo"); return; }
    if (nodes.length === 0) { alert("Adicione pelo menos um nó"); return; }

    setSaving(true);
    const wsId = await getWorkspaceId();
    const triggerNode = nodes.find(n => n.type === "trigger");
    const actionNode = nodes.find(n => n.type === "action");

    const payload = {
      name: flowName,
      workspace_id: wsId,
      trigger: triggerNode?.subtype || "lead_created",
      trigger_value: triggerNode?.value || "",
      action: actionNode?.subtype || "send_whatsapp",
      action_value: actionNode?.value || "",
      is_active: true,
      flow_nodes: JSON.stringify(nodes),
    };

    try {
      if (editingFlow === "new") {
        const created = await base44.entities.AutomationRule.create(payload);
        setRules(prev => [created, ...prev]);
        alert("Fluxo criado!");
      } else if (editingFlow) {
        await base44.entities.AutomationRule.update(editingFlow, payload);
        setRules(prev => prev.map(f => f.id === editingFlow ? { ...f, ...payload } : f));
        alert("Fluxo salvo!");
      }
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    }
    setSaving(false);
    closeBuilder();
  }

  function openBuilder(rule = null) {
    if (rule) {
      setFlowName(rule.name);
      setEditingFlow(rule.id);
      try {
        const parsed = rule.flow_nodes ? JSON.parse(rule.flow_nodes) : [];
        setNodes(parsed.length > 0 ? parsed : [createNode("trigger", 80, 80)]);
      } catch {
        setNodes([createNode("trigger", 80, 80)]);
      }
    } else {
      setFlowName("Novo fluxo");
      setEditingFlow("new");
      setNodes([createNode("trigger", 80, 80)]);
    }
    setShowBuilder(true);
  }

  function closeBuilder() {
    setShowBuilder(false);
    setEditingFlow(null);
    setNodes([]);
    setFlowName("Novo fluxo");
  }

  const handleAddNode = (type) => {
    const lastNode = nodes[nodes.length - 1];
    const x = lastNode ? Math.min(lastNode.x + 300, 800) : 80;
    const y = lastNode ? lastNode.y : 80;
    const newNode = createNode(type, x, y);
    setNodes(prev => [...prev, newNode]);
  };

  const handleUpdateNode = (id, data) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...data } : n));
  };

  const handleDeleteNode = (id) => {
    setNodes(prev => prev.filter(n => n.id !== id).map(n => ({ ...n, nextId: n.nextId === id ? null : n.nextId })));
  };

  const activeCount = rules.filter(r => r.is_active).length;
  const totalExecs = rules.reduce((sum, r) => sum + (r.executions || 0), 0);
  const activatedTemplateIds = new Set(rules.map(r => r._templateId || r.name).filter(Boolean));

  if (showBuilder) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
          background: "#fff", borderBottom: "1px solid #e2e8f0", flexShrink: 0,
        }}>
          <button
            onClick={closeBuilder}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", gap: 4, fontSize: 13, padding: "4px 8px", borderRadius: 6 }}
          >← Voltar</button>
          <div style={{ width: 1, height: 20, background: "#e2e8f0" }} />
          <input
            value={flowName}
            onChange={e => setFlowName(e.target.value)}
            placeholder="Nome do fluxo"
            style={{ fontSize: 13, fontWeight: 600, border: "none", background: "transparent", outline: "none", flex: 1, maxWidth: 300 }}
          />
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{nodes.length} nó{nodes.length !== 1 ? "s" : ""}</div>
          <button
            onClick={handleSaveFlow}
            disabled={saving}
            style={{
              padding: "6px 16px", borderRadius: 8, border: "none",
              background: C.accent, color: "#fff", fontSize: 12, fontWeight: 600,
              cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
            }}
          >{saving ? "Salvando..." : "Salvar"}</button>
        </div>

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

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', -apple-system, sans-serif",
      fontFamily: "'DM Sans', -apple-system, sans-serif",
      padding: "24px 32px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Automações</h1>
          <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Configure respostas automáticas e ações para seu WhatsApp</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => openBuilder()}
            style={{
              padding: "10px 20px", borderRadius: 12, border: "none",
              background: C.accent, color: "#fff", fontSize: 13, fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            }}>
            <span style={{ fontSize: 16 }}>⚡</span> Canvas Visual
          </button>
          <button onClick={() => setShowCreate(true)}
            style={{
              padding: "10px 20px", borderRadius: 12, border: `1px solid ${C.border}`,
              background: C.card, color: C.text, fontSize: 13, fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            }}>
            <span style={{ fontSize: 16 }}>+</span> Template
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Automações ativas", value: activeCount, color: C.green },
          { label: "Total de execuções", value: totalExecs, color: C.accent },
          { label: "Tempo economizado", value: `${Math.round(totalExecs * 0.5)}min`, color: C.orange },
        ].map((stat, i) => (
          <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{
        display: "flex", gap: 4, marginBottom: 20,
        background: C.card, borderRadius: 12, padding: 4,
        border: `1px solid ${C.border}`, width: "fit-content",
      }}>
        {[
          { key: "templates", label: "Templates prontos", icon: "📦" },
          { key: "active", label: `Minhas automações (${rules.length})`, icon: "⚡" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: "8px 18px", borderRadius: 9, border: "none",
              background: tab === t.key ? C.accent : "transparent",
              color: tab === t.key ? "#fff" : C.textMuted,
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6,
            }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {tab === "templates" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {TEMPLATES.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              isActive={activatedTemplateIds.has(t.id) || activatedTemplateIds.has(t.name)}
              onActivate={handleActivateTemplate}
            />
          ))}
        </div>
      )}

      {tab === "active" && (
        <div style={{ display: "grid", gap: 10 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>Carregando...</div>
          ) : rules.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: C.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Nenhuma automação criada</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Use o Canvas Visual ou ative um template</div>
            </div>
          ) : (
            rules.map(rule => (
              <div
                key={rule.id}
                style={{
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px",
                  display: "flex", alignItems: "center", gap: 14, cursor: rule.flow_nodes ? "pointer" : "default",
                  transition: "all 0.2s", position: "relative",
                }}
                onClick={() => rule.flow_nodes && openBuilder(rule)}
                onMouseEnter={(e) => e.currentTarget.style.background = C.cardHover}
                onMouseLeave={(e) => e.currentTarget.style.background = C.card}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                  background: rule.is_active ? C.green : C.textDim,
                  boxShadow: rule.is_active ? `0 0 8px ${C.green}60` : "none",
                }} />
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: `${TRIGGERS[rule.trigger]?.color || C.accent}12`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 17, flexShrink: 0,
                }}>{TRIGGERS[rule.trigger]?.icon || "⚡"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{rule.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <TriggerBadge trigger={rule.trigger} small />
                    <FlowArrow />
                    <ActionBadge action={rule.action} small />
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginRight: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{rule.executions || 0}</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>execuções</div>
                </div>
                <div
                  onClick={(e) => { e.stopPropagation(); handleToggle(rule); }}
                  style={{
                    width: 44, height: 24, borderRadius: 12, cursor: "pointer",
                    background: rule.is_active ? C.green : C.textDim + "40",
                    display: "flex", alignItems: "center", padding: 2,
                    transition: "background 0.3s", flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 10, background: "#fff",
                    transform: rule.is_active ? "translateX(20px)" : "translateX(0)",
                    transition: "transform 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }} />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(rule); }}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: C.red, opacity: 0.6, transition: "opacity 0.2s", padding: 4, fontSize: 16,
                  }}
                  onMouseEnter={(e) => e.target.style.opacity = 1}
                  onMouseLeave={(e) => e.target.style.opacity = 0.6}
                >🗑</button>
              </div>
            ))
          )}
        </div>
      )}

      <CreateDialog open={showCreate} onClose={() => setShowCreate(false)} onSave={handleCreate} />
    </div>
  );
}