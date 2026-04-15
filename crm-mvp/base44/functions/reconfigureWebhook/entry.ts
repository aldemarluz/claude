import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { channel_id } = await req.json();

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const APP_ID = Deno.env.get('BASE44_APP_ID');

    const headers = { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY };

    const channels = await base44.asServiceRole.entities.WhatsAppChannel.filter({ id: channel_id });
    if (channels.length === 0) return Response.json({ error: 'Canal não encontrado' }, { status: 404 });
    const ch = channels[0];

    const webhookUrl = `${req.headers.get('origin') || 'https://api.base44.com'}/api/apps/${APP_ID}/functions/evolutionWebhook`;

    console.log('[reconfigureWebhook] instance:', ch.instance_name, 'webhook:', webhookUrl);

    // Reconfigure webhook
    const webhookRes = await fetch(`${EVOLUTION_URL}/webhook/set/${ch.instance_name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: false,
          events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
        },
      }),
    });
    const webhookData = await webhookRes.json();
    console.log('[reconfigureWebhook] webhook set response:', JSON.stringify(webhookData));

    // Also check current webhook config
    const checkRes = await fetch(`${EVOLUTION_URL}/webhook/find/${ch.instance_name}`, { headers });
    const checkData = await checkRes.json();
    console.log('[reconfigureWebhook] current webhook config:', JSON.stringify(checkData));

    return Response.json({ ok: true, webhook_set: webhookData, current_config: checkData, webhook_url: webhookUrl });
  } catch (error) {
    console.error('[reconfigureWebhook] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});