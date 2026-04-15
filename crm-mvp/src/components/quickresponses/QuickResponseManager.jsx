import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getWorkspaceId } from "@/lib/workspace";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Edit2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "saudação", label: "Saudação" },
  { value: "despedida", label: "Despedida" },
  { value: "suporte", label: "Suporte" },
  { value: "venda", label: "Venda" },
  { value: "outro", label: "Outro" },
];

export default function QuickResponseManager() {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ titulo: "", mensagem: "", categoria: "outro" });

  useEffect(() => {
    loadResponses();
  }, []);

  const loadResponses = async () => {
    try {
      const workspaceId = await getWorkspaceId();
      const filter = workspaceId ? { workspace_id: workspaceId } : {};
      const data = await base44.entities.QuickResponse.filter(filter, "ordem", 100);
      setResponses(data);
    } catch (err) {
      console.error("Erro ao carregar respostas rápidas:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.titulo.trim() || !form.mensagem.trim()) {
      toast.error("Título e mensagem são obrigatórios");
      return;
    }

    try {
      const workspaceId = await getWorkspaceId();
      const data = {
        titulo: form.titulo,
        mensagem: form.mensagem,
        categoria: form.categoria,
        workspace_id: workspaceId || null,
      };

      if (editing) {
        await base44.entities.QuickResponse.update(editing.id, data);
        setResponses((prev) =>
          prev.map((r) => (r.id === editing.id ? { ...r, ...data } : r))
        );
        toast.success("Resposta atualizada");
      } else {
        const newResponse = await base44.entities.QuickResponse.create(data);
        setResponses((prev) => [...prev, newResponse]);
        toast.success("Resposta criada");
      }

      setForm({ titulo: "", mensagem: "", categoria: "outro" });
      setEditing(null);
      setOpen(false);
    } catch (err) {
      toast.error("Erro ao salvar resposta: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.QuickResponse.delete(id);
      setResponses((prev) => prev.filter((r) => r.id !== id));
      toast.success("Resposta removida");
    } catch (err) {
      toast.error("Erro ao remover resposta");
    }
  };

  const handleEdit = (response) => {
    setEditing(response);
    setForm({
      titulo: response.titulo,
      mensagem: response.mensagem,
      categoria: response.categoria || "outro",
    });
    setOpen(true);
  };

  const handleNew = () => {
    setEditing(null);
    setForm({ titulo: "", mensagem: "", categoria: "outro" });
    setOpen(true);
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Respostas Rápidas</h3>
        <Button onClick={handleNew} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Nova
        </Button>
      </div>

      <div className="grid gap-2 max-h-96 overflow-y-auto">
        {responses.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">
            Nenhuma resposta rápida cadastrada
          </p>
        ) : (
          responses.map((resp) => (
            <div
              key={resp.id}
              className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-slate-900 truncate">
                    {resp.titulo}
                  </p>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-600">
                    {CATEGORIES.find((c) => c.value === resp.categoria)?.label || "Outro"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                  {resp.mensagem}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleEdit(resp)}
                  className="p-1.5 hover:bg-slate-200 rounded text-slate-600"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(resp.id)}
                  className="p-1.5 hover:bg-red-100 rounded text-red-600"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Resposta" : "Nova Resposta Rápida"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label htmlFor="titulo">Título/Atalho *</Label>
              <Input
                id="titulo"
                placeholder="ex: Olá, Obrigado, etc"
                value={form.titulo}
                onChange={(e) =>
                  setForm((p) => ({ ...p, titulo: e.target.value }))
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="categoria">Categoria</Label>
              <Select
                value={form.categoria}
                onValueChange={(value) =>
                  setForm((p) => ({ ...p, categoria: value }))
                }
              >
                <SelectTrigger id="categoria" className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="mensagem">Mensagem *</Label>
              <Textarea
                id="mensagem"
                placeholder="Digite a mensagem que será enviada..."
                value={form.mensagem}
                onChange={(e) =>
                  setForm((p) => ({ ...p, mensagem: e.target.value }))
                }
                rows={4}
                className="text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                size="sm"
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} size="sm">
                {editing ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}