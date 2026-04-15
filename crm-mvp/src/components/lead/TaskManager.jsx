import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Check, Trash2, Clock, Bell, Phone, Users, RefreshCw, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import moment from "moment";

const TASK_TYPES = [
  { value: "task", label: "Tarefa", icon: Check, color: "bg-blue-500/10 text-blue-600" },
  { value: "reminder", label: "Lembrete", icon: Bell, color: "bg-amber-500/10 text-amber-600" },
  { value: "call", label: "Ligação", icon: Phone, color: "bg-violet-500/10 text-violet-600" },
  { value: "meeting", label: "Reunião", icon: Users, color: "bg-emerald-500/10 text-emerald-600" },
  { value: "follow_up", label: "Follow-up", icon: RefreshCw, color: "bg-rose-500/10 text-rose-600" },
];

const PRIORITY_COLORS = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  high: "bg-red-500/10 text-red-600 border-red-500/20",
};

const PRIORITY_LABELS = { low: "Baixa", medium: "Média", high: "Alta" };

const empty = { title: "", description: "", type: "task", status: "pending", priority: "medium", due_date: "" };

export default function TaskManager({ leadId, onTaskAdded }) {
  const [tasks, setTasks] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState(empty);
  const [filter, setFilter] = useState("pending");

  useEffect(() => {
    if (leadId) load();
  }, [leadId]);

  const load = async () => {
    const data = await base44.entities.Task.filter({ lead_id: leadId }, "due_date", 100);
    setTasks(data);
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Título é obrigatório"); return; }
    const created = await base44.entities.Task.create({
      ...form,
      lead_id: leadId,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
    });
    setTasks(p => [created, ...p]);
    setForm(empty);
    setShowDialog(false);
    toast.success("Tarefa criada");
    if (onTaskAdded) onTaskAdded(form.title, form.type);
  };

  const toggle = async (task) => {
    const newStatus = task.status === "done" ? "pending" : "done";
    await base44.entities.Task.update(task.id, { status: newStatus });
    setTasks(p => p.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
  };

  const remove = async (id) => {
    await base44.entities.Task.delete(id);
    setTasks(p => p.filter(t => t.id !== id));
    toast.success("Tarefa removida");
  };

  const filtered = filter === "all" ? tasks : tasks.filter(t => t.status === filter);
  const pendingCount = tasks.filter(t => t.status === "pending").length;
  const overdueCount = tasks.filter(t => t.status === "pending" && t.due_date && new Date(t.due_date) < new Date()).length;

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Tarefas & Lembretes</h3>
          {pendingCount > 0 && (
            <Badge className="bg-primary/10 text-primary border-0 text-xs px-1.5">{pendingCount}</Badge>
          )}
          {overdueCount > 0 && (
            <Badge className="bg-red-500/10 text-red-600 border-0 text-xs px-1.5">⚠ {overdueCount} atrasada{overdueCount > 1 ? "s" : ""}</Badge>
          )}
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => setShowDialog(true)}>
          <Plus className="w-3.5 h-3.5" /> Nova
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {[["pending", "Pendentes"], ["done", "Concluídas"], ["all", "Todas"]].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
          >{l}</button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tarefa</p>
        )}
        {filtered.map(task => {
          const typeConf = TASK_TYPES.find(t => t.value === task.type) || TASK_TYPES[0];
          const TypeIcon = typeConf.icon;
          const isOverdue = task.status === "pending" && task.due_date && new Date(task.due_date) < new Date();
          return (
            <div key={task.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${task.status === "done" ? "opacity-50 bg-muted/20" : isOverdue ? "border-red-200 bg-red-500/5" : "border-border bg-muted/10 hover:bg-muted/30"}`}>
              <button
                onClick={() => toggle(task)}
                className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors ${task.status === "done" ? "bg-primary border-primary" : "border-muted-foreground/40 hover:border-primary"}`}
              >
                {task.status === "done" && <Check className="w-3 h-3 text-primary-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
                {task.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md ${typeConf.color}`}>
                    <TypeIcon className="w-3 h-3" />{typeConf.label}
                  </span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[task.priority]}`}>{PRIORITY_LABELS[task.priority]}</Badge>
                  {task.due_date && (
                    <span className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                      <CalendarDays className="w-3 h-3" />
                      {moment(task.due_date).format("DD/MM HH:mm")}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => remove(task.id)} className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="O que precisa ser feito?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Data e hora</Label>
              <Input type="datetime-local" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Detalhes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={save}>Criar Tarefa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}