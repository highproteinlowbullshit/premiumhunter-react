import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';

const TABS = [
  { path: '/dashboard', label: 'Home',      icon: HomeIcon      },
  { path: '/watchlist', label: 'Watchlist', icon: WatchlistIcon },
  { path: '/screener',  label: 'Screen',    icon: ScreenIcon    },
  { path: '/wheel',     label: 'Track',     icon: TrackIcon     },
  { path: '/portfolio', label: 'Portfolio', icon: PortIcon      },
];

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isSuperuser } = useSubscription();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <>
      {/* More panel — slides up above the nav bar */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMoreOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 49,
              background: 'rgba(5,13,26,0.5)',
            }}
          />
          {/* Panel */}
          <div style={{
            position: 'fixed', bottom: 72, left: 0, right: 0, zIndex: 50,
            background: 'var(--ph-navbar-bg)',
            borderTop: '1px solid var(--ph-border-md)',
            borderRadius: '16px 16px 0 0',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            padding: '8px 0 4px',
          }}>
            {isSuperuser && (
              <>
                <button
                  onClick={() => { navigate('/admin'); setMoreOpen(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 24px', background: 'none', border: 'none',
                    color: '#f5c842', fontSize: 14, cursor: 'pointer',
                    fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  <AdminIcon active={location.pathname.startsWith('/admin')} />
                  Admin
                </button>
                <div style={{ height: 1, background: 'var(--ph-border-md)', margin: '4px 0' }} />
              </>
            )}
            <button
              onClick={() => { navigate('/help'); setMoreOpen(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 24px', background: 'none', border: 'none',
                color: 'var(--ph-text-1)', fontSize: 14, cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              <HelpIcon active={location.pathname.startsWith('/help')} />
              Help
            </button>
            <div style={{ height: 1, background: 'var(--ph-border-md)', margin: '4px 0' }} />
            <button
              onClick={() => { setMoreOpen(false); signOut(); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 24px', background: 'none', border: 'none',
                color: '#ff4d6d', fontSize: 14, cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              <SignOutIcon />
              Sign out
            </button>
          </div>
        </>
      )}

      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex"
        style={{
          height: 72,
          background: 'var(--ph-navbar-bg)',
          borderTop: '1px solid var(--ph-border-md)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {TABS.map(({ path, label, icon: Icon }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => { navigate(path); setMoreOpen(false); }}
              className="flex-1 flex flex-col items-center justify-center gap-0.5"
              style={{
                border: 'none',
                background: 'transparent',
                color: active ? '#00e5c4' : 'var(--ph-text-nav-inactive)',
                cursor: 'pointer',
                paddingBottom: 10,
                transition: 'color 0.15s ease',
              }}
            >
              <Icon active={active} />
              <span style={{ fontSize: 9, fontWeight: active ? 600 : 400, fontFamily: 'DM Sans, sans-serif', lineHeight: 1 }}>
                {label}
              </span>
            </button>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setMoreOpen(v => !v)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5"
          style={{
            border: 'none',
            background: 'transparent',
            color: moreOpen ? '#00e5c4' : 'var(--ph-text-nav-inactive)',
            cursor: 'pointer',
            paddingBottom: 6,
            transition: 'color 0.15s ease',
          }}
        >
          <MoreIcon active={moreOpen} />
          <span style={{ fontSize: 9, fontWeight: moreOpen ? 600 : 400, fontFamily: 'DM Sans, sans-serif', lineHeight: 1 }}>
            More
          </span>
        </button>
      </nav>
    </>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 9.5L10 3l7 6.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
        fill={active ? 'rgba(0,229,196,0.15)' : 'none'} />
      <path d="M7.5 18v-5h5v5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function WatchlistIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.3"
        fill={active ? 'rgba(0,229,196,0.12)' : 'none'} />
      <line x1="6" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="6" y1="13" x2="10" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ScreenIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.3"
        fill={active ? 'rgba(0,229,196,0.12)' : 'none'} />
      <line x1="13.2" y1="13.2" x2="17" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TrackIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.3"
        fill={active ? 'rgba(0,229,196,0.12)' : 'none'} />
      <circle cx="10" cy="10" r="2" fill="currentColor" />
      <line x1="10" y1="3" x2="10" y2="8" stroke="currentColor" strokeWidth="1.3" />
      <line x1="10" y1="12" x2="10" y2="17" stroke="currentColor" strokeWidth="1.3" />
      <line x1="3" y1="10" x2="8" y2="10" stroke="currentColor" strokeWidth="1.3" />
      <line x1="12" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function PortIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="8" width="4" height="9" rx="1" stroke="currentColor" strokeWidth="1.3"
        fill={active ? 'rgba(0,229,196,0.12)' : 'none'} />
      <rect x="8" y="5" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.3"
        fill={active ? 'rgba(0,229,196,0.15)' : 'none'} />
      <rect x="13" y="3" width="4" height="14" rx="1" stroke="currentColor" strokeWidth="1.3"
        fill={active ? 'rgba(0,229,196,0.18)' : 'none'} />
    </svg>
  );
}

function HelpIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.3"
        fill={active ? 'rgba(0,229,196,0.12)' : 'none'} />
      <path d="M7.5 7.5a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2.2-2.4 3.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="10" cy="14.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

function MoreIcon({ active }: { active: boolean }) {
  const color = active ? '#00e5c4' : 'currentColor';
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="5" cy="10" r="1.5" fill={color} />
      <circle cx="10" cy="10" r="1.5" fill={color} />
      <circle cx="15" cy="10" r="1.5" fill={color} />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M13 13l3-3-3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="16" y1="10" x2="8" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function AdminIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2L3 5V10C3 13.9 6.1 17.5 10 18.4C13.9 17.5 17 13.9 17 10V5L10 2Z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
        fill={active ? 'rgba(245,200,66,0.15)' : 'none'} />
      <path d="M7 10L9 12L13 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
