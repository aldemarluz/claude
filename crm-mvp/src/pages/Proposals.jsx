import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getWorkspaceId } from "@/lib/workspace";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { generateProposalPDF, generateContractPDF } from "@/components/proposals/ProposalPDF";
import SignatureDialog from "@/components/proposals/SignatureDialog";

const C = {
  bg: "#F5F6FA",
  card: "#FFFFFF",
  cardHover: "#F8FAFC",
  border: "#E2E8F0",
  text: "#0F172A",
  textMuted: "#64748B",
  textDim: "#94A3B8",
  primary: "#3B82F6",
  green: "#10B981",
  greenBg: "#ECFDF5",
  orange: "#F59E0B",
  orangeBg: "#FFFBEB",
  red: "#EF4444",
  redBg: "#FEF2F2",
  purple: "#8B5CF6",
  purpleBg: "#F5F3FF",
  blueBg: "#EFF6FF",
};

const STATUS = {
  rascunho: { label: "Rascunho", color: "#64748B", bg: "#F1F5F9" },
  enviada: { label: "Enviada", color: "#3B82F6", bg: "#EFF6FF" },
  aceita: { label: "Aceita", color: "#10B981", bg: "#ECFDF5" },
  recusada: { label: "Recusada", color: "#EF4444", bg: "#FEF2F2" },
};

const CONTRACT_STATUS = {
  pendente: { label: "Pendente", color: "#F59E0B", bg: "#FFFBEB" },
  assinado: { label: "Assinado", color: "#10B981", bg: "#ECFDF5" },
};

const EMPTY_PROPOSAL = { title: "", client_name: "", value: "", description: "", items: [], valid_until: "", status: "rascunho" };
const EMPTY_CONTRACT = { title: "", client_name: "", proposal_id: "", content: "", status: "pendente", value: "" };

function StatusBadge({ status, isContract }) {
  const map = isContract ? CONTRACT_STATUS : STATUS;
  const s = map[status] || map.rascunho;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 20,
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
      {s.label}
    </span>
  );
}

function StatusFlow({ status }) {
  const steps = ["rascunho", "enviada", "aceita"];
  const current = steps.indexOf(status);
  const rejected = status === "recusada";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {steps.map((s, i) => {
        const active = i <= current && !rejected;
        const isCurrent = s === status;
        const st = STATUS[s];
        return (
          <div key={s} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: isCurrent ? 28 : 22, height: isCurrent ? 28 : 22,
                borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: active ? st.color : "#E2E8F0",
                border: isCurrent ? `3px solid ${st.color}30` : "none",
                transition: "all 0.3s",
              }}>
                {active && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
              </div>
              <span style={{ fontSize: 9, color: isCurrent ? st.color : C.textDim, fontWeight: isCurrent ? 600 : 400 }}>
                {STATUS[s].label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width: 32, height: 2, marginBottom: 18,
                background: i < current && !rejected ? STATUS[steps[i + 1]].color : "#E2E8F0",
              }} />
            )}
          </div>
        );
      })}
      {rejected && (
        <>
          <div style={{ width: 32, height: 2, background: C.red, marginBottom: 18 }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.red, display: "flex", alignItems: "center", justifyContent: "center", border: `3px solid ${C.red}30` }}>
              <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>×</span>
            </div>
            <span style={{ fontSize: 9, color: C.red, fontWeight: 600 }}>Recusada</span>
          </div>
        </>
      )}
    </div>
  );
}

