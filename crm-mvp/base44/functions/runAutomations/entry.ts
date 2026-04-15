import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

// runAutomations: called by evolutionWebhook after saving each message
// Checks all active AutomationRules for the workspace and executes matching ones

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const {
      workspace_id,
      owner_email,
      phone,
      contact_name,
      message_text,
      conversation_id,
      contact_id,
      is_first_message,
      from_me,
      channel_id,
    } = body;

    if (from_me) return Response.json({ ok: true, skipped: 'from_me' });

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    const ruleFilter = workspace_id
      ? { is_active: true, workspace_id }
      : owner_email ? { is_active: true, owner_email } : { is_active: true };

    let rules = await base44.asServiceRole.entities.AutomationRule.filter(ruleFilter);
    if (rules.length === 0 && workspace_id) {
      rules = await base44.asServiceRole.entities.AutomationRule.filter({ is_active: true, account_id: workspace_id });
    }

    if (rules.length === 0) return Response.json({ ok: true, no_rules: true });

    const results = [];

    for (const rule of rules) {
      let matched = false;

      switch (rule.trigger) {
        case 'first_message':
          matched = is_first_message === true;
          break;
        case 'message_received':
          matched = true;
          break;
        case 'message_contains': {
          const keywords = (rule.trigger_value || '').split('|').map(k => k.trim().toLowerCase()).filter(Boolean);
          const text = (message_text || '').toLowerCase();
          matched = keywords.some(kw => text.includes(kw));
          break;
        }
        case 'lead_created':
          matched = is_first_message === true;
          break;
        default:
          matched = false;
      }

      if (!matched) continue;

      try {
        switch (rule.action) {
          case 'send_whatsapp': {
            if (!conversation_id || !rule.action_value) break;

            let msg = rule.action_value;
            msg = msg.replace(/\{\{nome\}\}/gi, contact_name || '');
            msg = msg.replace(/\{\{telefone\}\}/gi, phone || '');
            msg = msg.replace(/\{\{empresa\}\}/gi, '');

            const channels = channel_id
              ? await base44.asServiceRole.entities.WhatsAppChannel.filter({ id: channel_id, status: 'conectado' })
              : workspace_id
                ? await base44.asServiceRole.entities.WhatsAppChannel.filter({ status: 'conectado', workspace_id })
                : await base44.asServiceRole.entities.WhatsAppChannel.filter({ status: 'conectado', owner_email });

            if (channels.length > 0) {
              const canal = channels[0];
              const instanceName = canal.instance_name || canal.instance_id;
              const cleanPhone = (phone || '').replace(/\D/g, '');

              if (cleanPhone) {
                await new Promise(r => setTimeout(r, 1500));

                const evoRes = await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
                  body: JSON.stringify({ number: cleanPhone, text: msg }),
                });

                if (evoRes.ok) {
                  await base44.asServiceRole.entities.WhatsAppMessage.create({
                    conversa_id: conversation_id,
                    contato_id: contact_id,
                    direcao: 'outbound',
                    conteudo: msg,
                    media_type: 'text',
                    timestamp: new Date().toISOString(),
                    status: 'enviado',
                    owner_email,
                    workspace_id,
                  });

                  await base44.asServiceRole.entities.WhatsAppConversation.update(conversation_id, {
                    ultima_mensagem: msg,
                    atualizado_em: new Date().toISOString(),
                  });

                  results.push({ rule: rule.name, action: 'send_whatsapp', status: 'sent' });
                } else {
                  const err = await evoRes.text();
                  results.push({ rule: rule.name, action: 'send_whatsapp', status: 'failed', error: err });
                }
              }
            }
            break;
          }

          case 'add_tag': {
            if (!rule.action_value) break;
            const tag = rule.action_value.trim();
            const leads = await base44.asServiceRole.entities.Lead.filter(
              workspace_id ? { phone, workspace_id } : { phone }
            );
            if (leads.length > 0) {
              const lead = leads[0];
              const currentTags = lead.tags || [];
              if (!currentTags.includes(tag)) {
                await base44.asServiceRole.entities.Lead.update(lead.id, { tags: [...currentTags, tag] });
                results.push({ rule: rule.name, action: 'add_tag', status: 'added', tag });
              }
            }
            break;
          }

          case 'change_status': {
            if (!rule.action_value) break;
            const leads = await base44.asServiceRole.entities.Lead.filter(
              workspace_id ? { phone, workspace_id } : { phone }
            );
            if (leads.length > 0) {
              await base44.asServiceRole.entities.Lead.update(leads[0].id, { status: rule.action_value });
              results.push({ rule: rule.name, action: 'change_status', status: 'changed' });
            }
            break;
          }

          case 'create_lead': {
            if (!phone) break;
            const existing = await base44.asServiceRole.entities.Lead.filter(
              workspace_id ? { phone, workspace_id } : { phone }
            );
            if (existing.length === 0) {
              await base44.asServiceRole.entities.Lead.create({
                name: contact_name || phone,
                phone,
                email: '',
                status: 'novo',
                deal_status: 'aberto',
                origin: 'WhatsApp',
                workspace_id: workspace_id || null,
                tags: ['whatsapp-auto'],
              });
              results.push({ rule: rule.name, action: 'create_lead', status: 'created' });
            } else {
              results.push({ rule: rule.name, action: 'create_lead', status: 'already_exists' });
            }
            break;
          }

          default:
            results.push({ rule: rule.name, action: rule.action, status: 'unknown_action' });
        }

        await base44.asServiceRole.entities.AutomationRule.update(rule.id, {
          executions: (rule.executions || 0) + 1,
          last_executed_at: new Date().toISOString(),
        });

      } catch (actionError) {
        console.error(`[runAutomations] Error executing rule "${rule.name}":`, actionError.message);
        results.push({ rule: rule.name, status: 'error', error: actionError.message });
      }
    }

    console.log('[runAutomations] Results:', JSON.stringify(results));
    return Response.json({ ok: true, results });
  } catch (error) {
    console.error('[runAutomations] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});