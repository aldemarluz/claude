import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

/**
 * Generic outbound message dispatcher. Given a Conversation (or
 * WhatsAppConversation) id, route the send to the right provider
 * adapter based on the conversation's channel_type.
 *
 * Today only WhatsApp via Evolution is implemented; the dispatcher exists
 * so that the inbox UI and automations call ONE function regardless of
 * channel. When Instagram/Messenger/SMS/email adapters land, this is the
 * only place that needs to grow a new branch.
 *
 * Input shape (channel-agnostic):
 *   {
 *     conversation_id: string,
 *     content?: string,         // text body
 *     media_url?: string,
 *     media_type?: 'text'|'image'|'audio'|'video'|'document'|'sticker',
 *     file_name?: string,
 *     is_automated?: boolean,
 *     automation_rule_id?: string,
 *   }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({} as any));
    const { conversation_id, content, media_url, media_type, file_name, is_automated, automation_rule_id } = body;
    if (!conversation_id) return Response.json({ error: 'conversation_id é obrigatório' }, { status: 400 });

    // Detect channel_type. We support both the new generic Conversation and
    // the legacy WhatsAppConversation entities.
    let channelType: string | null = null;

    const generic = await base44.asServiceRole.entities.Conversation.filter({ id: conversation_id }).catch(() => []);
    if (generic.length > 0) {
      channelType = generic[0].channel_type || 'whatsapp';
    } else {
      const wa = await base44.asServiceRole.entities.WhatsAppConversation.filter({ id: conversation_id }).catch(() => []);
      if (wa.length > 0) channelType = 'whatsapp';
    }

    if (!channelType) return Response.json({ error: 'Conversa não encontrada' }, { status: 404 });

    switch (channelType) {
      case 'whatsapp': {
        // Forward to the existing implementation. The `mensagem` field name is
        // legacy but kept stable so callers who don't know about the rewrite
        // still work; new callers use `content`.
        const res = await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
          conversation_id,
          mensagem: typeof content === 'string' ? content : null,
          media_url: media_url || null,
          media_type: media_type || (media_url ? 'document' : 'text'),
          file_name: file_name || null,
          is_automated: Boolean(is_automated),
          automation_rule_id: automation_rule_id || null,
        });
        return Response.json(res?.data ?? { ok: true });
      }

      // Future channels:
      case 'email':
      case 'sms':
      case 'instagram':
      case 'messenger':
      case 'tiktok':
      case 'webchat':
        return Response.json({
          error: `Canal "${channelType}" ainda não implementado`,
          channel: channelType,
        }, { status: 501 });

      default:
        return Response.json({ error: `Canal desconhecido: ${channelType}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[sendChannelMessage] Erro:', (error as Error).message);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
});
