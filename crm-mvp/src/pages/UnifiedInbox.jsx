import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { getWorkspaceId } from "@/lib/workspace";
import { toast } from "sonner";
import { CHANNELS } from "@/components/inbox/ChannelConfig";
import ConversationList from "@/components/inbox/ConversationList";
import ChatBubble from "@/components/inbox/ChatBubble";
import ChatInput from "@/components/inbox/ChatInput";
import CRMPanel from "@/components/inbox/CRMPanel";
import moment from "moment";

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// CRM contacts mapped by conversation ID
const INITIAL_CONTACTS = {
  "wa-demo": null, // WhatsApp contacts loaded from DB
  "ig-1": {
    id: "ig-1", name: "Juliana Martins", email: "ju@julianamkt.com", phone: "+5511988887777",
    company: "Juliana MKT", tags: ["social media", "portfolio"], origin: "Instagram", assignedTo: "Você",
    totalValue: 5600, dealsCount: 2,
    deals: [
      { id: "d3", title: "Criação de portfólio", value: 2800, stage: 4, status: "ganho", createdAt: "15 Fev 2026", proposals: [{ id: "p2", title: "Portfólio web", value: 2800, status: "aceita" }] },
      { id: "d4", title: "Gestão de tráfego", value: 2800, stage: 0, status: "aberto", createdAt: "12 Abr 2026", proposals: [] },
    ],
    timeline: [
      { type: "deal", text: "Nova oportunidade: Gestão de tráfego", time: "Hoje 15:02", color: "#3b82f6" },
      { type: "instagram", text: "Juliana pediu segunda fase", time: "Hoje 15:02", color: "#E1306C" },
      { type: "deal", text: "Portfólio marcado como Ganho", time: "15 Fev", color: "#10b981" },
    ],
  },
  "ig-2": {
    id: "ig-2", name: "Pedro Tech", email: "pedro@tech.com", phone: "+5521977770000",
    company: "Pedro Tech", tags: ["site"], origin: "Instagram", assignedTo: "-",
    totalValue: 0, dealsCount: 1,
    deals: [{ id: "d8", title: "Site institucional", value: 0, stage: 0, status: "aberto", createdAt: "12 Abr 2026", proposals: [] }],
    timeline: [{ type: "instagram", text: "Primeiro contato via Instagram", time: "Hoje", color: "#E1306C" }],
  },
  "ms-1": {
    id: "ms-1", name: "Fernanda Oliveira", email: "fernanda@email.com", phone: "+5521977776666",
    company: "-", tags: ["site"], origin: "Facebook", assignedTo: "-",
    totalValue: 0, dealsCount: 1,
    deals: [{ id: "d5", title: "Site institucional", value: 0, stage: 0, status: "aberto", createdAt: "12 Abr 2026", proposals: [] }],
    timeline: [{ type: "messenger", text: "Primeiro contato via Messenger", time: "Hoje 14:05", color: "#0084FF" }],
  },
  "ms-2": {
    id: "ms-2", name: "Marcos Almeida", email: "marcos@email.com", phone: "+5511988880000",
    company: "-", tags: [], origin: "Facebook", assignedTo: "-",
    totalValue: 0, dealsCount: 1,
    deals: [{ id: "d9", title: "Consultoria", value: 0, stage: 0, status: "aberto", createdAt: "12 Abr 2026", proposals: [] }],
    timeline: [{ type: "messenger", text: "Primeiro contato via Messenger", time: "Hoje", color: "#0084FF" }],
  },
  "em-1": {
    id: "em-1", name: "Carla Mendes", email: "contato@empresa.com.br", phone: "+5511966665555",
    company: "Empresa XYZ", tags: ["crm", "enterprise", "recorrente"], origin: "Email", assignedTo: "Você",
    totalValue: 24000, dealsCount: 2,
    deals: [
      { id: "d6", title: "Site + CRM (8 users)", value: 12000, stage: 4, status: "ganho", createdAt: "Jan 2026", proposals: [{ id: "p3", title: "Site + CRM 8 users", value: 12000, status: "aceita" }] },
      { id: "d7", title: "Expansão CRM (15 users)", value: 12000, stage: 1, status: "aberto", createdAt: "12 Abr 2026", proposals: [] },
    ],
    timeline: [
      { type: "deal", text: "Nova oportunidade: Expansão CRM", time: "Hoje 13:45", color: "#3b82f6" },
      { type: "email", text: "Email pedindo novo projeto CRM", time: "Hoje 13:45", color: "#4A5568" },
      { type: "deal", text: "Site + CRM marcado como Ganho", time: "Jan 2026", color: "#10b981" },
    ],
  },
};

