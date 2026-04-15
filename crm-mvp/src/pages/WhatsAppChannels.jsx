import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { getWorkspaceId } from "@/lib/workspace";
import { Plus, Trash2, Wifi, WifiOff, QrCode, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function WhatsAppChannels() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [nome, setNome] = useState("");
  const [creating, setCreating] = useState(false);
  const [qrChannel, setQrChannel] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    load();
    return () => clearInterval(pollRef.current);
  }, []);

  async function load() {
    const workspaceId = await getWorkspaceId();
    const chs = workspaceId
      ? await base44.entities.WhatsAppChannel.filter({ workspace_id: workspaceId })
      : [];
    setChannels(chs);
    setLoading(false);
  }

  async function handleCreate() {
    if (!nome.trim()) { toast.error("Informe um nome para o canal"); return; }
    setCreating(true);
    try {
      const workspaceId = await getWorkspaceId();
      const res = await base44.functions.invoke("connectWhatsApp", { nome, workspace_id: workspaceId });
      const channel = res.data.channel;
      const initialQr = res.data.qr_code || null;
      setChannels((prev) => [...prev, channel]);
      setNome("");
      setShowNameDialog(false);
      toast.success("Instância criada! Escaneie o QR Code.");
      openQr(channel, initialQr);
    } catch (e) {
      toast.error("Erro ao criar canal: " + e.message);
    }
    setCreating(false);
  }

  function openQr(ch, initialQr = null) {
    clearInterval(pollRef.current);
    setQrChannel(ch);
    setQrCode(initialQr);
    setShowQrDialog(true);
    if (!initialQr) fetchQr(ch);
    pollRef.current = setInterval(() => fetchQr(ch), 5000);
  }

  async function fetchQr(ch) {
    setQrLoading(true);
    try {
      const statusRes = await base44.functions.invoke("getWhatsAppStatus", { channel_id: ch.id });
      const data = statusRes.data;

      if (data.connected) {
        clearInterval(pollRef.current);
        await base44.entities.WhatsAppChannel.update(ch.id, { status: "conectado" });
        setChannels((prev) => prev.map((c) => c.id === ch.id ? { ...c, status: "conectado" } : c));
        setShowQrDialog(false);
        toast.success("WhatsApp conectado com sucesso! 🎉");
        load();
        // Auto-mark onboarding step
        try {
          const me = await base44.auth.me();
          const list = await base44.entities.OnboardingProgress.filter({ user_id: me.id });
          if (list.length > 0 && !list[0].step_channel_connected) {
            await base44.entities.OnboardingProgress.update(list[0].id, { step_channel_connected: true });
          }
        } catch (_) {}
        return;
      }

      const connectRes = await base44.functions.invoke("connectWhatsApp", { channel_id: ch.id });
      if (connectRes.data?.qr_code) setQrCode(connectRes.data.qr_code);
    } catch (e) {
      console.error("[fetchQr] error:", e.message);
    } finally {
      setQrLoading(false);
    }
  }

  function closeQrDialog() {
    clearInterval(pollRef.current);
    setShowQrDialog(false);
    setQrChannel(null);
    setQrCode(null);
  }

  async function handleChangeNumber(ch) {
    if (!confirm("Isso vai deslogar o número atual e permitir conectar um novo. O histórico de conversas será mantido. Continuar?")) return;
    try {
      await base44.functions.invoke("disconnectWhatsApp", { channel_id: ch.id });
      setChannels((prev) => prev.map((c) => c.id === ch.id ? { ...c, status: "desconectado" } : c));
      toast.success("Desconectado. Escaneie o QR com o novo número.");
      openQr({ ...ch, status: "desconectado" });
    } catch (e) {
      toast.error("Erro ao trocar número: " + e.message);
    }
  }

  async function remove(id) {
    if (!confirm("Remover este canal?")) return;
    await base44.entities.WhatsAppChannel.delete(id);
    setChannels((prev) => prev.filter((c) => c.id !== id));
    toast.success("Canal removido");
  }

  async function syncChannel(ch) {
    toast.info("Sincronizando contatos e conversas...");
    try {
      await base44.entities.WhatsAppChannel.update(ch.id, { synced: false });
      const res = await base44.functions.invoke("syncWhatsAppContacts", { channel_id: ch.id });
      const d = res.data;
      if (d?.error) {
        toast.error("Erro no sync: " + d.error);
      } else if (d?.skipped) {
        toast.info("Sync já foi realizado anteriormente.");
      } else {
        toast.success(`Sincronizado! ${d?.contacts_synced || 0} contatos, ${d?.conversations_synced || 0} conversas, ${d?.messages_synced || 0} mensagens`);
      }
    } catch (e) {
      toast.error("Erro ao sincronizar: " + e.message);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Canais WhatsApp</h1>
          <p className="text-muted-foreground text-sm mt-1">Conecte seu WhatsApp escaneando o QR Code</p>
        </div>
        <Button onClick={() => setShowNameDialog(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Conectar WhatsApp
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : channels.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <WifiOff className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum canal conectado ainda</p>
          <p className="text-xs mt-1">Clique em "Conectar WhatsApp" para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map((ch) => (
            <div key={ch.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${ch.status === "conectado" ? "bg-emerald-100" : "bg-slate-100"}`}>
                {ch.status === "conectado"
                  ? <Wifi className="w-5 h-5 text-emerald-600" />
                  : <WifiOff className="w-5 h-5 text-slate-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{ch.nome}</p>
                <p className="text-xs text-slate-500 truncate">Instance: {ch.instance_id}</p>
              </div>
              <Badge className={`text-xs ${ch.status === "conectado" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                {ch.status}
              </Badge>
              {ch.status === "desconectado" ? (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => openQr(ch)}>
                  <QrCode className="w-3.5 h-3.5" /> QR Code
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => syncChannel(ch)}>
                    <Download className="w-3.5 h-3.5" /> Sincronizar
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => handleChangeNumber(ch)}>
                    <RefreshCw className="w-3.5 h-3.5" /> Trocar número
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => remove(ch.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome do Canal</Label>
              <Input
                placeholder="ex: Vendas, Suporte, Atendimento..."
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {creating ? "Criando instância..." : "Gerar QR Code"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQrDialog} onOpenChange={closeQrDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-600" />
              Escanear QR Code
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 pt-2">
            <p className="text-sm text-muted-foreground text-center">
              Abra o WhatsApp no seu celular → Dispositivos conectados → Conectar dispositivo
            </p>
            <div className="w-56 h-56 border-2 border-slate-200 rounded-xl flex items-center justify-center bg-slate-50">
              {qrCode ? (
                <img src={qrCode} alt="QR Code" className="w-52 h-52 rounded-lg" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <RefreshCw className={`w-8 h-8 ${qrLoading ? "animate-spin" : ""}`} />
                  <span className="text-xs">Carregando QR Code...</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Aguardando conexão...
            </div>
            <p className="text-xs text-slate-400 text-center">O QR Code atualiza automaticamente a cada 5 segundos</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}