import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Auth is enforced at the route level via AuthContext + ProtectedRoute;
// we let the SDK boot without a token so public routes can render, and
// AuthContext triggers the login flow for protected pages.
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl,
});
