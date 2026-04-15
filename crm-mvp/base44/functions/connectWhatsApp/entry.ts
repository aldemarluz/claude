import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

const slugify = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { nome, channel_id, workspace_id } = await req.json();

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const APP_ID = Deno.env.get('BASE44_APP_ID');
    // Prefer a fixed env-supplied URL for the webhook target so an attacker
    // can't redirect Evolution to their own listener via the Origin header.
    const WEBHOOK_BASE_URL = (Deno.env.get('WEBHOOK_BASE_URL') || '').replace(/\/$/, '');

    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
      return Response.json({ error: 'EVOLUTION_URL ou EVOLUTION_API_KEY não configurados' }, { status: 500 });
    }
    if (!APP_ID) return Response.json({ error: 'BASE44_APP_ID não configurado' }, { status: 500 });

    const headers = { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY };

    // ── Reconnect flow: just re-issue the QR for an existing channel. ────
    if (channel_id) {
      const channels = await base44.asServiceRole.entities.WhatsAppChannel.filter({ id: channel_id });
      if (channels.length === 0) return Response.json({ error: 'Canal não encontrado' }, { status: 404 });
      const ch = channels[0];

      // Authorize: only the channel owner can reconnect.
      if (ch.owner_email && ch.owner_email !== user.email) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const connectRes = await fetch(`${EVOLUTION_URL}/instance/connect/${ch.instance_name}`, { headers });
      if (!connectRes.ok) {
        return Response.json({ error: 'Falha ao reconectar instância', status: connectRes.status }, { status: 502 });
      }
      const connectData = await connectRes.json().catch(() => ({} as any));
      const qrCode = connectData?.base64 || connectData?.qrcode?.base64 || null;
      return Response.json({ ok: true, qr_code: qrCode, channel: ch });
    }

    // ── New instance flow. ───────────────────────────────────────────────
    const slug = slugify(user.full_name || user.email || user.id) || 'user';
    const instanceName = `crmflow_${slug.slice(0, 12)}_${Date.now()}`;

    if (!WEBHOOK_BASE_URL) {
      return Response.json({
        error: 'WEBHOOK_BASE_URL não configurado. Defina a variável de ambiente para o domínio público do app.',
      }, { status: 500 });
    }
    const webhookUrl = `${WEBHOOK_BASE_URL}/api/apps/${APP_ID}/functions/evolutionWebhook`;

    const createRes = await fetch(`${EVOLUTION_URL}/instance/create`, {
      method: 'POST', headers,
      body: JSON.stringify({ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
    });
    if (!createRes.ok) {
      return Response.json({ error: 'Falha ao criar instância', status: createRes.status }, { status: 502 });
    }
    const createData = await createRes.json().catch(() => ({} as any));

    // Configure webhook + push the shared secret as `apikey` header so the
    // webhook handler can authenticate inbound calls.
    const webhookRes = await fetch(`${EVOLUTION_URL}/webhook/set/${instanceName}`, {
      method: 'POST', headers,
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: false,
          events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
          headers: Deno.env.get('EVOLUTION_WEBHOOK_TOKEN')
            ? { apikey: Deno.env.get('EVOLUTION_WEBHOOK_TOKEN') }
            : undefined,
        },
      }),
    }).catch(() => null);
    if (!webhookRes || !webhookRes.ok) {
      console.warn('[connectWhatsApp] webhook configuration may have failed');
    }

    // Persist the channel WITHOUT the API key. The token field used to hold
    // EVOLUTION_API_KEY in plaintext — we now read it from env at call time.
    const channel = await base44.asServiceRole.entities.WhatsAppChannel.create({
      nome: nome || instanceName,
      instance_id: instanceName,
      instance_name: instanceName,
      auth_mode: 'env',
      status: 'desconectado',
      owner_email: user.email,
      workspace_id: workspace_id || null,
    });

    const qrCode = createData?.qrcode?.base64 || createData?.base64 || null;
    return Response.json({ ok: true, qr_code: qrCode, channel });
  } catch (error) {
    console.error('[connectWhatsApp] Erro:', (error as Error).message);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
});
