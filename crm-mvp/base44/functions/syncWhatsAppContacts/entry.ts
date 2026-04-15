import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

      // Find or create contact
      const existingContacts = workspace_id
        ? await base44.asServiceRole.entities.WhatsAppContact.filter({ telefone: phone, workspace_id })
        : await base44.asServiceRole.entities.WhatsAppContact.filter({ telefone: phone, owner_email });

      let contact;
      if (existingContacts.length === 0) {
        contact = await base44.asServiceRole.entities.WhatsAppContact.create({
          nome: chatName, telefone: phone, owner_email, workspace_id,
          profile_picture_url: profilePicUrl,
          profile_pic_updated_at: new Date().toISOString(),
          criado_em: new Date().toISOString(),
        });
        contacts_synced++;
      } else {
        contact = existingContacts[0];
        // Update name/pic if missing
        const updates = {};
        if (!contact.nome || contact.nome === contact.telefone) updates.nome = chatName;
        if (profilePicUrl && !contact.profile_picture_url) updates.profile_picture_url = profilePicUrl;
        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.WhatsAppContact.update(contact.id, updates);
          contact = { ...contact, ...updates };
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
          contato_nome: chatName,
          contato_telefone: phone,
          canal_id: ch.id,
          owner_email, workspace_id,
          ultima_mensagem: lastMsg,
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