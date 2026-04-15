import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { nome, channel_id, workspace_id } = await req.json();

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const APP_ID = Deno.env.get('BASE44_APP_ID');

    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
     return Response.json({ error: 'EVOLUTION_URL ou EVOLUTION_API_KEY não configurados' }, { status: 500 });
    }

    const headers = {
     'Content-Type': 'application/json',
     'apikey': EVOLUTION_API_KEY,
    };

    // Se channel_id foi passado, é uma reconexão — só busca o QR
    if (channel_id) {
     const channels = await base44.asServiceRole.entities.WhatsAppChannel.filter({ id: channel_id });
     if (channels.length === 0) return Response.json({ error: 'Canal não encontrado' }, { status: 404 });
     const ch = channels[0];

     const connectRes = await fetch(`${EVOLUTION_URL}/instance/connect/${ch.instance_name}`, { headers });
     const connectData = await connectRes.json();
     console.log('[connectWhatsApp] reconnect response:', JSON.stringify(connectData));

     return Response.json({ ok: true, qr_code: connectData.base64 || connectData.qrcode?.base64 || null, channel: ch });
    }

    // Nova instância
    const instanceName = `crmflow_${user.id.replace(/-/g,'').slice(0,8)}_${Date.now()}`;
    // Get webhook URL from request origin to support both preview and production domains
    const webhookUrl = `${req.headers.get('origin') || 'https://api.base44.com'}/api/apps/${APP_ID}/functions/evolutionWebhook`;

    // Criar instância
    const createRes = await fetch(`${EVOLUTION_URL}/instance/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    });
    const createData = await createRes.json();
    console.log('[connectWhatsApp] create response:', JSON.stringify(createData));

    if (!createRes.ok) {
      return Response.json({ error: 'Falha ao criar instância', details: createData }, { status: 502 });
    }

    // Configurar webhook (Evolution v2 format)
    await fetch(`${EVOLUTION_URL}/webhook/set/${instanceName}`, {
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

    // Salvar canal no banco
    const channel = await base44.asServiceRole.entities.WhatsAppChannel.create({
      nome: nome || instanceName,
      instance_id: instanceName,
      instance_name: instanceName,
      token: EVOLUTION_API_KEY,
      status: 'desconectado',
      owner_email: user.email,
      workspace_id: workspace_id || null,
    });

    const qrCode = createData.qrcode?.base64 || createData.base64 || null;
    return Response.json({ ok: true, qr_code: qrCode, channel });
  } catch (error) {
    console.error('[connectWhatsApp] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});