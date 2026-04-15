import { useState } from "react";
import { Trash2, ChevronDown } from "lucide-react";

const NODE_TYPES = {
  trigger: {
    label: "Gatilho",
    color: "#f97316",
    bg: "#fff7ed",
    border: "#fed7aa",
    icon: "⚡",
    options: [
      { value: "lead_created", label: "Novo lead criado" },
      { value: "status_changed", label: "Status do lead alterado" },
      { value: "tag_added", label: "Tag adicionada ao lead" },
      { value: "whatsapp_received", label: "Mensagem WhatsApp recebida" },
      { value: "form_submitted", label: "Formulário enviado" },
    ],
  },
  condition: {
    label: "Condição",
    color: "#8b5cf6",
    bg: "#faf5ff",
    border: "#ddd6fe",
    icon: "🔀",
    options: [
      { value: "lead_status_is", label: "Status do lead é..." },
      { value: "lead_has_tag", label: "Lead possui tag..." },
      { value: "lead_origin_is", label: "Origem do lead é..." },
      { value: "phone_exists", label: "Lead tem telefone" },
    ],
  },
  action: {
    label: "Ação",
    color: "#3b82f6",
    bg: "#eff6ff",
    border: "#bfdbfe",
    icon: "🎯",
    options: [
      { value: "send_whatsapp", label: "Enviar mensagem WhatsApp" },
      { value: "send_email", label: "Enviar email" },
      { value: "add_tag", label: "Adicionar tag ao lead" },
      { value: "change_status", label: "Alterar status do lead" },
      { value: "assign_lead", label: "Atribuir lead a usuário" },
      { value: "wait", label: "Aguardar X minutos" },
    ],
  },
  end: {
    label: "Fim",
    color: "#10b981",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    icon: "✅",
    options: [],
  },
};

const STATUS_OPTIONS = ["novo", "contato_iniciado", "qualificado", "proposta_enviada", "fechado"];

