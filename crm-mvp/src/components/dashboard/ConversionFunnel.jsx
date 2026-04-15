import { STATUS_LIST } from "@/lib/statusConfig";

export default function ConversionFunnel({ leads }) {
  const total = leads.length || 1;

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <h3 className="text-sm font-semibold mb-6">Funil de Conversão</h3>
      <div className="space-y-3">
        {STATUS_LIST.map((status) => {
          const count = leads.filter((l) => l.status === status.key).length;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={status.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{status.label}</span>
                <span className="font-semibold">{count} <span className="text-muted-foreground font-normal">({pct}%)</span></span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}