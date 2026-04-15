import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Timing-safe string comparison.
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

// Compute HMAC-SHA256 hex digest.
async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify the webhook came from Z-API.
 *
 * Z-API supports a shared secret via header (`ZAPI_WEBHOOK_SECRET`) or an
 * HMAC signature (`X-Signature`). Any of the two succeeding is enough. If
 * neither is configured we fall back to requiring a token header with
 * `ZAPI_WEBHOOK_TOKEN` — and refuse the request when no env var is set at all,
 * to avoid unauthenticated access by default.
 */
async function verifyZapiSignature(req: Request, rawBody: string): Promise<boolean> {
  const sharedSecret = Deno.env.get('ZAPI_WEBHOOK_SECRET');
  const staticToken = Deno.env.get('ZAPI_WEBHOOK_TOKEN');

  if (!sharedSecret && !staticToken) {
    // Fail closed: operators MUST configure at least one.
    console.error('[zapiWebhook] No ZAPI_WEBHOOK_SECRET or ZAPI_WEBHOOK_TOKEN configured; rejecting request.');
    return false;
  }

  // Static token header (simplest mode Z-API supports).
  if (staticToken) {
    const header = req.headers.get('x-zapi-token') || req.headers.get('authorization') || '';
    const provided = header.replace(/^Bearer\s+/i, '').trim();
    if (provided && timingSafeEqual(provided, staticToken)) return true;
  }

  // HMAC signature header.
  if (sharedSecret) {
    const provided = (req.headers.get('x-signature') || req.headers.get('x-hub-signature-256') || '')
      .replace(/^sha256=/i, '')
      .trim();
    if (provided) {
      const expected = await hmacSha256Hex(sharedSecret, rawBody);
      if (timingSafeEqual(provided.toLowerCase(), expected.toLowerCase())) return true;
    }
  }

  return false;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    // Read the body ONCE as text so we can both verify the signature and parse JSON.
    const rawBody = await req.text();
    const authorized = await verifyZapiSignature(req, rawBody);
    if (!authorized) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    const isMessage = body.type === 'ReceivedCallback' || body.type === 'received';
    if (!isMessage) {
      return Response.json({ ok: true, skipped: true });
    }

    const telefone = String(body.phone || '').replace(/\D/g, '');
    const nomeWA = body.pushName || body.senderName || telefone;
    const ts = Number(body.timestamp);
    const timestamp = Number.isFinite(ts) && ts > 0
      ? new Date(ts * 1000).toISOString()
      : new Date().toISOString();
    const providerMessageId = body.messageId || body.id || null;

    // Detect media type and extract url/content.
    let conteudo = '';
    let media_url: string | null = null;
    let media_type = 'text';
    let file_name: string | null = null;

    if (body.image) {
      media_type = 'image';
      media_url = body.image.imageUrl || body.image.url || null;
      conteudo = body.image.caption || '';
    } else if (body.audio) {
      media_type = 'audio';
      media_url = body.audio.audioUrl || body.audio.url || null;
      conteudo = '[Áudio]';
    } else if (body.video) {
      media_type = 'video';
      media_url = body.video.videoUrl || body.video.url || null;
      conteudo = body.video.caption || '[Vídeo]';
    } else if (body.document) {
      media_type = 'document';
      media_url = body.document.documentUrl || body.document.url || null;
      file_name = body.document.fileName || body.document.title || 'documento';
      conteudo = file_name;
    } else if (body.sticker) {
      media_type = 'image';
      media_url = body.sticker.stickerUrl || body.sticker.url || null;
      conteudo = '[Sticker]';
    } else {
      media_type = 'text';
      conteudo = body.text?.message || body.body || body.message || '';
    }

    if (!telefone || (!conteudo && !media_url)) {
      return Response.json({ ok: true, skipped: true, reason: 'no phone or content' });
    }

    // Idempotency: if we already stored this provider message_id, stop.
    if (providerMessageId) {
      const existing = await base44.asServiceRole.entities.WhatsAppMessage.filter({ message_id: providerMessageId });
      if (existing.length > 0) {
        return Response.json({ ok: true, deduped: true });
      }
    }

    // Best-effort CRM name lookup.
    let nomeFromCRM: string | null = null;
    try {
      const leads = await base44.asServiceRole.entities.Lead.filter({ phone: telefone });
      if (leads.length > 0) nomeFromCRM = leads[0].name;
      if (!nomeFromCRM) {
        const contacts = await base44.asServiceRole.entities.Contact.filter({ phone: telefone });
        if (contacts.length > 0) nomeFromCRM = contacts[0].name;
      }
    } catch (err) {
      console.error('[zapiWebhook] CRM lookup failed:', (err as Error).message);
    }

    const nome = nomeFromCRM || nomeWA;

    // Z-API doesn't send a workspace_id natively; if the webhook URL carries
    // one as a query parameter, scope everything to it. Otherwise we stay in a
    // single-tenant mode where the tenant must be inferred elsewhere.
    const url = new URL(req.url);
    const workspace_id = url.searchParams.get('workspace_id') || null;
    const owner_email = url.searchParams.get('owner_email') || null;
    const tenantFilter: Record<string, string> = {};
    if (workspace_id) tenantFilter.workspace_id = workspace_id;
    if (owner_email) tenantFilter.owner_email = owner_email;

    // Find or create contact — ALWAYS scope by tenant when we have one.
    const contatos = await base44.asServiceRole.entities.WhatsAppContact.filter({
      ...tenantFilter,
      telefone,
    });
    let contato;
    if (contatos.length > 0) {
      contato = contatos[0];
      const melhorNome = nomeFromCRM || (nomeWA !== telefone ? nomeWA : contato.nome);
      if (melhorNome && contato.nome !== melhorNome) {
        await base44.asServiceRole.entities.WhatsAppContact.update(contato.id, { nome: melhorNome });
        contato = { ...contato, nome: melhorNome };
      }
    } else {
      contato = await base44.asServiceRole.entities.WhatsAppContact.create({
        nome,
        telefone,
        ...tenantFilter,
        criado_em: new Date().toISOString(),
      });
    }

    // Find or create open conversation.
    let todasConversas = await base44.asServiceRole.entities.WhatsAppConversation.filter({
      ...tenantFilter,
      contato_id: contato.id,
      status: 'aberta',
    });
    let conversa;
    if (todasConversas.length > 0) {
      conversa = todasConversas[0];
      if (conversa.contato_nome !== contato.nome) {
        await base44.asServiceRole.entities.WhatsAppConversation.update(conversa.id, {
          contato_nome: contato.nome,
          contato_id: contato.id,
        });
        conversa = { ...conversa, contato_nome: contato.nome };
      }
    } else {
      conversa = await base44.asServiceRole.entities.WhatsAppConversation.create({
        contato_id: contato.id,
        contato_nome: contato.nome,
        contato_telefone: contato.telefone,
        ...tenantFilter,
        ultima_mensagem: conteudo || `[${media_type}]`,
        nao_lido: true,
        status: 'aberta',
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      });
    }

    // Save message.
    await base44.asServiceRole.entities.WhatsAppMessage.create({
      conversa_id: conversa.id,
      contato_id: contato.id,
      direcao: 'inbound',
      conteudo,
      media_url,
      media_type,
      file_name,
      timestamp,
      status: 'entregue',
      message_id: providerMessageId,
      ...tenantFilter,
    });

    await base44.asServiceRole.entities.WhatsAppConversation.update(conversa.id, {
      ultima_mensagem: conteudo || `[${media_type}]`,
      nao_lido: true,
      atualizado_em: new Date().toISOString(),
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[zapiWebhook] Erro:', (error as Error).message);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
});