export default function FlowNode({ node, allNodes, onMouseDown, onUpdate, onDelete, onConnect }) {
  const [expanded, setExpanded] = useState(true);
  const type = NODE_TYPES[node.type] || NODE_TYPES.action;

  const renderConfig = () => {
    if (node.type === "end") return null;

    return (
      <div className="mt-3 space-y-2" onClick={e => e.stopPropagation()}>
        {/* Type selector */}
        <select
          value={node.subtype || ""}
          onChange={e => onUpdate({ subtype: e.target.value })}
          style={{
            width: "100%", padding: "5px 8px", borderRadius: 6,
            border: `1px solid ${type.border}`, fontSize: 12,
            background: "#fff", color: "#1e293b", outline: "none",
          }}
        >
          <option value="">Selecionar...</option>
          {type.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Value input based on subtype */}
        {node.subtype === "send_whatsapp" && (
          <textarea
            value={node.value || ""}
            onChange={e => onUpdate({ value: e.target.value })}
            placeholder="Mensagem WhatsApp... (use {{nome}}, {{telefone}})"
            rows={3}
            style={{
              width: "100%", padding: "6px 8px", borderRadius: 6,
              border: `1px solid ${type.border}`, fontSize: 11,
              background: "#fff", color: "#1e293b", outline: "none", resize: "vertical", boxSizing: "border-box",
            }}
          />
        )}
        {node.subtype === "send_email" && (
          <div className="space-y-1">
            <input
              value={node.subject || ""}
              onChange={e => onUpdate({ subject: e.target.value })}
              placeholder="Assunto do email"
              style={{
                width: "100%", padding: "5px 8px", borderRadius: 6,
                border: `1px solid ${type.border}`, fontSize: 11, background: "#fff", outline: "none", boxSizing: "border-box",
              }}
            />
            <textarea
              value={node.value || ""}
              onChange={e => onUpdate({ value: e.target.value })}
              placeholder="Corpo do email..."
              rows={3}
              style={{
                width: "100%", padding: "6px 8px", borderRadius: 6,
                border: `1px solid ${type.border}`, fontSize: 11,
                background: "#fff", outline: "none", resize: "vertical", boxSizing: "border-box",
              }}
            />
          </div>
        )}
        {(node.subtype === "add_tag" || node.subtype === "lead_has_tag") && (
          <input
            value={node.value || ""}
            onChange={e => onUpdate({ value: e.target.value })}
            placeholder="Nome da tag..."
            style={{
              width: "100%", padding: "5px 8px", borderRadius: 6,
              border: `1px solid ${type.border}`, fontSize: 11, background: "#fff", outline: "none", boxSizing: "border-box",
            }}
          />
        )}
        {(node.subtype === "change_status" || node.subtype === "lead_status_is") && (
          <select
            value={node.value || ""}
            onChange={e => onUpdate({ value: e.target.value })}
            style={{
              width: "100%", padding: "5px 8px", borderRadius: 6,
              border: `1px solid ${type.border}`, fontSize: 11,
              background: "#fff", color: "#1e293b", outline: "none",
            }}
          >
            <option value="">Selecionar status...</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {node.subtype === "wait" && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={node.value || ""}
              onChange={e => onUpdate({ value: e.target.value })}
              placeholder="30"
              style={{
                width: 70, padding: "5px 8px", borderRadius: 6,
                border: `1px solid ${type.border}`, fontSize: 11, background: "#fff", outline: "none",
              }}
            />
            <span style={{ fontSize: 11, color: "#64748b" }}>minutos</span>
          </div>
        )}
        {node.subtype === "assign_lead" && (
          <input
            value={node.value || ""}
            onChange={e => onUpdate({ value: e.target.value })}
            placeholder="Email do responsável"
            style={{
              width: "100%", padding: "5px 8px", borderRadius: 6,
              border: `1px solid ${type.border}`, fontSize: 11, background: "#fff", outline: "none", boxSizing: "border-box",
            }}
          />
        )}

        {/* Connect to next node */}
        {node.type !== "end" && (
          <div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>Próximo nó</div>
            <select
              value={node.nextId || ""}
              onChange={e => onUpdate({ nextId: e.target.value || null })}
              style={{
                width: "100%", padding: "5px 8px", borderRadius: 6,
                border: "1px solid #e2e8f0", fontSize: 11,
                background: "#fff", color: "#1e293b", outline: "none",
              }}
            >
              <option value="">Sem conexão</option>
              {allNodes.filter(n => n.id !== node.id).map(n => (
                <option key={n.id} value={n.id}>{NODE_TYPES[n.type]?.icon} {n.label || NODE_TYPES[n.type]?.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: 260,
        background: type.bg,
        border: `2px solid ${type.border}`,
        borderRadius: 12,
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        zIndex: 10,
        userSelect: "none",
      }}
    >
      {/* Header */}
      <div
        onMouseDown={onMouseDown}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
          cursor: "grab", borderBottom: expanded ? `1px solid ${type.border}` : "none",
          borderRadius: expanded ? "10px 10px 0 0" : 10,
        }}
      >
        <span style={{ fontSize: 16 }}>{type.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: type.color, textTransform: "uppercase", letterSpacing: 0.5 }}>{type.label}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.label || (NODE_TYPES[node.type]?.options.find(o => o.value === node.subtype)?.label) || "Configurar..."}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); setExpanded(p => !p); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}
        >
          <ChevronDown style={{ width: 14, height: 14, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2, opacity: 0.6 }}
        >
          <Trash2 style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: "10px 12px 12px" }}>
          {/* Label */}
          <input
            value={node.label || ""}
            onChange={e => onUpdate({ label: e.target.value })}
            onClick={e => e.stopPropagation()}
            placeholder="Nome do nó (opcional)"
            style={{
              width: "100%", padding: "5px 8px", borderRadius: 6,
              border: `1px solid ${type.border}`, fontSize: 11,
              background: "rgba(255,255,255,0.7)", outline: "none", boxSizing: "border-box", color: "#1e293b",
            }}
          />
          {renderConfig()}
        </div>
      )}
    </div>
  );
}