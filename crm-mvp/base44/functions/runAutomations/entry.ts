import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

// ── Text utilities ─────────────────────────────────────────────────────────
const norm = (s: unknown): string =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const splitKeywords = (raw: unknown): string[] =>
  String(raw || '')
    .split(/[|,;\n]/)
    .map((k) => norm(k))
    .filter(Boolean);

const renderTemplate = (tpl: string, vars: Record<string, string | null | undefined>): string =>
  String(tpl || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => String(vars[key] ?? ''));

// ── Handler ────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({} as any));
    const {
      workspace_id, owner_email, phone, contact_name, message_text,
      conversation_id, contact_id, crm_contact_id,
      is_first_message, is_group, from_me, channel_id, channel_type,
    } = body;

    if (from_me) return Response.json({ ok: true, skipped: 'from_me' });

    const ruleFilter: Record<string, unknown> = { is_active: true };
    if (workspace_id) ruleFilter.workspace_id = workspace_id;
    else if (owner_email) ruleFilter.owner_email = owner_email;
    let rules = await base44.asServiceRole.entities.AutomationRule.filter(ruleFilter);
    if (rules.length === 0 && workspace_id) {
      rules = await base44.asServiceRole.entities.AutomationRule.filter({ is_active: true, account_id: workspace_id });
    }
    if (rules.length === 0) return Response.json({ ok: true, no_rules: true });

    const normalizedText = norm(message_text);
    const results: Array<Record<string, unknown>> = [];

    for (const rule of rules) {
      let matched = false;
      switch (rule.trigger) {
        case 'first_message':
          matched = is_first_message === true;
          break;
        case 'message_received':
        case 'whatsapp_received':
          matched = !is_group;
          break;
        case 'message_contains': {
          const keywords = splitKeywords(rule.trigger_value);
          matched = keywords.some((kw) => normalizedText.includes(kw));
          break;
        }
        case 'lead_created':
          matched = is_first_message === true;
          break;
        case 'no_response':
        default:
          matched = false;
      }
      if (!matched) continue;

      // Idempotency for first_message rules: only fire once per conversation.
      if (rule.trigger === 'first_message') {
        try {
          const recent = await base44.asServiceRole.entities.WhatsAppMessage.filter({
            conversa_id: conversation_id,
            automation_rule_id: rule.id,
          }, '-timestamp', 1);
          if (recent.length > 0) {
            results.push({ rule: rule.name, status: 'already_fired_first_message' });
            continue;
          }
        } catch { /* best-effort */ }
      }

      const tplVars = {
        nome: contact_name || '',
        telefone: phone || '',
        empresa: '',
        primeira_mensagem: message_text || '',
      };

      try {
        switch (rule.action) {
          case 'send_whatsapp': {
            if (!conversation_id || !rule.action_value) {
              results.push({ rule: rule.name, status: 'noop', reason: 'missing_target' });
              break;
            }
            const text = renderTemplate(rule.action_value, tplVars);
            try {
              await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
                conversation_id,
                mensagem: text,
                media_type: 'text',
                is_automated: true,
                automation_rule_id: rule.id,
              });
              results.push({ rule: rule.name, action: 'send_whatsapp', status: 'queued' });
            } catch (e) {
              results.push({ rule: rule.name, action: 'send_whatsapp', status: 'failed', error: (e as Error).message });
            }
            break;
          }

          case 'send_email': {
            if (!rule.action_value) { results.push({ rule: rule.name, status: 'noop' }); break; }
            const targetEmail = await resolveLeadEmail(base44, { workspace_id, phone, crm_contact_id });
            if (!targetEmail) { results.push({ rule: rule.name, status: 'no_email' }); break; }
            const subject = String(rule.trigger_value || 'Mensagem').slice(0, 160);
            const html = renderTemplate(rule.action_value, tplVars);
            try {
              await base44.asServiceRole.functions.invoke('sendTransactionalEmail', {
                to: targetEmail,
                subject,
                html,
                template: 'automation',
                workspace_id,
              });
              results.push({ rule: rule.name, action: 'send_email', status: 'queued' });
            } catch (e) {
              results.push({ rule: rule.name, action: 'send_email', status: 'failed', error: (e as Error).message });
            }
            break;
          }

          case 'add_tag': {
            if (!rule.action_value) break;
            const tag = String(rule.action_value).trim();
            const lead = await findOrCreateLead(base44, { workspace_id, phone, contact_name, createIfMissing: false });
            if (lead) {
              const currentTags = lead.tags || [];
              if (!currentTags.includes(tag)) {
                await base44.asServiceRole.entities.Lead.update(lead.id, { tags: [...currentTags, tag] });
                results.push({ rule: rule.name, action: 'add_tag', status: 'added', tag });
              } else {
                results.push({ rule: rule.name, action: 'add_tag', status: 'already_present' });
              }
            } else {
              results.push({ rule: rule.name, action: 'add_tag', status: 'no_lead' });
            }
            break;
          }

          case 'change_status': {
            if (!rule.action_value) break;
            const lead = await findOrCreateLead(base44, { workspace_id, phone, contact_name, createIfMissing: false });
            if (lead) {
              await base44.asServiceRole.entities.Lead.update(lead.id, { status: rule.action_value });
              results.push({ rule: rule.name, action: 'change_status', status: 'changed' });
            } else {
              results.push({ rule: rule.name, action: 'change_status', status: 'no_lead' });
            }
            break;
          }

          case 'create_lead': {
            const lead = await findOrCreateLead(base44, { workspace_id, phone, contact_name, createIfMissing: true });
            results.push({ rule: rule.name, action: 'create_lead', status: lead ? 'created_or_existing' : 'failed' });
            break;
          }

          case 'assign_lead': {
            if (!rule.action_value) break;
            const lead = await findOrCreateLead(base44, { workspace_id, phone, contact_name, createIfMissing: false });
            if (lead) {
              await base44.asServiceRole.entities.Lead.update(lead.id, { assigned_to: rule.action_value });
              results.push({ rule: rule.name, action: 'assign_lead', status: 'assigned' });
            }
            break;
          }

          case 'notify_team': {
            console.log(`[runAutomations] notify_team rule="${rule.name}"`);
            results.push({ rule: rule.name, action: 'notify_team', status: 'logged' });
            break;
          }

          case 'wait': {
            results.push({ rule: rule.name, action: 'wait', status: 'not_implemented' });
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
        console.error(`[runAutomations] rule "${rule.name}" failed:`, (actionError as Error).message);
        results.push({ rule: rule.name, status: 'error', error: (actionError as Error).message });
      }
    }

    return Response.json({ ok: true, count: results.length, results });
  } catch (error) {
    console.error('[runAutomations] Error:', (error as Error).message);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────
async function findOrCreateLead(
  base44: any,
  args: { workspace_id?: string; phone?: string; contact_name?: string; createIfMissing: boolean },
): Promise<any | null> {
  const { workspace_id, phone, contact_name, createIfMissing } = args;
  if (!phone) return null;
  const filter: Record<string, string> = { phone };
  if (workspace_id) filter.account_id = workspace_id;
  const found = await base44.asServiceRole.entities.Lead.filter(filter);
  if (found.length > 0) return found[0];
  if (!createIfMissing) return null;
  return await base44.asServiceRole.entities.Lead.create({
    name: contact_name || phone,
    phone,
    email: '',
    status: 'novo',
    deal_status: 'aberto',
    origin: 'WhatsApp',
    account_id: workspace_id || null,
    workspace_id: workspace_id || null,
    tags: ['whatsapp-auto'],
  });
}

async function resolveLeadEmail(
  base44: any,
  args: { workspace_id?: string; phone?: string; crm_contact_id?: string | null },
): Promise<string | null> {
  if (args.crm_contact_id) {
    try {
      const contacts = await base44.asServiceRole.entities.Contact.filter({ id: args.crm_contact_id });
      if (contacts[0]?.email) return contacts[0].email;
    } catch { /* ignore */ }
  }
  if (args.phone) {
    const f: Record<string, string> = { phone: args.phone };
    if (args.workspace_id) f.account_id = args.workspace_id;
    const leads = await base44.asServiceRole.entities.Lead.filter(f);
    if (leads[0]?.email) return leads[0].email;
  }
  return null;
}
