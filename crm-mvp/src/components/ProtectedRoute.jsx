import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

/**
 * Gate component that ensures the user is authenticated before rendering
 * nested routes. Use as a pathless layout route in React Router:
 *
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/dashboard" element={<Dashboard />} />
 *   </Route>
 *
 * By default, unauthenticated users are redirected to the SDK login page;
 * pass `unauthenticatedElement` to render something else instead.
 */
export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const {
    isAuthenticated,
    isLoadingAuth,
    isLoadingPublicSettings,
    authError,
    navigateToLogin,
  } = useAuth();

  const shouldRedirect =
    !isLoadingAuth &&
    !isLoadingPublicSettings &&
    !isAuthenticated &&
    authError?.type !== 'user_not_registered' &&
    !unauthenticatedElement;

  useEffect(() => {
    if (shouldRedirect) {
      navigateToLogin();
    }
  }, [shouldRedirect, navigateToLogin]);

  if (isLoadingAuth || isLoadingPublicSettings) {
    return fallback;
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement ?? fallback;
  }

  return <Outlet />;
}
