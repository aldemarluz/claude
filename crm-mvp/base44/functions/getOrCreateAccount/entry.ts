import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Look up existing UserAccount membership
    const memberships = await base44.asServiceRole.entities.UserAccount.filter({ user_email: user.email });

    if (memberships.length > 0) {
      return Response.json({ account_id: memberships[0].account_id });
    }

    // No account yet — create one for this user (they are the owner)
    const account = await base44.asServiceRole.entities.Account.create({
      name: user.full_name || user.email,
      owner_email: user.email,
      plan: 'free',
      is_active: true,
    });

    await base44.asServiceRole.entities.UserAccount.create({
      user_email: user.email,
      account_id: account.id,
      role: 'owner',
    });

    return Response.json({ account_id: account.id });
  } catch (error) {
    console.error('[getOrCreateAccount] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});