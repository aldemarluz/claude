import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, ArrowRight, MessageSquare, Users, Zap, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const STEPS = [
  { key: "step_profile_completed", icon: User, label: "Configure seu perfil", desc: "Adicione nome e empresa", action: "/settings" },
  { key: "step_first_lead_created", icon: Users, label: "Crie seu primeiro lead", desc: "Adicione um contato no pipeline", action: "/pipeline" },
  { key: "step_channel_connected", icon: MessageSquare, label: "Conecte um canal", desc: "WhatsApp, Instagram ou Email", action: "/settings" },
  { key: "step_first_message_sent", icon: MessageSquare, label: "Envie sua primeira mensagem", desc: "Responda via Inbox", action: "/inbox" },
  { key: "step_automation_created", icon: Zap, label: "Crie uma automação", desc: "Automatize seu follow-up", action: "/automations" },
];

export default function Welcome() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const me = await base44.auth.me();
      setUser(me);
      const list = await base44.entities.OnboardingProgress.filter({ user_id: me.id });
      if (list.length > 0) {
        setProgress(list[0]);
        if (list[0].completed) navigate("/");
      } else {
        const created = await base44.entities.OnboardingProgress.create({ user_id: me.id });
        setProgress(created);
      }
      setLoading(false);
    }
    load();
  }, []);

  const completedCount = progress
    ? STEPS.filter((s) => progress[s.key]).length
    : 0;
  const percent = Math.round((completedCount / STEPS.length) * 100);

  const handleComplete = async () => {
    await base44.entities.OnboardingProgress.update(progress.id, { completed: true });
    toast.success("Onboarding concluído! Bem-vindo ao CRMFlow 🎉");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold text-2xl">C</span>
          </div>
          <h1 className="text-2xl font-bold">Bem-vindo ao CRMFlow{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}!</h1>
          <p className="text-muted-foreground mt-1 text-sm">Complete os passos abaixo para começar em menos de 3 minutos.</p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{completedCount} de {STEPS.length} concluídos</span>
            <span>{percent}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary rounded-full h-2 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-8">
          {STEPS.map((step) => {
            const done = progress?.[step.key];
            return (
              <div
                key={step.key}
                onClick={() => navigate(step.action)}
                className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all hover:shadow-sm ${
                  done ? "bg-emerald-50 border-emerald-200" : "bg-card border-border hover:border-primary/40"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {done ? <CheckCircle2 className="w-5 h-5" /> : <step.icon className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${done ? "text-emerald-700 line-through" : ""}`}>{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
                {!done && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate("/")}>
            Fazer depois
          </Button>
          <Button className="flex-1" onClick={handleComplete} disabled={completedCount === 0}>
            Concluir onboarding
          </Button>
        </div>
      </div>
    </div>
  );
}