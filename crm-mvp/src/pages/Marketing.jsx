import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getWorkspaceId } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar, Plus, Trash2, Send, Mail, MessageCircle, Share2, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import moment from "moment";

const PLATFORMS = [
  { key: "instagram", label: "Instagram", color: "bg-pink-500/10 text-pink-600 border-pink-500/20" },
  { key: "facebook", label: "Facebook", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { key: "linkedin", label: "LinkedIn", color: "bg-blue-700/10 text-blue-700 border-blue-700/20" },
  { key: "twitter", label: "Twitter/X", color: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
];

const MOCK_COMMENTS = [
  { id: 1, platform: "instagram", author: "Maria Santos", content: "Adorei o conteúdo! Podem me mandar mais infos?", time: "há 2h", avatar: "M", replied: false },
  { id: 2, platform: "facebook", author: "João Pereira", content: "Preciso de um orçamento para minha empresa.", time: "há 4h", avatar: "J", replied: true },
  { id: 3, platform: "instagram", author: "Ana Lima", content: "Como funciona o serviço de vocês?", time: "há 6h", avatar: "A", replied: false },
  { id: 4, platform: "linkedin", author: "Carlos Fernandes", content: "Seria possível agendar uma demonstração?", time: "ontem", avatar: "C", replied: false },
  { id: 5, platform: "twitter", author: "Bruna Alves", content: "Excelente trabalho! Parabéns à equipe.", time: "ontem", avatar: "B", replied: true },
];

const emptySocialForm = { content: "", platform: "instagram", scheduled_date: "" };
const emptyCampaignForm = { name: "", subject: "", content: "", target_tags: "", target_all: false };

export default function Marketing() {
  const [activeTab, setActiveTab] = useState("social");
  const [posts, setPosts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSocialDialog, setShowSocialDialog] = useState(false);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [socialForm, setSocialForm] = useState(emptySocialForm);
  const [campaignForm, setCampaignForm] = useState(emptyCampaignForm);
  const [comments, setComments] = useState(MOCK_COMMENTS);
  const [replyText, setReplyText] = useState({});

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const accountId = await getWorkspaceId();
    const filter = accountId ? { account_id: accountId } : {};
    const [p, c, cont] = await Promise.all([
      base44.entities.SocialPost.filter(filter, "-created_date", 100),
      base44.entities.EmailCampaign.filter(filter, "-created_date", 100),
      base44.entities.Contact.filter(filter, "-created_date", 500),
    ]);
    setPosts(p);
    setCampaigns(c);
    setContacts(cont);
    setLoading(false);
  };

  const savePost = async () => {
    if (!socialForm.content || !socialForm.scheduled_date) { toast.error("Preencha o conteúdo e a data"); return; }
    const accountId = await getWorkspaceId();
    const created = await base44.entities.SocialPost.create({ ...socialForm, status: "agendado", account_id: accountId });
    setPosts(p => [created, ...p]);
    setSocialForm(emptySocialForm);
    setShowSocialDialog(false);
    toast.success("Post agendado com sucesso!");
  };

  const deletePost = async (id) => {
    await base44.entities.SocialPost.delete(id);
    setPosts(p => p.filter(x => x.id !== id));
    toast.success("Post removido");
  };

  const publishPost = async (post) => {
    const updated = await base44.entities.SocialPost.update(post.id, { status: "publicado" });
    setPosts(p => p.map(x => x.id === post.id ? updated : x));
    toast.success("Post marcado como publicado");
  };

  const sendCampaign = async () => {
    if (!campaignForm.name || !campaignForm.subject || !campaignForm.content) { toast.error("Preencha todos os campos obrigatórios"); return; }
    const accountId = await getWorkspaceId();
    const recipientsCount = campaignForm.target_all ? contacts.length : contacts.filter(c => {
      const tags = campaignForm.target_tags.split(",").map(t => t.trim()).filter(Boolean);
      return tags.length === 0 || (c.tags || []).some(t => tags.includes(t));
    }).length;
    const created = await base44.entities.EmailCampaign.create({
      ...campaignForm,
      status: "enviada",
      sent_at: new Date().toISOString(),
      recipients_count: recipientsCount,
      account_id: accountId,
    });
    setCampaigns(p => [created, ...p]);
    setCampaignForm(emptyCampaignForm);
    setShowCampaignDialog(false);
    toast.success(`Campanha enviada para ${recipientsCount} contato(s) (simulado)`);
  };

  const saveDraft = async () => {
    if (!campaignForm.name) { toast.error("Informe o nome da campanha"); return; }
    const created = await base44.entities.EmailCampaign.create({ ...campaignForm, status: "rascunho" });
    setCampaigns(p => [created, ...p]);
    setCampaignForm(emptyCampaignForm);
    setShowCampaignDialog(false);
    toast.success("Rascunho salvo");
  };

  const replyComment = (id) => {
    if (!replyText[id]?.trim()) return;
    setComments(c => c.map(x => x.id === id ? { ...x, replied: true } : x));
    setReplyText(r => ({ ...r, [id]: "" }));
    toast.success("Resposta enviada (simulado)");
  };

  const getPlatformConfig = (key) => PLATFORMS.find(p => p.key === key) || PLATFORMS[0];

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie posts, campanhas e interações</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-6">
        {[["social", "Social Media", <Share2 className="w-3.5 h-3.5" />], ["email", "Email Marketing", <Mail className="w-3.5 h-3.5" />], ["comments", "Comentários", <MessageCircle className="w-3.5 h-3.5" />]].map(([k, l, icon]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${activeTab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {icon}{l}
          </button>
        ))}
      </div>

      {/* SOCIAL MEDIA TAB */}
      {activeTab === "social" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" className="gap-2" onClick={() => setShowSocialDialog(true)}><Plus className="w-4 h-4" />Agendar Post</Button>
          </div>
          {posts.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhum post agendado ainda</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map(post => {
              const pc = getPlatformConfig(post.platform);
              return (
                <div key={post.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className={`text-xs border ${pc.color}`}>{pc.label}</Badge>
                    <Badge className={`text-xs border ${post.status === "publicado" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>
                      {post.status}
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed line-clamp-3">{post.content}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    {moment(post.scheduled_date).format("DD/MM/YYYY HH:mm")}
                  </div>
                  <div className="flex gap-2 pt-1">
                    {post.status !== "publicado" && (
                      <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs flex-1" onClick={() => publishPost(post)}>
                        <CheckCircle className="w-3.5 h-3.5" />Publicar
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deletePost(post.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EMAIL MARKETING TAB */}
      {activeTab === "email" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" className="gap-2" onClick={() => setShowCampaignDialog(true)}><Plus className="w-4 h-4" />Nova Campanha</Button>
          </div>
          {campaigns.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhuma campanha criada ainda</p>}
          <div className="space-y-3">
            {campaigns.map(campaign => (
              <div key={campaign.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{campaign.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{campaign.subject}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {campaign.recipients_count > 0 && (
                    <span className="text-xs text-muted-foreground">{campaign.recipients_count} destinatários</span>
                  )}
                  <Badge className={`text-xs border ${campaign.status === "enviada" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-slate-500/10 text-slate-600 border-slate-500/20"}`}>
                    {campaign.status}
                  </Badge>
                  {campaign.sent_at && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{moment(campaign.sent_at).format("DD/MM HH:mm")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COMMENTS TAB */}
      {activeTab === "comments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{comments.filter(c => !c.replied).length} comentário(s) sem resposta</p>
          </div>
          <div className="space-y-3">
            {comments.map(comment => {
              const pc = getPlatformConfig(comment.platform);
              return (
                <div key={comment.id} className={`bg-card border rounded-xl p-4 space-y-3 ${!comment.replied ? "border-primary/30" : "border-border"}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                      {comment.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{comment.author}</span>
                        <Badge className={`text-xs border ${pc.color}`}>{pc.label}</Badge>
                        {comment.replied && <Badge className="text-xs border bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Respondido</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{comment.time}</p>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/80">{comment.content}</p>
                  {!comment.replied && (
                    <div className="flex gap-2">
                      <Input
                        value={replyText[comment.id] || ""}
                        onChange={e => setReplyText(r => ({ ...r, [comment.id]: e.target.value }))}
                        placeholder="Escreva uma resposta..."
                        className="flex-1 h-8 text-sm"
                        onKeyDown={e => e.key === "Enter" && replyComment(comment.id)}
                      />
                      <Button size="sm" className="h-8 gap-1.5" onClick={() => replyComment(comment.id)}>
                        <Send className="w-3.5 h-3.5" />Responder
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Social Post Dialog */}
      <Dialog open={showSocialDialog} onOpenChange={setShowSocialDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Agendar Post</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Plataforma</Label>
              <Select value={socialForm.platform} onValueChange={v => setSocialForm(f => ({ ...f, platform: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Conteúdo *</Label>
              <Textarea value={socialForm.content} onChange={e => setSocialForm(f => ({ ...f, content: e.target.value }))} placeholder="Escreva o conteúdo do post..." rows={4} />
              <p className="text-xs text-muted-foreground text-right">{socialForm.content.length} caracteres</p>
            </div>
            <div className="space-y-1.5">
              <Label>Data e Hora *</Label>
              <Input type="datetime-local" value={socialForm.scheduled_date} onChange={e => setSocialForm(f => ({ ...f, scheduled_date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSocialDialog(false)}>Cancelar</Button>
            <Button onClick={savePost} className="gap-2"><Calendar className="w-4 h-4" />Agendar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Campaign Dialog */}
      <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Campanha de Email</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Nome da Campanha *</Label>
              <Input value={campaignForm.name} onChange={e => setCampaignForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Newsletter Abril" />
            </div>
            <div className="space-y-1.5">
              <Label>Assunto *</Label>
              <Input value={campaignForm.subject} onChange={e => setCampaignForm(f => ({ ...f, subject: e.target.value }))} placeholder="Assunto do email..." />
            </div>
            <div className="space-y-1.5">
              <Label>Conteúdo *</Label>
              <Textarea value={campaignForm.content} onChange={e => setCampaignForm(f => ({ ...f, content: e.target.value }))} placeholder="Escreva o corpo do email..." rows={5} />
            </div>
            <div className="space-y-1.5">
              <Label>Filtrar por Tags (separadas por vírgula)</Label>
              <Input value={campaignForm.target_tags} onChange={e => setCampaignForm(f => ({ ...f, target_tags: e.target.value }))} placeholder="Ex: premium, B2B, cliente" disabled={campaignForm.target_all} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={campaignForm.target_all} onChange={e => setCampaignForm(f => ({ ...f, target_all: e.target.checked }))} className="rounded" />
              <span className="text-sm">Enviar para todos os contatos ({contacts.length})</span>
            </label>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={saveDraft}>Salvar Rascunho</Button>
            <Button onClick={sendCampaign} className="gap-2"><Send className="w-4 h-4" />Enviar Campanha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}