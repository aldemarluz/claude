import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Send, MessageSquare, CheckCheck, Check, Clock, AlertTriangle, Paperclip, X } from "lucide-react";
import MediaMessage from "@/components/whatsapp/MediaMessage";
import AudioRecorder from "@/components/whatsapp/AudioRecorder";
import QuickResponseSelector from "@/components/quickresponses/QuickResponseSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import moment from "moment";
import { toast } from "sonner";

// Render the right send-status indicator next to outbound messages.
function MessageStatusIcon({ status }) {
  if (status === "pending") return <Clock className="w-3.5 h-3.5 text-slate-400 animate-pulse" aria-label="Enviando" />;
  if (status === "falhou" || status === "failed") return <AlertTriangle className="w-3.5 h-3.5 text-red-500" aria-label="Falha" />;
  if (status === "lido" || status === "read") return <CheckCheck className="w-3.5 h-3.5 text-blue-400" aria-label="Lido" />;
  if (status === "entregue" || status === "delivered") return <CheckCheck className="w-3.5 h-3.5 text-slate-400" aria-label="Entregue" />;
  if (status === "enviado" || status === "sent") return <Check className="w-3.5 h-3.5 text-slate-400" aria-label="Enviado" />;
  return null;
}

export default function WhatsAppInbox() {
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);
  const selectedConvRef = useRef(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadConversations, 5000);
    // Poll messages every 3s when a conversation is open
    const msgInterval = setInterval(() => {
      if (selectedConvRef.current?.id) {
        refreshMessages(selectedConvRef.current.id);
      }
    }, 3000);
    return () => { clearInterval(interval); clearInterval(msgInterval); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const unsub = base44.entities.WhatsAppConversation.subscribe((event) => {
      if (event.type === "create") {
        setConversations((prev) => [event.data, ...prev]);
      } else if (event.type === "update") {
        setConversations((prev) => prev.map((c) => (c.id === event.id ? { ...c, ...event.data } : c)));
      }
    });
    const unsubMsg = base44.entities.WhatsAppMessage.subscribe((event) => {
      if (event.type === "create" && selectedConvRef.current?.id === event.data?.conversa_id) {
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === event.data.id)) return prev;
          return [...prev, event.data];
        });
      }
    });
    return () => { unsub(); unsubMsg(); };
  }, []);

  async function loadData() {
    setLoading(true);
    await Promise.all([loadConversations(), loadChannels()]);
    setLoading(false);
  }

  async function loadConversations() {
    const convs = await base44.entities.WhatsAppConversation.list("-atualizado_em", 100);
    setConversations(convs);
  }

  async function loadChannels() {
    const chs = await base44.entities.WhatsAppChannel.list();
    setChannels(chs);
    if (chs.length > 0) setSelectedChannel(chs[0]);
  }

  async function refreshMessages(convId) {
    const msgs = await base44.entities.WhatsAppMessage.filter({ conversa_id: convId }, "timestamp", 200);
    setMessages(msgs);
  }

  async function selectConversation(conv) {
    selectedConvRef.current = conv;
    setSelectedConv(conv);
    await refreshMessages(conv.id);
    if (conv.nao_lido) {
      await base44.entities.WhatsAppConversation.update(conv.id, { nao_lido: false });
      setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, nao_lido: false } : c)));
    }
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const type = file.type.startsWith("image/") ? "image"
      : file.type.startsWith("audio/") ? "audio"
      : file.type.startsWith("video/") ? "video"
      : "document";
    setMediaFile({ url: file_url, type, name: file.name });
    setUploading(false);
    e.target.value = "";
  }

  async function sendMessage() {
    if (!newMessage.trim() && !mediaFile) return;
    if (!selectedConv || !selectedChannel) return;
    setSending(true);
    const texto = newMessage;
    const mf = mediaFile;
    setNewMessage("");
    setMediaFile(null);

    // Optimistic placeholder while the server creates the real WhatsAppMessage
    // (with status='pending' → 'enviado' or 'falhou'). When the next refresh
    // pulls the canonical row we'll drop this temp by id.
    const tempId = `tmp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      conversa_id: selectedConv.id,
      contato_id: selectedConv.contato_id,
      direcao: "outbound",
      conteudo: texto || mf?.name || "",
      media_url: mf?.url || null,
      media_type: mf?.type || "text",
      file_name: mf?.name || null,
      timestamp: new Date().toISOString(),
      status: "pending",
      _temp: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConv.id
          ? { ...c, ultima_mensagem: texto || `[${mf?.type}]`, atualizado_em: new Date().toISOString(), last_status: "pending" }
          : c
      )
    );

    try {
      const res = await base44.functions.invoke("sendWhatsAppMessage", {
        conversation_id: selectedConv.id,
        mensagem: texto || null,
        media_url: mf?.url || null,
        media_type: mf?.type || "text",
        file_name: mf?.name || null,
      });
      // Replace the optimistic row with the server's view.
      const serverStatus = res?.data?.status || "enviado";
      const serverId = res?.data?.message_id || null;
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId
          ? { ...m, id: serverId || m.id, status: serverStatus, _temp: false }
          : m))
      );
      // Refresh in the background to pick up provider_message_id + canonical row.
      refreshMessages(selectedConv.id).catch(() => null);
    } catch (err) {
      console.error("sendMessage failed:", err);
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "falhou", error: err?.message } : m));
      toast.error("Erro ao enviar mensagem");
      // Restore inputs so user can retry.
      setNewMessage(texto);
      setMediaFile(mf);
    }
    setSending(false);
  }

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const filteredConvs = conversations.filter((c) =>
    c.contato_nome?.toLowerCase().includes(search.toLowerCase()) ||
    c.contato_telefone?.includes(search)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden bg-white">
      {/* Sidebar */}
      <div className="w-[320px] border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200 space-y-3 bg-[#f0f2f5]">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg text-slate-800">WhatsApp</h2>
            {channels.length > 1 && (
              <Select value={selectedChannel?.id || ""} onValueChange={(v) => setSelectedChannel(channels.find((c) => c.id === v))}>
                <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Canal" /></SelectTrigger>
                <SelectContent>
                  {channels.map((ch) => <SelectItem key={ch.id} value={ch.id}>{ch.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <Input placeholder="Buscar conversa..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-white h-9 text-sm" />
        </div>

        <ScrollArea className="flex-1">
          {filteredConvs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Nenhuma conversa ainda</p>
            </div>
          )}
          {filteredConvs.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv)}
              className={`w-full text-left flex items-center gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedConv?.id === conv.id ? "bg-slate-100" : ""}`}
            >
              <div className="w-11 h-11 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">{getInitials(conv.contato_nome)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm truncate ${conv.nao_lido ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>
                    {conv.contato_nome || conv.contato_telefone}
                  </p>
                  <span className="text-[11px] text-slate-400 shrink-0 ml-1">
                    {conv.atualizado_em ? moment(conv.atualizado_em).format("HH:mm") : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className={`text-xs truncate ${conv.nao_lido ? "text-slate-800 font-medium" : "text-slate-500"}`}>
                    {conv.ultima_mensagem || "Sem mensagens"}
                  </p>
                  {conv.nao_lido && (
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center shrink-0 ml-1 font-bold">1</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-[#efeae2]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d9d9d9' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
        {!selectedConv ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="font-medium text-slate-700">Selecione uma conversa</p>
            <p className="text-sm mt-1 text-slate-400">para começar a responder</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="h-14 bg-[#f0f2f5] border-b border-slate-200 flex items-center px-4 gap-3 shrink-0">
              <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center">
                <span className="text-white font-bold text-xs">{getInitials(selectedConv.contato_nome)}</span>
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800">{selectedConv.contato_nome}</p>
                <p className="text-xs text-slate-500">+{selectedConv.contato_telefone}</p>
              </div>
              <div className="ml-auto">
                <Badge variant="outline" className={`text-xs ${selectedConv.status === "aberta" ? "border-emerald-400 text-emerald-600" : "border-slate-300 text-slate-500"}`}>
                  {selectedConv.status}
                </Badge>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2 max-w-3xl mx-auto">
                {messages.length === 0 && (
                  <p className="text-center text-xs text-slate-400 py-4">Nenhuma mensagem ainda</p>
                )}
                {messages.map((msg) => {
                  const isOut = msg.direcao === "outbound";
                  return (
                    <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-lg px-3 py-2 shadow-sm ${isOut ? "bg-[#d9fdd3] rounded-br-none" : "bg-white rounded-bl-none"}`}>
                        <MediaMessage msg={msg} />
                        <div className={`flex items-center gap-1 mt-1 ${isOut ? "justify-end" : "justify-start"}`}>
                          <span className="text-[10px] text-slate-400">
                            {msg.timestamp ? moment(msg.timestamp).format("HH:mm") : ""}
                          </span>
                          {isOut && <MessageStatusIcon status={msg.status} />}
                          {isOut && (msg.status === "falhou" || msg.status === "failed") && msg.error && (
                            <span className="text-[10px] text-red-500 ml-1" title={msg.error}>falhou</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className="p-3 bg-[#f0f2f5] border-t border-slate-200 shrink-0">
              {!selectedChannel && (
                <p className="text-xs text-red-500 mb-2 text-center">⚠️ Nenhum canal configurado. Vá em <strong>Canais WhatsApp</strong> para adicionar.</p>
              )}
              {mediaFile && (
                <div className="flex items-center gap-2 mb-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                  <span className="text-xs text-slate-600 truncate flex-1">{mediaFile.name}</span>
                  <button onClick={() => setMediaFile(null)} className="text-slate-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileSelect} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedChannel || uploading}
                  className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-500 hover:text-slate-700 shadow-sm shrink-0"
                >
                  {uploading
                    ? <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                    : <Paperclip className="w-5 h-5" />
                  }
                </button>

                {!mediaFile ? (
                  <AudioRecorder
                    disabled={!selectedChannel || sending}
                    onSend={async (mf) => {
                      // Auto-send immediately for audio with optimistic +
                      // server-confirmed status, just like sendMessage.
                      const tempId = `tmp-${Date.now()}`;
                      const optimistic = {
                        id: tempId,
                        conversa_id: selectedConv.id,
                        contato_id: selectedConv.contato_id,
                        direcao: "outbound",
                        conteudo: "",
                        media_url: mf.url,
                        media_type: "audio",
                        media_mime: mf.mime || null,
                        file_name: mf.name,
                        timestamp: new Date().toISOString(),
                        status: "pending",
                        _temp: true,
                      };
                      setMessages((prev) => [...prev, optimistic]);
                      setSending(true);
                      try {
                        const res = await base44.functions.invoke("sendWhatsAppMessage", {
                          conversation_id: selectedConv.id,
                          mensagem: null,
                          media_url: mf.url,
                          media_type: "audio",
                          file_name: mf.name,
                        });
                        const status = res?.data?.status || "enviado";
                        const id = res?.data?.message_id || null;
                        setMessages((prev) =>
                          prev.map((m) => m.id === tempId ? { ...m, id: id || m.id, status, _temp: false } : m)
                        );
                        refreshMessages(selectedConv.id).catch(() => null);
                      } catch (err) {
                        console.error("audio send failed:", err);
                        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "falhou", error: err?.message } : m));
                        toast.error("Erro ao enviar áudio");
                      } finally {
                        setSending(false);
                      }
                    }}
                  />
                ) : null}

                <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    placeholder={mediaFile ? "Legenda (opcional)..." : "Digite uma mensagem..."}
                    className="flex-1 bg-white border-0 shadow-sm h-10 text-sm"
                    disabled={!selectedChannel || sending}
                  />
                  <QuickResponseSelector
                    onSelect={(msg) => setNewMessage(msg)}
                    disabled={!selectedChannel || sending}
                  />
                  <Button
                  onClick={sendMessage}
                  disabled={(!newMessage.trim() && !mediaFile) || !selectedChannel || sending}
                  size="icon"
                  className="h-10 w-10 rounded-full bg-emerald-500 hover:bg-emerald-600 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}