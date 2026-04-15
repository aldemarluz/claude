import { Droppable, Draggable } from "@hello-pangea/dnd";
import LeadCard from "./LeadCard";
import { Badge } from "@/components/ui/badge";

const COLOR_MAP = {
  blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  violet: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  cyan: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  rose: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  orange: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  pink: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  gray: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

const COLOR_BAR = {
  blue: "#3b82f6", amber: "#f59e0b", violet: "#8b5cf6", cyan: "#06b6d4",
  emerald: "#10b981", rose: "#f43f5e", orange: "#f97316", pink: "#ec4899", gray: "#6b7280",
};

export default function PipelineColumn({ status, stageConfig, leads, onCardClick, onQuickAction, totalStages }) {
  const config = stageConfig || { label: status, color: "gray", order: 0 };
  const totalValue = leads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);
  const stageIndex = config.order ?? 0;
  const progressPct = totalStages > 0 ? Math.round(((stageIndex + 1) / totalStages) * 100) : 0;
  const badgeClass = COLOR_MAP[config.color] || COLOR_MAP.gray;
  const barColor = COLOR_BAR[config.color] || COLOR_BAR.gray;

  return (
    <div className="flex flex-col w-[280px] shrink-0 bg-muted/30 rounded-xl">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{config.label}</h3>
            <Badge variant="outline" className={`${badgeClass} text-[10px] border h-5`}>
              {leads.length}
            </Badge>
          </div>
        </div>
        {totalValue > 0 && (
          <p className="text-xs text-muted-foreground">R$ {totalValue.toLocaleString("pt-BR")}</p>
        )}
        <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: barColor, opacity: 0.6 + (progressPct / 250) }} />
        </div>
      </div>

      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-2 min-h-[200px] transition-colors duration-200 ${snapshot.isDraggingOver ? "bg-primary/5" : ""}`}
          >
            {leads.map((lead, index) => (
              <Draggable key={lead.id} draggableId={lead.id} index={index}>
                {(prov) => <LeadCard lead={lead} provided={prov} onClick={() => onCardClick(lead)} onQuickAction={onQuickAction} />}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}