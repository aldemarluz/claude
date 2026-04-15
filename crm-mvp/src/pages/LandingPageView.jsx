import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function LandingPageView() {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  const urlParams = new URLSearchParams(window.location.search);
  const slug = window.location.pathname.split("/lp/")[1];

  useEffect(() => {
    async function load() {
      const pages = await base44.entities.LandingPage.filter({ slug });
      if (pages.length > 0) setPage(pages[0]);
      setLoading(false);
    }
    if (slug) load();
    else setLoading(false);
  }, [slug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) return;

    await base44.entities.Lead.create({
      name: form.name,
      email: form.email,
      phone: form.phone,
      status: "novo",
      origin: `Landing Page: ${page?.title || slug}`,
      tags: ["landing-page"],
    });

    setSubmitted(true);
    toast.success("Dados enviados com sucesso!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        Página não encontrada
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-card rounded-2xl shadow-2xl p-8 space-y-6 border border-border/50">
          {submitted ? (
            <div className="text-center py-8 space-y-3">
              <CheckCircle className="w-16 h-16 mx-auto text-emerald-500" />
              <h2 className="text-2xl font-bold">Obrigado!</h2>
              <p className="text-muted-foreground">Seus dados foram recebidos. Entraremos em contato em breve.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 text-center">
                <h1 className="text-2xl font-bold tracking-tight">{page.title}</h1>
                {page.subtitle && <p className="text-primary font-medium">{page.subtitle}</p>}
                {page.body_text && <p className="text-sm text-muted-foreground">{page.body_text}</p>}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Seu nome completo"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="seu@email.com"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <Button type="submit" className="w-full h-11 text-base font-semibold">
                  {page.button_text || "Enviar"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}