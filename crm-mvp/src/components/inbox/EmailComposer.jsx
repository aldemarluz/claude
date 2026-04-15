import { useState } from "react";
import { Send, Mail, ChevronDown, ChevronUp, Bold, Italic, List, AlertCircle, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const PRIORITY_OPTIONS = [
  { value: "normal", label: "Normal", color: "text-muted-foreground" },
  { value: "high", label: "Alta", color: "text-orange-500" },
  { value: "urgent", label: "Urgente", color: "text-red-500" },
];

export default function EmailComposer({ toName, toEmail, fromName, fromEmail, onSend }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [priority, setPriority] = useState("normal");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [attachments, setAttachments] = useState([]);

  const handleSend = () => {
    if (!subject.trim() || !body.trim()) return;
    onSend({ subject, body, cc, bcc, priority, attachments });
    setSubject("");
    setBody("");
    setCc("");
    setBcc("");
    setPriority("normal");
    setAttachments([]);
    setShowCcBcc(false);
  };

  const handleAttach = (e) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files.map((f) => f.name)]);
  };

  const applyFormat = (tag) => {
    const textarea = document.getElementById("email-body-textarea");
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.substring(start, end);
    const map = { bold: `**${selected}**`, italic: `_${selected}_`, list: `\n• ${selected}` };
    const newBody = body.substring(0, start) + map[tag] + body.substring(end);
    setBody(newBody);
  };

  const prioConfig = PRIORITY_OPTIONS.find((p) => p.value === priority);

  return (
    <div className="max-w-2xl mx-auto space-y-0 border-2 border-blue-300 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* FROM */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-100 bg-blue-50/50">
        <span className="text-xs font-semibold text-blue-600 w-14 shrink-0">De:</span>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
            <span className="text-[9px] text-white font-bold">{fromName?.charAt(0)?.toUpperCase()}</span>
          </div>
          <span className="text-xs text-foreground font-medium">{fromName}</span>
          <span className="text-xs text-muted-foreground">&lt;{fromEmail || "seu@email.com"}&gt;</span>
        </div>
      </div>

      {/* TO */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-100">
        <span className="text-xs font-semibold text-blue-600 w-14 shrink-0">Para:</span>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs font-medium">{toName}</span>
          {toEmail && <span className="text-xs text-muted-foreground">&lt;{toEmail}&gt;</span>}
          {!toEmail && <span className="text-xs text-red-400 italic">sem e-mail cadastrado</span>}
        </div>
        <button
          onClick={() => setShowCcBcc(!showCcBcc)}
          className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
        >
          CC/BCC {showCcBcc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* CC / BCC */}
      {showCcBcc && (
        <>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-100">
            <span className="text-xs font-semibold text-blue-600 w-14 shrink-0">CC:</span>
            <input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="email@exemplo.com, outro@exemplo.com"
              className="flex-1 text-xs outline-none bg-transparent"
            />
          </div>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-100">
            <span className="text-xs font-semibold text-blue-600 w-14 shrink-0">BCC:</span>
            <input
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="email@exemplo.com"
              className="flex-1 text-xs outline-none bg-transparent"
            />
          </div>
        </>
      )}

      {/* SUBJECT */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-100">
        <span className="text-xs font-semibold text-blue-600 w-14 shrink-0">Assunto:</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Digite o assunto..."
          className="flex-1 text-sm outline-none bg-transparent font-medium"
        />
        {/* Priority */}
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className={`text-[10px] border border-border rounded px-1.5 py-0.5 outline-none bg-white cursor-pointer ${prioConfig.color}`}
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Formatting toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-blue-100 bg-blue-50/30">
        <button onClick={() => applyFormat("bold")} className="p-1.5 rounded hover:bg-blue-100 transition-colors" title="Negrito">
          <Bold className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button onClick={() => applyFormat("italic")} className="p-1.5 rounded hover:bg-blue-100 transition-colors" title="Itálico">
          <Italic className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button onClick={() => applyFormat("list")} className="p-1.5 rounded hover:bg-blue-100 transition-colors" title="Lista">
          <List className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <label className="p-1.5 rounded hover:bg-blue-100 transition-colors cursor-pointer" title="Anexar arquivo">
          <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
          <input type="file" multiple className="hidden" onChange={handleAttach} />
        </label>
        {priority === "urgent" && (
          <div className="ml-auto flex items-center gap-1 text-[10px] text-red-500 font-medium">
            <AlertCircle className="w-3 h-3" /> Urgente
          </div>
        )}
        {priority === "high" && (
          <div className="ml-auto flex items-center gap-1 text-[10px] text-orange-500 font-medium">
            <AlertCircle className="w-3 h-3" /> Alta prioridade
          </div>
        )}
      </div>

      {/* Body */}
      <textarea
        id="email-body-textarea"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={`Olá ${toName?.split(" ")[0] || ""},\n\nEscreva sua mensagem aqui...`}
        rows={6}
        className="w-full text-sm outline-none bg-transparent resize-none px-3 py-3 placeholder:text-muted-foreground/60"
      />

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pb-2 border-t border-blue-100 pt-2">
          {attachments.map((name, i) => (
            <div key={i} className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs text-blue-700">
              <Paperclip className="w-3 h-3" />
              <span className="max-w-[120px] truncate">{name}</span>
              <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}>
                <X className="w-3 h-3 hover:text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer / Send */}
      <div className="flex items-center justify-between px-3 py-2 bg-blue-50/50 border-t border-blue-100">
        <span className="text-[10px] text-muted-foreground">
          {attachments.length > 0 ? `${attachments.length} anexo(s)` : "Nenhum anexo"}
        </span>
        <Button
          onClick={handleSend}
          disabled={!subject.trim() || !body.trim() || !toEmail}
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
        >
          <Send className="w-3.5 h-3.5" /> Enviar E-mail
        </Button>
      </div>
    </div>
  );
}