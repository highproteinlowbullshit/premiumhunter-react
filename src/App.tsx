import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { WatchlistProvider } from './context/WatchlistContext';
import { PaperModeProvider } from './context/PaperModeContext';
import { Navbar } from './components/Navbar';
import { ToastContainer } from './components/Toast';
import { LeapsCalculator } from './components/LeapsCalculator';
import { WelcomeModal, SwitchOffListener } from './components/PaperModals';
import { PaperBanner } from './components/PaperBanner';
import * as Sentry from '@sentry/react';
import { ErrorFallback } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Dashboard } from './pages/Dashboard';
import { Watchlist } from './pages/Watchlist';
import { StockDetail } from './pages/StockDetail';
import { WheelTracker } from './pages/WheelTracker';
import { Screener } from './pages/Screener';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { NotFound } from './pages/NotFound';
import { Portfolio } from './pages/Portfolio';
import { HelpPage } from './pages/HelpPage';
import { DemoBanner } from './components/DemoBanner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
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
                <AppInner />
              </WatchlistProvider>
            </PaperModeProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function AppInner() {
  const [leapsCalcOpen, setLeapsCalcOpen] = useState(false);

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar
        onOpenLeapsCalc={() => setLeapsCalcOpen(true)}
      />
      <LeapsCalculator isOpen={leapsCalcOpen} onClose={() => setLeapsCalcOpen(false)} />
      <WelcomeModal />
      <SwitchOffListener />
      <PaperBanner />
      <ToastContainer />
      <Sentry.ErrorBoundary fallback={(props) => <ErrorFallback onReset={props.resetError} />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/help" element={<HelpPage />} />

          {/* Protected */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/watchlist" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
          <Route path="/stock/:ticker" element={<ProtectedRoute><StockDetail /></ProtectedRoute>} />
          <Route path="/wheel" element={<ProtectedRoute><WheelTracker /></ProtectedRoute>} />
          <Route path="/screener" element={<ProtectedRoute><Screener /></ProtectedRoute>} />
          <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Sentry.ErrorBoundary>
      <DemoBanner />
    </div>
  );
}
