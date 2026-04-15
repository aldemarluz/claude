import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { getWorkspaceId } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Download, Upload, Mail, MessageSquare, Phone, Building2, Tag, Trash2, Edit, X } from "lucide-react";
import { toast } from "sonner";

const CONTACT_STATUSES = ["ativo", "inativo", "prospect"];
const emptyContact = { name: "", email: "", phone: "", company_name: "", status: "ativo", tags: [], notes: "", whatsapp_id: "", origin: "", last_contact: "" };
const emptyCompany = { name: "", cnpj: "", segment: "", website: "", notes: "" };

export default function Contacts() {
  const [activeTab, setActiveTab] = useState("contacts");
  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showCompanyDialog, setShowCompanyDialog] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [editingCompany, setEditingCompany] = useState(null);
  const [contactForm, setContactForm] = useState(emptyContact);
  const [companyForm, setCompanyForm] = useState(emptyCompany);
  const [tagInput, setTagInput] = useState("");
  const [bulkTag, setBulkTag] = useState("");
  const fileInputRef = useRef();

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const accountId = await getWorkspaceId();
    let [c, comp] = await Promise.all([
      base44.entities.Contact.list("-created_date", 500),
      base44.entities.Company.list("-created_date", 200),
    ]);
    // Filter by workspace_id or account_id if available
    if (accountId) {
      c = c.filter(x => x.workspace_id === accountId || x.account_id === accountId);
      comp = comp.filter(x => x.workspace_id === accountId || x.account_id === accountId);
    }
    setContacts(c);
    setCompanies(comp);
    setLoading(false);
  };

  const filtered = contacts.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    (c.company_name || "").toLowerCase().includes(search.toLowerCase())
  );

  // Contact CRUD
  const openAdd = () => { setEditingContact(null); setContactForm(emptyContact); setTagInput(""); setShowContactDialog(true); };
  const openEdit = (c) => { setEditingContact(c); setContactForm({ ...c }); setTagInput(""); setShowContactDialog(true); };

  const saveContact = async () => {
    if (!contactForm.name || !contactForm.email) { toast.error("Nome e email são obrigatórios"); return; }
    const accountId = await getWorkspaceId();
    if (editingContact) {
      const u = await base44.entities.Contact.update(editingContact.id, contactForm);
      setContacts(p => p.map(c => c.id === editingContact.id ? u : c));
      toast.success("Contato atualizado");
    } else {
      const created = await base44.entities.Contact.create({ ...contactForm, account_id: accountId });
      setContacts(p => [created, ...p]);
      toast.success("Contato criado");
    }
    setShowContactDialog(false);
  };

  const deleteContact = async (id) => {
    await base44.entities.Contact.delete(id);
    setContacts(p => p.filter(c => c.id !== id));
    toast.success("Contato removido");
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    setContactForm(f => ({ ...f, tags: [...(f.tags || []), tagInput.trim()] }));
    setTagInput("");
  };
  const removeTag = (t) => setContactForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }));

  // Bulk actions
  const toggleSelect = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map(c => c.id));

  const bulkSend = (channel) => {
    toast.success(`${channel} enviado para ${selected.length} contato(s) (simulado)`);
  };

  const bulkAddTag = async () => {
    if (!bulkTag.trim() || !selected.length) return;
    for (const id of selected) {
      const c = contacts.find(x => x.id === id);
      if (c) await base44.entities.Contact.update(id, { tags: [...new Set([...(c.tags || []), bulkTag.trim()])] });
    }
    await loadAll();
    setBulkTag("");
    setSelected([]);
    toast.success("Tag adicionada em massa");
  };

  // CSV Export
  const exportCSV = () => {
    const rows = [["Nome", "Email", "Telefone", "Empresa", "Status", "Tags"]];
    contacts.forEach(c => rows.push([c.name, c.email, c.phone || "", c.company_name || "", c.status, (c.tags || []).join(";")]));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "contatos.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // CSV Import
  const importCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const lines = evt.target.result.split("\n").slice(1).filter(l => l.trim());
      let count = 0;
      for (const line of lines) {
        const p = line.split(",").map(x => x.replace(/^"|"$/g, "").trim());
        if (p[0] && p[1]) {
          await base44.entities.Contact.create({ name: p[0], email: p[1], phone: p[2] || "", company_name: p[3] || "", status: p[4] || "ativo", tags: p[5] ? p[5].split(";").filter(Boolean) : [] });
          count++;
        }
      }
      await loadAll();
      toast.success(`${count} contatos importados`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Company CRUD
  const openAddCompany = () => { setEditingCompany(null); setCompanyForm(emptyCompany); setShowCompanyDialog(true); };
  const openEditCompany = (c) => { setEditingCompany(c); setCompanyForm({ ...c }); setShowCompanyDialog(true); };

  const saveCompany = async () => {
    if (!companyForm.name) { toast.error("Nome é obrigatório"); return; }
    const accountId = await getWorkspaceId();
    if (editingCompany) {
      const u = await base44.entities.Company.update(editingCompany.id, companyForm);
      setCompanies(p => p.map(c => c.id === editingCompany.id ? u : c));
      toast.success("Empresa atualizada");
    } else {
      const created = await base44.entities.Company.create({ ...companyForm, account_id: accountId });
      setCompanies(p => [created, ...p]);
      toast.success("Empresa criada");
    }
    setShowCompanyDialog(false);
  };

  const deleteCompany = async (id) => {
    await base44.entities.Company.delete(id);
    setCompanies(p => p.filter(c => c.id !== id));
    toast.success("Empresa removida");
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contatos</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie seus contatos e empresas</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-6">
        {[["contacts", "Contatos", contacts.length], ["companies", "Empresas", companies.length]].map(([k, l, count]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${activeTab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {l}
            <Badge variant="secondary" className="text-xs px-1.5 py-0">{count}</Badge>
          </button>
        ))}
      </div>

      {/* CONTACTS TAB */}
      {activeTab === "contacts" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, email ou empresa..." className="pl-10" />
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV}><Download className="w-4 h-4" />Exportar CSV</Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}><Upload className="w-4 h-4" />Importar CSV</Button>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={importCSV} />
            <Button size="sm" className="gap-2" onClick={openAdd}><Plus className="w-4 h-4" />Novo Contato</Button>
          </div>

          {/* Bulk actions bar */}
          {selected.length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg flex-wrap">
              <span className="text-sm font-semibold text-primary">{selected.length} selecionados</span>
              <div className="h-4 w-px bg-border" />
              <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => bulkSend("WhatsApp")}><MessageSquare className="w-3.5 h-3.5" />WhatsApp em massa</Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => bulkSend("Email")}><Mail className="w-3.5 h-3.5" />Email em massa</Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => bulkSend("SMS")}><Phone className="w-3.5 h-3.5" />SMS em massa</Button>
              <div className="flex items-center gap-1.5 ml-auto">
                <Input value={bulkTag} onChange={e => setBulkTag(e.target.value)} placeholder="Adicionar tag..." className="h-7 text-xs w-32" />
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={bulkAddTag}><Tag className="w-3 h-3" />Aplicar</Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelected([])}><X className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          )}

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="w-10 p-3 text-center">
                    <input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={toggleAll} className="rounded" />
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Nome</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Email</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Telefone</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Origem</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden xl:table-cell">Tags</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="w-20 p-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">Nenhum contato encontrado</td></tr>
                )}
                {filtered.map(contact => (
                  <tr key={contact.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={selected.includes(contact.id)} onChange={() => toggleSelect(contact.id)} className="rounded" />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                          {contact.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="font-medium">{contact.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">{contact.email || "—"}</td>
                    <td className="p-3 text-muted-foreground hidden lg:table-cell">{contact.phone || "—"}</td>
                    <td className="p-3 text-muted-foreground hidden lg:table-cell">
                      {contact.origin ? <Badge variant="outline" className="text-xs">{contact.origin}</Badge> : "—"}
                    </td>
                    <td className="p-3 hidden xl:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(contact.tags || []).slice(0, 2).map(t => <Badge key={t} variant="outline" className="text-xs px-1.5 py-0">{t}</Badge>)}
                        {(contact.tags || []).length > 2 && <Badge variant="outline" className="text-xs px-1.5 py-0">+{contact.tags.length - 2}</Badge>}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge className={`text-xs border ${contact.status === "ativo" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : contact.status === "inativo" ? "bg-rose-500/10 text-rose-600 border-rose-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>
                        {contact.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(contact)}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteContact(contact.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COMPANIES TAB */}
      {activeTab === "companies" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" className="gap-2" onClick={openAddCompany}><Plus className="w-4 h-4" />Nova Empresa</Button>
          </div>
          {companies.length === 0 && <p className="text-muted-foreground text-sm text-center py-10">Nenhuma empresa cadastrada</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map(company => (
              <div key={company.id} className="bg-card border border-border rounded-xl p-5 space-y-3 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{company.name}</p>
                      {company.segment && <p className="text-xs text-muted-foreground">{company.segment}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditCompany(company)}><Edit className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteCompany(company.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                {company.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {company.cnpj}</p>}
                {company.website && <p className="text-xs text-primary truncate">{company.website}</p>}
                <div className="pt-1 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    {contacts.filter(c => c.company_name === company.name).length} contato(s) vinculado(s)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingContact ? "Editar Contato" : "Novo Contato"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Nome *</Label>
                <Input value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Email *</Label>
                <Input type="email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={contactForm.phone || ""} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={contactForm.status} onValueChange={v => setContactForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONTACT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
               <Label>Empresa</Label>
               <Select value={contactForm.company_name || ""} onValueChange={v => setContactForm(f => ({ ...f, company_name: v }))}>
                 <SelectTrigger><SelectValue placeholder="Selecionar empresa" /></SelectTrigger>
                 <SelectContent>
                   <SelectItem value={null}>Sem empresa</SelectItem>
                   {companies.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                 </SelectContent>
               </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
               <Label>Origem</Label>
               <Select value={contactForm.origin || ""} onValueChange={v => setContactForm(f => ({ ...f, origin: v }))}>
                 <SelectTrigger><SelectValue placeholder="Selecionar origem" /></SelectTrigger>
                 <SelectContent>
                   <SelectItem value={null}>Manual</SelectItem>
                   <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                   <SelectItem value="Email">Email</SelectItem>
                   <SelectItem value="Formulário">Formulário</SelectItem>
                   <SelectItem value="Indicação">Indicação</SelectItem>
                 </SelectContent>
               </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
               <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag()} placeholder="Digite e pressione Enter..." />
                  <Button type="button" variant="outline" onClick={addTag}>+</Button>
                </div>
                {(contactForm.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {contactForm.tags.map(t => (
                      <Badge key={t} variant="outline" className="text-xs gap-1 pr-1">
                        {t}<button onClick={() => removeTag(t)} className="ml-0.5 hover:text-destructive"><X className="w-2.5 h-2.5" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notas</Label>
                <Textarea value={contactForm.notes || ""} onChange={e => setContactForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Observações..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactDialog(false)}>Cancelar</Button>
            <Button onClick={saveContact}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Company Dialog */}
      <Dialog open={showCompanyDialog} onOpenChange={setShowCompanyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingCompany ? "Editar Empresa" : "Nova Empresa"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={companyForm.name} onChange={e => setCompanyForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome da empresa" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>CNPJ</Label>
                <Input value={companyForm.cnpj || ""} onChange={e => setCompanyForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" />
              </div>
              <div className="space-y-1.5">
                <Label>Segmento</Label>
                <Input value={companyForm.segment || ""} onChange={e => setCompanyForm(f => ({ ...f, segment: e.target.value }))} placeholder="Tecnologia, Varejo..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input value={companyForm.website || ""} onChange={e => setCompanyForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea value={companyForm.notes || ""} onChange={e => setCompanyForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompanyDialog(false)}>Cancelar</Button>
            <Button onClick={saveCompany}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}