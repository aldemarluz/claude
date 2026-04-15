import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getWorkspaceId } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Building2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { name: "", cnpj: "", segment: "", email: "", phone: "", website: "", notes: "" };

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const accountId = await getWorkspaceId();
    const filter = accountId ? { account_id: accountId } : {};
    const [co, ct] = await Promise.all([
      base44.entities.Company.filter(filter, "-created_date", 200),
      base44.entities.Contact.filter(filter, "-created_date", 500),
    ]);
    setCompanies(co);
    setContacts(ct);
    setLoading(false);
  };

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowDialog(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, cnpj: c.cnpj || "", segment: c.segment || "", email: c.email || "", phone: c.phone || "", website: c.website || "", notes: c.notes || "" }); setShowDialog(true); };

  const save = async () => {
    if (!form.name) return toast.error("Nome obrigatório");
    const accountId = await getWorkspaceId();
    if (editing) {
      const u = await base44.entities.Company.update(editing.id, form);
      setCompanies((p) => p.map((c) => (c.id === editing.id ? u : c)));
      toast.success("Empresa atualizada");
    } else {
      const c = await base44.entities.Company.create({ ...form, account_id: accountId });
      setCompanies((p) => [c, ...p]);
      toast.success("Empresa criada");
    }
    setShowDialog(false);
  };

  const del = async (id) => {
    await base44.entities.Company.delete(id);
    setCompanies((p) => p.filter((c) => c.id !== id));
    toast.success("Empresa removida");
  };

  const getContactCount = (name) => contacts.filter((c) => c.company_name === name).length;

  const filtered = companies.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.segment?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Empresas</h1>
          <p className="text-sm text-muted-foreground">{companies.length} empresas cadastradas</p>
        </div>
        <Button onClick={openNew} className="gap-1.5"><Plus className="w-4 h-4" />Nova Empresa</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar empresa..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((company) => (
          <div key={company.id} className="bg-card border border-border rounded-xl p-5 space-y-3 hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{company.name}</h3>
                  {company.segment && <p className="text-xs text-muted-foreground">{company.segment}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(company)}>Editar</Button>
                <Button variant="ghost" size="sm" onClick={() => del(company.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
            {company.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {company.cnpj}</p>}
            {company.email && <p className="text-xs text-muted-foreground">{company.email}</p>}
            <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1 border-t border-border">
              <Users className="w-3.5 h-3.5" />
              <span>{getContactCount(company.name)} contatos vinculados</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 py-16 text-center text-muted-foreground">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nenhuma empresa cadastrada</p>
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar Empresa" : "Nova Empresa"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><Label>Nome da Empresa *</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
              <div className="space-y-1"><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" /></div>
              <div className="space-y-1"><Label>Segmento</Label><Input value={form.segment} onChange={(e) => setForm((p) => ({ ...p, segment: e.target.value }))} placeholder="ex: Tecnologia" /></div>
              <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} /></div>
              <div className="col-span-2 space-y-1"><Label>Website</Label><Input value={form.website} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))} placeholder="https://..." /></div>
              <div className="col-span-2 space-y-1"><Label>Notas</Label><Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button onClick={save}>{editing ? "Salvar" : "Criar Empresa"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}