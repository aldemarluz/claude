import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { getWorkspaceId } from "@/lib/workspace";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, Pencil, Check, Star } from "lucide-react";

const DEFAULT_COLORS = ["blue", "amber", "violet", "cyan", "emerald", "rose", "orange", "pink"];

const DEFAULT_STAGES = [
  { key: "novo", label: "Novo Lead", color: "blue", order: 0 },
  { key: "contato_iniciado", label: "Contato Iniciado", color: "amber", order: 1 },
  { key: "qualificado", label: "Qualificado", color: "violet", order: 2 },
  { key: "proposta_enviada", label: "Proposta Enviada", color: "cyan", order: 3 },
  { key: "fechado", label: "Fechado", color: "emerald", order: 4 },
];

function StageRow({ stage, index, onChange, onDelete, totalStages }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(stage.label);

  const save = () => { onChange({ ...stage, label }); setEditing(false); };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg border border-border group">
      <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />
      <div className={`w-3 h-3 rounded-full shrink-0 bg-${stage.color}-500`} />
      {editing ? (
        <Input value={label} onChange={e => setLabel(e.target.value)} className="h-7 text-xs flex-1" autoFocus onKeyDown={e => e.key === "Enter" && save()} />
      ) : (
        <span className="text-sm flex-1">{stage.label}</span>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {editing ? (
          <button onClick={save} className="p-1 hover:bg-primary/10 rounded text-primary"><Check className="w-3.5 h-3.5" /></button>
        ) : (
          <button onClick={() => setEditing(true)} className="p-1 hover:bg-muted rounded text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
        )}
        <select
          value={stage.color}
          onChange={e => onChange({ ...stage, color: e.target.value })}
          className="text-xs border border-border rounded px-1 h-6 bg-background outline-none"
        >
          {DEFAULT_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {totalStages > 1 && (
          <button onClick={onDelete} className="p-1 hover:bg-destructive/10 rounded text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
        )}
      </div>
    </div>
  );
}

export default function PipelineManagerDialog({ open, onOpenChange, pipelines, onSaved, onSetDefault }) {
  const [view, setView] = useState("list"); // "list" | "edit"
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stages, setStages] = useState(DEFAULT_STAGES);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setStages(DEFAULT_STAGES.map(s => ({ ...s })));
    setView("edit");
  };

  const openEdit = (p) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description || "");
    setStages(p.stages?.length ? [...p.stages] : DEFAULT_STAGES.map(s => ({ ...s })));
    setView("edit");
  };

  const addStage = () => {
    const key = `stage_${Date.now()}`;
    setStages(prev => [...prev, { key, label: "Nova Etapa", color: "blue", order: prev.length }]);
  };

  const updateStage = (idx, updated) => setStages(prev => prev.map((s, i) => i === idx ? updated : s));
  const deleteStage = (idx) => setStages(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })));

  const save = async () => {
    if (!name.trim()) return toast.error("Nome obrigatório");
    setSaving(true);
    const wsId = await getWorkspaceId();
    const data = { name, description, stages, workspace_id: wsId };
    if (editing) {
      await base44.entities.PipelineConfig.update(editing.id, data);
      toast.success("Pipeline atualizado!");
    } else {
      await base44.entities.PipelineConfig.create({ ...data, is_default: pipelines.length === 0 });
      toast.success("Pipeline criado!");
    }
    setSaving(false);
    onSaved();
    setView("list");
  };

  const deletePipeline = async (p) => {
    if (pipelines.length <= 1) return toast.error("Você precisa ter pelo menos um pipeline");
    await base44.entities.PipelineConfig.delete(p.id);
    toast.success("Pipeline removido");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {view === "list" ? "Gerenciar Pipelines" : editing ? "Editar Pipeline" : "Novo Pipeline"}
          </DialogTitle>
        </DialogHeader>

        {view === "list" && (
          <div className="space-y-3">
            {pipelines.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 border border-border rounded-lg bg-muted/20">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{p.name}</span>
                    {p.is_default && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">Padrão</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.stages?.length || 0} estágios</p>
                </div>
                <div className="flex items-center gap-1">
                  {!p.is_default && (
                    <button onClick={() => onSetDefault(p)} title="Definir como padrão" className="p-1.5 hover:bg-amber-50 rounded text-muted-foreground hover:text-amber-500 transition-colors">
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-muted rounded text-muted-foreground">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {!p.is_default && (
                    <button onClick={() => deletePipeline(p)} className="p-1.5 hover:bg-destructive/10 rounded text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <Button onClick={openNew} variant="outline" className="w-full gap-2">
              <Plus className="w-4 h-4" /> Novo Pipeline
            </Button>
          </div>
        )}

        {view === "edit" && (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Vendas, Pós-venda..." />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <Label>Estágios</Label>
              <div className="space-y-2">
                {stages.map((stage, idx) => (
                  <StageRow
                    key={stage.key}
                    stage={stage}
                    index={idx}
                    totalStages={stages.length}
                    onChange={(updated) => updateStage(idx, updated)}
                    onDelete={() => deleteStage(idx)}
                  />
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addStage} className="gap-2 w-full">
                <Plus className="w-3.5 h-3.5" /> Adicionar Estágio
              </Button>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setView("list")} className="flex-1">Cancelar</Button>
              <Button onClick={save} disabled={saving} className="flex-1">
                {saving ? "Salvando..." : "Salvar Pipeline"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}