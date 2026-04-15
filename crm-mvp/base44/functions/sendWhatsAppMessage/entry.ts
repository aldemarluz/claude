import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

// Retry transient errors (network / 429 / 5xx) with exponential backoff.
const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!RETRY_STATUSES.has(res.status)) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) { lastErr = e; }
    if (attempt < MAX_ATTEMPTS) {
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetch failed');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { conversation_id, mensagem, media_url, media_type, file_name, is_automated, automation_rule_id } = await req.json();
    if (!conversation_id) return Response.json({ error: 'conversation_id é obrigatório' }, { status: 400 });

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
      return Response.json({ error: 'Evolution API not configured' }, { status: 500 });
    }

    // ── Load conversation. ───────────────────────────────────────────────
    const conversas = await base44.asServiceRole.entities.WhatsAppConversation.filter({ id: conversation_id });
    if (conversas.length === 0) return Response.json({ error: 'Conversa não encontrada' }, { status: 404 });
    const conversa = conversas[0];

    // ── Authorize: caller must own the conversation's tenant. ────────────
    let isAuthorized = false;
    if (is_automated) {
      // Calls coming from runAutomations bypass the user check (server-to-server).
      isAuthorized = true;
    } else if (conversa.owner_email && conversa.owner_email === user.email) {
      isAuthorized = true;
    } else if (conversa.workspace_id) {
      const accounts = await base44.asServiceRole.entities.Account.filter({ id: conversa.workspace_id });
      if (accounts.length > 0 && accounts[0].owner_email === user.email) isAuthorized = true;
    } else if (!conversa.workspace_id && !conversa.owner_email && conversa.canal_id) {
      const ownedChannels = await base44.asServiceRole.entities.WhatsAppChannel.filter({ id: conversa.canal_id, owner_email: user.email });
      if (ownedChannels.length > 0) isAuthorized = true;
    }
    if (!isAuthorized) return Response.json({ error: 'Forbidden' }, { status: 403 });

    // ── Find a connected channel STRICTLY scoped to this conversation. ──
    let canal: any | null = null;
    if (conversa.canal_id) {
      const direct = await base44.asServiceRole.entities.WhatsAppChannel.filter({ id: conversa.canal_id });
      if (direct.length > 0) {
        // Verify the channel still belongs to the conversation's tenant.
        const ch = direct[0];
        const tenantOk =
          (conversa.workspace_id && ch.workspace_id === conversa.workspace_id) ||
          (conversa.owner_email && ch.owner_email === conversa.owner_email) ||
          (!conversa.workspace_id && !conversa.owner_email);
        if (tenantOk && ch.status === 'conectado') canal = ch;
      }
    }
    if (!canal && conversa.workspace_id) {
      const list = await base44.asServiceRole.entities.WhatsAppChannel.filter({ status: 'conectado', workspace_id: conversa.workspace_id });
      if (list.length > 0) canal = list[0];
    }
    if (!canal && conversa.owner_email) {
      const list = await base44.asServiceRole.entities.WhatsAppChannel.filter({ status: 'conectado', owner_email: conversa.owner_email });
      if (list.length > 0) canal = list[0];
    }
    if (!canal) return Response.json({ error: 'Nenhum canal WhatsApp conectado para esta conversa' }, { status: 404 });

    const instanceName = canal.instance_name || canal.instance_id;
    const headers = { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY };

    // ── Verify the instance is really connected. ─────────────────────────
    try {
      const stateRes = await fetch(`${EVOLUTION_URL}/instance/connectionState/${instanceName}`, { headers });
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        const realState = stateData?.instance?.state || stateData?.state || '';
        if (realState !== 'open') {
          await base44.asServiceRole.entities.WhatsAppChannel.update(canal.id, { status: 'desconectado' });
          return Response.json({ error: 'WhatsApp desconectado. Reconecte o canal.' }, { status: 409 });
        }
      } else {
        return Response.json({ error: 'WhatsApp indisponível. Tente novamente.' }, { status: 503 });
      }
    } catch (err) {
      console.error('[sendWhatsApp] state check failed:', (err as Error).message);
      return Response.json({ error: 'WhatsApp indisponível. Tente novamente.' }, { status: 503 });
    }

    const phone = String(conversa.contato_telefone || '').replace(/\D/g, '');
    if (!phone) return Response.json({ error: 'Número de telefone inválido na conversa' }, { status: 400 });

    const tipo = media_type || 'text';
    const trimmedMessage = typeof mensagem === 'string' ? mensagem : null;

    if (tipo === 'text' && (!trimmedMessage || !trimmedMessage.trim())) {
      return Response.json({ error: 'Mensagem vazia' }, { status: 400 });
    }
    if (tipo !== 'text' && !media_url) {
      return Response.json({ error: 'media_url obrigatório para mensagens de mídia' }, { status: 400 });
    }

    // ── Pre-create the WhatsAppMessage in 'pending' so the UI shows a row
    //    before the provider replies. We update its status after. ────────
    const localMessage = await base44.asServiceRole.entities.WhatsAppMessage.create({
      conversa_id: conversation_id,
      contato_id: conversa.contato_id,
      contact_id: conversa.contact_id || null,
      channel_type: 'whatsapp',
      channel_id: canal.id,
      direcao: 'outbound',
      conteudo: trimmedMessage || file_name || '',
      media_url: media_url || null,
      media_type: tipo,
      file_name: file_name || null,
      timestamp: new Date().toISOString(),
      status: 'pending',
      owner_email: conversa.owner_email || user.email,
      workspace_id: conversa.workspace_id || null,
      is_automated: Boolean(is_automated),
      automation_rule_id: automation_rule_id || null,
    });

    // ── Call Evolution with retry. ───────────────────────────────────────
    let evoRes: Response;
    try {
      if (media_url && tipo !== 'text') {
        evoRes = await fetchWithRetry(`${EVOLUTION_URL}/message/sendMedia/${instanceName}`, {
          method: 'POST', headers,
          body: JSON.stringify({
            number: phone,
            mediatype: tipo === 'sticker' ? 'image' : tipo,
            media: media_url,
            caption: trimmedMessage || '',
            fileName: file_name || '',
          }),
        });
      } else {
        evoRes = await fetchWithRetry(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
          method: 'POST', headers,
          body: JSON.stringify({ number: phone, text: trimmedMessage }),
        });
      }
    } catch (err) {
      const errMsg = (err as Error).message || 'network error';
      await base44.asServiceRole.entities.WhatsAppMessage.update(localMessage.id, {
        status: 'falhou', error: errMsg,
      });
      await base44.asServiceRole.entities.WhatsAppConversation.update(conversation_id, { last_status: 'failed' }).catch(() => null);
      return Response.json({ error: 'Falha de rede ao enviar', details: errMsg }, { status: 502 });
    }

    const evoData = await evoRes.json().catch(() => ({} as any));
    if (!evoRes.ok) {
      const errMsg = evoData?.message || evoData?.error || `HTTP ${evoRes.status}`;
      await base44.asServiceRole.entities.WhatsAppMessage.update(localMessage.id, {
        status: 'falhou', error: String(errMsg).slice(0, 500),
      });
      await base44.asServiceRole.entities.WhatsAppConversation.update(conversation_id, { last_status: 'failed' }).catch(() => null);
      return Response.json({ error: 'Falha Evolution API', status: evoRes.status }, { status: 502 });
    }

    const providerMessageId = evoData?.key?.id || evoData?.messageId || null;
    await base44.asServiceRole.entities.WhatsAppMessage.update(localMessage.id, {
      status: 'enviado',
      message_id: providerMessageId,
    });

    await base44.asServiceRole.entities.WhatsAppConversation.update(conversation_id, {
      ultima_mensagem: trimmedMessage || `[${tipo}]`,
      last_message_at: new Date().toISOString(),
      last_direction: 'outbound',
      last_status: 'sent',
      nao_lido: false,
      atualizado_em: new Date().toISOString(),
    });

    return Response.json({ ok: true, message_id: localMessage.id, provider_message_id: providerMessageId, status: 'enviado' });
  } catch (error) {
    console.error('[sendWhatsApp] Erro:', (error as Error).message);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
});
