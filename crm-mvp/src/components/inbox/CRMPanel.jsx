import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getWorkspaceId } from "@/lib/workspace";

const STAGES = ["novo", "contato_iniciado", "qualificado", "proposta_enviada", "fechado"];
const STAGE_LABELS = { novo: "Novo", contato_iniciado: "Contato iniciado", qualificado: "Qualificado", proposta_enviada: "Proposta enviada", fechado: "Fechado" };
const DEAL_STATUS_COLORS = { aberto: "#3b82f6", ganho: "#10b981", perdido: "#ef4444" };

function DealCard({ deal, isSelected, onClick, color }) {
  return (
    <div onClick={onClick} style={{
      padding: 10, borderRadius: 10, cursor: "pointer", transition: "all 0.2s",
      border: isSelected ? `2px solid ${color}` : "1px solid #e2e8f0",
      background: isSelected ? `${color}06` : "#fff", marginBottom: 6,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{deal.title}</span>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10, textTransform: "uppercase", letterSpacing: 0.5,
          background: `${DEAL_STATUS_COLORS[deal.status]}15`, color: DEAL_STATUS_COLORS[deal.status],
        }}>{deal.status}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: deal.value ? color : "#94a3b8" }}>
          {deal.value ? `R$ ${deal.value.toLocaleString("pt-BR")}` : "Sem valor"}
        </span>
        <span style={{ fontSize: 10, color: "#94a3b8" }}>{deal.createdAt}</span>
      </div>
      {deal.status === "aberto" && (
        <div style={{ display: "flex", gap: 2, marginTop: 6 }}>
          {STAGES.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= deal.stage ? color : "#e2e8f0", transition: "background 0.2s" }} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CRMPanel({ contact, channel, onUpdate, onClose, onAssign, currentUserEmail }) {
  const [tab, setTab] = useState("deals");
  const [selDeal, setSelDeal] = useState(null);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [newDealTitle, setNewDealTitle] = useState("");
  const [newDealValue, setNewDealValue] = useState("");
  const [newDealPipeline, setNewDealPipeline] = useState("");
  const [users, setUsers] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [linkedLead, setLinkedLead] = useState(null);
  const [loadingLead, setLoadingLead] = useState(false);

  const primary = channel?.primary || "#3b82f6";

  useEffect(() => {
    Promise.all([
      base44.entities.User.list().catch(() => []),
      base44.entities.PipelineConfig.list().catch(() => [])
    ]).then(([users_, pipelines_]) => {
      setUsers(users_);
      setPipelines(pipelines_);
      if (pipelines_.length > 0) setNewDealPipeline(pipelines_[0].id);
    });
  }, []);

  // Buscar Lead vinculado ao contato por email ou telefone
  useEffect(() => {
    const searchLinkedLead = async () => {
      try {
        const workspaceId = contact.workspace_id || contact.account_id;
        const allLeads = await base44.entities.Lead.list();
        
        // Filtrar por workspace e buscar por telefone ou email
        const foundLead = allLeads.find(l => {
          const sameWorkspace = !workspaceId || l.workspace_id === workspaceId;
          const phoneMatch = l.phone && contact.phone && l.phone === contact.phone;
          const emailMatch = l.email && contact.email && l.email === contact.email;
          const whatsappEmailMatch = l.email && contact.phone && l.email === `${contact.phone}@whatsapp.local`;
          
          return sameWorkspace && (phoneMatch || emailMatch || whatsappEmailMatch);
        });
        
        if (foundLead) setLinkedLead(foundLead);
      } catch (_) {}
    };
    
    if (contact) searchLinkedLead();
  }, [contact]);

  // Busca o lead vinculado ao contato pelo telefone
  useEffect(() => {
    if (contact?.phone) {
      setLoadingLead(true);
      getWorkspaceId().then(wsId => {
        base44.entities.Lead.filter({ phone: contact.phone }).then(leads => {
          setLinkedLead(leads?.[0] || null);
          setLoadingLead(false);
        }).catch(() => setLoadingLead(false));
      });
    }
  }, [contact?.phone]);

  useEffect(() => {
    if (contact) {
      const openDeal = contact.deals?.find(d => d.status === "aberto");
      setSelDeal(openDeal?.id || contact.deals?.[0]?.id || null);
      setTab("deals");
    }
  }, [contact?.id]);

  if (!contact) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#94a3b8", fontSize: 13, flexDirection: "column", gap: 8 }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 32, height: 32, opacity: 0.3 }}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
      Selecione uma conversa
    </div>
  );

  const deals = contact.deals || [];
  const activeDeal = deals.find(d => d.id === selDeal);
  const openDeals = deals.filter(d => d.status === "aberto").length;
  const wonDeals = deals.filter(d => d.status === "ganho").length;

  const handleCreateDeal = async () => {
    if (!newDealTitle.trim() || !newDealPipeline) return;
    
    const selectedPipeline = pipelines.find(p => p.id === newDealPipeline);
    
    try {
      const workspaceId = contact.workspace_id || contact.account_id;
      const estimatedValue = parseInt(newDealValue) || 0;
      
      // Buscar ou criar Lead vinculado ao contato
      let lead = linkedLead;
      if (!lead) {
        const allLeads = await base44.entities.Lead.list();
        const existingLead = allLeads.find(l => 
          (l.email && contact.email && l.email === contact.email) ||
          (l.phone && contact.phone && l.phone === contact.phone)
        );
        
        if (existingLead) {
          lead = existingLead;
        } else {
          lead = await base44.entities.Lead.create({
            workspace_id: workspaceId,
            name: contact.name,
            email: contact.email || `${contact.phone}@whatsapp.local`,
            phone: contact.phone,
            status: "contato_iniciado",
            deal_status: "aberto",
            estimated_value: estimatedValue,
            origin: contact.origin || "WhatsApp",
            notes: `Oportunidade: ${newDealTitle}`,
          });
        }
        setLinkedLead(lead);
      }

      // Atualizar Lead com nova oportunidade
      const updatedLead = await base44.entities.Lead.update(lead.id, {
        status: "contato_iniciado",
        deal_status: "aberto",
        estimated_value: Math.max(lead.estimated_value || 0, estimatedValue),
        notes: `${lead.notes || ''}\n${newDealTitle}`,
      });
      setLinkedLead(updatedLead);

      // Adicionar deal localmente
      const newDeal = {
        id: lead.id, 
        title: newDealTitle,
        value: estimatedValue, 
        stage: 0, 
        status: "aberto",
        createdAt: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
        proposals: [],
        pipelineId: newDealPipeline,
        pipelineName: selectedPipeline?.name,
        linkedLeadId: lead.id,
      };

      const updatedContact = {
        ...contact,
        deals: [...(contact.deals || []), newDeal],
        dealsCount: (contact.dealsCount || 0) + 1,
      };

      onUpdate(updatedContact);
      setSelDeal(newDeal.id);
      setNewDealTitle("");
      setNewDealValue("");
      setNewDealPipeline(pipelines.length > 0 ? pipelines[0].id : "");
      setShowNewDeal(false);
    } catch (err) {
      console.error("Erro ao criar oportunidade:", err);
    }
  };

  const handleStageChange = async (newStage) => {
    if (!activeDeal || activeDeal.status !== "aberto") return;
    
    // Sincroniza com o lead no pipeline
    if (linkedLead) {
      try {
        const stageKey = STAGES[newStage];
        await base44.entities.Lead.update(linkedLead.id, { status: stageKey });
        setLinkedLead(prev => ({ ...prev, status: stageKey }));
      } catch (_) {}
    }
    
    onUpdate({ ...contact, deals: deals.map(d => d.id === selDeal ? { ...d, stage: newStage } : d) });
  };

  const handleDealStatus = async (newStatus) => {
    if (!activeDeal) return;
    
    // Sincroniza com o lead no pipeline
    if (linkedLead) {
      try {
        const dealStatus = newStatus === "ganho" ? "ganho" : "perdido";
        await base44.entities.Lead.update(linkedLead.id, { 
          deal_status: dealStatus,
          status: newStatus === "ganho" ? "fechado" : "qualificado"
        });
        setLinkedLead(prev => ({ ...prev, deal_status: dealStatus }));
      } catch (_) {}
    }

    const updated = deals.map(d => d.id === selDeal ? { ...d, status: newStatus, stage: newStatus === "ganho" ? 4 : d.stage } : d);
    const totalValue = updated.filter(d => d.status === "ganho").reduce((s, d) => s + d.value, 0);
    onUpdate({
      ...contact, deals: updated, totalValue,
      timeline: [{ type: "deal", text: `"${activeDeal.title}" marcado como ${newStatus}`, time: "Agora", color: newStatus === "ganho" ? "#10b981" : "#ef4444" }, ...(contact.timeline || [])],
    });
  };

  const tabs = [
    { id: "deals", label: `Oportunidades (${deals.length})` },
    { id: "info", label: "Contato" },
    { id: "history", label: "Histórico" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontSize: 13, background: "#fff" }}>
      {/* Header */}
      <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%", background: `${primary}12`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: primary, flexShrink: 0, overflow: "hidden",
          }}>
            {contact.profile_picture_url
              ? <img src={contact.profile_picture_url} alt={contact.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
              : (contact.name?.split(" ").map(n => n[0]).join("").slice(0, 2) || "?")
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contact.name}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{contact.company || contact.phone || ""}</div>
          </div>
          {onClose && (
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2, display: "flex" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
        {/* Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <div style={{ background: "#f8fafc", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
              {contact.totalValue >= 1000 ? `R$${(contact.totalValue / 1000).toFixed(1)}k` : `R$${contact.totalValue || 0}`}
            </div>
            <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase" }}>Total ganho</div>
          </div>
          <div style={{ background: "#f8fafc", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#3b82f6" }}>{openDeals}</div>
            <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase" }}>Abertas</div>
          </div>
          <div style={{ background: "#f8fafc", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#10b981" }}>{wonDeals}</div>
            <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase" }}>Ganhas</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #f1f5f9" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "8px 0", border: "none", cursor: "pointer", fontSize: 11, fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? primary : "#94a3b8", background: "transparent",
            borderBottom: tab === t.id ? `2px solid ${primary}` : "2px solid transparent", transition: "all 0.2s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>

        {tab === "deals" && (
          <div>
            {deals.map(d => (
              <DealCard key={d.id} deal={d} isSelected={selDeal === d.id} onClick={() => setSelDeal(d.id)} color={primary} />
            ))}

            {!showNewDeal ? (
              <button onClick={() => setShowNewDeal(true)} style={{
                width: "100%", padding: "10px", borderRadius: 8, border: `1px dashed ${primary}40`,
                background: "transparent", color: primary, fontSize: 12, fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4,
              }}>+ Nova oportunidade</button>
            ) : (
              <div style={{ padding: 12, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>Nova oportunidade</div>
                <input value={newDealTitle} onChange={e => setNewDealTitle(e.target.value)}
                  placeholder="Ex: Cardápio digital, Redesign..."
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", marginBottom: 6, boxSizing: "border-box" }} />
                <input value={newDealValue} onChange={e => setNewDealValue(e.target.value)}
                  placeholder="Valor estimado (R$)" type="number"
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", marginBottom: 6, boxSizing: "border-box" }} />
                {pipelines.length > 0 && (
                  <select value={newDealPipeline} onChange={e => setNewDealPipeline(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", marginBottom: 8, boxSizing: "border-box", background: "#fff", cursor: "pointer" }}>
                    <option value="">Selecionar pipeline</option>
                    {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={handleCreateDeal} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", background: primary, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: newDealPipeline ? 1 : 0.5, pointerEvents: newDealPipeline ? "auto" : "none" }}>Criar</button>
                  <button onClick={() => setShowNewDeal(false)} style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 11, cursor: "pointer", color: "#64748b" }}>Cancelar</button>
                </div>
              </div>
            )}

            {activeDeal && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{activeDeal.title}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10, textTransform: "uppercase",
                    background: `${DEAL_STATUS_COLORS[activeDeal.status]}15`, color: DEAL_STATUS_COLORS[activeDeal.status],
                  }}>{activeDeal.status}</span>
                </div>

                {activeDeal.status === "aberto" && (
                  <>
                    <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                      Pipeline {linkedLead && <span style={{ fontSize: 9, color: primary }}>(sincronizado com lead)</span>}
                    </div>
                    {STAGES.map((stg, i) => (
                      <div key={i} onClick={() => handleStageChange(i)} style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 6, cursor: "pointer", marginBottom: 1,
                        background: i === activeDeal.stage ? `${primary}08` : "transparent",
                      }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: "50%",
                          border: i <= activeDeal.stage ? "none" : "2px solid #cbd5e1",
                          background: i <= activeDeal.stage ? primary : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>{i <= activeDeal.stage && <span style={{ color: "#fff", fontSize: 9 }}>✓</span>}</div>
                        <span style={{ fontSize: 11, fontWeight: i === activeDeal.stage ? 600 : 400, color: i === activeDeal.stage ? primary : "#64748b" }}>{STAGE_LABELS[stg]}</span>
                      </div>
                    ))}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
                      <button onClick={() => handleDealStatus("ganho")} style={{ padding: "8px", borderRadius: 6, border: "none", background: "#dcfce7", color: "#166534", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>✓ Marcar Ganho</button>
                      <button onClick={() => handleDealStatus("perdido")} style={{ padding: "8px", borderRadius: 6, border: "none", background: "#fee2e2", color: "#991b1b", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>✗ Marcar Perdido</button>
                    </div>
                  </>
                )}

                {activeDeal.proposals && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Propostas</div>
                    {activeDeal.proposals.length === 0 ? (
                      <button style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px dashed #e2e8f0", background: "transparent", color: primary, fontSize: 11, cursor: "pointer" }}>+ Criar proposta</button>
                    ) : activeDeal.proposals.map(p => (
                      <div key={p.id} style={{ padding: 8, borderRadius: 6, border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#0f172a" }}>{p.title}</div>
                          <div style={{ fontSize: 10, color: "#64748b" }}>R$ {p.value.toLocaleString("pt-BR")}</div>
                        </div>
                        <span style={{
                          fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                          background: p.status === "aceita" ? "#dcfce7" : "#dbeafe",
                          color: p.status === "aceita" ? "#166534" : "#1d4ed8",
                        }}>{p.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "info" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { l: "Email", v: contact.email },
              { l: "Telefone", v: contact.phone },
              { l: "Empresa", v: contact.company },
              { l: "Origem", v: contact.origin },
            ].map(f => (
              <div key={f.l}>
                <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{f.l}</div>
                <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>{f.v || "-"}</div>
              </div>
            ))}

            {onAssign && (
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Responsável</div>
                <select
                  value={contact.assignedTo || ""}
                  onChange={e => onAssign(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, color: "#1e293b", outline: "none", background: "#fff", cursor: "pointer" }}
                >
                  <option value="">Sem responsável</option>
                  {users.map(u => (
                    <option key={u.id} value={u.email}>{u.full_name || u.email}{u.email === currentUserEmail ? " (você)" : ""}</option>
                  ))}
                </select>
                {contact.assignedTo && (
                  <div style={{ marginTop: 6, fontSize: 11, color: primary, fontWeight: 500 }}>✓ {contact.assignedTo}</div>
                )}
              </div>
            )}

            {contact.tags?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Tags</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {contact.tags.map(t => (
                    <span key={t} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: `${primary}12`, color: primary, fontWeight: 500 }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div>
            {(contact.timeline || []).map((ev, i) => (
              <div key={i} style={{ display: "flex", gap: 8, paddingBottom: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16, flexShrink: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: ev.color || "#94a3b8", flexShrink: 0 }} />
                  {i < (contact.timeline?.length - 1) && <div style={{ width: 1.5, flex: 1, background: "#e2e8f0", marginTop: 3 }} />}
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#1e293b", lineHeight: 1.4 }}>{ev.text}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>{ev.time}</div>
                </div>
              </div>
            ))}
            {(!contact.timeline || contact.timeline.length === 0) && (
              <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 16 }}>Nenhuma atividade ainda</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}