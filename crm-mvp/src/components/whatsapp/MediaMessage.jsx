import { FileText, Play, Download } from "lucide-react";

export default function MediaMessage({ msg }) {
  const { media_type, media_url, conteudo, file_name } = msg;

  if (!media_type || media_type === "text") {
    return <p className="text-sm text-slate-800 whitespace-pre-wrap">{conteudo}</p>;
  }

  if (media_type === "image") {
    return (
      <div className="space-y-1">
        <img
          src={media_url}
          alt="imagem"
          className="rounded-lg max-w-[260px] max-h-[260px] object-cover cursor-pointer"
          onClick={() => window.open(media_url, "_blank")}
        />
        {conteudo && <p className="text-sm text-slate-700">{conteudo}</p>}
      </div>
    );
  }

  if (media_type === "audio") {
    return (
      <audio controls className="max-w-[260px] h-10">
        <source src={media_url} />
      </audio>
    );
  }

  if (media_type === "video") {
    return (
      <div className="space-y-1">
        <video controls className="rounded-lg max-w-[260px] max-h-[200px]">
          <source src={media_url} />
        </video>
        {conteudo && <p className="text-sm text-slate-700">{conteudo}</p>}
      </div>
    );
  }

  if (media_type === "document") {
    return (
      <a
        href={media_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2 hover:bg-white/90 transition-colors max-w-[240px]"
      >
        <FileText className="w-5 h-5 text-blue-500 shrink-0" />
        <span className="text-sm text-slate-700 truncate">{file_name || conteudo || "Documento"}</span>
        <Download className="w-4 h-4 text-slate-400 shrink-0 ml-auto" />
      </a>
    );
  }

  return <p className="text-sm text-slate-800 whitespace-pre-wrap">{conteudo}</p>;
}