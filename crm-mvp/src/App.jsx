import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
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
import Welcome from './pages/Welcome';
import Pricing from './pages/Pricing';
import PublicLanding from './pages/PublicLanding';
import Companies from './pages/Companies';
import WhatsAppInbox from './pages/WhatsAppInbox';
import UnifiedInbox from './pages/UnifiedInbox';
import WhatsAppChannels from './pages/WhatsAppChannels';
import FlowBuilder from './pages/FlowBuilder';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  // Onboarding guard — must be at top level, not after conditionals

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/leads/:id" element={<LeadDetail />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/automations" element={<Automations />} />
        <Route path="/landing-pages" element={<LandingPages />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/marketing" element={<Marketing />} />
        <Route path="/proposals" element={<Proposals />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/whatsapp" element={<WhatsAppInbox />} />
        <Route path="/unified-inbox" element={<UnifiedInbox />} />
        <Route path="/whatsapp-channels" element={<WhatsAppChannels />} />
        <Route path="/companies" element={<Companies />} />
      </Route>
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/lp/:slug" element={<LandingPageView />} />
      <Route path="/landing" element={<PublicLanding />} />

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