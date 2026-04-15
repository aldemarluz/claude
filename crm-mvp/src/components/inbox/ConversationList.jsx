import moment from "moment";

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function GroupIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18 }}>
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
    </svg>
  );
}

export default function ConversationList({ conversations, selectedId, onSelect, channel, config, search, onSearchChange, filterMine, onFilterMineChange, currentUserEmail, profilePics = {} }) {
  const filtered = conversations.filter((c) => {
    if (filterMine && c.assigned_to !== currentUserEmail) return false;
    const name = c.contato_nome || c.nome || c.name || "";
    const phone = c.contato_telefone || c.telefone || c.phone || "";
    const subject = c.subject || "";
    return (
      name.toLowerCase().includes(search.toLowerCase()) ||
      phone.includes(search) ||
      subject.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div style={{ width: 320, background: config.listBg, borderRight: `1px solid ${config.searchBg}`, display: "flex", flexDirection: "column", flexShrink: 0, transition: "background 0.4s ease" }}>
      <div style={{ padding: "12px 16px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ color: config.primary }}>{config.icon}</div>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#1a202c" }}>{config.name}</span>
        </div>
        <input
          type="text"
          placeholder="Buscar conversa..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: "100%", padding: "8px 14px", borderRadius: 20,
            border: "none", background: config.searchBg, fontSize: 13,
            outline: "none", color: "#1a202c", boxSizing: "border-box",
            transition: "background 0.3s ease",
          }}
        />
        {currentUserEmail && (
          <button
            onClick={() => onFilterMineChange(!filterMine)}
            style={{
              marginTop: 8, width: "100%", padding: "6px 12px", borderRadius: 20,
              border: `1px solid ${filterMine ? config.primary : "#e2e8f0"}`,
              background: filterMine ? `${config.primary}12` : "#fff",
              color: filterMine ? config.primary : "#64748b",
              fontSize: 12, fontWeight: filterMine ? 600 : 400, cursor: "pointer",
              transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            {filterMine ? "Minhas conversas ✓" : "Minhas conversas"}
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 && (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
            Nenhuma conversa encontrada
          </div>
        )}
        {filtered.map((conv) => {
          const name = conv.contato_nome || conv.nome || conv.name || conv.contato_telefone || "?";
          const lastMsg = conv.ultima_mensagem || conv.lastMsg || conv.last_message || "";
          const time = conv.atualizado_em || conv.updated_at || conv.time || "";
          const unread = conv.nao_lido ? 1 : (conv.unread || 0);
          const isActive = selectedId === conv.id;
          const subject = conv.subject || "";
          const isGroup = conv.is_group || conv.isGroup || (conv.contato_telefone || '').includes('@g.us');
          // Use persisted profile_picture_url first, fallback to profilePics map (legacy)
          const phone = (conv.contato_telefone || '').replace(/\D/g, '');
          const picUrl = conv.profile_picture_url || conv.pictureUrl || profilePics[phone] || null;

          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                cursor: "pointer", transition: "background 0.15s",
                background: isActive ? config.listHover : "transparent",
                borderLeft: isActive ? `3px solid ${config.primary}` : "3px solid transparent",
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = config.listHover; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                background: `${config.primary}22`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 700, color: config.primary,
                overflow: "hidden", position: "relative",
              }}>
                {picUrl ? (
                  <img src={picUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} onError={e => { e.target.style.display = 'none'; }} />
                ) : isGroup ? (
                  <GroupIcon />
                ) : (
                  getInitials(name)
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 14, fontWeight: unread ? 700 : 500, color: "#1a202c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                </div>
                {channel === "email" && subject && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subject}</div>
                )}
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lastMsg}</div>
              </div>
              {conv.assigned_to && conv.assigned_to === currentUserEmail && (
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: config.primary, flexShrink: 0 }} />
              )}
              {unread > 0 && (
                <span style={{ background: config.primary, color: "#fff", fontSize: 11, fontWeight: 700, width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{unread}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}