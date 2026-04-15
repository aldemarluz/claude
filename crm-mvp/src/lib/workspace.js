import { base44 } from '@/api/base44Client';

let _cachedWorkspaceId = null;

export async function getWorkspaceId() {
  if (_cachedWorkspaceId) return _cachedWorkspaceId;

  const user = await base44.auth.me().catch(() => null);
  if (!user) return null;

  // Try to find existing workspace for this user
  const existing = await base44.entities.Workspace.filter({ owner_email: user.email });
  if (existing.length > 0) {
    _cachedWorkspaceId = existing[0].id;
    return _cachedWorkspaceId;
  }

  // Create workspace on first access
  const created = await base44.entities.Workspace.create({
    name: user.full_name || user.email,
    owner_email: user.email,
    members: [user.email],
  });
  _cachedWorkspaceId = created.id;
  return _cachedWorkspaceId;
}

export function clearWorkspaceCache() {
  _cachedWorkspaceId = null;
}