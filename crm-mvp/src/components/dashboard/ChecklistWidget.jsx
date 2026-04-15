import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, Circle, ChevronRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const STEPS = [
  { key: "step_profile_completed", label: "Configure seu perfil", action: "/settings" },
  { key: "step_first_lead_created", label: "Crie seu primeiro lead", action: "/pipeline" },
  { key: "step_channel_connected", label: "Conecte um canal de comunicação", action: "/settings" },
  { key: "step_first_message_sent", label: "Envie sua primeira mensagem", action: "/inbox" },
  { key: "step_automation_created", label: "Crie uma automação", action: "/automations" },
];

export default function ChecklistWidget() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function load() {
      const me = await base44.auth.me();
      const list = await base44.entities.OnboardingProgress.filter({ user_id: me.id });
      if (list.length > 0) setProgress(list[0]);
    }
    load();
  }, []);

  if (!progress || progress.completed || dismissed) return null;

  const completedCount = STEPS.filter((s) => progress[s.key]).length;
  const percent = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm">Primeiros passos</h3>
          <p className="text-xs text-muted-foreground">{completedCount} de {STEPS.length} concluídos</p>
        </div>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 mb-4">
        <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <div className="space-y-2">
        {STEPS.map((step) => {
          const done = progress[step.key];
          return (
            <button
              key={step.key}
              onClick={() => navigate(step.action)}
              className="w-full flex items-center gap-3 text-left hover:bg-muted/50 rounded-lg px-2 py-1.5 transition-colors"
            >
              {done
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
              <span className={`text-sm flex-1 ${done ? "line-through text-muted-foreground" : ""}`}>{step.label}</span>
              {!done && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}