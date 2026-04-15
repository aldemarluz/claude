import { useRef } from "react";
import AudioRecorder from "@/components/whatsapp/AudioRecorder";
import { Paperclip, X, Send } from "lucide-react";

export default function ChatInput({ channel, config, value, onChange, onSend, onFileSelect, mediaFile, onClearMedia, uploading, sending, hasChannel }) {
  const fileInputRef = useRef(null);

  if (channel === "email") {
    return (
      <div style={{ padding: "12px 16px", background: config.bg, borderTop: `1px solid ${config.searchBg}` }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: config.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            ↩ Responder
          </button>
          <button style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #e2e8f0", background: "transparent", color: "#4a5568", fontSize: 13, cursor: "pointer" }}>
            Encaminhar
          </button>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escreva sua resposta..."
          rows={3}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0",
            background: config.inputBg, fontSize: 13, outline: "none", resize: "none",
            color: "#1a202c", fontFamily: "inherit", boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button
            onClick={onSend}
            disabled={!value.trim()}
            style={{
              padding: "8px 20px", borderRadius: 6, border: "none",
              background: value.trim() ? config.primary : "#e2e8f0",
              color: value.trim() ? "#fff" : "#9ca3af",
              fontSize: 13, fontWeight: 600, cursor: value.trim() ? "pointer" : "default",
              transition: "all 0.2s",
            }}
          >
            Enviar
          </button>
        </div>
      </div>
    );
  }

  if (channel === "instagram") {
    return (
      <div style={{ padding: "10px 16px", background: config.bg, borderTop: `1px solid ${config.searchBg}`, display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          placeholder="Enviar mensagem..."
          style={{
            flex: 1, padding: "10px 16px", borderRadius: 24,
            border: "1px solid #dbdbdb", background: config.inputBg, fontSize: 14,
            outline: "none", color: "#1a202c",
          }}
        />
        <button
          onClick={onSend}
          disabled={!value.trim()}
          style={{
            background: "none", border: "none", cursor: value.trim() ? "pointer" : "default",
            fontWeight: 600, fontSize: 14, color: value.trim() ? "#0095F6" : "#c0dffd",
            transition: "color 0.2s",
          }}
        >
          Enviar
        </button>
      </div>
    );
  }

  // WhatsApp
  return (
    <div style={{ padding: "8px 12px", background: "#f0f2f5", borderTop: "1px solid #e2e8f0" }}>
      {!hasChannel && (
        <p style={{ fontSize: 12, color: "#ef4444", marginBottom: 6, textAlign: "center" }}>
          ⚠️ Nenhum canal configurado. Vá em Canais WhatsApp.
        </p>
      )}
      {mediaFile && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: "#fff", borderRadius: 8, padding: "6px 12px" }}>
          <span style={{ fontSize: 12, color: "#4b5563", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mediaFile.name}</span>
          <button onClick={onClearMedia} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input ref={fileInputRef} type="file" style={{ display: "none" }} accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={onFileSelect} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!hasChannel || uploading}
          style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", flexShrink: 0 }}
        >
          {uploading
            ? <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #e2e8f0", borderTopColor: "#64748b", animation: "spin 0.8s linear infinite" }} />
            : <Paperclip style={{ width: 18, height: 18 }} />}
        </button>

        {!mediaFile && (
          <AudioRecorder
            disabled={!hasChannel || sending}
            onSend={(mf) => {
              onFileSelect(null, mf);
            }}
          />
        )}

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
          placeholder={mediaFile ? "Legenda (opcional)..." : "Digite uma mensagem..."}
          disabled={!hasChannel || sending}
          style={{
            flex: 1, padding: "10px 16px", borderRadius: 24,
            border: "none", background: "#fff", fontSize: 13,
            outline: "none", color: "#1a202c", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        />
        <button
          onClick={onSend}
          disabled={(!value.trim() && !mediaFile) || !hasChannel || sending}
          style={{
            width: 40, height: 40, borderRadius: "50%", border: "none",
            background: "#25D366", color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: ((!value.trim() && !mediaFile) || !hasChannel || sending) ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          <Send style={{ width: 18, height: 18 }} />
        </button>
      </div>
    </div>
  );
}