import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

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
 * Verify the webhook came from Evolution API.
 *
 * Evolution API commonly authenticates webhooks via a static API key header
 * (`apikey`) or a shared secret HMAC (`X-Hub-Signature-256` style). At least
 * one must be configured — otherwise we refuse the request.
 */
async function verifyEvolutionSignature(req: Request, rawBody: string): Promise<boolean> {
  const sharedSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET');
  const staticToken = Deno.env.get('EVOLUTION_WEBHOOK_TOKEN');

  if (!sharedSecret && !staticToken) {
    console.error('[evolutionWebhook] No EVOLUTION_WEBHOOK_SECRET or EVOLUTION_WEBHOOK_TOKEN configured; rejecting request.');
    return false;
  }

  if (staticToken) {
    const header = req.headers.get('apikey') || req.headers.get('authorization') || '';
    const provided = header.replace(/^Bearer\s+/i, '').trim();
    if (provided && timingSafeEqual(provided, staticToken)) return true;
  }

  if (sharedSecret) {
    const provided = (req.headers.get('x-hub-signature-256') || req.headers.get('x-signature') || '')
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
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const rawBody = await req.text();
    const authorized = await verifyEvolutionSignature(req, rawBody);
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
    const event = body.event || '';
    const instanceName = body.instance;

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const evoHeaders = { 'apikey': EVOLUTION_API_KEY || '', 'Content-Type': 'application/json' };

    // ── CONNECTION UPDATE ──────────────────────────────────────────────────
    if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
      const state = body.data?.state || '';
      const wuid = body.data?.wuid || null;
      const profileName = body.data?.profileName || null;

      const channels = await base44.asServiceRole.entities.WhatsAppChannel.filter({ instance_name: instanceName });
      if (channels.length > 0) {
        const ch = channels[0];
        const newStatus = state === 'open' ? 'conectado' : 'desconectado';
        const updates: Record<string, unknown> = {};
        if (ch.status !== newStatus) updates.status = newStatus;
        if (state === 'open' && wuid) {
          updates.phone_number = String(wuid).replace('@s.whatsapp.net', '');
        }
        if (state === 'open' && profileName && !ch.profile_name) {
          updates.profile_name = profileName;
        }
        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.WhatsAppChannel.update(ch.id, updates);
        }
        if (state === 'open' && !ch.synced) {
          base44.asServiceRole.functions
            .invoke('syncWhatsAppContacts', { channel_id: ch.id })
            .catch((e: Error) => console.error('[evolutionWebhook] sync trigger error:', e.message));
        }
      }
      return Response.json({ ok: true });
    }

    // ── MESSAGES UPDATE (delivery/read receipts) ──────────────────────────
    if (event === 'messages.update' || event === 'MESSAGES_UPDATE') {
      const updates = Array.isArray(body.data) ? body.data : [body.data];
      for (const upd of updates) {
        const statusMap: Record<number, string> = { 2: 'enviado', 3: 'entregue', 4: 'lido' };
        const newStatus = statusMap[upd?.update?.status];
        if (!newStatus || !upd?.key?.id) continue;
        // Best-effort: update our WhatsAppMessage by provider message_id.
        try {
          const msgs = await base44.asServiceRole.entities.WhatsAppMessage.filter({ message_id: upd.key.id });
          for (const m of msgs) {
            await base44.asServiceRole.entities.WhatsAppMessage.update(m.id, { status: newStatus });
          }
        } catch (err) {
          console.error('[evolutionWebhook] update status error:', (err as Error).message);
        }
      }
      return Response.json({ ok: true });
    }

    // ── MESSAGES UPSERT ───────────────────────────────────────────────────
    if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') {
      return Response.json({ ok: true, skipped: true });
    }

    const msgData = body.data;
    if (!msgData) return Response.json({ ok: true, skipped: 'no_data' });

    const remoteJid = msgData.key?.remoteJid || '';
    const isGroup = String(remoteJid).includes('@g.us');
    const phone = isGroup ? remoteJid : String(remoteJid).replace('@s.whatsapp.net', '');
    if (!phone) return Response.json({ ok: true, skipped: 'no_phone' });

    const providerMessageId = msgData.key?.id || null;
    const fromMe = msgData.key?.fromMe || false;
    const tsRaw = Number(msgData.messageTimestamp);
    const timestamp = Number.isFinite(tsRaw) && tsRaw > 0
      ? new Date(tsRaw * 1000).toISOString()
      : new Date().toISOString();

    // Idempotency.
    if (providerMessageId) {
      const existing = await base44.asServiceRole.entities.WhatsAppMessage.filter({ message_id: providerMessageId });
      if (existing.length > 0) {
        return Response.json({ ok: true, deduped: true });
      }
    }

    // Extract message content.
    const msg = msgData.message || {};
    let conteudo = '';
    let media_url: string | null = null;
    let media_type = 'text';
    let file_name: string | null = null;

    if (msg.conversation) {
      conteudo = msg.conversation;
    } else if (msg.extendedTextMessage) {
      conteudo = msg.extendedTextMessage.text || '';
    } else if (msg.imageMessage) {
      media_type = 'image';
      conteudo = msg.imageMessage.caption || '[Imagem]';
      media_url = await downloadMedia(EVOLUTION_URL, evoHeaders, instanceName, msgData, base44);
    } else if (msg.audioMessage || msg.pttMessage) {
      media_type = 'audio';
      conteudo = '[Áudio]';
      media_url = await downloadMedia(EVOLUTION_URL, evoHeaders, instanceName, msgData, base44);
    } else if (msg.videoMessage) {
      media_type = 'video';
      conteudo = msg.videoMessage.caption || '[Vídeo]';
      media_url = await downloadMedia(EVOLUTION_URL, evoHeaders, instanceName, msgData, base44);
    } else if (msg.documentMessage) {
      media_type = 'document';
      file_name = msg.documentMessage.fileName || 'arquivo';
      conteudo = file_name;
      media_url = await downloadMedia(EVOLUTION_URL, evoHeaders, instanceName, msgData, base44);
    } else if (msg.stickerMessage) {
      media_type = 'image';
      conteudo = '[Sticker]';
      media_url = await downloadMedia(EVOLUTION_URL, evoHeaders, instanceName, msgData, base44);
    } else {
      conteudo = '[Mensagem]';
    }

    // Find channel by instance name — this is our source of tenancy.
    const channels = await base44.asServiceRole.entities.WhatsAppChannel.filter({ instance_name: instanceName });
    const canal_id = channels.length > 0 ? channels[0].id : null;
    const owner_email = channels.length > 0 ? (channels[0].owner_email || null) : null;
    const workspace_id = channels.length > 0 ? (channels[0].workspace_id || null) : null;

    // Require at least some tenant context to avoid cross-tenant leaks.
    if (!workspace_id && !owner_email) {
      console.error('[evolutionWebhook] Refusing to write: no workspace_id/owner_email for instance', instanceName);
      return Response.json({ ok: true, skipped: 'no_tenant' });
    }

    const tenantFilter: Record<string, string> = {};
    if (workspace_id) tenantFilter.workspace_id = workspace_id;
    if (owner_email) tenantFilter.owner_email = owner_email;

    const pushName = msgData.pushName || null;

    // Find or create contact.
    let contacts = await base44.asServiceRole.entities.WhatsAppContact.filter({
      ...tenantFilter,
      telefone: phone,
    });
    let contact;

    if (contacts.length === 0) {
      const nome = pushName || phone;
      let profilePicUrl: string | null = null;
      if (!fromMe) {
        profilePicUrl = await fetchProfilePic(EVOLUTION_URL, evoHeaders, instanceName, phone);
      }

      contact = await base44.asServiceRole.entities.WhatsAppContact.create({
        nome,
        telefone: phone,
        ...tenantFilter,
        profile_picture_url: profilePicUrl,
        profile_pic_updated_at: profilePicUrl ? new Date().toISOString() : null,
        criado_em: new Date().toISOString(),
      });

      try {
        const crmContacts = await base44.asServiceRole.entities.Contact.filter({
          ...(workspace_id ? { account_id: workspace_id } : {}),
          phone,
        });
        if (crmContacts.length > 0) {
          await base44.asServiceRole.entities.WhatsAppContact.update(contact.id, { crm_contact_id: crmContacts[0].id });
          contact = { ...contact, crm_contact_id: crmContacts[0].id };
        }
      } catch (err) {
        console.error('[evolutionWebhook] CRM link failed:', (err as Error).message);
      }
    } else {
      contact = contacts[0];
      const updates: Record<string, unknown> = {};

      if (pushName && pushName !== contact.nome && !isGroup && !fromMe) updates.nome = pushName;

      if (!fromMe) {
        const picAge = contact.profile_pic_updated_at
          ? (Date.now() - new Date(contact.profile_pic_updated_at).getTime()) / 3600000
          : 999;
        if (picAge > 24) {
          const newPic = await fetchProfilePic(EVOLUTION_URL, evoHeaders, instanceName, phone);
          if (newPic) {
            updates.profile_picture_url = newPic;
            updates.profile_pic_updated_at = new Date().toISOString();
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.WhatsAppContact.update(contact.id, updates);
        contact = { ...contact, ...updates };
      }
    }

    // Find or create conversation.
    let convs = await base44.asServiceRole.entities.WhatsAppConversation.filter({
      ...tenantFilter,
      contato_id: contact.id,
    });
    let conversa;

    if (convs.length === 0) {
      conversa = await base44.asServiceRole.entities.WhatsAppConversation.create({
        contato_id: contact.id,
        contato_nome: contact.nome,
        contato_telefone: phone,
        canal_id,
        ...tenantFilter,
        ultima_mensagem: conteudo,
        nao_lido: !fromMe,
        unread_count: fromMe ? 0 : 1,
        is_group: isGroup,
        profile_picture_url: contact.profile_picture_url || null,
        status: 'aberta',
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      });
    } else {
      conversa = convs[0];
      const updateData: Record<string, unknown> = {
        ultima_mensagem: conteudo,
        atualizado_em: new Date().toISOString(),
      };
      if (!fromMe) {
        updateData.nao_lido = true;
        updateData.unread_count = (conversa.unread_count || 0) + 1;
      }
      if (contact.nome && contact.nome !== conversa.contato_nome) updateData.contato_nome = contact.nome;
      if (contact.profile_picture_url && !conversa.profile_picture_url) {
        updateData.profile_picture_url = contact.profile_picture_url;
      }
      await base44.asServiceRole.entities.WhatsAppConversation.update(conversa.id, updateData);
    }

    // Save message.
    await base44.asServiceRole.entities.WhatsAppMessage.create({
      conversa_id: conversa.id,
      contato_id: contact.id,
      direcao: fromMe ? 'outbound' : 'inbound',
      conteudo,
      media_url,
      media_type,
      file_name,
      timestamp,
      status: fromMe ? 'enviado' : 'entregue',
      message_id: providerMessageId,
      ...tenantFilter,
    });

    // ── TRIGGER AUTOMATIONS (inbound only) ───────────────────────────────
    if (!fromMe) {
      const isFirstMessage = convs.length === 0;
      base44.asServiceRole.functions
        .invoke('runAutomations', {
          workspace_id,
          owner_email,
          phone,
          contact_name: contact.nome || null,
          message_text: conteudo,
          conversation_id: conversa.id,
          contact_id: contact.id,
          is_first_message: isFirstMessage,
          from_me: false,
          channel_id: canal_id,
        })
        .catch((e: Error) => console.error('[evolutionWebhook] runAutomations error:', e.message));
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[evolutionWebhook] Erro:', (error as Error).message);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
});

// Helper: fetch profile picture URL
async function fetchProfilePic(EVOLUTION_URL: string, headers: Record<string, string>, instanceName: string, phone: string): Promise<string | null> {
  try {
    const res = await fetch(`${EVOLUTION_URL}/chat/fetchProfilePictureUrl/${instanceName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ number: phone }),
    });
    if (res.ok) {
      const data = await res.json();
      return data?.profilePictureUrl || data?.picture || null;
    }
  } catch (_) { /* ignore */ }
  return null;
}

// Helper: download media from Evolution, upload to Base44 storage, return URL
async function downloadMedia(
  EVOLUTION_URL: string,
  headers: Record<string, string>,
  instanceName: string,
  msgData: any,
  base44Client: any,
): Promise<string | null> {
  try {
    const res = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: { key: msgData.key, message: msgData.message } }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const base64 = data?.base64 || data?.media || null;
    const mime = data?.mimetype || 'application/octet-stream';
    if (!base64) return null;

    const byteString = atob(base64);
    const byteArray = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) byteArray[i] = byteString.charCodeAt(i);
    const blob = new Blob([byteArray], { type: mime });
    const ext = mime.split('/')[1]?.split(';')[0] || 'bin';
    const file = new File([blob], `media_${Date.now()}.${ext}`, { type: mime });

    const uploadResult = await base44Client.asServiceRole.integrations.Core.UploadFile({ file });
    return uploadResult?.file_url || null;
  } catch (e) {
    console.error('[evolutionWebhook] downloadMedia error:', (e as Error).message);
    return null;
  }
}
