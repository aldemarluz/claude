const NODE_PALETTE = [
  { type: "trigger", label: "Gatilho", icon: "⚡", color: "#f97316", desc: "Inicia o fluxo" },
  { type: "condition", label: "Condição", icon: "🔀", color: "#8b5cf6", desc: "Bifurca baseado em dados" },
  { type: "action", label: "Ação", icon: "🎯", color: "#3b82f6", desc: "Executa uma tarefa" },
  { type: "end", label: "Fim", icon: "✅", color: "#10b981", desc: "Encerra o fluxo" },
];

export default function FlowSidebar({ onAddNode }) {
  return (
    <div style={{
      width: 200, background: "#fff", borderRight: "1px solid #e2e8f0",
      display: "flex", flexDirection: "column", flexShrink: 0,
    }}>
      <div style={{ padding: "14px 12px 8px", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>Nós disponíveis</div>
      </div>
      <div style={{ padding: "8px", flex: 1, overflowY: "auto" }}>
        {NODE_PALETTE.map(n => (
          <button
            key={n.type}
            onClick={() => onAddNode(n.type)}
            style={{
              width: "100%", padding: "10px 10px", borderRadius: 10, border: "1px solid #e2e8f0",
              background: "#fff", cursor: "pointer", textAlign: "left", marginBottom: 6,
              transition: "all 0.15s", display: "flex", alignItems: "center", gap: 10,
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
            onMouseLeave={e => e.currentTarget.style.background = "#fff"}
          >
            <span style={{ fontSize: 20 }}>{n.icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{n.label}</div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>{n.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <div style={{ padding: "12px", borderTop: "1px solid #f1f5f9" }}>
        <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.5 }}>
          💡 Arraste os nós para reorganizar. Conecte nós pelo campo "Próximo nó".
        </div>
      </div>
    </div>
  );
}