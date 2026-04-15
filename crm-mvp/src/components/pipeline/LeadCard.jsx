import { Badge } from "@/components/ui/badge";
import { Mail, DollarSign, Trophy, XCircle, Archive } from "lucide-react";

const DEAL_STATUS_STYLE = {
  aberto:     "bg-blue-100 text-blue-700 border-blue-200",
  ganho:      "bg-emerald-100 text-emerald-700 border-emerald-200",
  perdido:    "bg-red-100 text-red-700 border-red-200",
  abandonado: "bg-gray-100 text-gray-500 border-gray-200",
};

const CARD_BG = {
  aberto:     "bg-card border-border",
  ganho:      "bg-emerald-50 border-emerald-300",
  perdido:    "bg-red-50 border-red-300",
  abandonado: "bg-gray-50 border-gray-300",
};
const DEAL_STATUS_LABEL = {
  aberto: "Aberto", ganho: "Ganho", perdido: "Perdido", abandonado: "Abandonado",
};

export default function LeadCard({ lead, provided, onClick, onQuickAction }) {
  const ds = lead.deal_status || "aberto";
  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={onClick}
      className={`border rounded-lg p-3.5 mb-2 hover:shadow-md transition-all duration-200 group cursor-pointer active:cursor-grabbing ${CARD_BG[ds]}`}
    >
      <div className="space-y-2.5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-primary text-xs font-semibold">{lead.name?.charAt(0)?.toUpperCase()}</span>
            </div>
            <div>
              <p className="text-sm font-medium group-hover:text-primary transition-colors leading-tight">{lead.name}</p>
              {lead.company && <p className="text-xs text-muted-foreground">{lead.company}</p>}
            </div>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${DEAL_STATUS_STYLE[ds]}`}>
            {DEAL_STATUS_LABEL[ds]}
          </span>
        </div>

        {lead.email && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
            <Mail className="w-3 h-3 shrink-0" /> {lead.email}
          </div>
        )}

        {lead.estimated_value > 0 && (
          <div className="flex items-center gap-1 text-xs font-medium text-emerald-600">
            <DollarSign className="w-3 h-3" />
            R$ {lead.estimated_value?.toLocaleString("pt-BR")}
          </div>
        )}

        {lead.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {lead.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-5">{tag}</Badge>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          {ds !== "ganho" && (
            <button onClick={() => onQuickAction(lead, "ganho")}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
              <Trophy className="w-3 h-3" /> Ganho
            </button>
          )}
          {ds !== "perdido" && (
            <button onClick={() => onQuickAction(lead, "perdido")}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
              <XCircle className="w-3 h-3" /> Perdido
            </button>
          )}
          {ds !== "abandonado" && (
            <button onClick={() => onQuickAction(lead, "abandonado")}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors">
              <Archive className="w-3 h-3" /> Abandonar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}