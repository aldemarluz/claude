import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const event = body.event || '';
    const instanceName = body.instance;

    console.log('[evolutionWebhook] event:', event, 'instance:', instanceName);

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const evoHeaders = { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' };

    // ── CONNECTION UPDATE ──────────────────────────────────────────────────
    if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
      const state = body.data?.state || '';
      const wuid = body.data?.wuid || null; // número conectado: "5527999881234@s.whatsapp.net"
      const profileName = body.data?.profileName || null;

      const channels = await base44.asServiceRole.entities.WhatsAppChannel.filter({ instance_name: instanceName });
      if (channels.length > 0) {
        const ch = channels[0];
        const newStatus = state === 'open' ? 'conectado' : 'desconectado';
        const updates = {};
        if (ch.status !== newStatus) updates.status = newStatus;
        if (state === 'open' && wuid) {
          updates.phone_number = wuid.replace('@s.whatsapp.net', '');
        }
        if (state === 'open' && profileName && !ch.profile_name) {
          updates.profile_name = profileName;
        }
        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.WhatsAppChannel.update(ch.id, updates);
          console.log('[evolutionWebhook] channel updated:', updates);
        }
        // Trigger initial sync on first connection
        if (state === 'open' && !ch.synced) {
          console.log('[evolutionWebhook] triggering initial sync...');
          base44.asServiceRole.functions.invoke('syncWhatsAppContacts', { channel_id: ch.id }).catch(e => {
            console.error('[evolutionWebhook] sync trigger error:', e.message);
          });
        }
      }
      return Response.json({ ok: true });
    }

    // ── MESSAGES UPDATE (delivery/read receipts) ──────────────────────────
    if (event === 'messages.update' || event === 'MESSAGES_UPDATE') {
      const updates = Array.isArray(body.data) ? body.data : [body.data];
      for (const upd of updates) {
        const statusMap = { 2: 'enviado', 3: 'entregue', 4: 'lido' };
        const newStatus = statusMap[upd?.update?.status];
        if (!newStatus || !upd?.key?.id) continue;
        // Try to find messages by conversa to update status — best effort
        console.log('[evolutionWebhook] message status update:', upd.key.id, '->', newStatus);
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
    const isGroup = remoteJid.includes('@g.us');
    const phone = isGroup ? remoteJid : remoteJid.replace('@s.whatsapp.net', '');
    if (!phone) return Response.json({ ok: true, skipped: 'no_phone' });

    const fromMe = msgData.key?.fromMe || false;
    const timestamp = msgData.messageTimestamp
      ? new Date(msgData.messageTimestamp * 1000).toISOString()
      : new Date().toISOString();

    // Extract message content
    const msg = msgData.message || {};
    let conteudo = '';
    let media_url = null;
    let media_type = 'text';
    let file_name = null;

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

    // Find channel by instance name
    const channels = await base44.asServiceRole.entities.WhatsAppChannel.filter({ instance_name: instanceName });
    const canal_id = channels.length > 0 ? channels[0].id : null;
    const owner_email = channels.length > 0 ? (channels[0].owner_email || null) : null;
    const workspace_id = channels.length > 0 ? (channels[0].workspace_id || null) : null;

    const pushName = msgData.pushName || null;

    // For fromMe messages, "phone" is the remoteJid (the recipient)
    // Find or create contact
    const contactFilter = workspace_id
      ? { telefone: phone, workspace_id }
      : owner_email ? { telefone: phone, owner_email } : { telefone: phone };

    let contacts = await base44.asServiceRole.entities.WhatsAppContact.filter(contactFilter);
    let contact;

    if (contacts.length === 0) {
      const nome = pushName || phone;
      let profilePicUrl = null;
      if (!fromMe) {
        // Only fetch profile pic for inbound — for outbound we don't know the pic
        profilePicUrl = await fetchProfilePic(EVOLUTION_URL, evoHeaders, instanceName, phone);
      }

      contact = await base44.asServiceRole.entities.WhatsAppContact.create({
        nome,
        telefone: phone,
        owner_email,
        workspace_id,
        profile_picture_url: profilePicUrl,
        profile_pic_updated_at: profilePicUrl ? new Date().toISOString() : null,
        criado_em: new Date().toISOString(),
      });

      // Try to link to CRM contact by phone
      try {
        const crmFilter = workspace_id ? { phone, workspace_id } : { phone };
        const crmContacts = await base44.asServiceRole.entities.Contact.filter(crmFilter);
        if (crmContacts.length > 0) {
          await base44.asServiceRole.entities.WhatsAppContact.update(contact.id, { crm_contact_id: crmContacts[0].id });
          contact = { ...contact, crm_contact_id: crmContacts[0].id };
        }
      } catch (_) {}

    } else {
      contact = contacts[0];
      const updates = {};

      if (pushName && pushName !== contact.nome && !isGroup && !fromMe) updates.nome = pushName;

      // Refresh profile picture if older than 24h (only for inbound)
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

    // Find or create conversation
    const convFilter = workspace_id
      ? { contato_id: contact.id, workspace_id }
      : owner_email ? { contato_id: contact.id, owner_email } : { contato_id: contact.id };

    let convs = await base44.asServiceRole.entities.WhatsAppConversation.filter(convFilter);
    let conversa;

    if (convs.length === 0) {
      conversa = await base44.asServiceRole.entities.WhatsAppConversation.create({
        contato_id: contact.id,
        contato_nome: contact.nome,
        contato_telefone: phone,
        canal_id,
        owner_email,
        workspace_id,
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
      const updateData = {
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

    // Save message
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
      owner_email,
      workspace_id,
    });

    console.log('[evolutionWebhook] message saved from', phone, 'fromMe:', fromMe);

    // ── TRIGGER AUTOMATIONS (inbound only) ───────────────────────────────
    if (!fromMe) {
      const isFirstMessage = convs.length === 0; // conversation was just created
      base44.asServiceRole.functions.invoke('runAutomations', {
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
      }).catch(e => console.error('[evolutionWebhook] runAutomations error:', e.message));
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[evolutionWebhook] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper: fetch profile picture URL
async function fetchProfilePic(EVOLUTION_URL, headers, instanceName, phone) {
  try {
    const res = await fetch(`${EVOLUTION_URL}/chat/fetchProfilePictureUrl/${instanceName}`, {
      method: 'POST', headers,
      body: JSON.stringify({ number: phone }),
    });
    if (res.ok) {
      const data = await res.json();
      return data?.profilePictureUrl || data?.picture || null;
    }
  } catch (_) {}
  return null;
}

// Helper: download media from Evolution, upload to Base44 storage, return URL
async function downloadMedia(EVOLUTION_URL, headers, instanceName, msgData, base44Client) {
  try {
    const res = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: 'POST', headers,
      body: JSON.stringify({ message: { key: msgData.key, message: msgData.message } }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const base64 = data?.base64 || data?.media || null;
    const mime = data?.mimetype || 'application/octet-stream';
    if (!base64) return null;

    // Convert base64 to binary and upload
    const byteString = atob(base64);
    const byteArray = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) byteArray[i] = byteString.charCodeAt(i);
    const blob = new Blob([byteArray], { type: mime });
    const ext = mime.split('/')[1]?.split(';')[0] || 'bin';
    const file = new File([blob], `media_${Date.now()}.${ext}`, { type: mime });

    const uploadResult = await base44Client.asServiceRole.integrations.Core.UploadFile({ file });
    return uploadResult?.file_url || null;
  } catch (e) {
    console.error('[evolutionWebhook] downloadMedia error:', e.message);
    return null;
  }
}