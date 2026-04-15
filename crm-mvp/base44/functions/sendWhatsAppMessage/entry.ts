import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { conversation_id, mensagem, media_url, media_type, file_name } = await req.json();
    if (!conversation_id) return Response.json({ error: 'conversation_id é obrigatório' }, { status: 400 });

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    const conversas = await base44.asServiceRole.entities.WhatsAppConversation.filter({ id: conversation_id });
    if (conversas.length === 0) return Response.json({ error: 'Conversa não encontrada' }, { status: 404 });
    const conversa = conversas[0];

    // Find channel: first try by canal_id in the conversation, then by workspace, then by owner
    let canais = [];
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

    // Verify connection is really open before sending
    const stateRes = await fetch(`${EVOLUTION_URL}/instance/connectionState/${instanceName}`, { headers });
    if (stateRes.ok) {
      const stateData = await stateRes.json();
      const realState = stateData?.instance?.state || stateData?.state || '';
      if (realState !== 'open') {
        // Update channel status in DB to reflect real state
        await base44.asServiceRole.entities.WhatsAppChannel.update(canal.id, { status: 'desconectado' });
        return Response.json({ error: 'WhatsApp desconectado. Reconecte o canal.' }, { status: 409 });
      }
    }

    const phone = (conversa.contato_telefone || '').replace(/\D/g, ''); // Remove +, espaços, parênteses
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
      evoRes = await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ number: phone, text: mensagem }),
      });
    }

    const evoData = await evoRes.json();
    console.log('[sendWhatsApp] Evolution response:', JSON.stringify(evoData));
    if (!evoRes.ok) return Response.json({ error: 'Falha Evolution API', details: evoData }, { status: 502 });

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
    console.error('[sendWhatsApp] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});