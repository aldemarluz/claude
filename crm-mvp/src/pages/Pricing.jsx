import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

export default function Pricing() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Plan.filter({ is_active: true }).then((data) => {
      setPlans(data);
      setLoading(false);
    });
  }, []);

  const HIGHLIGHT = "Growth";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 lg:p-12">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold tracking-tight">Planos simples e transparentes</h1>
          <p className="text-muted-foreground mt-2">Sem cobrança por usuário. Cancele quando quiser.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const isHighlight = plan.name === HIGHLIGHT;
            return (
              <div
                key={plan.id}
                className={`rounded-2xl border p-6 flex flex-col gap-4 relative ${
                  isHighlight
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-border bg-card"
                }`}
              >
                {isHighlight && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3">
                    <Zap className="w-3 h-3 mr-1" /> Mais popular
                  </Badge>
                )}
                <div>
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                </div>
                <div>
                  {plan.price_monthly === 0 ? (
                    <span className="text-3xl font-bold">Grátis</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold">R$ {plan.price_monthly}</span>
                      <span className="text-muted-foreground text-sm">/mês</span>
                    </>
                  )}
                </div>
                <ul className="space-y-2 flex-1">
                  {(plan.features || []).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full ${isHighlight ? "" : "variant-outline"}`}
                  variant={isHighlight ? "default" : "outline"}
                  onClick={() => navigate("/settings/billing")}
                >
                  {plan.price_monthly === 0 ? "Começar grátis" : "Assinar agora"}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Pagamento via PIX ou cartão de crédito · Processado pelo Pagar.me
        </p>
      </div>
    </div>
  );
}