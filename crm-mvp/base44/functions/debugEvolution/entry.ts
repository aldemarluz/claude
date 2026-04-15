import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { channel_id } = body;

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const headers = { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' };

    let instanceName = body.instance_name;

    // Get instance name from channel if channel_id provided
    if (channel_id) {
      const channels = await base44.asServiceRole.entities.WhatsAppChannel.filter({ id: channel_id });
      if (channels[0]) instanceName = channels[0].instance_name;
    }

    if (!instanceName) {
      return Response.json({ error: 'instance_name or channel_id required' }, { status: 400 });
    }

    const results = {};

    // Test 1: connection state
    try {
      const r = await fetch(`${EVOLUTION_URL}/instance/connectionState/${instanceName}`, { headers });
      results.connectionState = { status: r.status, data: await r.json() };
    } catch (e) { results.connectionState = { error: e.message }; }

    // Test 2: findChats GET
    try {
      const r = await fetch(`${EVOLUTION_URL}/chat/findChats/${instanceName}`, { headers });
      const data = await r.json();
      results.findChatsGET = { status: r.status, count: Array.isArray(data) ? data.length : 'not array', sample: Array.isArray(data) ? data.slice(0, 2) : data };
    } catch (e) { results.findChatsGET = { error: e.message }; }

    // Test 3: findChats POST
    try {
      const r = await fetch(`${EVOLUTION_URL}/chat/findChats/${instanceName}`, {
        method: 'POST', headers, body: JSON.stringify({}),
      });
      const data = await r.json();
      results.findChatsPOST = { status: r.status, count: Array.isArray(data) ? data.length : 'not array', sample: Array.isArray(data) ? data.slice(0, 2) : data };
    } catch (e) { results.findChatsPOST = { error: e.message }; }

    // Test 4: findContacts POST
    try {
      const r = await fetch(`${EVOLUTION_URL}/chat/findContacts/${instanceName}`, {
        method: 'POST', headers, body: JSON.stringify({}),
      });
      const data = await r.json();
      results.findContactsPOST = { status: r.status, count: Array.isArray(data) ? data.length : 'not array', sample: Array.isArray(data) ? data.slice(0, 2) : data };
    } catch (e) { results.findContactsPOST = { error: e.message }; }

    // Test 5: fetchInstances
    try {
      const r = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, { headers });
      const data = await r.json();
      results.fetchInstances = { status: r.status, count: Array.isArray(data) ? data.length : 'not array', data };
    } catch (e) { results.fetchInstances = { error: e.message }; }

    return Response.json({ instanceName, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});