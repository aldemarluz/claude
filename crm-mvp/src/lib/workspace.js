import { base44 } from '@/api/base44Client';

// Single-flight cache + in-flight promise so concurrent calls don't create
// duplicate Accounts.
let _cachedAccountId = null;
let _inFlight = null;

async function resolveAccountId() {
  const user = await base44.auth.me().catch(() => null);
  if (!user?.email) return null;

  // Find an existing account owned by the current user.
  try {
    const existing = await base44.entities.Account.filter({ owner_email: user.email });
    if (existing?.length > 0) {
      return existing[0].id;
    }
  } catch (err) {
    console.error('Failed to look up Account:', err);
    return null;
  }

  // Create on first access.
  try {
    const created = await base44.entities.Account.create({
      name: user.full_name || user.email,
      owner_email: user.email,
      plan: 'free',
      is_active: true,
    });
    return created?.id ?? null;
  } catch (err) {
    console.error('Failed to create Account:', err);
    return null;
  }
}

/**
 * Returns the current user's Account ID.
 *
 * This is the single tenant identifier used across the app. Some entities
 * (Lead, Contact, Company) store it as `account_id`, while others
 * (WhatsAppChannel, PipelineConfig, AutomationRule, etc.) store it as
 * `workspace_id`. The VALUE is the same — only the field name differs.
 * Use {@link getWorkspaceId} as an alias when filtering those entities.
 */
export async function getAccountId() {
  if (_cachedAccountId) return _cachedAccountId;
  if (_inFlight) return _inFlight;

  _inFlight = resolveAccountId()
    .then((id) => {
      _cachedAccountId = id;
      return id;
    })
    .finally(() => {
      _inFlight = null;
    });

  return _inFlight;
}

/**
 * Alias of {@link getAccountId}. Kept for callers that filter by
 * `workspace_id`. The returned value is the Account ID.
 */
export const getWorkspaceId = getAccountId;

export function clearWorkspaceCache() {
  _cachedAccountId = null;
  _inFlight = null;
}

export const clearAccountCache = clearWorkspaceCache;
