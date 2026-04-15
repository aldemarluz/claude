import { base44 } from "@/api/base44Client";
import {
  MessageSquare, Zap, BarChart3, Users, CheckCircle2, ArrowRight,
  Star, Mail, Phone, Shield, Globe, TrendingUp, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  { icon: MessageSquare, color: "text-emerald-600", bg: "bg-emerald-500/10", title: "Inbox Multicanal", desc: "WhatsApp, Email e SMS em um único lugar. Nunca perca uma mensagem." },
  { icon: Users, color: "text-blue-600", bg: "bg-blue-500/10", title: "CRM Inteligente", desc: "Pipeline visual com drag-and-drop. Gerencie seus leads com facilidade." },
  { icon: Zap, color: "text-orange-600", bg: "bg-orange-500/10", title: "Automações", desc: "Envio automático de mensagens baseado em gatilhos do seu funil de vendas." },
  { icon: BarChart3, color: "text-violet-600", bg: "bg-violet-500/10", title: "Relatórios", desc: "Métricas de conversão, tempo de resposta e receita estimada em tempo real." },
  { icon: Globe, color: "text-cyan-600", bg: "bg-cyan-500/10", title: "Landing Pages", desc: "Crie páginas de captura profissionais sem precisar de desenvolvedor." },
  { icon: TrendingUp, color: "text-rose-600", bg: "bg-rose-500/10", title: "Marketing", desc: "Campanhas de email e posts em redes sociais agendados e rastreados." },
];

const TESTIMONIALS = [
  { name: "Ana Souza", role: "Diretora Comercial", company: "TechBR Soluções", text: "Desde que adotamos o CRMFlow, nossa taxa de conversão subiu 40%. O inbox multicanal mudou completamente nossa rotina de atendimento.", avatar: "A" },
  { name: "Carlos Mendes", role: "Fundador", company: "Agência Pulso", text: "Simples, direto e eficiente. Antes usávamos 4 ferramentas diferentes. Agora tudo está no CRMFlow.", avatar: "C" },
  { name: "Fernanda Lima", role: "Gestora de Vendas", company: "Construtora Lima", text: "As automações economizam horas por semana. Configurei em 10 minutos e já está funcionando sozinha.", avatar: "F" },
];

const PLANS = [
  { name: "Free", price: "R$ 0", period: "/mês", desc: "Para começar agora, sem cartão", features: ["100 contatos", "1 usuário", "1 canal de inbox", "Pipeline básico", "Landing pages ilimitadas"], cta: "Começar de graça →", highlighted: false },
  { name: "Growth", price: "R$ 197", period: "/mês", desc: "Para times em expansão", features: ["5.000 contatos", "Usuários ilimitados", "3 canais de inbox", "Automações avançadas", "Landing pages ilimitadas", "Suporte prioritário"], cta: "Experimentar 14 dias grátis", highlighted: true },
  { name: "Pro", price: "R$ 397", period: "/mês", desc: "Para operações completas", features: ["Contatos ilimitados", "Usuários ilimitados", "Canais ilimitados", "API de integração", "Gerente de sucesso dedicado", "SLA 99.9%"], cta: "Falar com vendas", highlighted: false },
];

