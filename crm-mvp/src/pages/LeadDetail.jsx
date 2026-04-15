import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { getWorkspaceId } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Mail, MessageSquare, Phone, Send, Building2, Globe, UserPlus, FileText, ListTodo } from "lucide-react";
import { STATUS_CONFIG, STATUS_LIST, getStatusBadgeClasses } from "@/lib/statusConfig";
import LeadTimeline from "../components/lead/LeadTimeline";
import TaskManager from "../components/lead/TaskManager";
import CustomFieldsPanel from "../components/lead/CustomFieldsPanel";
import { toast } from "sonner";

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messageChannel, setMessageChannel] = useState("whatsapp");
  const [activeTab, setActiveTab] = useState("timeline");

  useEffect(() => {
    async function load() {
      const leads = await base44.entities.Lead.filter({ id });
      if (leads.length > 0) setLead(leads[0]);
      const ints = await base44.entities.Interaction.filter({ lead_id: id }, "-created_date", 50);
      setInteractions(ints);
      setLoading(false);
    }
    load();
  }, [id]);

  const getWsId = async () => {
    return lead?.workspace_id || await getWorkspaceId();
  };

  const saveCustomFields = async (custom_fields) => {
    await base44.entities.Lead.update(id, { custom_fields });
    setLead(prev => ({ ...prev, custom_fields }));
  };

  const handleTaskAdded = async (title, type) => {
    const newInt = await base44.entities.Interaction.create({
      lead_id: id,
      type,
      content: `Tarefa criada: "${title}"`,
    });
    setInteractions(prev => [newInt, ...prev]);
  };

  const addNote = async () => {
    if (!note.trim()) return;
    const wsId = await getWsId();
    const newInt = await base44.entities.Interaction.create({
      lead_id: id,
      type: "note",
      content: note,
      workspace_id: wsId,
    });
    setInteractions((prev) => [newInt, ...prev]);
    setNote("");
    toast.success("Nota adicionada");
  };

  const sendMessage = async () => {
    if (!messageText.trim()) return;
    const newInt = await base44.entities.Interaction.create({
      lead_id: id,
      type: messageChannel,
      content: `[${messageChannel === "whatsapp" ? "WhatsApp" : "Email"}] ${messageText}`,
    });
    setInteractions((prev) => [newInt, ...prev]);

    let convos = await base44.entities.Conversation.filter({ lead_id: id });
    let convo;
    if (convos.length === 0) {
      convo = await base44.entities.Conversation.create({
        lead_id: id,
        lead_name: lead.name,
        channel: messageChannel,
        last_message: messageText,
      });
    } else {
      convo = convos[0];
      await base44.entities.Conversation.update(convo.id, { last_message: messageText });
    }
    await base44.entities.Message.create({
      conversation_id: convo.id,
      lead_id: id,
      direction: "sent",
      content: messageText,
      channel: messageChannel,
    });

    setMessageText("");
    toast.success(`Mensagem enviada via ${messageChannel === "whatsapp" ? "WhatsApp" : "Email"} (simulado)`);
  };

  const saveAsContact = async () => {
    const existing = await base44.entities.Contact.filter({ email: lead.email });
    if (existing.length > 0) {
      toast.info("Contato já existe na base de contatos");
    } else {
      await base44.entities.Contact.create({
        name: lead.name,
        email: lead.email,
        phone: lead.phone || "",
        company_name: lead.company || "",
        tags: lead.tags || [],
        status: "ativo",
        lead_id: id,
        notes: lead.notes || "",
      });
      toast.success("Lead salvo como contato!");
    }
  };

  const updateStatus = async (newStatus) => {
    const oldStatus = lead.status;
    await base44.entities.Lead.update(id, { status: newStatus });
    setLead({ ...lead, status: newStatus });
    const wsId = await getWsId();
    const newInt = await base44.entities.Interaction.create({
      lead_id: id,
      type: "status_change",
      content: `Status: ${STATUS_CONFIG[oldStatus]?.label} → ${STATUS_CONFIG[newStatus]?.label}`,
      from_status: oldStatus,
      to_status: newStatus,
      workspace_id: wsId,
    });
    setInteractions((prev) => [newInt, ...prev]);
    toast.success("Status atualizado");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Lead não encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/pipeline")}>
          Voltar ao Pipeline
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/pipeline")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="text-primary text-lg font-bold">{lead.name?.charAt(0)?.toUpperCase()}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">{lead.name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
              {lead.company && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{lead.company}</span>}
              {lead.origin && <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" />{lead.origin}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={saveAsContact}>
            <UserPlus className="w-4 h-4" />Salvar como Contato
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(`/proposals?lead_name=${encodeURIComponent(lead.name)}&lead_id=${id}`)}>
            <FileText className="w-4 h-4" />Criar Proposta
          </Button>
          <Badge variant="outline" className={getStatusBadgeClasses(lead.status) + " border text-sm px-3 py-1"}>
            {STATUS_CONFIG[lead.status]?.label}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Info + Actions */}
        <div className="space-y-4">
          {/* Contact Info */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-semibold">Informações</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" /> <span>{lead.email}</span>
              </div>
              {lead.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" /> <span>{lead.phone}</span>
                </div>
              )}
              {lead.estimated_value > 0 && (
                <p className="font-semibold text-emerald-600">
                  R$ {lead.estimated_value?.toLocaleString("pt-BR")}
                </p>
              )}
            </div>
            {lead.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {lead.tags.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                ))}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-semibold">Atualizar Status</h3>
            <Select value={lead.status} onValueChange={updateStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_LIST.map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Fields */}
          <CustomFieldsPanel
            customFields={lead.custom_fields || {}}
            onSave={saveCustomFields}
          />

          {/* Send Message */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-semibold">Enviar Mensagem</h3>
            <div className="flex gap-2">
              <Button
                variant={messageChannel === "whatsapp" ? "default" : "outline"}
                size="sm"
                onClick={() => setMessageChannel("whatsapp")}
                className="gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
              </Button>
              <Button
                variant={messageChannel === "email" ? "default" : "outline"}
                size="sm"
                onClick={() => setMessageChannel("email")}
                className="gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" /> Email
              </Button>
            </div>
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Escreva sua mensagem..."
              rows={3}
            />
            <Button onClick={sendMessage} disabled={!messageText.trim()} className="w-full gap-2">
              <Send className="w-4 h-4" /> Enviar
            </Button>
          </div>
        </div>

        {/* Right - Tabs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab navigation */}
          <div className="flex gap-1 border-b border-border">
            {[["timeline", "Histórico"], ["tasks", "Tarefas"], ["note", "Nova Nota"]].map(([k, l]) => (
              <button key={k} onClick={() => setActiveTab(k)}
                className={`flex items-center gap-1.5 px-3 pb-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {k === "tasks" && <ListTodo className="w-3.5 h-3.5" />}{l}
              </button>
            ))}
          </div>

          {activeTab === "note" && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-3">
              <h3 className="text-sm font-semibold">Adicionar Nota</h3>
              <div className="flex gap-2">
                <Input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder="Escreva uma nota..." className="flex-1" />
                <Button onClick={addNote} disabled={!note.trim()}>Adicionar</Button>
              </div>
            </div>
          )}

          {activeTab === "tasks" && (
            <TaskManager leadId={id} onTaskAdded={handleTaskAdded} />
          )}

          {activeTab === "timeline" && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold mb-4">Histórico de Atividades</h3>
              <LeadTimeline interactions={interactions} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}