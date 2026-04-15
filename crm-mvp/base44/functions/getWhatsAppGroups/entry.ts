import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    // Parse body FIRST before any SDK call consumes the stream
    const body = await req.json().catch(() => ({}));
    const { phones = [] } = body;

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const headers = { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY };

    // Get active channel
    const canais = await base44.asServiceRole.entities.WhatsAppChannel.filter({ status: 'conectado' });
    if (canais.length === 0) return Response.json({ groups: [], profilePics: {} });
    const canal = canais[0];
    const instanceName = canal.instance_name || canal.instance_id;

    // Fetch all groups
    let groups = [];
    try {
      const groupRes = await fetch(`${EVOLUTION_URL}/group/fetchAllGroups/${instanceName}?getParticipants=false`, { headers });
      if (groupRes.ok) {
        const data = await groupRes.json();
        groups = (Array.isArray(data) ? data : []).map(g => ({
          id: g.id,
          name: g.subject || g.name || g.id,
          pictureUrl: g.pictureUrl || null,
          isGroup: true,
          size: g.size || 0,
        }));
      }
    } catch (e) {
      console.error('Error fetching groups:', e.message);
    }

    // Fetch profile pictures for given phone numbers (batched, max 30)
    const profilePics = {};
    if (phones.length > 0) {
      const picPromises = phones.slice(0, 30).map(async (phone) => {
        try {
          const clean = String(phone).replace(/\D/g, '');
          if (!clean) return;
          const picRes = await fetch(`${EVOLUTION_URL}/chat/fetchProfilePictureUrl/${instanceName}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ number: clean }),
          });
          if (picRes.ok) {
            const picData = await picRes.json();
            const url = picData?.profilePictureUrl || picData?.picture || picData?.url;
            if (url) {
              profilePics[clean] = url;
            }
          }
        } catch (_) {}
      });
      await Promise.allSettled(picPromises);
    }

    console.log(`[getWhatsAppGroups] groups: ${groups.length}, profilePics: ${Object.keys(profilePics).length}, phones requested: ${phones.length}`);
    return Response.json({ groups, profilePics });
  } catch (error) {
    console.error('[getWhatsAppGroups] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});