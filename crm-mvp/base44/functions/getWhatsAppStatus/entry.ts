import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { channel_id } = await req.json();
    if (!channel_id) return Response.json({ error: 'channel_id é obrigatório' }, { status: 400 });

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const headers = { 'apikey': EVOLUTION_API_KEY };

    const channels = await base44.asServiceRole.entities.WhatsAppChannel.filter({ id: channel_id });
    if (channels.length === 0) return Response.json({ error: 'Canal não encontrado' }, { status: 404 });
    const ch = channels[0];

    const stateRes = await fetch(`${EVOLUTION_URL}/instance/connectionState/${ch.instance_name}`, { headers });
    const stateData = await stateRes.json();
    console.log('[getWhatsAppStatus]', ch.instance_name, JSON.stringify(stateData));

    const state = stateData.instance?.state || stateData.state || '';
    const connected = state === 'open';

    if (connected && ch.status !== 'conectado') {
      await base44.asServiceRole.entities.WhatsAppChannel.update(channel_id, { status: 'conectado' });
    }

    return Response.json({ connected, state });
  } catch (error) {
    console.error('[getWhatsAppStatus] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});