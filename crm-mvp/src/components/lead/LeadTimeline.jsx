import moment from "moment";
import { MessageSquare, Mail, Phone, ArrowRight, StickyNote, Zap, Check, Bell, RefreshCw, Users } from "lucide-react";

const iconMap = {
  note: StickyNote,
  email: Mail,
  whatsapp: MessageSquare,
  call: Phone,
  status_change: ArrowRight,
  automation: Zap,
  task: Check,
  reminder: Bell,
  follow_up: RefreshCw,
  meeting: Users,
};

const colorMap = {
  note: "bg-amber-500/10 text-amber-600",
  email: "bg-blue-500/10 text-blue-600",
  whatsapp: "bg-emerald-500/10 text-emerald-600",
  call: "bg-violet-500/10 text-violet-600",
  status_change: "bg-cyan-500/10 text-cyan-600",
  automation: "bg-orange-500/10 text-orange-600",
  task: "bg-blue-500/10 text-blue-600",
  reminder: "bg-amber-500/10 text-amber-600",
  follow_up: "bg-rose-500/10 text-rose-600",
  meeting: "bg-emerald-500/10 text-emerald-600",
};

const typeLabels = {
  note: "Nota",
  email: "Email",
  whatsapp: "WhatsApp",
  call: "Ligação",
  status_change: "Mudança de Status",
  automation: "Automação",
  task: "Tarefa criada",
  reminder: "Lembrete",
  follow_up: "Follow-up",
  meeting: "Reunião",
};

export default function LeadTimeline({ interactions, filterType }) {
  const filtered = filterType ? interactions.filter(i => i.type === filterType) : interactions;

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhuma interação registrada
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {filtered.map((item) => {
        const Icon = iconMap[item.type] || StickyNote;
        const colors = colorMap[item.type] || "bg-muted text-muted-foreground";
        return (
          <div key={item.id} className="flex gap-3 group py-2 border-b border-border/40 last:border-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${colors}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{typeLabels[item.type] || item.type}</span>
                  <p className="text-sm mt-0.5 leading-snug">{item.content}</p>
                  {item.from_status && item.to_status && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.from_status} → {item.to_status}</p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                  {moment(item.created_date).fromNow()}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}