export default function PublicLanding() {
  const handleStart = () => base44.auth.redirectToLogin();

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="font-bold text-lg">CRMFlow</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">Funcionalidades</a>
            <a href="#testimonials" className="hover:text-slate-900 transition-colors">Depoimentos</a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">Preços</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleStart}>Entrar</Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleStart}>
              Começar grátis <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50 mb-6 px-4 py-1.5">
          🚀 Novo: Automações com IA disponíveis
        </Badge>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight mb-6">
          Seu CRM completo para<br />
          <span className="text-blue-600">micro e pequenas empresas</span>
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Inbox multicanal, pipeline visual, automações e landing pages — tudo integrado. Sem cobrar por usuário. Sem complicação.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 h-12 px-8 text-base gap-2" onClick={handleStart}>
            Começar de graça <ArrowRight className="w-4 h-4" />
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-8 text-base" onClick={handleStart}>
            Ver planos
          </Button>
        </div>
        <p className="text-sm text-slate-400 mt-4">Plano gratuito disponível • Sem cartão de crédito</p>

        {/* App screenshot mockup */}
        <div className="mt-16 rounded-2xl border border-slate-200 overflow-hidden shadow-2xl shadow-slate-200 bg-slate-50">
          <div className="h-8 bg-slate-100 border-b border-slate-200 flex items-center gap-2 px-4">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <div className="flex-1 mx-6 h-5 bg-white border border-slate-200 rounded-md flex items-center px-3">
              <span className="text-xs text-slate-400">app.crmflow.com.br/dashboard</span>
            </div>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {["Pipeline: 12 leads", "Inbox: 3 não lidos", "Conversão: 28%", "Receita: R$ 48k"].map((m, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className={`text-xs font-semibold mb-1 ${["text-blue-600","text-emerald-600","text-violet-600","text-orange-600"][i]}`}>{m.split(":")[0]}</div>
                <div className="text-lg font-bold text-slate-900">{m.split(": ")[1]}</div>
              </div>
            ))}
            <div className="col-span-2 md:col-span-4 bg-white rounded-xl border border-slate-200 p-4">
              <div className="space-y-1.5">
                {["Maria Silva — qualificado", "João Costa — proposta enviada", "Lucas Rocha — fechado 🏆"].map((l, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">{l[0]}</div>
                    <span className="text-slate-600">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ── */}
      <section className="border-y border-slate-100 bg-slate-50 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-sm text-slate-500 mb-4">Usado por mais de <strong>500 empresas brasileiras</strong></p>
          <div className="flex items-center justify-center gap-8 flex-wrap text-slate-300 text-lg font-semibold">
            {["Agência Pulso", "TechBR", "Construtora Lima", "Escola Conecta", "Loja Verde"].map(b => (
              <span key={b} className="text-slate-400">{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold tracking-tight mb-4">Tudo que você precisa em um lugar só</h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">Chega de abrir 5 abas diferentes. O CRMFlow integra CRM, comunicação e marketing.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-50 transition-all">
              <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" className="bg-slate-50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight mb-4">Quem usa, recomenda</h2>
            <div className="flex items-center justify-center gap-1 text-yellow-400 mb-2">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 fill-yellow-400" />)}
            </div>
            <p className="text-slate-500">4.9/5 com base em 200+ avaliações</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <p className="text-slate-600 leading-relaxed italic">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">{t.avatar}</div>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role} · {t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold tracking-tight mb-4">Preço justo, sem surpresas</h2>
          <p className="text-slate-500 text-lg">Cobramos por empresa, não por usuário. Cresceu? O preço não muda.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`rounded-2xl border p-8 flex flex-col gap-6 relative ${plan.highlighted ? "border-blue-600 bg-blue-600 text-white shadow-2xl shadow-blue-200 md:scale-105" : "border-slate-200 bg-white"}`}>
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-orange-400 text-white border-0 shadow-md">⭐ Mais popular</Badge>
                </div>
              )}
              <div>
                <h3 className={`font-bold text-xl mb-1 ${plan.highlighted ? "text-white" : "text-slate-900"}`}>{plan.name}</h3>
                <p className={`text-sm mb-4 ${plan.highlighted ? "text-blue-100" : "text-slate-500"}`}>{plan.desc}</p>
                <div className="flex items-end gap-1">
                  <span className={`text-4xl font-extrabold ${plan.highlighted ? "text-white" : "text-slate-900"}`}>{plan.price}</span>
                  <span className={`text-sm pb-1 ${plan.highlighted ? "text-blue-200" : "text-slate-400"}`}>{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-3 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className={`w-4 h-4 shrink-0 ${plan.highlighted ? "text-blue-200" : "text-emerald-500"}`} />
                    <span className={plan.highlighted ? "text-blue-50" : "text-slate-600"}>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className={`w-full ${plan.highlighted ? "bg-white text-blue-600 hover:bg-blue-50" : plan.name === "Free" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
                onClick={handleStart}
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-blue-600 py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Comece de graça agora mesmo</h2>
          <p className="text-blue-100 text-lg mb-8">Plano gratuito disponível. Sem cartão de crédito, sem prazo de expiração.</p>
          <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 h-12 px-10 text-base font-semibold" onClick={handleStart}>
            Criar conta gratuita <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">C</span>
            </div>
            <span className="font-bold">CRMFlow</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-slate-900 transition-colors flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Privacidade</a>
            <a href="#" className="hover:text-slate-900 transition-colors flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> contato@crmflow.com.br</a>
            <a href="#" className="hover:text-slate-900 transition-colors flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> (11) 3000-0000</a>
          </div>
          <p className="text-xs text-slate-400">© 2026 CRMFlow · ACLUZ Marketing</p>
        </div>
      </footer>
    </div>
  );
}