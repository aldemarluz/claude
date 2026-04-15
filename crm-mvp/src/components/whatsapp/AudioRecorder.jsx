import { useState, useRef, useEffect } from "react";
import { Mic, Square, Send, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function AudioRecorder({ onSend, disabled }) {
  const [state, setState] = useState("idle"); // idle | recording | preview
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function startRecording() {
    chunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      setState("preview");
    };

    mr.start();
    setState("recording");
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
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
    // Use mp4 extension so Evolution API / WhatsApp can handle it
    const mimeType = audioBlob.type || 'audio/webm';
    const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([audioBlob], `audio.${ext}`, { type: mimeType });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploading(false);
    discard();
    onSend({ url: file_url, type: 'audio', name: `audio.${ext}` });
  }

  function fmt(s) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  if (state === "preview") {
    return (
      <div className="flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow-sm flex-1">
        <button onClick={discard} className="text-red-400 hover:text-red-600 shrink-0">
          <Trash2 className="w-5 h-5" />
        </button>
        <audio src={audioUrl} controls className="h-8 flex-1 min-w-0" />
        <button
          onClick={send}
          disabled={uploading || disabled}
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
        <span className="text-sm font-mono text-slate-700 flex-1">{fmt(seconds)}</span>
        <button
          onClick={stopRecording}
          className="w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shrink-0"
        >
          <Square className="w-4 h-4 fill-white" />
        </button>
      </div>
    );
  }

  // idle
  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-500 hover:text-emerald-600 shadow-sm shrink-0 disabled:opacity-40"
      title="Gravar áudio"
    >
      <Mic className="w-5 h-5" />
    </button>
  );
}