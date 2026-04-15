import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import moment from "moment";

export default function BillingBanner() {
  const navigate = useNavigate();
  const [sub, setSub] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function load() {
      const me = await base44.auth.me();
      const subs = await base44.entities.Subscription.filter({ user_id: me.id });
      if (subs.length > 0) setSub(subs[0]);
    }
    load();
  }, []);

  if (!sub || dismissed) return null;

  const isPastDue = sub.status === "past_due";
  const isTrialing = sub.status === "trialing";
  const daysLeft = sub.trial_end_date
    ? moment(sub.trial_end_date).diff(moment(), "days")
    : null;

  if (!isPastDue && !isTrialing) return null;

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
      isPastDue
        ? "bg-destructive/10 border-b border-destructive/20 text-destructive"
        : "bg-amber-50 border-b border-amber-200 text-amber-800"
    }`}>
      {isPastDue ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Clock className="w-4 h-4 shrink-0" />}
      <span className="flex-1">
        {isPastDue
          ? "Pagamento pendente. Regularize sua assinatura para continuar usando o CRMFlow."
          : `Período de teste: ${daysLeft !== null ? `${daysLeft} dias restantes` : "em andamento"}. Assine para não perder acesso.`}
      </span>
      <Button
        size="sm"
        variant={isPastDue ? "destructive" : "default"}
        className="h-7 text-xs"
        onClick={() => navigate("/settings/billing")}
      >
        {isPastDue ? "Regularizar" : "Assinar agora"}
      </Button>
      <button onClick={() => setDismissed(true)} className="opacity-60 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}