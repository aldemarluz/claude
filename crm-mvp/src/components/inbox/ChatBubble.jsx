import moment from "moment";
import MediaMessage from "@/components/whatsapp/MediaMessage";

export default function ChatBubble({ msg, channel, config }) {
  const isSent = msg.direcao === "outbound" || msg.dir === "sent" || msg.direction === "sent";

  // Email: render as card for received emails
  if (channel === "email" && !isSent && msg.subject) {
    return (
      <div style={{ maxWidth: "85%", margin: "8px auto", width: "100%", padding: "0 16px" }}>
        <div style={{
          background: config.receivedBubble,
          borderRadius: 12, padding: 20,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a202c", marginBottom: 4 }}>{msg.subject}</div>
          <div style={{ fontSize: 11, color: "#a0aec0", marginBottom: 12 }}>Recebido</div>
          <div style={{ fontSize: 13, color: config.receivedText, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {msg.conteudo || msg.content || msg.text || ""}
          </div>
          <div style={{ fontSize: 10, color: config.timeColor, marginTop: 8, textAlign: "right" }}>
            {msg.timestamp ? moment(msg.timestamp).format("HH:mm") : msg.time || ""}
          </div>
        </div>
      </div>
    );
  }

  const text = msg.conteudo || msg.content || msg.text || "";
  const time = msg.timestamp ? moment(msg.timestamp).format("HH:mm") : msg.time || "";
  const hasMedia = msg.media_url || msg.media_type === "audio" || msg.media_type === "image" || msg.media_type === "video" || msg.media_type === "document";

  return (
    <div style={{ display: "flex", justifyContent: isSent ? "flex-end" : "flex-start", padding: "3px 16px" }}>
      <div style={{
        maxWidth: "70%", padding: hasMedia ? "6px" : "8px 12px",
        borderRadius: isSent ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
        background: typeof (isSent ? config.sentBubble : config.receivedBubble) === "string" &&
          (isSent ? config.sentBubble : config.receivedBubble).includes("gradient")
          ? undefined : (isSent ? config.sentBubble : config.receivedBubble),
        backgroundImage: typeof (isSent ? config.sentBubble : config.receivedBubble) === "string" &&
          (isSent ? config.sentBubble : config.receivedBubble).includes("gradient")
          ? (isSent ? config.sentBubble : config.receivedBubble) : undefined,
        color: isSent ? config.sentText : config.receivedText,
        fontSize: 13, lineHeight: 1.5,
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
      }}>
        {hasMedia ? (
          <MediaMessage msg={msg} />
        ) : (
          <span style={{ whiteSpace: "pre-wrap" }}>{text}</span>
        )}
        <div style={{
          fontSize: 10, marginTop: 4, textAlign: "right",
          color: isSent ? (config.sentText === "#ffffff" ? "rgba(255,255,255,0.7)" : config.timeColor) : config.timeColor,
          display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4,
        }}>
          {time}
          {isSent && <span>✓✓</span>}
        </div>
      </div>
    </div>
  );
}