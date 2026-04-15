import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import EmailComposer from "../components/inbox/EmailComposer";
import {
  Send, MessageSquare, Mail, Phone, Building2, Tag,
  ExternalLink, FileText, Zap,
  Smile, Paperclip, Clock, AlertCircle, CheckCircle2, Circle,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import moment from "moment";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import AddTagInline from "../components/inbox/AddTagInline";
import { STATUS_CONFIG, STATUS_LIST } from "@/lib/statusConfig";

const CHANNEL_CONFIG = {
  whatsapp: { label: "WhatsApp", color: "text-green-500", icon: "💬", bg: "bg-green-500/10" },
  email:    { label: "Email",    color: "text-blue-500",  icon: "📩", bg: "bg-blue-500/10" },
  sms:      { label: "SMS",      color: "text-violet-500",icon: "📱", bg: "bg-violet-500/10" },
};

const CONV_STATUS = {
  unread:    { label: "Não lido",          color: "bg-blue-500",   icon: Circle },
  waiting:   { label: "Aguardando",        color: "bg-amber-400",  icon: Clock },
  responded: { label: "Respondido",        color: "bg-emerald-500",icon: CheckCircle2 },
  urgent:    { label: "Urgente",           color: "bg-red-500",    icon: AlertCircle },
};

// Derive a human-friendly status from the conversation's real data.
// Previously this was simulated from the index, which changed on any reorder.
const deriveConvStatus = (c) => {
  if (c?.conv_status && CONV_STATUS[c.conv_status]) return c.conv_status;
  if ((c?.unread_count || 0) > 0) return "unread";
  return "responded";
};

const QUICK_TEMPLATES = [
  { label: "Olá, tudo bem?", text: "Olá {{nome}}, tudo bem? Como posso te ajudar hoje?" },
  { label: "Aguardando retorno", text: "Olá {{nome}}, estou aguardando seu retorno sobre nossa proposta. Ficou alguma dúvida?" },
  { label: "Agendamento", text: "Olá {{nome}}, podemos marcar uma chamada rápida para alinhar os detalhes?" },
  { label: "Proposta enviada", text: "Olá {{nome}}, acabei de enviar a proposta por email. Pode verificar?" },
];

export default function Inbox() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [activeChannel, setActiveChannel] = useState("whatsapp");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);
  const bottomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const convos = await base44.entities.Conversation.list("-updated_date", 100);
        if (cancelled) return;
        setConversations(convos || []);
      } catch (err) {
        console.error("Failed to load conversations:", err);
        toast.error("Erro ao carregar as conversas.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectionTokenRef = useRef(0);
  const selectConversation = async (convo) => {
    const token = ++selectionTokenRef.current;
    setSelected(convo);
    setSelectedLead(null);
    setMessages([]);
    setActiveChannel(convo.channel || "whatsapp");
    setEmailSubject("");
    setEmailBody("");
    try {
      const [msgs, leads] = await Promise.all([
        base44.entities.Message.filter({ conversation_id: convo.id }, "created_date", 100),
        convo.lead_id ? base44.entities.Lead.filter({ id: convo.lead_id }) : Promise.resolve([]),
      ]);
      // Drop results if a newer selection happened in the meantime.
      if (selectionTokenRef.current !== token) return;
      setMessages(msgs || []);
      if ((leads || []).length > 0) setSelectedLead(leads[0]);
    } catch (err) {
      console.error("Failed to load conversation:", err);
      if (selectionTokenRef.current === token) {
        toast.error("Erro ao carregar a conversa.");
      }
      return;
    }
    // Mark as read (optimistic).
    setConversations((prev) =>
      prev.map((c) => (c.id === convo.id ? { ...c, conv_status: "responded", unread_count: 0 } : c))
    );
    if ((convo.unread_count || 0) > 0) {
      base44.entities.Conversation.update(convo.id, { unread_count: 0 })
        .catch((err) => console.error("Failed to mark conversation as read:", err));
    }
  };

  const sendEmail = async ({ subject, body, cc, bcc, priority }) => {
    if (!selected) return;
    const content = `Assunto: ${subject}\n${cc ? `CC: ${cc}\n` : ""}${bcc ? `BCC: ${bcc}\n` : ""}Prioridade: ${priority}\n\n${body}`;
    try {
      const msg = await base44.entities.Message.create({
        conversation_id: selected.id,
        lead_id: selected.lead_id,
        direction: "sent",
        content,
        channel: "email",
      });
      setMessages((prev) => [...prev, msg]);
      base44.entities.Conversation.update(selected.id, { last_message: `📩 ${subject}` })
        .catch((err) => console.error("Failed to update conversation:", err));
      setConversations((prev) =>
        prev.map((c) => (c.id === selected.id ? { ...c, last_message: `📩 ${subject}`, updated_date: new Date().toISOString(), conv_status: "responded" } : c))
      );
    } catch (err) {
      console.error("Failed to send email:", err);
      toast.error("Não foi possível enviar o email.");
    }
  };

  const sendMessage = async () => {
    const trimmed = newMessage.trim();
    if (!trimmed || !selected) return;
    const resolved = trimmed.replace(/\{\{nome\}\}/g, selected.lead_name?.split(" ")[0] || "");
    try {
      const msg = await base44.entities.Message.create({
        conversation_id: selected.id,
        lead_id: selected.lead_id,
        direction: "sent",
        content: resolved,
        channel: activeChannel,
      });
      setMessages((prev) => [...prev, msg]);
      setNewMessage("");
      setShowTemplates(false);
      // Best-effort conversation update; if it fails the message was still sent.
      base44.entities.Conversation.update(selected.id, { last_message: resolved })
        .catch((err) => console.error("Failed to update conversation last_message:", err));
      setConversations((prev) =>
        prev.map((c) => (c.id === selected.id ? { ...c, last_message: resolved, updated_date: new Date().toISOString(), conv_status: "responded" } : c))
      );
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error("Não foi possível enviar a mensagem.");
    }
  };

  const moveStatus = async (newStatus) => {
    if (!selectedLead) return;
    await base44.entities.Lead.update(selectedLead.id, { status: newStatus });
    setSelectedLead({ ...selectedLead, status: newStatus });
    toast.success(`Lead movido para ${STATUS_CONFIG[newStatus]?.label}`);
  };

  const addTag = async (tag) => {
    if (!selectedLead || !tag.trim()) return;
    const tags = [...(selectedLead.tags || []), tag.trim()];
    await base44.entities.Lead.update(selectedLead.id, { tags });
    setSelectedLead({ ...selectedLead, tags });
    toast.success("Tag adicionada");
  };

  const counts = {
    unread: conversations.filter((c) => deriveConvStatus(c) === "unread" || (c.unread_count || 0) > 0).length,
    open: conversations.filter((c) => ["waiting", "unread"].includes(deriveConvStatus(c))).length,
    all: conversations.length,
  };

  const filteredConvos = conversations.filter((c) => {
    const status = deriveConvStatus(c);
    const matchSearch = c.lead_name?.toLowerCase().includes(search.toLowerCase());
    const matchChannel = filterChannel === "all" || c.channel === filterChannel;
    const matchStatus = filterStatus === "all" || status === filterStatus;
    const matchTab =
      activeTab === "all" ? true :
      activeTab === "unread" ? (status === "unread" || (c.unread_count || 0) > 0) :
      activeTab === "open" ? (["waiting", "unread"].includes(status)) :
      true;
    return matchSearch && matchChannel && matchStatus && matchTab;
  }).sort((a, b) => {
    if (sortBy === "recent") return new Date(b.updated_date) - new Date(a.updated_date);
    // oldest first (longest without response)
    return new Date(a.updated_date) - new Date(b.updated_date);
  });

  const timeSinceLastMsg = selected
    ? moment(selected.updated_date).fromNow()
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* ===== LEFT: Conversation List ===== */}
      <div className="w-[300px] border-r border-border flex flex-col shrink-0 bg-card">
        {/* Tabs */}
        <div className="flex border-b border-border">
          {[
            { key: "all",    label: "Todos",     count: counts.all },
            { key: "unread", label: "Não lidos", count: counts.unread },
            { key: "open",   label: "Abertos",   count: counts.open },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === tab.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold">Inbox</h2>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-[10px] text-muted-foreground bg-transparent border-0 outline-none cursor-pointer"
              >
                <option value="recent">↓ Recente</option>
                <option value="oldest">↑ Sem resposta</option>
              </select>
            </div>
            <div className="space-y-2">
              <Select value={filterChannel} onValueChange={setFilterChannel}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os canais</SelectItem>
                  <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                  <SelectItem value="email">📩 Email</SelectItem>
                  <SelectItem value="sms">📱 SMS</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {Object.entries(CONV_STATUS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {filteredConvos.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conversa</p>
          )}
          {filteredConvos.map((convo) => {
            const ch = CHANNEL_CONFIG[convo.channel] || CHANNEL_CONFIG.whatsapp;
            const convStatus = deriveConvStatus(convo);
            const cs = CONV_STATUS[convStatus] || CONV_STATUS.responded;
            const isUnread = convStatus === "unread" || (convo.unread_count || 0) > 0;
            const isActive = selected?.id === convo.id;
            return (
              <button
                key={convo.id}
                onClick={() => selectConversation(convo)}
                className={`w-full text-left p-3.5 border-b border-border hover:bg-muted/50 transition-colors ${
                  isActive ? "bg-primary/5 border-l-2 border-l-primary" :
                  isUnread ? "bg-blue-500/5" : ""
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary text-sm font-semibold">{convo.lead_name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${cs.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-sm truncate ${isUnread ? "font-bold" : "font-medium"}`}>{convo.lead_name}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{moment(convo.updated_date).fromNow()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px]">{ch.icon}</span>
                      <p className="text-xs text-muted-foreground truncate flex-1">{convo.last_message || "Sem mensagens"}</p>
                      {convo.unread_count > 0 && (
                        <Badge className="h-4 min-w-4 px-1 text-[9px] bg-primary text-primary-foreground shrink-0">{convo.unread_count}</Badge>
                      )}
                    </div>
                    <div className="mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white ${cs.color}`}>{cs.label}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </ScrollArea>
      </div>

      {/* ===== CENTER: Chat ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <MessageSquare className="w-12 h-12 mx-auto opacity-30" />
              <p className="text-sm">Selecione uma conversa</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header + Quick Actions */}
            <div className="border-b border-border px-4 py-3 shrink-0 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary text-sm font-semibold">{selected.lead_name?.charAt(0)?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{selected.lead_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{CHANNEL_CONFIG[activeChannel]?.icon} {CHANNEL_CONFIG[activeChannel]?.label || "WhatsApp"}</span>
                    <span>•</span>
                    <Clock className="w-3 h-3" />
                    <span>{timeSinceLastMsg}</span>
                  </div>
                  {/* Channel Switcher */}
                  <div className="flex items-center gap-2 mt-2">
                    {[
                      { key: "whatsapp", icon: "💬", label: "WhatsApp", available: true },
                      { key: "email", icon: "📩", label: "Email", available: !!selectedLead?.email },
                      { key: "sms", icon: "📱", label: "SMS", available: !!selectedLead?.phone },
                    ].map((ch) => (
                      <button
                        key={ch.key}
                        disabled={!ch.available}
                        onClick={() => { setActiveChannel(ch.key); setNewMessage(""); setEmailSubject(""); setEmailBody(""); }}
                        title={ch.available ? `Usar ${ch.label}` : `${ch.label} não disponível`}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                          activeChannel === ch.key
                            ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
                            : ch.available
                            ? "bg-card border-border text-foreground hover:border-primary hover:text-primary hover:bg-primary/5"
                            : "bg-muted/30 border-border/30 text-muted-foreground/40 cursor-not-allowed"
                        }`}
                      >
                        <span>{ch.icon}</span> {ch.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={() => setShowSidebar(!showSidebar)}
                >
                  {showSidebar ? "Ocultar info" : "Ver contato"}
                </Button>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {selectedLead && (
                  <Select value={selectedLead.status} onValueChange={moveStatus}>
                    <SelectTrigger className="h-7 text-xs w-auto gap-1 border-dashed">
                      <span>📊</span>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_LIST.map((s) => (
                        <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => { const t = prompt("Nova tag:"); if (t) addTag(t); }}>
                  <Tag className="w-3 h-3" /> Tag
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => navigate(`/proposals?lead_name=${encodeURIComponent(selected.lead_name)}&lead_id=${selected.lead_id}`)}>
                  <FileText className="w-3 h-3" /> Proposta
                </Button>
                {selectedLead && (
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => navigate(`/leads/${selectedLead.id}`)}>
                    <ExternalLink className="w-3 h-3" /> Abrir no CRM
                  </Button>
                )}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3 max-w-2xl mx-auto">
                {messages.length === 0 && (
                  <p className="text-sm text-center text-muted-foreground py-6">Nenhuma mensagem ainda</p>
                )}
                {messages.map((msg) => {
                  const isEmail = msg.channel === "email";
                  const isSent = msg.direction === "sent";
                  // Parse email parts from content
                  let emailSubjectLine = "";
                  let emailBodyText = msg.content;
                  if (isEmail && msg.content.startsWith("Assunto:")) {
                    const lines = msg.content.split("\n");
                    const bodyStart = lines.findIndex((l) => l.trim() === "");
                    emailSubjectLine = lines[0].replace("Assunto: ", "");
                    emailBodyText = lines.slice(bodyStart + 1).join("\n");
                  }
                  return (
                    <div key={msg.id} className={`flex flex-col ${isSent ? "items-end" : "items-start"}`}>
                      {msg.is_automated && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                          <Zap className="w-3 h-3" /> Enviado automaticamente via automação
                        </div>
                      )}
                      {isEmail ? (
                        <div className={`max-w-[80%] rounded-xl border text-sm overflow-hidden ${
                          isSent ? "border-blue-200" : "border-border"
                        }`}>
                          {/* Email header */}
                          <div className={`flex items-center gap-2 px-3 py-2 border-b ${
                            isSent ? "bg-blue-50 border-blue-200" : "bg-muted border-border"
                          }`}>
                            <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-xs truncate">{emailSubjectLine || "(sem assunto)"}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {isSent ? `De: ${currentUser?.full_name || "Você"}` : `De: ${selected.lead_name}`}
                              </p>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">{moment(msg.created_date).format("HH:mm")}</span>
                          </div>
                          {/* Email body */}
                          <div className="px-3 py-2.5 bg-white">
                            <p className="text-sm whitespace-pre-wrap text-foreground">{emailBodyText}</p>
                          </div>
                        </div>
                      ) : (
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          isSent
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted rounded-bl-sm"
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${isSent ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {moment(msg.created_date).format("HH:mm")}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Templates Picker */}
            {showTemplates && (
              <div className="border-t border-border px-4 py-2 bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Respostas rápidas</p>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowTemplates(false)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      onClick={() => { setNewMessage(t.text); setShowTemplates(false); }}
                      className="text-xs bg-card border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className={`border-t-2 p-4 shrink-0 transition-colors ${
              activeChannel === "email" ? "border-blue-400/50 bg-blue-50/40" : "border-primary/30 bg-primary/5"
            }`}>
              {activeChannel === "email" ? (
                <EmailComposer
                  toName={selected.lead_name}
                  toEmail={selectedLead?.email || ""}
                  fromName={currentUser?.full_name || "Você"}
                  fromEmail={currentUser?.email || ""}
                  onSend={sendEmail}
                />
              ) : (
                /* WhatsApp / SMS Mode */
                <div className="flex gap-3 max-w-2xl mx-auto items-end">
                  <div className="flex-1 space-y-1.5">
                    <div className="relative">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                        placeholder={`Mensagem via ${CHANNEL_CONFIG[activeChannel]?.label || "WhatsApp"}... (use {{nome}} para personalizar)`}
                        className="flex-1 border-2 border-primary/40 focus:border-primary bg-white shadow-sm pr-3 h-10 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Templates" onClick={() => setShowTemplates(!showTemplates)}>
                        <Zap className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Emoji">
                        <Smile className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Anexo">
                        <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <span className="text-[10px] text-muted-foreground ml-1">Enter para enviar</span>
                    </div>
                  </div>
                  <Button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    size="icon"
                    className="h-10 w-10 rounded-full shadow-md shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ===== RIGHT: Lead Context Sidebar ===== */}
      {selected && showSidebar && (
        <div className="w-[260px] border-l border-border flex flex-col shrink-0 bg-card overflow-y-auto">
          <div className="p-4 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contato</p>
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary text-xl font-bold">{selected.lead_name?.charAt(0)?.toUpperCase()}</span>
              </div>
              <div>
                <p className="font-semibold text-sm">{selected.lead_name}</p>
                {selectedLead && (
                  <Badge variant="outline" className="text-[10px] mt-1">
                    {STATUS_CONFIG[selectedLead.status]?.label || selectedLead.status}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {selectedLead ? (
            <div className="p-4 space-y-4">
              <div className="space-y-2 text-sm">
                {selectedLead.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate text-xs">{selectedLead.email}</span>
                  </div>
                )}
                {selectedLead.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs">{selectedLead.phone}</span>
                  </div>
                )}
                {selectedLead.company && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs">{selectedLead.company}</span>
                  </div>
                )}
                {selectedLead.origin && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs">{selectedLead.origin}</span>
                  </div>
                )}
                {selectedLead.estimated_value > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-emerald-700 font-semibold">
                      💰 R$ {selectedLead.estimated_value?.toLocaleString("pt-BR")}
                    </p>
                  </div>
                )}
              </div>

              {selectedLead.tags?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedLead.tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px] px-1.5">{t}</Badge>
                    ))}
                    <AddTagInline onAdd={addTag} />
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Pipeline</p>
                <div className={`text-xs px-2.5 py-1.5 rounded-lg font-medium ${
                  STATUS_CONFIG[selectedLead.status]?.color || "bg-muted text-muted-foreground"
                }`}>
                  {STATUS_CONFIG[selectedLead.status]?.label || selectedLead.status}
                </div>
              </div>

              <Button
                className="w-full gap-2 text-xs h-8"
                variant="outline"
                onClick={() => navigate(`/leads/${selectedLead.id}`)}
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir no CRM
              </Button>

              <Button
                className="w-full gap-2 text-xs h-8"
                variant="outline"
                onClick={() => navigate(`/proposals?lead_name=${encodeURIComponent(selectedLead.name)}&lead_id=${selectedLead.id}`)}
              >
                <FileText className="w-3.5 h-3.5" /> Criar Proposta
              </Button>
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-muted-foreground">
              <p>Lead não encontrado no CRM</p>
              <p className="mt-1 text-[11px]">Canal: {CHANNEL_CONFIG[selected.channel]?.label}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}