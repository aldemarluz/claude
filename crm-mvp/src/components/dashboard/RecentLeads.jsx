import { Link } from "react-router-dom";
import { STATUS_CONFIG } from "@/lib/statusConfig";
import { getStatusBadgeClasses } from "@/lib/statusConfig";
import { Badge } from "@/components/ui/badge";
import moment from "moment";

export default function RecentLeads({ leads }) {
  const recent = [...leads].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 6);

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold">Leads Recentes</h3>
        <Link to="/pipeline" className="text-xs text-primary hover:underline font-medium">
          Ver todos
        </Link>
      </div>
      <div className="space-y-3">
        {recent.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum lead encontrado</p>
        )}
        {recent.map((lead) => (
          <Link
            key={lead.id}
            to={`/leads/${lead.id}`}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-primary text-sm font-semibold">
                  {lead.name?.charAt(0)?.toUpperCase() || "?"}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium group-hover:text-primary transition-colors">{lead.name}</p>
                <p className="text-xs text-muted-foreground">{lead.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={getStatusBadgeClasses(lead.status) + " text-xs border"}>
                {STATUS_CONFIG[lead.status]?.label || lead.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {moment(lead.created_date).fromNow()}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}