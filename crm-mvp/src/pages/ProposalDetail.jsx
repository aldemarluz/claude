import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CheckCircle2, XCircle, Send, FileSignature, Printer } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_COLORS = {
  rascunho: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  enviada: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  aceita: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  recusada: "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

export default function ProposalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState(null);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [contractContent, setContractContent] = useState("");
  const [contractTitle, setContractTitle] = useState("");

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    const [props, contracts] = await Promise.all([
      base44.entities.Proposal.filter({ id }),
      base44.entities.Contract.filter({ proposal_id: id }),
    ]);
    if (props.length > 0) {
      setProposal(props[0]);
      setContractTitle(`Contrato - ${props[0].client_name}`);
      setContractContent(generateContractTemplate(props[0]));
    }
    if (contracts.length > 0) setContract(contracts[0]);
    setLoading(false);
  };

  const generateContractTemplate = (p) => `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATANTE: ${p.client_name}
CONTRATADA: [Nome da Empresa]

OBJETO: ${p.title}

DESCRIÇÃO DOS SERVIÇOS:
${p.description || "[Descrição detalhada dos serviços]"}

VALOR TOTAL: R$ ${Number(p.value || 0).toLocaleString("pt-BR")}

VIGÊNCIA: [Data de início] até [Data de término]

CONDIÇÕES DE PAGAMENTO: [Formas de pagamento]

ASSINATURAS:
________________________          ________________________
Contratante                       Contratada
${p.client_name}`;

  const acceptProposal = async () => {
    const updated = await base44.entities.Proposal.update(id, { status: "aceita", accepted_date: new Date().toISOString() });
    setProposal(updated);
    toast.success("Proposta aceita digitalmente!");
  };

  const rejectProposal = async () => {
    const updated = await base44.entities.Proposal.update(id, { status: "recusada" });
    setProposal(updated);
    toast.success("Proposta marcada como recusada");
  };

  const sendProposal = async () => {
    const updated = await base44.entities.Proposal.update(id, { status: "enviada" });
    setProposal(updated);
    toast.success("Proposta enviada (simulado)");
  };

  const createContract = async () => {
    if (!contractTitle || !contractContent) { toast.error("Preencha todos os campos"); return; }
    const created = await base44.entities.Contract.create({
      proposal_id: id,
      title: contractTitle,
      client_name: proposal.client_name,
      content: contractContent,
      value: proposal.value,
      status: "pendente",
    });
    setContract(created);
    setShowContractDialog(false);
    toast.success("Contrato criado");
  };

  const signContract = async () => {
    const updated = await base44.entities.Contract.update(contract.id, { status: "assinado", signed_date: new Date().toISOString() });
    setContract(updated);
    toast.success("Contrato assinado digitalmente!");
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (!proposal) return <div className="p-8 text-center text-muted-foreground">Proposta não encontrada</div>;

  const total = (proposal.items || []).reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) || proposal.value || 0;

  return (
    <div className="p-6 lg:p-8 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/proposals")}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-xl font-bold">{proposal.title}</h1>
            <p className="text-sm text-muted-foreground">Cliente: {proposal.client_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-sm px-3 py-1 ${STATUS_COLORS[proposal.status] || ""}`}>{proposal.status}</Badge>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5"><Printer className="w-4 h-4" />Imprimir</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document */}
        <div className="lg:col-span-2 space-y-4">
          {/* Proposal Document */}
          <div className="bg-card border border-border rounded-xl p-6 lg:p-8 space-y-6 print:shadow-none">
            <div className="flex items-start justify-between border-b border-border pb-6">
              <div>
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-3">
                  <span className="text-primary-foreground font-bold text-lg">C</span>
                </div>
                <p className="font-bold text-lg">CRMFlow</p>
                <p className="text-sm text-muted-foreground">Proposta Comercial</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Nº da Proposta</p>
                <p className="font-mono text-sm font-semibold">{id.slice(-8).toUpperCase()}</p>
                <p className="text-xs text-muted-foreground mt-1">Emitida em {format(new Date(proposal.created_date || new Date()), "dd/MM/yyyy", { locale: ptBR })}</p>
                {proposal.valid_until && <p className="text-xs text-muted-foreground">Válida até {format(new Date(proposal.valid_until), "dd/MM/yyyy", { locale: ptBR })}</p>}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Para</p>
              <p className="font-semibold text-lg">{proposal.client_name}</p>
            </div>

            {proposal.description && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Descrição</p>
                <p className="text-sm leading-relaxed">{proposal.description}</p>
              </div>
            )}

            {(proposal.items || []).length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Itens</p>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Descrição</th>
                        <th className="text-center p-3 font-medium">Qtd</th>
                        <th className="text-right p-3 font-medium">Unit.</th>
                        <th className="text-right p-3 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proposal.items.map((item, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="p-3">{item.description}</td>
                          <td className="p-3 text-center">{item.quantity}</td>
                          <td className="p-3 text-right">R$ {Number(item.unit_price).toLocaleString("pt-BR")}</td>
                          <td className="p-3 text-right font-medium">R$ {(item.quantity * item.unit_price).toLocaleString("pt-BR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="border-t border-border pt-4 flex justify-between items-center">
              <p className="font-semibold">Valor Total</p>
              <p className="text-2xl font-bold text-emerald-600">R$ {Number(total).toLocaleString("pt-BR")}</p>
            </div>

            {proposal.status === "aceita" && proposal.accepted_date && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-700">Proposta Aceita Digitalmente</p>
                  <p className="text-xs text-emerald-600">{format(new Date(proposal.accepted_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold">Ações</h3>
            {proposal.status === "rascunho" && (
              <Button className="w-full gap-2" onClick={sendProposal}><Send className="w-4 h-4" />Enviar Proposta</Button>
            )}
            {(proposal.status === "enviada" || proposal.status === "rascunho") && (
              <>
                <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={acceptProposal}><CheckCircle2 className="w-4 h-4" />Aceitar Proposta</Button>
                <Button variant="outline" className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={rejectProposal}><XCircle className="w-4 h-4" />Recusar</Button>
              </>
            )}
            {proposal.status === "aceita" && !contract && (
              <Button className="w-full gap-2" onClick={() => setShowContractDialog(true)}><FileSignature className="w-4 h-4" />Gerar Contrato</Button>
            )}
          </div>

          {contract && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold">Contrato</h3>
              <div className="space-y-2">
                <p className="text-sm font-medium">{contract.title}</p>
                <Badge variant="outline" className={contract.status === "assinado" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}>
                  {contract.status}
                </Badge>
                {contract.signed_date && <p className="text-xs text-emerald-600">Assinado em {format(new Date(contract.signed_date), "dd/MM/yyyy", { locale: ptBR })}</p>}
                {contract.status === "pendente" && (
                  <Button className="w-full gap-2 mt-2" onClick={signContract}><FileSignature className="w-4 h-4" />Assinar Contrato</Button>
                )}
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-5 space-y-2 text-sm">
            <p className="font-semibold text-sm">Resumo</p>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="capitalize">{proposal.status}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-semibold text-emerald-600">R$ {Number(total).toLocaleString("pt-BR")}</span></div>
            {proposal.valid_until && <div className="flex justify-between"><span className="text-muted-foreground">Validade</span><span>{format(new Date(proposal.valid_until), "dd/MM/yy", { locale: ptBR })}</span></div>}
          </div>
        </div>
      </div>

      <Dialog open={showContractDialog} onOpenChange={setShowContractDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Gerar Contrato</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Título do Contrato</Label>
              <Input value={contractTitle} onChange={(e) => setContractTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Conteúdo do Contrato</Label>
              <Textarea value={contractContent} onChange={(e) => setContractContent(e.target.value)} rows={15} className="font-mono text-xs" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowContractDialog(false)}>Cancelar</Button>
              <Button onClick={createContract}>Criar Contrato</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}