import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

/**
 * Link a single WhatsApp contact to its CRM Contact (creating the Contact
 * if it doesn't exist). Always tenant-scoped; never crosses workspaces.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({} as any));
    const { contact_id, contact_name, contact_phone, workspace_id, is_group } = body;

    if (is_group || !contact_phone) {
      return Response.json({ ok: true, synced: false, reason: 'group_or_no_phone' });
    }
    const phone = String(contact_phone).replace(/\D/g, '');
    if (!phone) return Response.json({ ok: true, synced: false, reason: 'invalid_phone' });

    const tenantWs = workspace_id || null;
    const accountFilter = tenantWs ? { account_id: tenantWs } : {};
    const existing = await base44.asServiceRole.entities.Contact.filter({ ...accountFilter, phone });

    if (existing.length > 0) {
      const c = existing[0];
      const updates: Record<string, unknown> = { last_contact: new Date().toISOString() };
      if (!c.whatsapp_id && contact_id) updates.whatsapp_id = contact_id;
      if (!c.origin) updates.origin = 'WhatsApp';
      await base44.asServiceRole.entities.Contact.update(c.id, updates);
      if (contact_id) {
        await base44.asServiceRole.entities.WhatsAppContact
          .update(contact_id, { crm_contact_id: c.id }).catch(() => null);
      }
      return Response.json({ ok: true, synced: false, reason: 'already_exists', contact_id: c.id });
    }

    const created = await base44.asServiceRole.entities.Contact.create({
      name: contact_name || phone,
      phone,
      account_id: tenantWs,
      workspace_id: tenantWs,
      status: 'ativo',
      tags: ['whatsapp'],
      origin: 'WhatsApp',
      whatsapp_id: contact_id || null,
      last_contact: new Date().toISOString(),
    });
    if (contact_id) {
      await base44.asServiceRole.entities.WhatsAppContact
        .update(contact_id, { crm_contact_id: created.id }).catch(() => null);
    }
    return Response.json({ ok: true, synced: true, contact_id: created.id });
  } catch (error) {
    console.error('[syncWhatsAppToContacts] Erro:', (error as Error).message);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
});