function ProposalCard({ p, onClick, onUpdateStatus, onDelete, onGenerateContract, companyName }) {
  const [hover, setHover] = useState(false);
  const total = (p.items || []).reduce((s, i) => s + (i.value || i.v || 0), 0) || p.value || 0;

  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={() => onClick(p)}
      style={{
        background: C.card, border: `1px solid ${hover ? C.primary + "40" : C.border}`,
        borderRadius: 14, padding: "18px 20px", cursor: "pointer",
        transition: "all 0.2s", boxShadow: hover ? "0 2px 12px rgba(0,0,0,0.06)" : "0 1px 3px rgba(0,0,0,0.03)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{p.title}</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
            {p.client_name} · {p.created_date ? format(new Date(p.created_date), "dd/MM/yyyy") : ""}
          </div>
        </div>
        <div style={{ textAlign: "right", marginLeft: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>R$ {total.toLocaleString("pt-BR")}</div>
          <div style={{ marginTop: 4 }}><StatusBadge status={p.status} /></div>
        </div>
      </div>

      {(p.items || []).length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {(p.items || []).map((item, i) => (
            <span key={i} style={{
              fontSize: 10, padding: "3px 8px", borderRadius: 6,
              background: "#F1F5F9", color: C.textMuted, border: "1px solid #E2E8F0",
            }}>{item.description || item.d} · R${(item.value || item.v || 0).toLocaleString("pt-BR")}</span>
          ))}
        </div>
      )}

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingTop: 12, borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ display: "flex", gap: 12 }}>
          {p.accepted_at && <span style={{ fontSize: 11, color: C.green }}>✓ Aceita em {format(new Date(p.accepted_at), "dd/MM HH:mm")}</span>}
        </div>
        <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
          {p.status === "rascunho" && (
            <button onClick={() => onUpdateStatus(p.id, "enviada")} style={{
              padding: "5px 12px", borderRadius: 8, border: "none",
              background: C.primary, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>Enviar</button>
          )}
          {p.status === "enviada" && (
            <>
              <button onClick={() => onUpdateStatus(p.id, "aceita")} style={{
                padding: "5px 12px", borderRadius: 8, border: "none",
                background: C.green, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}>✓ Aceitar</button>
              <button onClick={() => onUpdateStatus(p.id, "recusada")} style={{
                padding: "5px 12px", borderRadius: 8, border: "none",
                background: C.redBg, color: C.red, fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}>✗ Recusar</button>
            </>
          )}
          {p.status === "aceita" && (
            <button onClick={() => onGenerateContract(p)} style={{
              padding: "5px 12px", borderRadius: 8, border: "none",
              background: C.primary, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>📄 Gerar Contrato</button>
          )}
          <button onClick={() => generateProposalPDF(p, companyName)} style={{
            padding: "5px 10px", borderRadius: 8, border: `1px solid ${C.border}`,
            background: "transparent", color: C.textMuted, fontSize: 11, cursor: "pointer",
          }}>📄 PDF</button>
          <button onClick={() => onDelete(p.id)} style={{
            padding: "5px 10px", borderRadius: 8, border: `1px solid ${C.border}`,
            background: "transparent", color: C.textMuted, fontSize: 11, cursor: "pointer",
          }}>🗑</button>
        </div>
      </div>
    </div>
  );
}

function ContractCard({ c, onSign, companyName }) {
  const total = c.value || 0;
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: "18px 20px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{c.title}</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
            {c.client_name} · {c.created_date ? format(new Date(c.created_date), "dd/MM/yyyy") : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.green, marginBottom: 4 }}>R$ {total.toLocaleString("pt-BR")}</div>
          <StatusBadge status={c.status} isContract />
        </div>
      </div>
      {c.status === "assinado" && c.signed_at && (
        <div style={{ marginTop: 10, fontSize: 11, color: C.green }}>
          ✓ Assinado em {format(new Date(c.signed_at), "dd/MM/yyyy HH:mm")}
        </div>
      )}
      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={() => generateContractPDF(c, companyName)} style={{
          padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.border}`,
          background: "transparent", color: C.textMuted, fontSize: 12, fontWeight: 500, cursor: "pointer",
        }}>📄 PDF</button>
        {c.status === "pendente" && (
          <button onClick={() => onSign(c.id)} style={{
            padding: "6px 16px", borderRadius: 8, border: "none",
            background: C.primary, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>✍️ Assinar Digitalmente</button>
        )}
      </div>
    </div>
  );
}

function DetailPanel({ p, onClose, onUpdateStatus, onGenerateContract, companyName }) {
  if (!p) return null;
  const total = (p.items || []).reduce((s, i) => s + (i.value || i.v || 0), 0) || p.value || 0;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
      display: "flex", justifyContent: "flex-end", zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        width: 480, height: "100%", background: C.card,
        borderLeft: `1px solid ${C.border}`, overflow: "auto",
        boxShadow: "-8px 0 30px rgba(0,0,0,0.08)",
      }} onClick={e => e.stopPropagation()}>

        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <StatusBadge status={p.status} />
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginTop: 8 }}>{p.title}</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>Para: {p.client_name}</div>
            </div>
            <button onClick={onClose} style={{
              background: "#F1F5F9", border: "none", borderRadius: 8,
              width: 32, height: 32, cursor: "pointer", color: C.textMuted, fontSize: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>×</button>
          </div>
        </div>

        <div style={{ padding: "20px 24px 8px", display: "flex", justifyContent: "center" }}>
          <StatusFlow status={p.status} />
        </div>

        <div style={{
          margin: "16px 24px", padding: 20, borderRadius: 14,
          background: C.greenBg, border: `1px solid ${C.green}20`,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>VALOR TOTAL</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: C.green }}>R$ {total.toLocaleString("pt-BR")}</div>
        </div>

        {(p.items || []).length > 0 && (
          <div style={{ padding: "0 24px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Itens</div>
            {(p.items || []).map((item, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: 8,
                background: i % 2 === 0 ? "#F8FAFC" : "transparent",
              }}>
                <span style={{ fontSize: 13, color: C.text }}>{item.description || item.d}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>R$ {(item.value || item.v || 0).toLocaleString("pt-BR")}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>R$ {total.toLocaleString("pt-BR")}</span>
            </div>
          </div>
        )}

        {p.description && (
          <div style={{ padding: "0 24px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Descrição</div>
            <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>{p.description}</p>
          </div>
        )}

        <div style={{ padding: "12px 24px 24px", display: "grid", gap: 8 }}>
          {p.status === "rascunho" && (
            <button onClick={() => { onUpdateStatus(p.id, "enviada"); onClose(); }} style={{
              padding: "12px", borderRadius: 10, border: "none",
              background: C.primary, color: "#fff", fontSize: 13, fontWeight: 600,
              cursor: "pointer",
            }}>Marcar como Enviada</button>
          )}
          {p.status === "enviada" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => { onUpdateStatus(p.id, "aceita"); onClose(); }} style={{
                padding: "10px", borderRadius: 10, border: "none",
                background: C.green, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>✓ Aceitar</button>
              <button onClick={() => { onUpdateStatus(p.id, "recusada"); onClose(); }} style={{
                padding: "10px", borderRadius: 10, border: "none",
                background: C.redBg, color: C.red, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>✗ Recusar</button>
            </div>
          )}
          {p.status === "aceita" && (
            <button onClick={() => { onGenerateContract(p); onClose(); }} style={{
              padding: "12px", borderRadius: 10, border: "none",
              background: C.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>📄 Gerar Contrato</button>
          )}
          {p.accepted_at && (
            <div style={{ textAlign: "center", fontSize: 11, color: C.green }}>
              ✓ Aceita em {format(new Date(p.accepted_at), "dd/MM/yyyy HH:mm")}
            </div>
          )}
          <button onClick={() => generateProposalPDF(p, companyName)} style={{
            padding: "10px", borderRadius: 10, border: `1px solid ${C.border}`,
            background: "transparent", color: C.textMuted, fontSize: 13, fontWeight: 500,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>📄 Baixar PDF da Proposta</button>
        </div>
      </div>
    </div>
  );
}

export default function Proposals() {
  const urlParams = new URLSearchParams(window.location.search);
  const prefillName = urlParams.get("lead_name") || "";
  const prefillLeadId = urlParams.get("lead_id") || "";

  const [proposals, setProposals] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("proposals");
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState(null);
  const [companyName, setCompanyName] = useState("Minha Empresa");

  const [showProposalDialog, setShowProposalDialog] = useState(!!prefillName);
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signingContractId, setSigningContractId] = useState(null);
  const [signingContractTitle, setSigningContractTitle] = useState("");
  const [form, setForm] = useState(prefillName ? { ...EMPTY_PROPOSAL, client_name: prefillName, lead_id: prefillLeadId } : EMPTY_PROPOSAL);
  const [contractForm, setContractForm] = useState(EMPTY_CONTRACT);
  const [itemText, setItemText] = useState("");
  const [itemValue, setItemValue] = useState("");

  useEffect(() => {
    load();
    base44.auth.me().then(u => { if (u?.company_name) setCompanyName(u.company_name); }).catch(() => {});
  }, []);

  const load = async () => {
    const accountId = await getWorkspaceId();
    const f = accountId ? { workspace_id: accountId } : {};
    const [p, c] = await Promise.all([
      base44.entities.Proposal.filter(f, "-created_date", 200),
      base44.entities.Contract.filter(f, "-created_date", 200),
    ]);
    setProposals(p);
    setContracts(c);
    setLoading(false);
  };

  const saveProposal = async () => {
    if (!form.title || !form.client_name) return toast.error("Título e cliente obrigatórios");
    const accountId = await getWorkspaceId();
    const p = await base44.entities.Proposal.create({ ...form, value: parseFloat(form.value) || 0, workspace_id: accountId });
    setProposals(prev => [p, ...prev]);
    setShowProposalDialog(false);
    setForm(EMPTY_PROPOSAL);
    toast.success("Proposta criada");
  };

  const addItem = () => {
    if (!itemText.trim()) return;
    setForm(p => ({ ...p, items: [...p.items, { description: itemText, value: parseFloat(itemValue) || 0 }] }));
    setItemText(""); setItemValue("");
  };

  const removeItem = (i) => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));

  const updateStatus = async (id, status) => {
    if (!id) return toast.error("Proposta inválida");
    const data = { status };
    if (status === "aceita") data.accepted_at = new Date().toISOString();
    await base44.entities.Proposal.update(id, data);
    setProposals(p => p.map(x => x.id === id ? { ...x, ...data } : x));
    if (detail?.id === id) setDetail(p => ({ ...p, ...data }));
    toast.success(`Proposta marcada como ${STATUS[status]?.label}`);
  };

  const deleteProposal = async (id) => {
    await base44.entities.Proposal.delete(id);
    setProposals(p => p.filter(x => x.id !== id));
    toast.success("Proposta removida");
  };

  const openNewContract = (proposal) => {
    setContractForm({
      title: `Contrato - ${proposal.client_name}`,
      client_name: proposal.client_name,
      proposal_id: proposal.id,
      value: proposal.value || 0,
      content: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nCliente: ${proposal.client_name}\nValor: R$ ${(proposal.value || 0).toLocaleString("pt-BR")}\n\n${proposal.description || ""}\n\nCláusulas:\n1. O presente contrato tem validade de 12 meses.\n2. O pagamento deverá ser realizado conforme acordado.\n3. Quaisquer alterações deverão ser acordadas por escrito.\n\nAssinatura do Cliente: _____________________\nData: ___/___/______`,
      status: "pendente",
    });
    setShowContractDialog(true);
  };

  const saveContract = async () => {
    if (!contractForm.title || !contractForm.content) return toast.error("Preencha os campos obrigatórios");
    const accountId = await getWorkspaceId();
    const c = await base44.entities.Contract.create({ ...contractForm, value: parseFloat(contractForm.value) || 0, workspace_id: accountId });
    setContracts(prev => [c, ...prev]);
    setShowContractDialog(false);
    toast.success("Contrato criado");
  };

  const openSignature = (id) => {
    const contract = contracts.find(c => c.id === id);
    setSigningContractId(id);
    setSigningContractTitle(contract?.title || "Contrato");
    setShowSignatureDialog(true);
  };

  const signContract = async (signatureDataUrl) => {
    setShowSignatureDialog(false);
    const now = new Date().toISOString();

    // Convert base64 dataUrl to a File and upload it
    const res = await fetch(signatureDataUrl);
    const blob = await res.blob();
    const file = new File([blob], "assinatura.png", { type: "image/png" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    await base44.entities.Contract.update(signingContractId, {
      status: "assinado",
      signed_at: now,
      signature_image: file_url,
    });
    setContracts(p => p.map(c => c.id === signingContractId
      ? { ...c, status: "assinado", signed_at: now, signature_image: file_url }
      : c
    ));
    setSigningContractId(null);
    toast.success("Contrato assinado digitalmente! ✍️");
  };

  const filteredProposals = filter === "all" ? proposals : proposals.filter(p => p.status === filter);

  const stats = {
    total: proposals.length,
    value: proposals.reduce((s, p) => s + (p.value || 0), 0),
    aceitas: proposals.filter(p => p.status === "aceita").length,
    aguardando: proposals.filter(p => ["enviada"].includes(p.status)).length,
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "24px 32px", fontFamily: "-apple-system, 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Propostas & Contratos</h1>
          <p style={{ fontSize: 13, color: C.textMuted, marginTop: 3 }}>Crie, envie e acompanhe suas propostas comerciais</p>
        </div>
        <button onClick={() => { setForm(EMPTY_PROPOSAL); setShowProposalDialog(true); }} style={{
          padding: "9px 18px", borderRadius: 10, border: "none",
          background: C.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>+ Nova Proposta</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Propostas", value: stats.total, color: C.primary },
          { label: "Valor total", value: `R$ ${(stats.value / 1000).toFixed(1)}k`, color: C.green },
          { label: "Aceitas", value: stats.aceitas, color: C.green },
          { label: "Aguardando", value: stats.aguardando, color: C.orange },
        ].map((s, i) => (
          <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 18,
        background: C.card, borderRadius: 10, padding: 4,
        border: `1px solid ${C.border}`, width: "fit-content",
      }}>
        {[
          { key: "proposals", label: `📄 Propostas (${proposals.length})` },
          { key: "contracts", label: `📝 Contratos (${contracts.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "7px 16px", borderRadius: 8, border: "none",
            background: tab === t.key ? C.primary : "transparent",
            color: tab === t.key ? "#fff" : C.textMuted,
            fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.2s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Filter (proposals only) */}
      {tab === "proposals" && (
        <div style={{
          display: "flex", gap: 3, marginBottom: 16,
          background: C.card, borderRadius: 10, padding: 3,
          border: `1px solid ${C.border}`, width: "fit-content",
        }}>
          {[
            { key: "all", label: "Todas" },
            { key: "rascunho", label: "Rascunhos" },
            { key: "enviada", label: "Enviadas" },
            { key: "aceita", label: "Aceitas" },
            { key: "recusada", label: "Recusadas" },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: "5px 12px", borderRadius: 7, border: "none",
              background: filter === f.key ? C.primary : "transparent",
              color: filter === f.key ? "#fff" : C.textMuted,
              fontSize: 11, fontWeight: 500, cursor: "pointer", transition: "all 0.2s",
            }}>{f.label}</button>
          ))}
        </div>
      )}

      {/* Content */}
      {tab === "proposals" && (
        <div style={{ display: "grid", gap: 10 }}>
          {filteredProposals.length === 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "48px 24px", textAlign: "center", color: C.textMuted }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Nenhuma proposta encontrada</div>
            </div>
          )}
          {filteredProposals.map(p => (
            <ProposalCard
              key={p.id} p={p}
              onClick={setDetail}
              onUpdateStatus={updateStatus}
              onDelete={deleteProposal}
              onGenerateContract={openNewContract}
              companyName={companyName}
            />
          ))}
        </div>
      )}

      {tab === "contracts" && (
        <div style={{ display: "grid", gap: 10 }}>
          {contracts.length === 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "48px 24px", textAlign: "center", color: C.textMuted }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Nenhum contrato gerado</div>
            </div>
          )}
          {contracts.map(c => <ContractCard key={c.id} c={c} onSign={openSignature} companyName={companyName} />)}
        </div>
      )}

      {/* Detail panel */}
      {detail && (
        <DetailPanel
          p={detail}
          onClose={() => setDetail(null)}
          onUpdateStatus={updateStatus}
          onGenerateContract={openNewContract}
          companyName={companyName}
        />
      )}

      {/* New Proposal Dialog */}
      <Dialog open={showProposalDialog} onOpenChange={setShowProposalDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Proposta</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><Label>Título *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Cliente *</Label><Input value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Valor (R$)</Label><Input type="number" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} /></div>
              <div className="col-span-2 space-y-1"><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} /></div>
              <div className="space-y-1"><Label>Válida até</Label><Input type="date" value={form.valid_until} onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))} /></div>
            </div>
            <div className="space-y-2">
              <Label>Itens da Proposta</Label>
              <div className="flex gap-2">
                <Input placeholder="Descrição do item" value={itemText} onChange={e => setItemText(e.target.value)} className="flex-1" />
                <Input placeholder="Valor" type="number" value={itemValue} onChange={e => setItemValue(e.target.value)} className="w-24" />
                <Button variant="outline" onClick={addItem}>+</Button>
              </div>
              {form.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-sm">
                  <span>{item.description}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">R$ {item.value?.toLocaleString("pt-BR")}</span>
                    <button onClick={() => removeItem(i)} className="text-destructive text-xs">×</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowProposalDialog(false)}>Cancelar</Button>
              <Button onClick={saveProposal}>Criar Proposta</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Signature Dialog */}
      <SignatureDialog
        open={showSignatureDialog}
        onOpenChange={setShowSignatureDialog}
        contractTitle={signingContractTitle}
        onConfirm={signContract}
      />

      {/* New Contract Dialog */}
      <Dialog open={showContractDialog} onOpenChange={setShowContractDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Criar Contrato</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><Label>Título *</Label><Input value={contractForm.title} onChange={e => setContractForm(p => ({ ...p, title: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Cliente</Label><Input value={contractForm.client_name} onChange={e => setContractForm(p => ({ ...p, client_name: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Valor (R$)</Label><Input type="number" value={contractForm.value} onChange={e => setContractForm(p => ({ ...p, value: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Conteúdo do Contrato *</Label><Textarea value={contractForm.content} onChange={e => setContractForm(p => ({ ...p, content: e.target.value }))} rows={10} className="font-mono text-xs" /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowContractDialog(false)}>Cancelar</Button>
              <Button onClick={saveContract}>Criar Contrato</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}