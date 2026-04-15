import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getWorkspaceId } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QuickResponseManager from "@/components/quickresponses/QuickResponseManager";
import {
  Building2, MessageSquare, Mail, Check, LogOut, CreditCard,
  User, Zap, AlertCircle, CheckCircle2, Clock, ExternalLink,
  Phone, Instagram, Wifi, WifiOff
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const STATUS_BADGE = {
  conectado: { label: "Conectado", class: "text-emerald-600 border-emerald-500/20 bg-emerald-500/10", icon: CheckCircle2 },
  desconectado: { label: "Desconectado", class: "text-amber-600 border-amber-500/20 bg-amber-500/10", icon: WifiOff },
  pending_setup: { label: "Aguardando configuração", class: "text-amber-600 border-amber-500/20 bg-amber-500/10", icon: Clock },
  coming_soon: { label: "Em breve", class: "text-slate-500 border-slate-200 bg-slate-50", icon: AlertCircle },
};

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [waChannels, setWaChannels] = useState([]);

  useEffect(() => {
    async function load() {
      const me = await base44.auth.me();
      setUser(me);
      setCompanyName(me?.company_name || "");

      const [subs, workspaceId] = await Promise.all([
        base44.entities.Subscription.filter({ user_id: me?.id }),
        getWorkspaceId(),
      ]);
      if (subs.length > 0) setSubscription(subs[0]);

      const chs = workspaceId
        ? await base44.entities.WhatsAppChannel.filter({ workspace_id: workspaceId })
        : [];
      setWaChannels(chs);
    }
    load();
  }, []);

  const handleSaveAccount = async () => {
    setSaving(true);
    await base44.auth.updateMe({ company_name: companyName });
    setSaving(false);
    toast.success("Configurações salvas");
    // Auto-mark onboarding step
    try {
      const me = await base44.auth.me();
      const list = await base44.entities.OnboardingProgress.filter({ user_id: me.id });
      if (list.length > 0 && !list[0].step_profile_completed) {
        await base44.entities.OnboardingProgress.update(list[0].id, { step_profile_completed: true });
      }
    } catch (_) {}
  };

  const statusMap = {
    trialing: { label: "Trial ativo", class: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    active: { label: "Ativo", class: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    past_due: { label: "Pagamento pendente", class: "bg-red-500/10 text-red-600 border-red-500/20" },
    cancelled: { label: "Cancelado", class: "bg-slate-100 text-slate-600 border-slate-200" },
    free: { label: "Plano Free", class: "bg-slate-100 text-slate-600 border-slate-200" },
  };

  const trialDaysLeft = subscription?.trial_end_date
    ? Math.max(0, Math.ceil((new Date(subscription.trial_end_date) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="p-6 lg:p-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie sua conta, integrações e plano</p>
      </div>

      <Tabs defaultValue="account">
        <TabsList className="mb-6">
          <TabsTrigger value="account" className="gap-2"><User className="w-4 h-4" />Conta</TabsTrigger>
          <TabsTrigger value="quick-responses" className="gap-2"><Zap className="w-4 h-4" />Respostas Rápidas</TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2"><Zap className="w-4 h-4" />Integrações</TabsTrigger>
          <TabsTrigger value="billing" className="gap-2"><CreditCard className="w-4 h-4" />Plano & Faturamento</TabsTrigger>
        </TabsList>

        {/* ── ABA CONTA ── */}
        <TabsContent value="account" className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-semibold">Dados da Empresa</h2>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome da Empresa</Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Sua empresa"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={user?.email || ""} disabled className="bg-muted/50" />
                <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleSaveAccount} disabled={saving} className="gap-2">
                <Check className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
              </Button>
              <Button variant="outline" onClick={() => base44.auth.logout()} className="gap-2 text-muted-foreground">
                <LogOut className="w-4 h-4" /> Sair
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── ABA RESPOSTAS RÁPIDAS ── */}
        <TabsContent value="quick-responses" className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-6">
            <QuickResponseManager />
          </div>
        </TabsContent>

        {/* ── ABA INTEGRAÇÕES ── */}
        <TabsContent value="integrations" className="space-y-4">
          {/* WhatsApp channels — real status */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30">
              <p className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" /> WhatsApp
              </p>
            </div>
            {waChannels.length === 0 ? (
              <div className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nenhum canal conectado</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Conecte um número para começar a enviar mensagens</p>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => navigate("/whatsapp-channels")}>
                  <ExternalLink className="w-3 h-3" /> Conectar
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {waChannels.map((ch) => {
                  const isConnected = ch.status === "conectado";
                  const cfg = STATUS_BADGE[ch.status] || STATUS_BADGE.pending_setup;
                  const CfgIcon = cfg.icon;
                  return (
                    <div key={ch.id} className="flex items-center gap-4 p-4">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isConnected ? "bg-emerald-100" : "bg-slate-100"}`}>
                        {isConnected ? <Wifi className="w-4 h-4 text-emerald-600" /> : <WifiOff className="w-4 h-4 text-slate-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{ch.nome}</p>
                        <p className="text-xs text-muted-foreground">{ch.phone_number ? `+${ch.phone_number}` : ch.instance_name}</p>
                      </div>
                      <Badge variant="outline" className={`text-xs gap-1 ${cfg.class}`}>
                        <CfgIcon className="w-3 h-3" />
                        {cfg.label}
                      </Badge>
                      {!isConnected && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => navigate("/whatsapp-channels")}>
                          Reconectar
                        </Button>
                      )}
                    </div>
                  );
                })}
                <div className="px-4 py-2.5">
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => navigate("/whatsapp-channels")}>
                    <ExternalLink className="w-3 h-3" /> Gerenciar canais
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Other channels */}
          <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
            {[
              { key: "email", Icon: Mail, color: "text-blue-600", bg: "bg-blue-100", label: "Email", desc: "Envio via Base44 integrations (Resend)", status: "pending_setup" },
              { key: "instagram", Icon: Instagram, color: "text-pink-600", bg: "bg-pink-100", label: "Instagram DM", desc: "Via Meta Graph API", status: "coming_soon" },
              { key: "sms", Icon: Phone, color: "text-violet-600", bg: "bg-violet-100", label: "SMS", desc: "Via Twilio ou Zenvia", status: "coming_soon" },
            ].map(({ key, Icon, color, bg, label, desc, status }) => {
              const cfg = STATUS_BADGE[status];
              const CfgIcon = cfg.icon;
              return (
                <div key={key} className={`flex items-center gap-4 p-4 ${status === "coming_soon" ? "opacity-60" : ""}`}>
                  <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Badge variant="outline" className={`text-xs gap-1 ${cfg.class}`}>
                    <CfgIcon className="w-3 h-3" />
                    {cfg.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ── ABA PLANO & FATURAMENTO ── */}
        <TabsContent value="billing" className="space-y-4">
          {subscription ? (
            <>
              <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{subscription.plan_name || "Plano ativo"}</p>
                      <p className="text-xs text-muted-foreground">Assinatura atual</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={statusMap[subscription.status]?.class}>
                    {statusMap[subscription.status]?.label}
                  </Badge>
                </div>

                {subscription.status === "trialing" && trialDaysLeft !== null && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                    <p className="text-sm text-blue-700 font-medium">
                      ⏳ Trial: {trialDaysLeft} dia{trialDaysLeft !== 1 ? "s" : ""} restante{trialDaysLeft !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">Assine agora para não perder o acesso às funcionalidades.</p>
                  </div>
                )}

                {subscription.status === "past_due" && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <p className="text-sm text-red-700 font-medium">⚠️ Pagamento pendente</p>
                    <p className="text-xs text-red-600 mt-1">Regularize o pagamento para continuar usando o CRMFlow.</p>
                  </div>
                )}

                {subscription.current_period_end && (
                  <div className="text-xs text-muted-foreground">
                    Próxima renovação: {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
                  </div>
                )}
              </div>

              <Button className="gap-2" onClick={() => navigate("/pricing")}>
                <CreditCard className="w-4 h-4" /> Ver planos disponíveis
              </Button>
            </>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CreditCard className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-lg">Você está no plano gratuito</p>
                <p className="text-sm text-muted-foreground mt-1">Assine um plano para desbloquear todos os recursos.</p>
              </div>
              <Button className="gap-2" onClick={() => navigate("/pricing")}>
                Ver planos <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}