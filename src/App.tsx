import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { WatchlistProvider } from './context/WatchlistContext';
import { PaperModeProvider } from './context/PaperModeContext';
import { MarketClockProvider, useMarketClock } from './context/MarketClockContext';
import { Navbar } from './components/Navbar';
import { MobileNav } from './components/MobileNav';
import { ShortcutsModal } from './components/ShortcutsModal';
import { ToastContainer } from './components/Toast';
import { WelcomeModal, SwitchOffListener } from './components/PaperModals';
import { PaperBanner } from './components/PaperBanner';
import * as Sentry from '@sentry/react';
import { ErrorFallback } from './components/ErrorBoundary';
import { ProtectedRoute, GuestRoute } from './components/ProtectedRoute';
import { TierRoute } from './components/FeatureGate';
import { DemoBanner } from './components/DemoBanner';
import { PageLoader } from './components/PageLoader';
import { Dashboard } from './pages/Dashboard';
import { useLastSeen } from './hooks/useLastSeen';

const LandingPage      = lazy(() => import('./pages/LandingPage'));
const LeapsCalculator  = lazy(() => import('./components/LeapsCalculator').then(m => ({ default: m.LeapsCalculator })));
const Watchlist        = lazy(() => import('./pages/Watchlist').then(m => ({ default: m.Watchlist })));
const StockDetail      = lazy(() => import('./pages/StockDetail').then(m => ({ default: m.StockDetail })));
const WheelTracker     = lazy(() => import('./pages/WheelTracker').then(m => ({ default: m.WheelTracker })));
const Screener         = lazy(() => import('./pages/Screener').then(m => ({ default: m.Screener })));
const Login            = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Signup           = lazy(() => import('./pages/Signup').then(m => ({ default: m.Signup })));
const ForgotPassword   = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword    = lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const NotFound         = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));
const Portfolio        = lazy(() => import('./pages/Portfolio').then(m => ({ default: m.Portfolio })));
const HelpPage         = lazy(() => import('./pages/HelpPage').then(m => ({ default: m.HelpPage })));
const AdminPage        = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const UpgradePage      = lazy(() => import('./pages/UpgradePage').then(m => ({ default: m.UpgradePage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
      retry: 1,
      retryDelay: 1000,
      networkMode: 'online',
    },
    mutations: {
      retry: 0,
      networkMode: 'online',
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <PaperModeProvider>
              <WatchlistProvider>
                <MarketClockProvider>
                  <AppInner />
                </MarketClockProvider>
              </WatchlistProvider>
            </PaperModeProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function LandingPageRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

function AppInner() {
  const [leapsCalcOpen, setLeapsCalcOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { show: clockVisible } = useMarketClock();
  useLastSeen();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case '1': navigate('/dashboard'); break;
        case '2': navigate('/watchlist'); break;
        case '3': navigate('/screener'); break;
        case '4': navigate('/wheel'); break;
        case '5': navigate('/portfolio'); break;
        case '?': setShortcutsOpen(true); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  return (
    <div style={{ minHeight: '100vh' }}>
      {user && (
        <>
          <Navbar
            onOpenLeapsCalc={() => setLeapsCalcOpen(true)}
            onOpenShortcuts={() => setShortcutsOpen(true)}
          />
          <Suspense fallback={null}>
            <LeapsCalculator isOpen={leapsCalcOpen} onClose={() => setLeapsCalcOpen(false)} />
          </Suspense>
          {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
          <WelcomeModal />
          <SwitchOffListener />
          <PaperBanner />
          <MobileNav />
        </>
      )}
      <ToastContainer />
      <Sentry.ErrorBoundary fallback={(props) => <ErrorFallback onReset={props.resetError} />}>
        <Suspense fallback={<PageLoader />}>
          <div className={user ? (clockVisible ? 'mobile-nav-pad-clock' : 'mobile-nav-pad') : ''}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/help" element={<HelpPage />} />

            {/* Landing / root */}
            <Route path="/" element={<LandingPageRoute />} />

            {/* Protected */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/watchlist" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
            <Route path="/stock/:ticker" element={<ProtectedRoute><StockDetail /></ProtectedRoute>} />
            <Route path="/wheel" element={<ProtectedRoute><WheelTracker /></ProtectedRoute>} />
            <Route path="/screener" element={<ProtectedRoute><Screener /></ProtectedRoute>} />
            <Route path="/portfolio" element={
              <ProtectedRoute>
                <TierRoute requires="pro">
                  <Portfolio />
                </TierRoute>
              </ProtectedRoute>
            } />
            <Route path="/upgrade" element={<ProtectedRoute><UpgradePage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </div>
        </Suspense>
      </Sentry.ErrorBoundary>
      <DemoBanner />
    </div>
  );
}
