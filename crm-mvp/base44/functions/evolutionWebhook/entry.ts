import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

// ── Constants ──────────────────────────────────────────────────────────────
const MAX_MEDIA_BYTES = 32 * 1024 * 1024; // 32 MB hard cap
const ALLOWED_MIME_PREFIXES = ['image/', 'audio/', 'video/', 'application/', 'text/'];
const PROFILE_PIC_REFRESH_HOURS = 24;

// ── Helpers ────────────────────────────────────────────────────────────────
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

/** Mask phone for safe logging — keeps country code + last 2 digits. */
const maskPhone = (p: unknown): string => {
  const s = String(p || '').replace(/\D/g, '');
  if (s.length < 6) return '***';
  return `${s.slice(0, 2)}***${s.slice(-2)}`;
};

async function verifyEvolutionSignature(req: Request, rawBody: string): Promise<boolean> {
  const sharedSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET');
  const staticToken = Deno.env.get('EVOLUTION_WEBHOOK_TOKEN');

  if (!sharedSecret && !staticToken) {
    console.error('[evolutionWebhook] Missing EVOLUTION_WEBHOOK_SECRET / EVOLUTION_WEBHOOK_TOKEN; rejecting.');
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

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const rawBody = await req.text();
    if (!await verifyEvolutionSignature(req, rawBody)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try { body = JSON.parse(rawBody); }
    catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const base44 = createClientFromRequest(req);
    const event = String(body.event || '').toLowerCase().replace(/_/g, '.');
    const instanceName = body.instance;
    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';
    const evoHeaders = { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' };

    // ── CONNECTION UPDATE ────────────────────────────────────────────────
    if (event === 'connection.update') {
      return await handleConnectionUpdate(base44, body, instanceName);
    }

    // ── MESSAGES UPDATE (delivery / read receipts) ───────────────────────
    if (event === 'messages.update') {
      return await handleMessagesUpdate(base44, body);
    }

    // ── MESSAGES UPSERT ──────────────────────────────────────────────────
    if (event !== 'messages.upsert') {
      return Response.json({ ok: true, skipped: event });
    }

    return await handleMessagesUpsert(base44, body, { EVOLUTION_URL, evoHeaders, instanceName });
  } catch (error) {
    console.error('[evolutionWebhook] Erro:', (error as Error).message);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
});

// ── Event: connection.update ───────────────────────────────────────────────
async function handleConnectionUpdate(base44: any, body: any, instanceName: string) {
  const state = body.data?.state || '';
  const wuid = body.data?.wuid || null;
  const profileName = body.data?.profileName || null;

  const channels = await base44.asServiceRole.entities.WhatsAppChannel.filter({ instance_name: instanceName });
  if (channels.length === 0) return Response.json({ ok: true, skipped: 'no_channel' });

  const ch = channels[0];
  const newStatus = state === 'open' ? 'conectado' : 'desconectado';
  const updates: Record<string, unknown> = {};
  if (ch.status !== newStatus) updates.status = newStatus;
  if (state === 'open' && wuid) updates.phone_number = String(wuid).replace('@s.whatsapp.net', '');
  if (state === 'open' && profileName && !ch.profile_name) updates.profile_name = profileName;
  if (Object.keys(updates).length > 0) {
    await base44.asServiceRole.entities.WhatsAppChannel.update(ch.id, updates);
  }
  if (state === 'open' && !ch.synced) {
    base44.asServiceRole.functions
      .invoke('syncWhatsAppContacts', { channel_id: ch.id })
      .catch((e: Error) => console.error('[evolutionWebhook] sync trigger error:', e.message));
  }
  return Response.json({ ok: true });
}

// ── Event: messages.update (delivery/read receipts) ────────────────────────
async function handleMessagesUpdate(base44: any, body: any) {
  const updates = Array.isArray(body.data) ? body.data : [body.data];
  // Evolution API v2 emits numeric codes in update.status (Baileys). v3+ may
  // emit string codes; accept both. Map to our canonical PT-BR vocabulary.
  const numericMap: Record<number, string> = { 2: 'enviado', 3: 'entregue', 4: 'lido' };
  const stringMap: Record<string, string> = {
    SERVER_ACK: 'enviado',
    DELIVERY_ACK: 'entregue',
    READ: 'lido',
    PLAYED: 'lido',
    PENDING: 'pending',
    ERROR: 'falhou',
  };

  for (const upd of updates) {
    const raw = upd?.update?.status ?? upd?.status;
    const newStatus = (typeof raw === 'number' ? numericMap[raw] : stringMap[String(raw || '').toUpperCase()]) || null;
    const id = upd?.key?.id || upd?.keyId || null;
    if (!newStatus || !id) continue;
    try {
      const msgs = await base44.asServiceRole.entities.WhatsAppMessage.filter({ message_id: id });
      for (const m of msgs) {
        if (m.status === newStatus) continue; // no-op if already at this state
        await base44.asServiceRole.entities.WhatsAppMessage.update(m.id, { status: newStatus });
        // Mirror to the conversation row so the inbox can show the latest.
        if (m.conversa_id) {
          await base44.asServiceRole.entities.WhatsAppConversation
            .update(m.conversa_id, { last_status: newStatus })
            .catch(() => null);
        }
      }
    } catch (err) {
      console.error('[evolutionWebhook] status update error:', (err as Error).message);
    }
  }
  return Response.json({ ok: true });
}

// ── Event: messages.upsert ─────────────────────────────────────────────────
async function handleMessagesUpsert(base44: any, body: any, ctx: { EVOLUTION_URL: string; evoHeaders: Record<string, string>; instanceName: string }) {
  const { EVOLUTION_URL, evoHeaders, instanceName } = ctx;
  const msgData = body.data;
  if (!msgData) return Response.json({ ok: true, skipped: 'no_data' });

  const remoteJid = String(msgData.key?.remoteJid || '');
  const isGroup = remoteJid.includes('@g.us');
  const externalId = isGroup ? remoteJid : remoteJid.replace('@s.whatsapp.net', '');
  if (!externalId) return Response.json({ ok: true, skipped: 'no_remote_jid' });

  // For 1-to-1 conversations, externalId is the contact's phone. For groups
  // it's the group JID — we use it as a stable key but never as a phone.
  const phone = isGroup ? null : externalId;

  const providerMessageId = msgData.key?.id || null;
  const fromMe = Boolean(msgData.key?.fromMe);
  const tsRaw = Number(msgData.messageTimestamp);
  const timestamp = Number.isFinite(tsRaw) && tsRaw > 0
    ? new Date(tsRaw * 1000).toISOString()
    : new Date().toISOString();

  // ── Idempotency: short-circuit if we've stored this provider id. ────────
  if (providerMessageId) {
    const existing = await base44.asServiceRole.entities.WhatsAppMessage.filter({ message_id: providerMessageId });
    if (existing.length > 0) return Response.json({ ok: true, deduped: true });
  }

  // ── Resolve tenant from the channel (single source of truth). ──────────
  const channels = await base44.asServiceRole.entities.WhatsAppChannel.filter({ instance_name: instanceName });
  if (channels.length === 0) {
    console.warn('[evolutionWebhook] Unknown instance:', instanceName);
    return Response.json({ ok: true, skipped: 'unknown_instance' });
  }
  const channel = channels[0];
  const canal_id = channel.id;
  const owner_email = channel.owner_email || null;
  const workspace_id = channel.workspace_id || null;

  if (!workspace_id && !owner_email) {
    console.error('[evolutionWebhook] Channel has no tenant; refusing write. instance=', instanceName);
    return Response.json({ ok: true, skipped: 'no_tenant' });
  }

  const tenantFilter: Record<string, string> = {};
  if (workspace_id) tenantFilter.workspace_id = workspace_id;
  if (owner_email) tenantFilter.owner_email = owner_email;

  // ── Extract content + download media safely. ───────────────────────────
  const extracted = await extractMessageContent(msgData.message || {}, { EVOLUTION_URL, evoHeaders, instanceName, msgData, base44 });
  const { conteudo, media_type, media_url, file_name, media_mime, media_size } = extracted;

  const pushName = msgData.pushName || null;
  const groupName = isGroup ? (msgData.pushName || externalId.split('-')[0]) : null;

  // ── Upsert WhatsAppContact (PT-BR). Race-tolerant: if a parallel webhook
  //    raced us to create one, keep the older row and fold into it.
  const contact = await upsertWhatsAppContact(base44, {
    tenantFilter, externalId, phone, isGroup, fromMe, pushName, groupName,
    EVOLUTION_URL, evoHeaders, instanceName,
  });

  // ── Mirror into the CRM Contact (only for 1-to-1 with a phone). ────────
  if (!isGroup && phone) {
    await mirrorToCRMContact(base44, { tenantFilter, workspace_id, owner_email, contact, phone, pushName });
  }

  // ── Upsert conversation (race-tolerant). ───────────────────────────────
  const { conversa, isFirstMessage } = await upsertConversation(base44, {
    tenantFilter, contact, canal_id, isGroup, conteudo, fromMe, externalId, phone,
  });

  // ── Save message (idempotent — we already deduped above). ──────────────
  await base44.asServiceRole.entities.WhatsAppMessage.create({
    conversa_id: conversa.id,
    contato_id: contact.id,
    contact_id: contact.crm_contact_id || null,
    channel_type: 'whatsapp',
    channel_id: canal_id,
    direcao: fromMe ? 'outbound' : 'inbound',
    conteudo,
    media_url,
    media_type,
    media_mime,
    media_size,
    file_name,
    timestamp,
    status: fromMe ? 'enviado' : 'entregue',
    message_id: providerMessageId,
    ...tenantFilter,
  });

  // ── Trigger automations on inbound only. ───────────────────────────────
  if (!fromMe) {
    base44.asServiceRole.functions
      .invoke('runAutomations', {
        workspace_id,
        owner_email,
        phone: phone || externalId,
        contact_name: contact.nome || null,
        message_text: conteudo,
        conversation_id: conversa.id,
        contact_id: contact.id,
        crm_contact_id: contact.crm_contact_id || null,
        is_first_message: isFirstMessage,
        is_group: isGroup,
        from_me: false,
        channel_id: canal_id,
        channel_type: 'whatsapp',
      })
      .catch((e: Error) => console.error('[evolutionWebhook] runAutomations error:', e.message));
  }

  return Response.json({ ok: true, phone: maskPhone(phone || externalId) });
}

// ── Content extraction (safe media download) ───────────────────────────────
async function extractMessageContent(msg: any, ctx: any): Promise<{ conteudo: string; media_type: string; media_url: string | null; file_name: string | null; media_mime: string | null; media_size: number | null }> {
  let conteudo = '';
  let media_url: string | null = null;
  let media_type = 'text';
  let file_name: string | null = null;
  let media_mime: string | null = null;
  let media_size: number | null = null;

  if (msg.conversation) {
    conteudo = msg.conversation;
  } else if (msg.extendedTextMessage) {
    conteudo = msg.extendedTextMessage.text || '';
  } else if (msg.imageMessage) {
    media_type = 'image';
    conteudo = msg.imageMessage.caption || '[Imagem]';
    media_mime = msg.imageMessage.mimetype || null;
    const dl = await downloadMedia(ctx);
    if (dl) { media_url = dl.url; media_mime = media_mime || dl.mime; media_size = dl.size; }
  } else if (msg.audioMessage || msg.pttMessage) {
    media_type = 'audio';
    conteudo = '[Áudio]';
    media_mime = (msg.audioMessage || msg.pttMessage)?.mimetype || null;
    const dl = await downloadMedia(ctx);
    if (dl) { media_url = dl.url; media_mime = media_mime || dl.mime; media_size = dl.size; }
  } else if (msg.videoMessage) {
    media_type = 'video';
    conteudo = msg.videoMessage.caption || '[Vídeo]';
    media_mime = msg.videoMessage.mimetype || null;
    const dl = await downloadMedia(ctx);
    if (dl) { media_url = dl.url; media_mime = media_mime || dl.mime; media_size = dl.size; }
  } else if (msg.documentMessage) {
    media_type = 'document';
    file_name = sanitizeFileName(msg.documentMessage.fileName) || 'arquivo';
    conteudo = file_name;
    media_mime = msg.documentMessage.mimetype || null;
    const dl = await downloadMedia(ctx);
    if (dl) { media_url = dl.url; media_mime = media_mime || dl.mime; media_size = dl.size; }
  } else if (msg.stickerMessage) {
    media_type = 'sticker';
    conteudo = '[Sticker]';
    media_mime = msg.stickerMessage.mimetype || null;
    const dl = await downloadMedia(ctx);
    if (dl) { media_url = dl.url; media_mime = media_mime || dl.mime; media_size = dl.size; }
  } else if (msg.locationMessage) {
    media_type = 'location';
    const lat = msg.locationMessage.degreesLatitude;
    const lng = msg.locationMessage.degreesLongitude;
    conteudo = msg.locationMessage.name || `📍 ${lat},${lng}`;
  } else {
    conteudo = '[Mensagem]';
  }

  return { conteudo, media_type, media_url, file_name, media_mime, media_size };
}

// ── Profile pic (safe) ─────────────────────────────────────────────────────
async function fetchProfilePic(EVOLUTION_URL: string, headers: Record<string, string>, instanceName: string, phone: string): Promise<string | null> {
  try {
    const res = await fetch(`${EVOLUTION_URL}/chat/fetchProfilePictureUrl/${instanceName}`, {
      method: 'POST', headers, body: JSON.stringify({ number: phone }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.profilePictureUrl || data?.picture || null;
  } catch { return null; }
}

// ── Download media: validate MIME + size, decode safely, upload to storage.
async function downloadMedia(ctx: any): Promise<{ url: string; mime: string; size: number } | null> {
  const { EVOLUTION_URL, evoHeaders, instanceName, msgData, base44 } = ctx;
  let res: Response;
  try {
    res = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: 'POST', headers: evoHeaders,
      body: JSON.stringify({ message: { key: msgData.key, message: msgData.message } }),
    });
  } catch (e) {
    console.error('[evolutionWebhook] media fetch failed:', (e as Error).message);
    return null;
  }
  if (!res.ok) {
    console.error('[evolutionWebhook] media endpoint returned', res.status);
    return null;
  }

  let data: any;
  try { data = await res.json(); }
  catch { console.error('[evolutionWebhook] media: invalid JSON response'); return null; }

  const base64 = data?.base64 || data?.media || null;
  const mimeRaw = String(data?.mimetype || 'application/octet-stream').toLowerCase();
  const mime = mimeRaw.split(';')[0].trim();
  if (!base64) return null;
  if (!ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p))) {
    console.warn('[evolutionWebhook] media: rejecting MIME', mime);
    return null;
  }

  // Decode + size check.
  let bytes: Uint8Array;
  try {
    const bin = atob(base64);
    if (bin.length > MAX_MEDIA_BYTES) {
      console.warn('[evolutionWebhook] media too large:', bin.length, 'bytes');
      return null;
    }
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch (e) {
    console.error('[evolutionWebhook] media: invalid base64:', (e as Error).message);
    return null;
  }

  // Pick a sane extension based on the validated MIME, not the raw payload.
  const ext = (mimeToExt(mime) || mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '');
  const blob = new Blob([bytes], { type: mime });
  const file = new File([blob], `media_${Date.now()}.${ext}`, { type: mime });

  try {
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    const url = uploadResult?.file_url || null;
    if (!url) return null;
    return { url, mime, size: bytes.length };
  } catch (e) {
    console.error('[evolutionWebhook] media upload failed:', (e as Error).message);
    return null;
  }
}

function mimeToExt(mime: string): string | null {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/webm': 'webm',
    'video/mp4': 'mp4', 'video/webm': 'webm',
    'application/pdf': 'pdf', 'application/zip': 'zip',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt',
  };
  return map[mime] || null;
}

function sanitizeFileName(name: unknown): string | null {
  if (!name) return null;
  // Strip path separators + control chars + leading dots.
  return String(name).replace(/[/\\\x00-\x1f]/g, '_').replace(/^\.+/, '').slice(0, 200) || null;
}

// ── Upsert WhatsAppContact (race-tolerant) ─────────────────────────────────
async function upsertWhatsAppContact(base44: any, args: {
  tenantFilter: Record<string, string>;
  externalId: string; phone: string | null; isGroup: boolean; fromMe: boolean;
  pushName: string | null; groupName: string | null;
  EVOLUTION_URL: string; evoHeaders: Record<string, string>; instanceName: string;
}) {
  const { tenantFilter, externalId, phone, isGroup, fromMe, pushName, groupName, EVOLUTION_URL, evoHeaders, instanceName } = args;

  const findKey = isGroup ? { group_jid: externalId } : { telefone: phone };
  const findFilter = { ...tenantFilter, ...findKey };
  let contacts = await base44.asServiceRole.entities.WhatsAppContact.filter(findFilter);

  if (contacts.length === 0) {
    const nome = isGroup
      ? (groupName || `Grupo ${externalId.slice(0, 8)}`)
      : (pushName || phone || '');

    let profilePicUrl: string | null = null;
    if (!fromMe && !isGroup && phone) {
      profilePicUrl = await fetchProfilePic(EVOLUTION_URL, evoHeaders, instanceName, phone);
    }

    try {
      const created = await base44.asServiceRole.entities.WhatsAppContact.create({
        nome,
        telefone: phone || externalId,
        ...tenantFilter,
        group_jid: isGroup ? externalId : null,
        is_group: isGroup,
        profile_picture_url: profilePicUrl,
        profile_pic_updated_at: profilePicUrl ? new Date().toISOString() : null,
        criado_em: new Date().toISOString(),
      });

      // Race resolution: if a parallel webhook already created the same row,
      // collapse onto the older one and delete the dupe we just created.
      const post = await base44.asServiceRole.entities.WhatsAppContact.filter(findFilter);
      if (post.length > 1) {
        const sorted = post.sort((a: any, b: any) => new Date(a.criado_em || 0).getTime() - new Date(b.criado_em || 0).getTime());
        const winner = sorted[0];
        for (const dupe of sorted.slice(1)) {
          if (dupe.id === winner.id) continue;
          await base44.asServiceRole.entities.WhatsAppContact.delete(dupe.id).catch(() => null);
        }
        return winner;
      }
      return created;
    } catch (err) {
      // Re-fetch on error in case another writer succeeded first.
      const post = await base44.asServiceRole.entities.WhatsAppContact.filter(findFilter);
      if (post.length > 0) return post[0];
      throw err;
    }
  }

  // Existing contact — refresh name + (optionally) profile pic.
  const contact = contacts[0];
  const updates: Record<string, unknown> = {};
  if (!isGroup && pushName && pushName !== contact.nome && !fromMe) updates.nome = pushName;
  if (isGroup && groupName && groupName !== contact.nome) updates.nome = groupName;

  if (!fromMe && !isGroup && phone) {
    const picAge = contact.profile_pic_updated_at
      ? (Date.now() - new Date(contact.profile_pic_updated_at).getTime()) / 3600000
      : 999;
    if (picAge > PROFILE_PIC_REFRESH_HOURS) {
      const newPic = await fetchProfilePic(EVOLUTION_URL, evoHeaders, instanceName, phone);
      if (newPic && newPic !== contact.profile_picture_url) {
        updates.profile_picture_url = newPic;
        updates.profile_pic_updated_at = new Date().toISOString();
      }
    }
  }
  if (Object.keys(updates).length > 0) {
    await base44.asServiceRole.entities.WhatsAppContact.update(contact.id, updates);
    return { ...contact, ...updates };
  }
  return contact;
}

// ── Mirror to CRM Contact ──────────────────────────────────────────────────
async function mirrorToCRMContact(base44: any, args: {
  tenantFilter: Record<string, string>;
  workspace_id: string | null; owner_email: string | null;
  contact: any; phone: string; pushName: string | null;
}) {
  const { workspace_id, contact, phone, pushName } = args;
  try {
    const accountFilter = workspace_id ? { account_id: workspace_id } : {};
    const existing = await base44.asServiceRole.entities.Contact.filter({ ...accountFilter, phone });

    if (existing.length > 0) {
      const c = existing[0];
      const updates: Record<string, unknown> = {};
      if (!c.whatsapp_id) updates.whatsapp_id = contact.id;
      if (!c.profile_picture_url && contact.profile_picture_url) updates.profile_picture_url = contact.profile_picture_url;
      if (!c.last_contact || new Date(c.last_contact) < new Date()) updates.last_contact = new Date().toISOString();
      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.Contact.update(c.id, updates);
      }
      // Backlink on WhatsApp side too.
      if (!contact.crm_contact_id) {
        await base44.asServiceRole.entities.WhatsAppContact.update(contact.id, { crm_contact_id: c.id }).catch(() => null);
        contact.crm_contact_id = c.id;
      }
    } else {
      const created = await base44.asServiceRole.entities.Contact.create({
        name: contact.nome || pushName || phone,
        phone,
        // No fake email: leave blank instead of `${phone}@whatsapp.local`.
        account_id: workspace_id || null,
        workspace_id: workspace_id || null,
        origin: 'WhatsApp',
        status: 'ativo',
        tags: ['whatsapp'],
        whatsapp_id: contact.id,
        profile_picture_url: contact.profile_picture_url || null,
        last_contact: new Date().toISOString(),
      });
      await base44.asServiceRole.entities.WhatsAppContact.update(contact.id, { crm_contact_id: created.id }).catch(() => null);
      contact.crm_contact_id = created.id;
    }
  } catch (err) {
    console.error('[evolutionWebhook] CRM mirror failed:', (err as Error).message);
  }
}

