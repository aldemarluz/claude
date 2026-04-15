import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First, clear all contacts with tag "whatsapp" that have generated emails
    try {
      const allContacts = await base44.entities.Contact.list("-updated_date", 1000);
      for (const contact of allContacts) {
        if (contact.tags?.includes("whatsapp") && contact.email?.includes("@whatsapp.local")) {
          await base44.entities.Contact.delete(contact.id);
        }
      }
    } catch (_) {}

    // Fetch all WhatsApp contacts from WhatsAppContact entity
    const waContacts = await base44.entities.WhatsAppContact.list("-criado_em", 500);
    
    let synced = 0;

    for (const wc of waContacts) {
      // Skip invalid entries
      if (!wc.nome || !wc.telefone) continue;
      if (typeof wc.telefone === 'string' && wc.telefone.includes('@g.us')) continue;

      try {
        // Create new contact
        await base44.entities.Contact.create({
          name: String(wc.nome),
          phone: String(wc.telefone),
          email: `${wc.telefone}@whatsapp.local`,
          status: "ativo",
          tags: ["whatsapp"],
          workspace_id: wc.workspace_id || "",
        });
        synced++;
      } catch (_) {}
    }

    return Response.json({ 
      message: 'Sincronização concluída',
      synced,
      total: waContacts.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});