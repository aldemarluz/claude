import { cn } from "@/lib/utils";

export default function MetricCard({ title, value, change, icon: Icon, color = "primary" }) {
  const isPositive = change && change > 0;

  return (
    <div className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {change !== undefined && (
            <p className={cn("text-xs font-medium", isPositive ? "text-emerald-600" : "text-rose-500")}>
              {isPositive ? "+" : ""}{change}% vs mês anterior
            </p>
          )}
        </div>
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center bg-primary/10")}>
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </div>
  );
}