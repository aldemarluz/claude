import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversation_id, contact_id, contact_name, contact_phone, workspace_id, is_group } = await req.json();

    // Skip if it's a group conversation
    if (is_group || !contact_name || !contact_phone) {
      return Response.json({ synced: false, reason: 'Skipped (group or incomplete data)' });
    }

    // Check if contact already exists by phone
    const existing = await base44.entities.Contact.filter({ phone: contact_phone });
    
    if (existing && existing.length > 0) {
      // Contact exists, update whatsapp_id if not set
      if (!existing[0].whatsapp_id) {
        await base44.entities.Contact.update(existing[0].id, { whatsapp_id: contact_id });
      }
      return Response.json({ synced: false, reason: 'Contact already exists' });
    }

    // Create new contact from WhatsApp conversation
    const newContact = await base44.entities.Contact.create({
      name: contact_name,
      phone: contact_phone,
      email: "",
      company_name: "",
      status: "ativo",
      tags: ["whatsapp"],
      notes: "",
      origin: "WhatsApp",
      whatsapp_id: contact_id,
      workspace_id: workspace_id,
    });

    return Response.json({ 
      synced: true, 
      contact_id: newContact.id,
      message: `Contato "${contact_name}" criado automaticamente` 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});