import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    const canais = await base44.asServiceRole.entities.WhatsAppChannel.filter({ status: 'conectado' });
    if (canais.length === 0) return Response.json({ profiles: {}, groups: [] });

    const canal = canais[0];
    const instanceName = canal.instance_name || canal.instance_id;
    const headers = { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY };

    // Fetch groups
    let groups = [];
    try {
      const gRes = await fetch(`${EVOLUTION_URL}/group/fetchAllGroups/${instanceName}?getParticipants=false`, { headers });
      if (gRes.ok) {
        const gData = await gRes.json();
        groups = Array.isArray(gData) ? gData.map(g => ({
          id: g.id,
          name: g.subject || g.name || 'Grupo',
          picture: g.pictureUrl || null,
          isGroup: true,
        })) : [];
      }
    } catch (e) {
      console.log('Groups fetch error:', e.message);
    }

    // Fetch contacts with profile pictures from existing conversations
    const conversations = await base44.asServiceRole.entities.WhatsAppConversation.list('-atualizado_em', 100);
    const profiles = {};

    // Batch fetch profile pictures (limit to avoid overload)
    const phones = [...new Set(conversations.map(c => c.contato_telefone).filter(Boolean))].slice(0, 30);

    await Promise.allSettled(phones.map(async (phone) => {
      try {
        const pRes = await fetch(`${EVOLUTION_URL}/chat/fetchProfile/${instanceName}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ number: phone }),
        });
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData?.picture || pData?.profilePictureUrl) {
            profiles[phone] = pData.picture || pData.profilePictureUrl;
          }
        }
      } catch (_) {}
    }));

    return Response.json({ profiles, groups });
  } catch (error) {
    console.error('getWhatsAppContacts error:', error.message);
    return Response.json({ profiles: {}, groups: [] });
  }
});