const EMAIL_CONVS = [
  { id: "em-1", contato_nome: "contato@empresa.com.br", subject: "Solicitação de orçamento", ultima_mensagem: "Prezados, gostaríamos de solicitar...", atualizado_em: new Date().toISOString(), nao_lido: true },
  { id: "em-2", contato_nome: "rh@clientex.com", subject: "Re: Proposta comercial", ultima_mensagem: "Recebemos a proposta, vamos analisar...", atualizado_em: new Date(Date.now() - 7200000).toISOString(), nao_lido: false },
  { id: "em-3", contato_nome: "joao@startup.io", subject: "Interesse em CRM", ultima_mensagem: "Oi! Estou procurando um CRM simples...", atualizado_em: new Date(Date.now() - 86400000).toISOString(), nao_lido: false },
];
const EMAIL_MESSAGES = {
  "em-1": [
    { id: "em-m1", dir: "received", subject: "Solicitação de orçamento", text: "Prezados,\n\nGostariamos de solicitar um orçamento para criação de site institucional e implementação de CRM para nossa equipe de vendas (8 pessoas).\n\nAguardamos retorno.\n\nAtt,\nCarla Mendes\nDiretora Comercial", time: "13:45" },
  ],
};

export default function UnifiedInbox() {
  const [activeChannel, setActiveChannel] = useState("whatsapp");
  const [transitioning, setTransitioning] = useState(false);
  const [search, setSearch] = useState("");

  // WhatsApp state
  const [waConversations, setWaConversations] = useState([]);
  const [waMessages, setWaMessages] = useState([]);
  const [waChannels, setWaChannels] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mediaFile, setMediaFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [waGroups, setWaGroups] = useState([]); // groups from WhatsApp
  const [profilePics, setProfilePics] = useState({}); // phone -> picture url
  const [disconnectedBanner, setDisconnectedBanner] = useState(false);

  // CRM contacts state
  const [crmContacts, setCrmContacts] = useState(INITIAL_CONTACTS);
  const [showCRM, setShowCRM] = useState(true);
  const [filterMine, setFilterMine] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Email (mock)
  const [emMessages, setEmMessages] = useState(EMAIL_MESSAGES);
  const [emSelected, setEmSelected] = useState("em-1");
  const [mockInput, setMockInput] = useState("");

  const bottomRef = useRef(null);
  const config = CHANNELS[activeChannel];

  useEffect(() => {
    loadWAData();
    const interval = setInterval(() => {
      getWorkspaceId().then(accountId => { if (accountId) loadWAConversations(accountId); }).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (waConversations.length > 0) loadGroupsAndPics();
  }, [waConversations.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [waMessages, emMessages, activeChannel, selectedConv, emSelected]);

  useEffect(() => {
    const unsub = base44.entities.WhatsAppConversation.subscribe((event) => {
      if (event.type === "create") setWaConversations((p) => [event.data, ...p]);
      else if (event.type === "update") setWaConversations((p) => p.map((c) => c.id === event.id ? { ...c, ...event.data } : c));
    });
    const unsubMsg = base44.entities.WhatsAppMessage.subscribe((event) => {
      if (event.type === "create" && selectedConv?.id === event.data?.conversa_id)
        setWaMessages((p) => [...p, event.data]);
    });
    // Subscribe to channel status changes to show disconnect banner
    const unsubChannel = base44.entities.WhatsAppChannel.subscribe((event) => {
      if (event.type === "update") {
        setWaChannels((p) => p.map((c) => c.id === event.id ? { ...c, ...event.data } : c));
        if (event.data?.status === "desconectado") setDisconnectedBanner(true);
        if (event.data?.status === "conectado") setDisconnectedBanner(false);
      }
    });
    return () => { unsub(); unsubMsg(); unsubChannel(); };
  }, [selectedConv]);

  async function loadWAData() {
    setLoading(true);
    const [user, accountId] = await Promise.all([
      base44.auth.me().catch(() => null),
      getWorkspaceId(),
    ]);
    setCurrentUser(user);
    await Promise.all([loadWAConversations(accountId), loadWAChannels(accountId)]);
    setLoading(false);
  }

  async function loadGroupsAndPics() {
    try {
      const phones = waConversations
        .map(c => c.contato_telefone)
        .filter(Boolean)
        .filter(p => !p.includes('@g.us')); // exclude groups
      const res = await base44.functions.invoke('getWhatsAppGroups', { phones });
      if (res?.data?.groups) setWaGroups(res.data.groups);
      if (res?.data?.profilePics) setProfilePics(res.data.profilePics);
    } catch (_) {}
  }

  async function loadWAConversations(accountId) {
    let convs = [];
    // 1) Tentar por workspace_id
    if (accountId) {
      const [withWs, noWs] = await Promise.all([
        base44.entities.WhatsAppConversation.filter({ workspace_id: accountId }, "-atualizado_em", 100),
        base44.entities.WhatsAppConversation.filter({ workspace_id: null }, "-atualizado_em", 100),
      ]);
      const merged = [...withWs];
      for (const c of noWs) { if (!merged.find(x => x.id === c.id)) merged.push(c); }
      convs = merged;
    }
    // 2) Fallback: buscar por owner_email se nada encontrado
    if (convs.length === 0) {
      try {
        const user = currentUser || await base44.auth.me().catch(() => null);
        if (user) {
          const byOwner = await base44.entities.WhatsAppConversation.filter({ owner_email: user.email }, "-atualizado_em", 100);
          convs = byOwner;
        }
      } catch (_) {}
    }
    // 3) Último fallback: listar todas (para debug — pega até conversas órfãs)
    if (convs.length === 0) {
      try {
        const all = await base44.entities.WhatsAppConversation.list("-atualizado_em", 100);
        convs = all;
        if (all.length > 0) console.warn("[CRMFlow] Conversas encontradas sem workspace_id/owner_email — possível dessincronização");
      } catch (_) {}
    }
    convs.sort((a, b) => new Date(b.atualizado_em || 0) - new Date(a.atualizado_em || 0));
    setWaConversations(convs.slice(0, 100));
  }

  async function loadWAChannels(accountId) {
    const id = accountId || await getWorkspaceId();
    let chs = [];
    if (id) {
      chs = await base44.entities.WhatsAppChannel.filter({ workspace_id: id });
    }
    // Fallback: buscar canais sem workspace_id ou por owner_email
    if (chs.length === 0) {
      try {
        const user = currentUser || await base44.auth.me().catch(() => null);
        if (user) {
          const [noWs, byOwner] = await Promise.all([
            base44.entities.WhatsAppChannel.filter({ workspace_id: null }),
            base44.entities.WhatsAppChannel.filter({ owner_email: user.email }),
          ]);
          const all = [...noWs, ...byOwner];
          const seen = new Set();
          chs = all.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
        }
      } catch (_) {}
    }
    setWaChannels(chs);
    if (chs.length > 0 && chs.some(c => c.status === "desconectado")) setDisconnectedBanner(true);
    if (chs.length > 0 && chs.every(c => c.status === "conectado")) setDisconnectedBanner(false);
  }

  async function selectWAConversation(conv) {
    setSelectedConv(conv);
    const msgs = await base44.entities.WhatsAppMessage.filter({ conversa_id: conv.id }, "timestamp", 200);
    setWaMessages(msgs);
    if (conv.nao_lido) {
      await base44.entities.WhatsAppConversation.update(conv.id, { nao_lido: false });
      setWaConversations((p) => p.map((c) => c.id === conv.id ? { ...c, nao_lido: false } : c));
    }
  }

  async function handleAssignConversation(userEmail) {
    if (activeChannel !== "whatsapp" || !selectedConv) return;
    await base44.entities.WhatsAppConversation.update(selectedConv.id, { assigned_to: userEmail || null });
    setWaConversations((p) => p.map((c) => c.id === selectedConv.id ? { ...c, assigned_to: userEmail || null } : c));
    setSelectedConv(prev => ({ ...prev, assigned_to: userEmail || null }));
    setCrmContacts(p => ({
      ...p,
      [selectedConv.id]: { ...getCRMContact("whatsapp", selectedConv.id), assignedTo: userEmail },
    }));
  }

  async function handleFileSelect(e, directMedia) {
    // Audio from AudioRecorder: send directly without going through mediaFile preview
    if (directMedia && directMedia.type === 'audio') {
      if (!selectedConv) { toast.error("Selecione uma conversa primeiro."); return; }
      if (waChannels.length === 0) { toast.error("Nenhum canal WhatsApp encontrado."); return; }
      setSending(true);
      try {
        await base44.functions.invoke('sendWhatsAppMessage', {
          conversation_id: selectedConv.id,
          mensagem: null,
          media_url: directMedia.url,
          media_type: 'audio',
          file_name: directMedia.name || 'audio.webm',
        });
        setWaMessages((p) => [...p, {
          id: Date.now().toString(), conversa_id: selectedConv.id, contato_id: selectedConv.contato_id,
          direcao: 'outbound', conteudo: '', media_url: directMedia.url,
          media_type: 'audio', file_name: directMedia.name || 'audio.webm',
          timestamp: new Date().toISOString(), status: 'enviado',
        }]);
        setWaConversations((p) => p.map((c) => c.id === selectedConv.id ? { ...c, ultima_mensagem: '[Áudio]', atualizado_em: new Date().toISOString() } : c));
      } catch (err) {
        toast.error('Erro ao enviar áudio: ' + err.message);
      }
      setSending(false);
      return;
    }
    if (directMedia) { setMediaFile(directMedia); return; }
    const file = e?.target?.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("video/") ? "video" : "document";
    setMediaFile({ url: file_url, type, name: file.name });
    setUploading(false);
    if (e?.target) e.target.value = "";
  }

  async function sendWAMessage() {
    if (!newMessage.trim() && !mediaFile) return;
    if (!selectedConv) { toast.error("Selecione uma conversa primeiro."); return; }
    if (waChannels.length === 0) {
      toast.error("Nenhum canal WhatsApp encontrado. Vá em Canais WhatsApp e conecte.");
      return;
    }
    // Check channel status before sending — prefer canal_id match, then connected, then first
    const activeChannel_ = waChannels.find(c => c.id === selectedConv?.canal_id) || waChannels.find(c => c.status === "conectado") || waChannels[0];
    if (activeChannel_?.status === "desconectado") {
      toast.error("WhatsApp desconectado. Reconecte o canal antes de enviar.");
      setDisconnectedBanner(true);
      return;
    }
    setSending(true);
    const texto = newMessage;
    const mf = mediaFile;
    setNewMessage("");
    setMediaFile(null);
    try {
      await base44.functions.invoke("sendWhatsAppMessage", {
        conversation_id: selectedConv.id,
        mensagem: texto || null,
        media_url: mf?.url || null,
        media_type: mf?.type || "text",
        file_name: mf?.name || null,
      });
      setWaMessages((p) => [...p, {
        id: Date.now().toString(), conversa_id: selectedConv.id, contato_id: selectedConv.contato_id,
        direcao: "outbound", conteudo: texto || mf?.name || "", media_url: mf?.url || null,
        media_type: mf?.type || "text", file_name: mf?.name || null,
        timestamp: new Date().toISOString(), status: "enviado",
      }]);
      setWaConversations((p) => p.map((c) => c.id === selectedConv.id ? { ...c, ultima_mensagem: texto || `[${mf?.type}]`, atualizado_em: new Date().toISOString() } : c));
      // Auto-mark onboarding step
      try {
        const me = await base44.auth.me();
        const list = await base44.entities.OnboardingProgress.filter({ user_id: me.id });
        if (list.length > 0 && !list[0].step_first_message_sent) {
          await base44.entities.OnboardingProgress.update(list[0].id, { step_first_message_sent: true });
        }
      } catch (_) {}
    } catch (err) {
      toast.error("Erro ao enviar: " + err.message);
      setNewMessage(texto);
      setMediaFile(mf);
    }
    setSending(false);
  }

  function sendMockMessage() {
    if (!mockInput.trim()) return;
    const msg = { id: Date.now().toString(), dir: "sent", text: mockInput, time: moment().format("HH:mm") };
    setEmMessages((p) => ({ ...p, [emSelected]: [...(p[emSelected] || []), msg] }));
    setMockInput("");
  }

  function handleChannelSwitch(ch) {
    if (ch === activeChannel) return;
    setTransitioning(true);
    setSearch("");
    setTimeout(() => { setActiveChannel(ch); setTransitioning(false); }, 200);
  }

  // Get CRM contact for current conversation
  function getCRMContact(channel, convId) {
    if (!convId) return null;
    if (channel === "whatsapp") {
      // Try to find by phone number in WA conversation
      const conv = waConversations.find(c => c.id === convId);
      if (!conv) return null;
      return crmContacts[convId] || {
        id: convId, name: conv.contato_nome || conv.contato_telefone,
        email: "", phone: conv.contato_telefone || "", company: "",
        profile_picture_url: conv.profile_picture_url || null,
        tags: [], origin: "WhatsApp", assignedTo: conv.assigned_to || "-",
        totalValue: 0, dealsCount: 0,
        deals: [],
        timeline: [{ type: "whatsapp", text: "Contato via WhatsApp", time: conv.atualizado_em ? moment(conv.atualizado_em).format("DD MMM HH:mm") : "Recente", color: "#25D366" }],
      };
    }
    return crmContacts[convId] || null;
  }

  const totalUnread = (ch) => {
    if (ch === "whatsapp") return waConversations.filter((c) => c.nao_lido).length;
    if (ch === "email") return EMAIL_CONVS.filter((c) => c.nao_lido).length;
    return 0;
  };

  // Merge group conversations into WA list
  const waConvsWithGroups = [
    ...waConversations,
    ...waGroups
      .filter(g => !waConversations.some(c => c.contato_telefone === g.id))
      .map(g => ({
        id: g.id, contato_id: g.id, contato_nome: g.name,
        contato_telefone: g.id, canal_id: '', ultima_mensagem: `Grupo · ${g.size || ''} membros`,
        nao_lido: false, status: 'aberta', isGroup: true, pictureUrl: g.pictureUrl,
      }))
  ];

  // Current data for each channel
  const currentConversations = activeChannel === "whatsapp" ? waConvsWithGroups : EMAIL_CONVS;
  const currentSelectedId = activeChannel === "whatsapp" ? selectedConv?.id : emSelected;
  const currentConv = currentConversations.find((c) => c.id === currentSelectedId);
  const currentMessages = activeChannel === "whatsapp" ? waMessages : (emMessages[emSelected] || []);
  const convName = currentConv ? (currentConv.contato_nome || currentConv.nome || currentConv.name || currentConv.contato_telefone || "?") : "";
  const crmContact = getCRMContact(activeChannel, currentSelectedId);
  const hasWAChannel = waChannels.length > 0;

  function handleConvSelect(conv) {
    if (activeChannel === "whatsapp") selectWAConversation(conv);
    else setEmSelected(conv.id);
  }

  function handleSend() {
    if (activeChannel === "whatsapp") sendWAMessage();
    else sendMockMessage();
  }

  function handleInputChange(val) {
    if (activeChannel === "whatsapp") setNewMessage(val);
    else setMockInput(val);
  }

  const inputValue = activeChannel === "whatsapp" ? newMessage : mockInput;

  if (loading && activeChannel === "whatsapp") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "#0f172a" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "4px solid rgba(255,255,255,0.1)", borderTopColor: "#3b82f6", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: "'SF Pro Display', -apple-system, 'Segoe UI', sans-serif", overflow: "hidden", background: "#f0f2f5" }}>

      {/* Channel tabs top bar */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        {/* Disconnected banner */}
        {disconnectedBanner && activeChannel === "whatsapp" && (
          <div style={{
            background: "#7f1d1d", color: "#fca5a5", padding: "8px 16px",
            fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
          }}>
            <span>⚠️</span>
            <span>Canal WhatsApp desconectado. As mensagens não serão enviadas.</span>
            <a href="/whatsapp-channels" style={{ marginLeft: "auto", color: "#fca5a5", fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}>
              Reconectar →
            </a>
            <button onClick={() => setDisconnectedBanner(false)} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", padding: "0 4px" }}>✕</button>
          </div>
        )}
        <div style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
          background: "#1e293b", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0,
        }}>
          {Object.entries(CHANNELS).map(([key, ch]) => {
            const isActive = activeChannel === key;
            const unread = totalUnread(key);
            const bgColor = ch.headerBg.includes("gradient") ? ch.primary : ch.headerBg;
            const isMock = key !== "whatsapp";
            return (
              <button
                key={key}
                onClick={() => handleChannelSwitch(key)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
                  borderRadius: 8, border: "none", cursor: "pointer",
                  background: isActive ? bgColor : "transparent",
                  color: isActive ? "#fff" : "#94a3b8",
                  fontSize: 13, fontWeight: isActive ? 600 : 500,
                  transition: "all 0.25s ease",
                  opacity: isMock ? 0.45 : (isActive ? 1 : 0.7),
                  transform: isActive ? "scale(1)" : "scale(0.97)",
                  position: "relative",
                }}
              >
                {ch.icon}
                <span>{ch.name}</span>
                {isMock && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 6,
                    background: "rgba(255,255,255,0.1)", color: "#94a3b8", marginLeft: 2,
                  }}>EM BREVE</span>
                )}
                {!isMock && unread > 0 && (
                  <span style={{
                    background: isActive ? "rgba(255,255,255,0.25)" : ch.primary,
                    color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 6px",
                    borderRadius: 10, minWidth: 18, textAlign: "center",
                  }}>{unread}</span>
                )}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowCRM(p => !p)}
            title="Painel CRM"
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
              borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
              background: showCRM ? "rgba(59,130,246,0.15)" : "transparent",
              color: showCRM ? "#60a5fa" : "#64748b",
              transition: "all 0.2s",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></svg>
            CRM
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1, display: "flex", overflow: "hidden",
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? "translateY(4px)" : "translateY(0)",
          transition: "opacity 0.2s ease, transform 0.2s ease",
        }}>
          {/* Conversation list */}
          <ConversationList
            conversations={currentConversations}
            selectedId={currentSelectedId}
            onSelect={handleConvSelect}
            channel={activeChannel}
            config={config}
            search={search}
            onSearchChange={setSearch}
            filterMine={filterMine}
            onFilterMineChange={setFilterMine}
            currentUserEmail={currentUser?.email}
            profilePics={profilePics}
          />

          {/* Chat area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: config.bg, transition: "background 0.4s ease", overflow: "hidden" }}>
            {!currentConv ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${config.primary}18`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <div style={{ color: config.primary }}>{config.icon}</div>
                </div>
                <p style={{ fontWeight: 600, color: "#374151" }}>Selecione uma conversa</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>para começar a responder</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 20px",
                  background: config.headerBg.includes("gradient") ? undefined : config.headerBg,
                  backgroundImage: config.headerBg.includes("gradient") ? config.headerBg : undefined,
                  color: config.headerText, flexShrink: 0,
                  transition: "background 0.4s ease",
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: config.headerText, flexShrink: 0, overflow: "hidden" }}>
                    {(() => {
                      // Use profile_picture_url stored on conversation (no extra API calls)
                      const pic = currentConv?.profile_picture_url || currentConv?.pictureUrl;
                      const isGrp = currentConv?.is_group || currentConv?.isGroup || (currentConv?.contato_telefone || '').includes('@g.us');
                      if (pic) return <img src={pic} alt={convName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display='none'; }} />;
                      if (isGrp) return <svg viewBox="0 0 24 24" fill="white" style={{ width: 20, height: 20 }}><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>;
                      return getInitials(convName);
                    })()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{convName}</div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>
                      {activeChannel === "whatsapp" ? `+${currentConv.contato_telefone || ""}` :
                      activeChannel === "email" ? (currentConv.subject || convName) : ""}
                    </div>
                  </div>
                  {crmContact && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      {crmContact.deals?.filter(d => d.status === "aberto").length > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,0.2)" }}>
                          {crmContact.deals.filter(d => d.status === "aberto").length} aberta{crmContact.deals.filter(d => d.status === "aberto").length > 1 ? "s" : ""}
                        </span>
                      )}
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,0.15)" }}>
                        {crmContact.deals?.length || 0} oport.
                      </span>
                    </div>
                  )}
                </div>

                {/* Messages */}
                <div style={{
                  flex: 1, overflowY: "auto", padding: "12px 0",
                  background: config.chatBg,
                  backgroundImage: config.pattern !== "none" ? config.pattern : undefined,
                  transition: "background 0.4s ease",
                }}>
                  {currentMessages.length === 0 && (
                    <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", padding: 16 }}>Nenhuma mensagem ainda</p>
                  )}
                  {currentMessages.map((msg) => (
                    <ChatBubble
                      key={msg.id}
                      msg={msg}
                      channel={activeChannel}
                      config={config}
                    />
                  ))}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <ChatInput
                  channel={activeChannel}
                  config={config}
                  value={inputValue}
                  onChange={handleInputChange}
                  onSend={handleSend}
                  onFileSelect={handleFileSelect}
                  mediaFile={mediaFile}
                  onClearMedia={() => setMediaFile(null)}
                  uploading={uploading}
                  sending={sending}
                  hasChannel={activeChannel === "whatsapp" ? hasWAChannel : true}
                />
              </>
            )}
          </div>

          {/* CRM Panel */}
          {showCRM && (
            <div style={{ width: 300, background: "#fff", borderLeft: "1px solid #f1f5f9", flexShrink: 0, overflow: "hidden" }}>
              <CRMPanel
                contact={crmContact}
                channel={config}
                onUpdate={(updated) => setCrmContacts(p => ({ ...p, [currentSelectedId]: updated }))}
                onAssign={activeChannel === "whatsapp" ? handleAssignConversation : undefined}
                currentUserEmail={currentUser?.email}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}