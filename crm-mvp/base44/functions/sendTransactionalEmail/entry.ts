import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

// Templates de email transacional
const TEMPLATES = {
  welcome: (data) => ({
    subject: `Bem-vindo ao CRMFlow, ${data.name}!`,
    body: `Olá ${data.name},\n\nSua conta foi criada com sucesso!\n\nComeçe agora:\n1. Configure seu perfil\n2. Adicione seu primeiro lead\n3. Conecte seu canal de comunicação\n\nQualquer dúvida, responda este email.\n\nEquipe CRMFlow`,
  }),
  trial_reminder: (data) => ({
    subject: `⏳ Seu trial termina em ${data.days_left} dias`,
    body: `Olá ${data.name},\n\nSeu período de trial termina em ${data.days_left} dias.\n\nNão perca o acesso! Assine um plano para continuar usando:\n- Inbox multicanal\n- Automações ilimitadas\n- Pipeline de vendas\n\nAssine agora: ${data.pricing_url}\n\nEquipe CRMFlow`,
  }),
  lead_created: (data) => ({
    subject: `🎉 Novo lead: ${data.lead_name}`,
    body: `Um novo lead foi cadastrado no CRMFlow:\n\nNome: ${data.lead_name}\nEmail: ${data.lead_email || "—"}\nTelefone: ${data.lead_phone || "—"}\nOrigem: ${data.lead_origin || "—"}\n\nAcesse o pipeline para acompanhar: ${data.pipeline_url}`,
  }),
  payment_failed: (data) => ({
    subject: `⚠️ Problema com seu pagamento`,
    body: `Olá ${data.name},\n\nIdentificamos um problema com o seu pagamento.\n\nPor favor, acesse sua conta e atualize as informações de pagamento para evitar a suspensão do serviço.\n\nEquipe CRMFlow`,
  }),
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { template, to, data } = await req.json();

    if (!template || !to) {
      return Response.json({ error: 'template e to são obrigatórios' }, { status: 400 });
    }

    const templateFn = TEMPLATES[template];
    if (!templateFn) {
      return Response.json({ error: `Template '${template}' não encontrado. Disponíveis: ${Object.keys(TEMPLATES).join(', ')}` }, { status: 400 });
    }

    const { subject, body } = templateFn(data || {});

    await base44.integrations.Core.SendEmail({
      to,
      subject,
      body,
      from_name: 'CRMFlow',
    });

    return Response.json({ success: true, template, to });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});