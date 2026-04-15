import { useState } from "react";
import { FileText, Download, ImageOff, AudioLines } from "lucide-react";

/**
 * Renders WhatsApp / channel media. Media URLs from the Base44 storage are
 * signed and can return 403 once expired, so we degrade gracefully instead
 * of showing a broken icon.
 *
 * Accepts both PT (conteudo / media_type) and EN (content / media_type)
 * field names so it works for the legacy WhatsAppMessage and the generic
 * Message entity without a wrapper.
 */
export default function MediaMessage({ msg }) {
  const media_type = msg.media_type || "text";
  const media_url = msg.media_url || null;
  const conteudo = msg.conteudo ?? msg.content ?? "";
  const file_name = msg.file_name || msg.fileName || null;
  const media_mime = msg.media_mime || msg.mediaMime || null;

  if (!media_type || media_type === "text" || media_type === "location") {
    return <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{conteudo}</p>;
  }

  if (!media_url) {
    return <BrokenMedia label="Mídia indisponível" caption={conteudo} />;
  }

  if (media_type === "image" || media_type === "sticker") {
    return <ImageBubble src={media_url} caption={conteudo} />;
  }

  if (media_type === "audio") {
    return <AudioBubble src={media_url} mime={media_mime} />;
  }

  if (media_type === "video") {
    return <VideoBubble src={media_url} caption={conteudo} mime={media_mime} />;
  }

  if (media_type === "document") {
    return <DocumentBubble href={media_url} fileName={file_name || conteudo || "Documento"} />;
  }

  return <p className="text-sm text-slate-800 whitespace-pre-wrap">{conteudo}</p>;
}

function BrokenMedia({ label, caption }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 text-slate-500 text-xs">
        <ImageOff className="w-4 h-4" />
        <span>{label}</span>
      </div>
      {caption && <p className="text-sm text-slate-700">{caption}</p>}
    </div>
  );
}

function ImageBubble({ src, caption }) {
  const [errored, setErrored] = useState(false);
  if (errored) return <BrokenMedia label="Imagem expirada" caption={caption} />;
  return (
    <div className="space-y-1">
      <img
        src={src}
        alt={caption || "imagem"}
        className="rounded-lg max-w-[260px] max-h-[260px] object-cover cursor-pointer"
        onClick={() => window.open(src, "_blank", "noopener,noreferrer")}
        onError={() => setErrored(true)}
      />
      {caption && <p className="text-sm text-slate-700">{caption}</p>}
    </div>
  );
}

function AudioBubble({ src, mime }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 max-w-[260px]">
        <AudioLines className="w-4 h-4 text-slate-400" />
        <a href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
          Baixar áudio
        </a>
      </div>
    );
  }
  return (
    <audio
      controls
      preload="metadata"
      className="max-w-[260px] h-10"
      onError={() => setErrored(true)}
    >
      <source src={src} type={mime || undefined} />
      <a href={src}>Baixar áudio</a>
    </audio>
  );
}

function VideoBubble({ src, caption, mime }) {
  const [errored, setErrored] = useState(false);
  if (errored) return <BrokenMedia label="Vídeo expirado" caption={caption} />;
  return (
    <div className="space-y-1">
      <video
        controls
        preload="metadata"
        className="rounded-lg max-w-[260px] max-h-[200px]"
        onError={() => setErrored(true)}
      >
        <source src={src} type={mime || undefined} />
        <a href={src}>Baixar vídeo</a>
      </video>
      {caption && <p className="text-sm text-slate-700">{caption}</p>}
    </div>
  );
}

function DocumentBubble({ href, fileName }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={fileName}
      className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2 hover:bg-white/90 transition-colors max-w-[240px]"
    >
      <FileText className="w-5 h-5 text-blue-500 shrink-0" />
      <span className="text-sm text-slate-700 truncate">{fileName}</span>
      <Download className="w-4 h-4 text-slate-400 shrink-0 ml-auto" />
    </a>
  );
}
