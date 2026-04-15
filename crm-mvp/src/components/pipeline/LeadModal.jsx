import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Trophy, XCircle, Archive, DollarSign, Mail, Phone, Building2, Tag, Clock, MessageSquare, FileText, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_CONFIG, STATUS_LIST } from "@/lib/statusConfig";
import moment from "moment";
import { toast } from "sonner";

const DEAL_STATUS = {
  aberto:      { label: "Aberto",      color: "bg-blue-100 text-blue-700 border-blue-200" },
  ganho:       { label: "Ganho",       color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  perdido:     { label: "Perdido",     color: "bg-red-100 text-red-700 border-red-200" },
  abandonado:  { label: "Abandonado",  color: "bg-gray-100 text-gray-600 border-gray-200" },
};

const INTERACTION_ICONS = {
  note:          { icon: MessageSquare, color: "text-blue-500" },
  email:         { icon: Mail,          color: "text-violet-500" },
  whatsapp:      { icon: MessageSquare, color: "text-green-500" },
  call:          { icon: Phone,         color: "text-amber-500" },
  status_change: { icon: ChevronRight,  color: "text-orange-500" },
  automation:    { icon: FileText,      color: "text-pink-500" },
};

export default function LeadModal({ lead, onClose, onUpdate }) {
  const [interactions, setInteractions] = useState([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [localLead, setLocalLead] = useState(lead);

  useEffect(() => {
    setLocalLead(lead);
    base44.entities.Interaction.filter({ lead_id: lead.id }, "-created_date", 50)
      .then(setInteractions);
  }, [lead]);

  const updateLead = async (patch) => {
    const updated = { ...localLead, ...patch };
    setLocalLead(updated);
    await base44.entities.Lead.update(lead.id, patch);
    onUpdate(updated);
  };

  const setDealStatus = async (deal_status) => {
    await updateLead({ deal_status });
    const labels = { ganho: "Ganho 🏆", perdido: "Perdido", abandonado: "Abandonado" };
    toast.success(`Lead marcado como ${labels[deal_status] || deal_status}`);
    if (deal_status !== "aberto") {
      await base44.entities.Interaction.create({
        lead_id: lead.id,
        type: "status_change",
        content: `Lead marcado como ${DEAL_STATUS[deal_status]?.label}`,
      });
      setInteractions((prev) => [{ id: Date.now(), type: "status_change", content: `Lead marcado como ${DEAL_STATUS[deal_status]?.label}`, created_date: new Date().toISOString() }, ...prev]);
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    const interaction = await base44.entities.Interaction.create({
      lead_id: lead.id,
      type: "note",
      content: note.trim(),
    });
    setInteractions((prev) => [interaction, ...prev]);
    await updateLead({ notes: note.trim() });
    setNote("");
    setSaving(false);
    toast.success("Nota salva");
  };

  const ds = DEAL_STATUS[localLead.deal_status || "aberto"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold">{localLead.name?.charAt(0)?.toUpperCase()}</span>
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">{localLead.name}</h2>
              {localLead.company && <p className="text-xs text-muted-foreground">{localLead.company}</p>}
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${ds.color}`}>{ds.label}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Actions */}
            {localLead.deal_status !== "ganho" && (
              <Button size="sm" onClick={() => setDealStatus("ganho")} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs">
                <Trophy className="w-3.5 h-3.5" /> Ganho
              </Button>
            )}
            {localLead.deal_status !== "perdido" && (
              <Button size="sm" variant="outline" onClick={() => setDealStatus("perdido")} className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 h-8 text-xs">
                <XCircle className="w-3.5 h-3.5" /> Perdido
              </Button>
            )}
            {localLead.deal_status !== "abandonado" && (
              <Button size="sm" variant="outline" onClick={() => setDealStatus("abandonado")} className="gap-1.5 text-muted-foreground h-8 text-xs">
                <Archive className="w-3.5 h-3.5" /> Abandonado
              </Button>
            )}
            {localLead.deal_status !== "aberto" && (
              <Button size="sm" variant="outline" onClick={() => setDealStatus("aberto")} className="gap-1.5 text-blue-600 border-blue-200 h-8 text-xs">
                Reabrir
              </Button>
            )}
            <button onClick={onClose} className="ml-2 p-1.5 rounded-lg hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: Lead data */}
          <div className="w-[320px] shrink-0 border-r border-border p-5 overflow-y-auto space-y-5">
            {/* Pipeline Stage */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fase do Pipeline</p>
              <Select value={localLead.status} onValueChange={(v) => updateLead({ status: v })}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_LIST.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Value */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Valor Estimado</p>
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">
                  {localLead.estimated_value > 0 ? `R$ ${localLead.estimated_value.toLocaleString("pt-BR")}` : "Não definido"}
                </span>
              </div>
            </div>

            {/* Contact */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Contato</p>
              <div className="space-y-2">
                {localLead.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate text-xs">{localLead.email}</span>
                  </div>
                )}
                {localLead.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs">{localLead.phone}</span>
                  </div>
                )}
                {localLead.company && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs">{localLead.company}</span>
                  </div>
                )}
                {localLead.origin && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs">Origem: {localLead.origin}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            {localLead.tags?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {localLead.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Assigned */}
            {localLead.assigned_to && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Responsável</p>
                <p className="text-xs">{localLead.assigned_to}</p>
              </div>
            )}
          </div>

          {/* RIGHT: Timeline + Notes */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Note input */}
            <div className="p-4 border-b border-border shrink-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Adicionar nota</p>
              <div className="flex gap-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Escreva uma nota sobre essa oportunidade..."
                  rows={2}
                  className="flex-1 text-sm border border-border rounded-lg px-3 py-2 outline-none focus:border-primary resize-none bg-background"
                />
                <Button onClick={addNote} disabled={saving || !note.trim()} size="sm" className="h-auto self-end">
                  Salvar
                </Button>
              </div>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Histórico de atividades</p>
              {interactions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhuma atividade ainda</p>
              ) : (
                <div className="space-y-3">
                  {interactions.map((item) => {
                    const cfg = INTERACTION_ICONS[item.type] || INTERACTION_ICONS.note;
                    const Icon = cfg.icon;
                    return (
                      <div key={item.id} className="flex gap-3 group">
                        <div className={`w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 ${cfg.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug">{item.content}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {moment(item.created_date).fromNow()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}