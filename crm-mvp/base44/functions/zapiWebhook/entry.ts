import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const body = await req.json();
    const isMessage = body.type === 'ReceivedCallback' || body.type === 'received';
    if (!isMessage) {
      console.log('Skipped event type:', body.type);
      return Response.json({ ok: true, skipped: true });
    }

    const telefone = (body.phone || '').replace(/\D/g, '');
    // Prefer pushName (WhatsApp display name), fallback to senderName, then phone
    const nomeWA = body.pushName || body.senderName || telefone;
    const timestamp = body.timestamp ? new Date(body.timestamp * 1000).toISOString() : new Date().toISOString();

    // Detect media type and extract url/content
    let conteudo = '';
    let media_url = null;
    let media_type = 'text';
    let file_name = null;

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

    console.log('[Webhook] Telefone:', telefone, '| Nome WA:', nomeWA, '| Tipo:', media_type, '| Conteúdo:', conteudo);

    if (!telefone || (!conteudo && !media_url)) {
      return Response.json({ ok: true, skipped: true, reason: 'no phone or content' });
    }

    // Try to find matching Lead or Contact in CRM by phone for a better name
    let nomeFromCRM = null;
    try {
      const leads = await base44.asServiceRole.entities.Lead.filter({ phone: telefone });
      if (leads.length > 0) nomeFromCRM = leads[0].name;
      if (!nomeFromCRM) {
        const contacts = await base44.asServiceRole.entities.Contact.filter({ phone: telefone });
        if (contacts.length > 0) nomeFromCRM = contacts[0].name;
      }
    } catch(e) { /* ignore */ }

    const nome = nomeFromCRM || nomeWA;

    // Find or create contact
    const contatos = await base44.asServiceRole.entities.WhatsAppContact.filter({ telefone });
    let contato;
    if (contatos.length > 0) {
      contato = contatos[0];
      // Always update name if we have a better one
      const melhorNome = nomeFromCRM || (nomeWA !== telefone ? nomeWA : contato.nome);
      if (melhorNome && contato.nome !== melhorNome) {
        await base44.asServiceRole.entities.WhatsAppContact.update(contato.id, { nome: melhorNome });
        contato = { ...contato, nome: melhorNome };
      }
    } else {
      contato = await base44.asServiceRole.entities.WhatsAppContact.create({
        nome, telefone, criado_em: new Date().toISOString(),
      });
    }

    // Find or create open conversation — search by phone AND contato_id to avoid duplicates
    let todasConversas = await base44.asServiceRole.entities.WhatsAppConversation.filter({ contato_telefone: contato.telefone, status: 'aberta' });
    // fallback: also try by contato_id
    if (todasConversas.length === 0) {
      todasConversas = await base44.asServiceRole.entities.WhatsAppConversation.filter({ contato_id: contato.id, status: 'aberta' });
    }
    let conversa;
    if (todasConversas.length > 0) {
      conversa = todasConversas[0];
      // Sync name if changed
      if (conversa.contato_nome !== contato.nome) {
        await base44.asServiceRole.entities.WhatsAppConversation.update(conversa.id, { contato_nome: contato.nome, contato_id: contato.id });
        conversa = { ...conversa, contato_nome: contato.nome };
      }
    } else {
      conversa = await base44.asServiceRole.entities.WhatsAppConversation.create({
        contato_id: contato.id,
        contato_nome: contato.nome,
        contato_telefone: contato.telefone,
        ultima_mensagem: conteudo || `[${media_type}]`,
        nao_lido: true,
        status: 'aberta',
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      });
    }

    // Save message
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
    });

    await base44.asServiceRole.entities.WhatsAppConversation.update(conversa.id, {
      ultima_mensagem: conteudo || `[${media_type}]`,
      nao_lido: true,
      atualizado_em: new Date().toISOString(),
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[Webhook] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});