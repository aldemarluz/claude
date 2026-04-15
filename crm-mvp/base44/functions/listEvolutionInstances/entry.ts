import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const APP_ID = Deno.env.get('BASE44_APP_ID');
    const headers = { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' };

    // List all instances
    const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, { headers });
    const instances = await res.json();
    console.log('[listEvolutionInstances] raw:', JSON.stringify(instances).slice(0, 2000));

    // For each instance, check state and set webhook
    const results = [];
    for (const inst of (Array.isArray(instances) ? instances : [])) {
      console.log('[inst keys]', Object.keys(inst), JSON.stringify(inst).slice(0, 300));
      const name = inst.instance?.instanceName || inst.instanceName || inst.name;
      const state = inst.instance?.state || inst.connectionStatus || inst.state || 'unknown';

      // Set/update webhook for all instances
      const webhookUrl = `https://api.base44.com/api/apps/${APP_ID}/functions/evolutionWebhook`;
      const whRes = await fetch(`${EVOLUTION_URL}/webhook/set/${name}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: false,
            events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
          },
        }),
      });
      const whData = await whRes.json().catch(() => ({}));

      results.push({ name, state, webhook_set: whRes.ok, webhook_response: whData });
    }

    return Response.json({ ok: true, instances: results });
  } catch (error) {
    console.error('[listEvolutionInstances] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});