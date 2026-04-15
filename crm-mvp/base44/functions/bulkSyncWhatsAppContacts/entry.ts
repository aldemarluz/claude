import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

/**
 * Mirror existing WhatsAppContacts into CRM Contacts for a given workspace.
 * Safe to re-run: NEVER deletes existing Contacts, NEVER fabricates fake
 * emails, NEVER touches contacts from other tenants.
 *
 * Input: { workspace_id?: string }
 *   - If omitted, falls back to the caller's owner_email scope.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({} as any));
    const workspace_id: string | null = body?.workspace_id || null;

    const tenantFilter: Record<string, string> = workspace_id
      ? { workspace_id }
      : { owner_email: user.email };

    const waContacts = await base44.asServiceRole.entities.WhatsAppContact.filter(tenantFilter, '-criado_em', 1000);

    let synced = 0;
    let skipped = 0;

    for (const wc of waContacts) {
      try {
        if (!wc.telefone) { skipped++; continue; }
        if (String(wc.telefone).includes('@g.us')) { skipped++; continue; }
        if (wc.is_group) { skipped++; continue; }
        const phone = String(wc.telefone).replace(/\D/g, '');
        if (!phone) { skipped++; continue; }

        const accountFilter = workspace_id ? { account_id: workspace_id } : {};
        const existing = await base44.asServiceRole.entities.Contact.filter({ ...accountFilter, phone });

        if (existing.length > 0) {
          const c = existing[0];
          const updates: Record<string, unknown> = {};
          if (!c.whatsapp_id) updates.whatsapp_id = wc.id;
          if (!c.profile_picture_url && wc.profile_picture_url) updates.profile_picture_url = wc.profile_picture_url;
          if (!c.origin) updates.origin = 'WhatsApp';
          if (Object.keys(updates).length > 0) {
            await base44.asServiceRole.entities.Contact.update(c.id, updates);
          }
          if (!wc.crm_contact_id) {
            await base44.asServiceRole.entities.WhatsAppContact.update(wc.id, { crm_contact_id: c.id }).catch(() => null);
          }
          skipped++;
          continue;
        }

        const created = await base44.asServiceRole.entities.Contact.create({
          name: String(wc.nome || phone),
          phone,
          account_id: workspace_id || null,
          workspace_id: workspace_id || null,
          status: 'ativo',
          tags: ['whatsapp'],
          origin: 'WhatsApp',
          whatsapp_id: wc.id,
          profile_picture_url: wc.profile_picture_url || null,
        });
        await base44.asServiceRole.entities.WhatsAppContact.update(wc.id, { crm_contact_id: created.id }).catch(() => null);
        synced++;
      } catch (err) {
        console.error('[bulkSync] entry failed:', (err as Error).message);
        skipped++;
      }
    }

    return Response.json({ ok: true, synced, skipped, total: waContacts.length });
  } catch (error) {
    console.error('[bulkSyncWhatsAppContacts] Erro:', (error as Error).message);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
});
