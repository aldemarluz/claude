import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { channel_id } = body;

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!channel_id) return Response.json({ error: 'channel_id obrigatório' }, { status: 400 });

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const headers = { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY };

    const channels = await base44.asServiceRole.entities.WhatsAppChannel.filter({ id: channel_id });
    if (channels.length === 0) return Response.json({ error: 'Canal não encontrado' }, { status: 404 });

    const ch = channels[0];
    const instanceName = ch.instance_name || ch.instance_id;

    // Logout from Evolution API (forces disconnection so a new number can be scanned)
    try {
      await fetch(`${EVOLUTION_URL}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers,
      });
      console.log('[disconnectWhatsApp] logout sent for', instanceName);
    } catch (e) {
      console.error('[disconnectWhatsApp] logout error:', e.message);
    }

    // Update status in DB
    await base44.asServiceRole.entities.WhatsAppChannel.update(ch.id, { status: 'desconectado' });

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[disconnectWhatsApp] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});