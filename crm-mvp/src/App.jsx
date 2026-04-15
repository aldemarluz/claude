import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Pipeline from './pages/Pipeline.jsx';
import LeadDetail from './pages/LeadDetail';
import Inbox from './pages/Inbox';
import Automations from './pages/Automations';
import LandingPages from './pages/LandingPages';
import LandingPageView from './pages/LandingPageView';
import Settings from './pages/Settings';
import Contacts from './pages/Contacts';
import Marketing from './pages/Marketing';
import Proposals from './pages/Proposals';
import ProposalDetail from './pages/ProposalDetail';
import Welcome from './pages/Welcome';
import Pricing from './pages/Pricing';
import PublicLanding from './pages/PublicLanding';
import Companies from './pages/Companies';
import WhatsAppInbox from './pages/WhatsAppInbox';
import UnifiedInbox from './pages/UnifiedInbox';
import WhatsAppChannels from './pages/WhatsAppChannels';
import FlowBuilder from './pages/FlowBuilder';

// Paths that must NEVER require authentication (rendered before the auth gate).
const PUBLIC_PATH_PATTERNS = [
  /^\/welcome\/?$/,
  /^\/landing\/?$/,
  /^\/lp\/.+/,
];

const isPublicPath = (pathname) => PUBLIC_PATH_PATTERNS.some((rx) => rx.test(pathname));

const LoadingSpinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const PublicRoutes = () => (
  <Routes>
    <Route path="/welcome" element={<Welcome />} />
    <Route path="/lp/:slug" element={<LandingPageView />} />
    <Route path="/landing" element={<PublicLanding />} />
    <Route path="*" element={<PageNotFound />} />
  </Routes>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();
  const onPublicPath = isPublicPath(location.pathname);

  // Redirect to login as a side-effect, never during render.
  useEffect(() => {
    if (!onPublicPath && authError?.type === 'auth_required') {
      navigateToLogin();
    }
  }, [authError, navigateToLogin, onPublicPath]);

  // Public routes are always accessible, regardless of auth state.
  if (onPublicPath) {
    return <PublicRoutes />;
  }

  // Show loading spinner while checking app public settings or auth.
  if (isLoadingPublicSettings || isLoadingAuth) {
    return <LoadingSpinner />;
  }

  // Handle authentication errors.
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    if (authError.type === 'auth_required') {
      // useEffect above triggers the redirect; render a spinner meanwhile.
      return <LoadingSpinner />;
    }
    // Unknown error — render a friendly fallback instead of a blank screen.
    return (
      <div className="fixed inset-0 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-lg font-semibold">Não foi possível carregar o aplicativo</h1>
          <p className="text-sm text-muted-foreground">
            {authError.message || 'Tente recarregar a página em alguns instantes.'}
          </p>
          <button
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
            onClick={() => window.location.reload()}
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }

  // Render the main app.
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/leads/:id" element={<LeadDetail />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/automations" element={<Automations />} />
        <Route path="/automations/:id" element={<FlowBuilder />} />
        <Route path="/landing-pages" element={<LandingPages />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/marketing" element={<Marketing />} />
        <Route path="/proposals" element={<Proposals />} />
        <Route path="/proposals/:id" element={<ProposalDetail />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/whatsapp" element={<WhatsAppInbox />} />
        <Route path="/unified-inbox" element={<UnifiedInbox />} />
        <Route path="/whatsapp-channels" element={<WhatsAppChannels />} />
        <Route path="/companies" element={<Companies />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
