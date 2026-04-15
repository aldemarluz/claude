import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getWorkspaceId } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, FileText, Eye, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function LandingPages() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    body_text: "",
    button_text: "Enviar",
    slug: "",
    is_active: true,
  });

  useEffect(() => {
    async function load() {
      const accountId = await getWorkspaceId();
      const data = accountId
        ? await base44.entities.LandingPage.filter({ account_id: accountId }, "-created_date", 50)
        : [];
      setPages(data);
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    if (!form.title || !form.slug) return;
    const accountId = await getWorkspaceId();
    const page = await base44.entities.LandingPage.create({ ...form, account_id: accountId });
    setPages((prev) => [page, ...prev]);
    setShowAdd(false);
    setForm({ title: "", subtitle: "", body_text: "", button_text: "Enviar", slug: "", is_active: true });
    toast.success("Landing Page criada");
  };

  const deletePage = async (page) => {
    await base44.entities.LandingPage.delete(page.id);
    setPages((prev) => prev.filter((p) => p.id !== page.id));
    toast.success("Página removida");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Landing Pages</h1>
          <p className="text-sm text-muted-foreground mt-1">Crie páginas de captura de leads</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Página
        </Button>
      </div>

      {pages.length === 0 && (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">Nenhuma landing page criada</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pages.map((page) => (
          <div key={page.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">{page.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">/{page.slug}</p>
              </div>
              <Badge variant="outline" className={page.is_active ? "text-emerald-600 border-emerald-500/20 bg-emerald-500/10" : "text-muted-foreground"}>
                {page.is_active ? "Ativa" : "Inativa"}
              </Badge>
            </div>
            {page.subtitle && <p className="text-xs text-muted-foreground">{page.subtitle}</p>}
            <div className="flex gap-2 pt-1">
              <Link to={`/lp/${page.slug}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Visualizar
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => deletePage(page)} className="text-muted-foreground hover:text-destructive gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Landing Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Consultoria Gratuita" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Slug (URL) *</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                placeholder="ex: consultoria-gratuita"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subtítulo</Label>
              <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Subtítulo da página" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Texto</Label>
              <Textarea value={form.body_text} onChange={(e) => setForm({ ...form, body_text: e.target.value })} placeholder="Descrição da oferta..." rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Texto do Botão</Label>
              <Input value={form.button_text} onChange={(e) => setForm({ ...form, button_text: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.title || !form.slug}>Criar Página</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}