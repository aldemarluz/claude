import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { conversation_id, mensagem, media_url, media_type, file_name } = await req.json();
    if (!conversation_id) return Response.json({ error: 'conversation_id é obrigatório' }, { status: 400 });

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
      return Response.json({ error: 'Evolution API not configured' }, { status: 500 });
    }

    const conversas = await base44.asServiceRole.entities.WhatsAppConversation.filter({ id: conversation_id });
    if (conversas.length === 0) return Response.json({ error: 'Conversa não encontrada' }, { status: 404 });
    const conversa = conversas[0];

    // Authorize: only the workspace owner OR the owner_email on the conversation
    // can send messages on it. This prevents one user from sending on another
    // tenant's conversation just by guessing the id.
    let isAuthorized = false;
    if (conversa.owner_email && conversa.owner_email === user.email) {
      isAuthorized = true;
    } else if (conversa.workspace_id) {
      const accounts = await base44.asServiceRole.entities.Account.filter({ id: conversa.workspace_id });
      if (accounts.length > 0 && accounts[0].owner_email === user.email) {
        isAuthorized = true;
      }
    } else if (!conversa.workspace_id && !conversa.owner_email) {
      // Legacy data without tenancy — allow only if the user owns a channel that
      // was previously used for this conversation.
      const ownedChannels = await base44.asServiceRole.entities.WhatsAppChannel.filter({ owner_email: user.email });
      if (ownedChannels.length > 0 && conversa.canal_id && ownedChannels.some((c: any) => c.id === conversa.canal_id)) {
        isAuthorized = true;
      }
    }
    if (!isAuthorized) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find a connected channel scoped to the tenant.
    let canais: any[] = [];
    if (conversa.canal_id) {
      canais = await base44.asServiceRole.entities.WhatsAppChannel.filter({ id: conversa.canal_id, status: 'conectado' });
    }
    if (canais.length === 0 && conversa.workspace_id) {
      canais = await base44.asServiceRole.entities.WhatsAppChannel.filter({ status: 'conectado', workspace_id: conversa.workspace_id });
    }
    if (canais.length === 0) {
      canais = await base44.asServiceRole.entities.WhatsAppChannel.filter({ status: 'conectado', owner_email: user.email });
    }
    if (canais.length === 0) return Response.json({ error: 'Nenhum canal WhatsApp conectado' }, { status: 404 });
    const canal = canais[0];

    const instanceName = canal.instance_name || canal.instance_id;
    const headers = { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY };

    // Verify connection is really open before sending.
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
        // If we can't even reach the status endpoint, refuse to send blind.
        return Response.json({ error: 'WhatsApp indisponível. Tente novamente.' }, { status: 503 });
      }
    } catch (err) {
      console.error('[sendWhatsApp] state check failed:', (err as Error).message);
      return Response.json({ error: 'WhatsApp indisponível. Tente novamente.' }, { status: 503 });
    }

    const phone = String(conversa.contato_telefone || '').replace(/\D/g, '');
    if (!phone) return Response.json({ error: 'Número de telefone inválido na conversa' }, { status: 400 });
    const tipo = media_type || 'text';

    let evoRes;
    if (media_url && tipo !== 'text') {
      evoRes = await fetch(`${EVOLUTION_URL}/message/sendMedia/${instanceName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          number: phone,
          mediatype: tipo,
          media: media_url,
          caption: mensagem || '',
          fileName: file_name || '',
        }),
      });
    } else {
      if (!mensagem || !String(mensagem).trim()) {
        return Response.json({ error: 'Mensagem vazia' }, { status: 400 });
      }
      evoRes = await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ number: phone, text: mensagem }),
      });
    }

    const evoData = await evoRes.json().catch(() => ({}));
    if (!evoRes.ok) return Response.json({ error: 'Falha Evolution API', details: evoData }, { status: 502 });

    const providerMessageId = evoData?.key?.id || evoData?.messageId || null;

    const msg = await base44.asServiceRole.entities.WhatsAppMessage.create({
      conversa_id: conversation_id,
      contato_id: conversa.contato_id,
      direcao: 'outbound',
      conteudo: mensagem || file_name || '',
      media_url: media_url || null,
      media_type: tipo,
      file_name: file_name || null,
      timestamp: new Date().toISOString(),
      status: 'enviado',
      message_id: providerMessageId,
      owner_email: user.email,
      workspace_id: conversa.workspace_id || null,
    });

    await base44.asServiceRole.entities.WhatsAppConversation.update(conversation_id, {
      ultima_mensagem: mensagem || `[${tipo}]`,
      nao_lido: false,
      atualizado_em: new Date().toISOString(),
    });

    return Response.json({ ok: true, message_id: msg.id });
  } catch (error) {
    console.error('[sendWhatsApp] Erro:', (error as Error).message);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
});
