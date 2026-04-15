import { useState, useRef, useEffect } from "react";
import { Mic, Square, Send, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

// Pick the first MIME type the browser supports. WhatsApp playback is
// best with audio/ogg;codecs=opus (PTT format) — Evolution converts as
// needed but we send the closest match available.
const PREFERRED_MIME_TYPES = [
  "audio/ogg;codecs=opus",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/webm",
];

function pickMimeType() {
  if (typeof window === "undefined" || !("MediaRecorder" in window)) return null;
  for (const type of PREFERRED_MIME_TYPES) {
    if (window.MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return null;
}

function extFor(mime) {
  if (!mime) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("webm")) return "webm";
  return "bin";
}

const MAX_DURATION_SECONDS = 5 * 60; // 5 min cap to avoid huge uploads

export default function AudioRecorder({ onSend, disabled }) {
  const [state, setState] = useState("idle"); // idle | recording | preview
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
  }, [audioUrl]);

  async function startRecording() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Seu navegador não suporta gravação de áudio");
      return;
    }
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const mr = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const type = mr.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setState("preview");
      };

      mr.start();
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_DURATION_SECONDS) stopRecording();
          return next;
        });
      }, 1000);
    } catch (err) {
      console.error("AudioRecorder start failed:", err);
      toast.error(err?.name === "NotAllowedError"
        ? "Permissão de microfone negada"
        : "Não foi possível iniciar a gravação");
      setState("idle");
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    try {
      mediaRecorderRef.current?.stop();
    } catch (err) {
      console.error("AudioRecorder stop failed:", err);
    }
  }

  function discard() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioBlob(null);
    setSeconds(0);
    setState("idle");
  }

  async function send() {
    if (!audioBlob) return;
    setUploading(true);
    try {
      const mimeType = audioBlob.type || "audio/webm";
      const ext = extFor(mimeType);
      const file = new File([audioBlob], `audio.${ext}`, { type: mimeType });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (!file_url) throw new Error("Upload sem URL");
      onSend({ url: file_url, type: "audio", name: `audio.${ext}`, mime: mimeType });
      discard();
    } catch (err) {
      console.error("AudioRecorder send failed:", err);
      toast.error("Não foi possível enviar o áudio.");
    } finally {
      setUploading(false);
    }
  }

  function fmt(s) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  if (state === "preview") {
    return (
      <div className="flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow-sm flex-1">
        <button
          onClick={discard}
          aria-label="Descartar gravação"
          className="text-red-400 hover:text-red-600 shrink-0"
        >
          <Trash2 className="w-5 h-5" />
        </button>
        <audio src={audioUrl} controls className="h-8 flex-1 min-w-0" />
        <button
          onClick={send}
          disabled={uploading || disabled}
          aria-label="Enviar áudio"
          className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white shrink-0 disabled:opacity-50"
        >
          {uploading
            ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <Send className="w-4 h-4" />
          }
        </button>
      </div>
    );
  }

  if (state === "recording") {
    return (
      <div className="flex items-center gap-3 bg-white rounded-full px-4 py-2 shadow-sm flex-1">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
        <span className="text-sm font-mono text-slate-700 flex-1" aria-live="polite">{fmt(seconds)}</span>
        <button
          onClick={stopRecording}
          aria-label="Parar gravação"
          className="w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shrink-0"
        >
          <Square className="w-4 h-4 fill-white" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      aria-label="Gravar áudio"
      className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-500 hover:text-emerald-600 shadow-sm shrink-0 disabled:opacity-40"
      title="Gravar áudio"
    >
      <Mic className="w-5 h-5" />
    </button>
  );
}
