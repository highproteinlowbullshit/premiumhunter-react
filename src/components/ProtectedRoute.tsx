import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDisclaimer } from '../hooks/useDisclaimer';
import { DisclaimerModal } from './DisclaimerModal';
import { PageLoader } from './PageLoader';

/** Redirects already-authenticated users away from guest-only pages (login, signup). */
export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isBanned } = useAuth();
  const { isLoading: disclaimerLoading } = useDisclaimer();
  const location = useLocation();

  if (isBanned) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-6" style={{ maxWidth: 400 }}>
          <p className="text-base font-semibold" style={{ color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif' }}>
            Account suspended
          </p>
          <p className="text-sm" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            Your account has been suspended. If you believe this is a mistake, please contact support.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{
              borderColor: 'rgba(0,229,196,0.2)',
              borderTopColor: '#00e5c4',
            }}
          />
          <p className="text-sm" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Hold until we know disclaimer status — prevents any flash of protected content
  if (disclaimerLoading) return <PageLoader />;

  // DisclaimerModal renders itself fullscreen when hasAccepted is false;
  // renders null when accepted — no extra routing needed.
  return (
    <>
      <DisclaimerModal />
      {children ?? <Outlet />}
    </>
  );
}
