import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { channel_id } = body;

    if (!channel_id) return Response.json({ error: 'channel_id required' }, { status: 400 });

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const headers = { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' };

    const channels = await base44.asServiceRole.entities.WhatsAppChannel.filter({ id: channel_id });
    const ch = channels[0];
    if (!ch) return Response.json({ error: 'Channel not found' }, { status: 404 });
    if (ch.status !== 'conectado') return Response.json({ error: 'Channel not connected' }, { status: 400 });
    if (ch.synced === true) return Response.json({ ok: true, skipped: 'already_synced' });

    const instanceName = ch.instance_name;
    const owner_email = ch.owner_email || null;
    const workspace_id = ch.workspace_id || null;

    // Fetch chats from Evolution
    let chats = [];
    const chatsRes = await fetch(`${EVOLUTION_URL}/chat/findChats/${instanceName}`, {
      method: 'POST', headers, body: JSON.stringify({}),
    });
    if (chatsRes.ok) {
      const data = await chatsRes.json();
      chats = Array.isArray(data) ? data : [];
    }

    // Filter only real phone numbers and groups (skip @lid internal IDs)
    const validChats = chats
      .filter(c => {
        const jid = c.remoteJid || c.id || '';
        return jid.includes('@s.whatsapp.net') || jid.includes('@g.us');
      })
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
      .slice(0, 50); // Only sync 50 most recent chats

    console.log(`[sync] Processing ${validChats.length} chats out of ${chats.length} total`);

    let contacts_synced = 0;
    let conversations_synced = 0;

    for (const chat of validChats) {
      const remoteJid = chat.remoteJid || chat.id || '';
      if (!remoteJid) continue;

      const isGroup = remoteJid.includes('@g.us');
      const phone = isGroup ? remoteJid : remoteJid.replace('@s.whatsapp.net', '');
      const chatName = chat.pushName || chat.name || (isGroup ? `Grupo ${phone.split('-')[0]}` : phone);
      const profilePicUrl = chat.profilePicUrl || chat.profilePictureUrl || null;
      const lastMsg = chat.lastMessage?.message?.conversation || chat.lastMessage?.message?.extendedTextMessage?.text || '';

      // Small delay to avoid rate limiting
      await sleep(150);

      // Find or create WhatsAppContact (tenant-scoped, group-aware).
      const findKey = isGroup ? { group_jid: phone } : { telefone: phone };
      const tenantFilter = workspace_id ? { workspace_id } : { owner_email };
      const existingContacts = await base44.asServiceRole.entities.WhatsAppContact.filter({ ...tenantFilter, ...findKey });

      let contact;
      if (existingContacts.length === 0) {
        contact = await base44.asServiceRole.entities.WhatsAppContact.create({
          nome: chatName,
          telefone: phone,
          owner_email,
          workspace_id,
          group_jid: isGroup ? phone : null,
          is_group: isGroup,
          profile_picture_url: profilePicUrl,
          profile_pic_updated_at: profilePicUrl ? new Date().toISOString() : null,
          criado_em: new Date().toISOString(),
        });
        contacts_synced++;
      } else {
        contact = existingContacts[0];
        const updates = {};
        if (!contact.nome || contact.nome === contact.telefone) updates.nome = chatName;
        if (profilePicUrl && !contact.profile_picture_url) updates.profile_picture_url = profilePicUrl;
        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.WhatsAppContact.update(contact.id, updates);
          contact = { ...contact, ...updates };
        }
      }

      // Mirror to CRM Contact (only for 1-to-1, never for groups, never with fake email).
      if (!isGroup && phone && !contact.crm_contact_id) {
        try {
          const accountFilter = workspace_id ? { account_id: workspace_id } : {};
          const crmExisting = await base44.asServiceRole.entities.Contact.filter({ ...accountFilter, phone });
          if (crmExisting.length > 0) {
            const c = crmExisting[0];
            if (!c.whatsapp_id) {
              await base44.asServiceRole.entities.Contact.update(c.id, { whatsapp_id: contact.id });
            }
            await base44.asServiceRole.entities.WhatsAppContact.update(contact.id, { crm_contact_id: c.id });
            contact.crm_contact_id = c.id;
          } else {
            const created = await base44.asServiceRole.entities.Contact.create({
              name: chatName,
              phone,
              account_id: workspace_id || null,
              workspace_id: workspace_id || null,
              status: 'ativo',
              tags: ['whatsapp'],
              origin: 'WhatsApp',
              whatsapp_id: contact.id,
              profile_picture_url: profilePicUrl || null,
            });
            await base44.asServiceRole.entities.WhatsAppContact.update(contact.id, { crm_contact_id: created.id });
            contact.crm_contact_id = created.id;
          }
        } catch (mirrorErr) {
          console.error('[sync] CRM mirror failed:', (mirrorErr as Error).message);
        }
      }

      await sleep(150);

      // Find or create conversation
      const existingConvs = workspace_id
        ? await base44.asServiceRole.entities.WhatsAppConversation.filter({ contato_id: contact.id, workspace_id })
        : await base44.asServiceRole.entities.WhatsAppConversation.filter({ contato_id: contact.id, owner_email });

      if (existingConvs.length === 0) {
        await base44.asServiceRole.entities.WhatsAppConversation.create({
          contato_id: contact.id,
          contact_id: contact.crm_contact_id || null,
          contato_nome: chatName,
          contato_telefone: phone,
          canal_id: ch.id,
          channel_type: 'whatsapp',
          owner_email, workspace_id,
          ultima_mensagem: lastMsg,
          last_message_at: chat.updatedAt || new Date().toISOString(),
          profile_picture_url: profilePicUrl,
          is_group: isGroup,
          nao_lido: false,
          status: 'aberta',
          criado_em: chat.updatedAt || new Date().toISOString(),
          atualizado_em: chat.updatedAt || new Date().toISOString(),
        });
        conversations_synced++;
      } else {
        // Update existing conversation with latest info
        const conv = existingConvs[0];
        const updates = {};
        if (profilePicUrl && !conv.profile_picture_url) updates.profile_picture_url = profilePicUrl;
        if (chatName && (!conv.contato_nome || conv.contato_nome === conv.contato_telefone)) updates.contato_nome = chatName;
        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.WhatsAppConversation.update(conv.id, updates);
        }
      }
    }

    // Mark channel as synced
    await base44.asServiceRole.entities.WhatsAppChannel.update(ch.id, { synced: true });

    console.log(`[sync] Done: ${contacts_synced} contacts, ${conversations_synced} conversations`);
    return Response.json({ ok: true, contacts_synced, conversations_synced });
  } catch (error) {
    console.error('[syncWhatsAppContacts] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});