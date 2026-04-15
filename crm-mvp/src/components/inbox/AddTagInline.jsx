import { useState } from "react";
import { Plus, X } from "lucide-react";

export default function AddTagInline({ onAdd }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const submit = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") { setEditing(false); setValue(""); }
          }}
          className="text-[10px] border border-border rounded px-1.5 py-0.5 w-20 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="nova tag"
        />
        <button onClick={submit} className="text-primary hover:opacity-80">
          <Plus className="w-3 h-3" />
        </button>
        <button onClick={() => { setEditing(false); setValue(""); }} className="text-muted-foreground hover:opacity-80">
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-[10px] border border-dashed border-border rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground hover:border-foreground transition-colors flex items-center gap-0.5"
    >
      <Plus className="w-2.5 h-2.5" /> tag
    </button>
  );
}