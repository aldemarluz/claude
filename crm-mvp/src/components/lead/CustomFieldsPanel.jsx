import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";

// Custom fields are stored as JSON in a "custom_fields" key on the entity
export default function CustomFieldsPanel({ customFields = {}, schema = [], onSave }) {
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [addMode, setAddMode] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");

  const startEdit = (key, val) => {
    setEditingKey(key);
    setEditValue(val || "");
  };

  const saveEdit = () => {
    onSave({ ...customFields, [editingKey]: editValue });
    setEditingKey(null);
  };

  const removeField = (key) => {
    const updated = { ...customFields };
    delete updated[key];
    onSave(updated);
  };

  const addField = () => {
    if (!newLabel.trim()) return;
    const key = newLabel.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    onSave({ ...customFields, [key]: newValue });
    setNewLabel("");
    setNewValue("");
    setAddMode(false);
  };

  const fields = Object.entries(customFields || {});

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Campos Personalizados</h3>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setAddMode(p => !p)}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {fields.length === 0 && !addMode && (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhum campo personalizado</p>
      )}

      <div className="space-y-2">
        {fields.map(([key, val]) => (
          <div key={key} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">{key.replace(/_/g, " ")}</Label>
              {editingKey === key ? (
                <Input
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingKey(null); }}
                  className="h-7 text-xs mt-0.5"
                  autoFocus
                />
              ) : (
                <p className="text-sm font-medium">{val || <span className="text-muted-foreground italic">vazio</span>}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {editingKey === key ? (
                <>
                  <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-700 p-1"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditingKey(null)} className="text-muted-foreground hover:text-foreground p-1"><X className="w-3.5 h-3.5" /></button>
                </>
              ) : (
                <>
                  <button onClick={() => startEdit(key, val)} className="text-muted-foreground hover:text-foreground p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeField(key)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {addMode && (
        <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Nome do campo</Label>
              <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Ex: CPF, LinkedIn..." className="h-7 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor</Label>
              <Input value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="Valor..." className="h-7 text-xs" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={addField}>Adicionar</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddMode(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}