// ── Upsert WhatsAppConversation (race-tolerant) ────────────────────────────
async function upsertConversation(base44: any, args: {
  tenantFilter: Record<string, string>;
  contact: any; canal_id: string; isGroup: boolean; conteudo: string; fromMe: boolean;
  externalId: string; phone: string | null;
}) {
  const { tenantFilter, contact, canal_id, isGroup, conteudo, fromMe, phone } = args;

  const filter = { ...tenantFilter, contato_id: contact.id };
  let convs = await base44.asServiceRole.entities.WhatsAppConversation.filter(filter);

  if (convs.length === 0) {
    try {
      const created = await base44.asServiceRole.entities.WhatsAppConversation.create({
        contato_id: contact.id,
        contact_id: contact.crm_contact_id || null,
        contato_nome: contact.nome,
        contato_telefone: phone || contact.telefone,
        canal_id,
        channel_type: 'whatsapp',
        ...tenantFilter,
        ultima_mensagem: conteudo,
        last_message_at: new Date().toISOString(),
        last_direction: fromMe ? 'outbound' : 'inbound',
        last_status: fromMe ? 'enviado' : 'entregue',
        nao_lido: !fromMe,
        unread_count: fromMe ? 0 : 1,
        is_group: isGroup,
        profile_picture_url: contact.profile_picture_url || null,
        status: 'aberta',
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      });

      // Race fix: collapse duplicates onto the oldest.
      const post = await base44.asServiceRole.entities.WhatsAppConversation.filter(filter);
      if (post.length > 1) {
        const sorted = post.sort((a: any, b: any) => new Date(a.criado_em || 0).getTime() - new Date(b.criado_em || 0).getTime());
        const winner = sorted[0];
        for (const dupe of sorted.slice(1)) {
          if (dupe.id === winner.id) continue;
          await base44.asServiceRole.entities.WhatsAppConversation.delete(dupe.id).catch(() => null);
        }
        return { conversa: winner, isFirstMessage: true };
      }
      return { conversa: created, isFirstMessage: true };
    } catch (err) {
      const post = await base44.asServiceRole.entities.WhatsAppConversation.filter(filter);
      if (post.length > 0) return { conversa: post[0], isFirstMessage: false };
      throw err;
    }
  }

  const conversa = convs[0];
  const updateData: Record<string, unknown> = {
    ultima_mensagem: conteudo,
    last_message_at: new Date().toISOString(),
    last_direction: fromMe ? 'outbound' : 'inbound',
    atualizado_em: new Date().toISOString(),
  };
  if (!fromMe) {
    updateData.nao_lido = true;
    updateData.unread_count = (conversa.unread_count || 0) + 1;
    updateData.last_status = 'entregue';
  }
  if (contact.nome && contact.nome !== conversa.contato_nome) updateData.contato_nome = contact.nome;
  if (contact.profile_picture_url && !conversa.profile_picture_url) {
    updateData.profile_picture_url = contact.profile_picture_url;
  }
  if (contact.crm_contact_id && !conversa.contact_id) updateData.contact_id = contact.crm_contact_id;
  await base44.asServiceRole.entities.WhatsAppConversation.update(conversa.id, updateData);
  return { conversa: { ...conversa, ...updateData }, isFirstMessage: false };
}
