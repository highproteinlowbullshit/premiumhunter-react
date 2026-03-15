import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard',    icon: GridIcon      },
  { to: '/watchlist', label: 'Watchlist',    icon: ListIcon      },
  { to: '/screener',  label: 'IV Screener',  icon: ScreenerIcon  },
  { to: '/wheel',     label: 'Wheel Tracker', icon: WheelIcon    },
  { to: '/portfolio', label: 'Portfolio',    icon: PortfolioIcon },
];

interface NavbarProps {
  onOpenLeapsCalc: () => void;
}

export function Navbar({ onOpenLeapsCalc }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    setMobileOpen(false);
    navigate('/login');
  };

  // Derive a display name: first part of email before @
  const displayName = user?.email?.split('@')[0] ?? '';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16" style={{
      background: 'var(--ph-navbar-bg)',
      borderBottom: '1px solid var(--ph-border-md)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2.5 group cursor-pointer"
        >
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 rounded-lg opacity-20 group-hover:opacity-40 transition-opacity duration-300"
              style={{ background: 'linear-gradient(135deg, #00e5c4, #00c6f5)' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <WheelIconSmall />
            </div>
          </div>
          <span className="text-lg font-bold tracking-tight"
            style={{ fontFamily: 'Syne, sans-serif', color: 'var(--ph-text-1)' }}>
            Premium<span style={{ color: '#00e5c4' }}>Hunter</span>
          </span>
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={({ isActive }) => ({
                color: isActive ? '#00e5c4' : 'var(--ph-text-nav-inactive)',
                background: isActive ? 'rgba(0,229,196,0.08)' : 'transparent',
                fontFamily: 'DM Sans, sans-serif',
              })}
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* LEAPS Calculator */}
          <button
            onClick={onOpenLeapsCalc}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-[rgba(0,229,196,0.08)] text-[#6a8fb0] hover:text-[#00e5c4]"
            title="LEAPS Calculator"
          >
            <CalcIcon />
          </button>

          {/* Profile / auth */}
          {user ? (
            <div className="hidden md:flex items-center gap-2">
              {/* User chip */}
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{
                  background: 'rgba(0,229,196,0.06)',
                  border: '1px solid rgba(0,229,196,0.12)',
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(0,229,196,0.2)', color: '#00e5c4', fontFamily: 'Syne, sans-serif' }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <span
                  className="text-xs max-w-[100px] truncate"
                  style={{ color: 'var(--ph-text-2)', fontFamily: 'DM Sans, sans-serif' }}
                >
                  {displayName}
                </span>
              </div>
              {/* Sign out */}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:bg-[rgba(255,77,109,0.1)]"
                style={{ color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif', border: '1px solid transparent' }}
                title="Sign out"
              >
                <SignOutIcon />
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: 'rgba(0, 229, 196, 0.1)',
                border: '1px solid rgba(0, 229, 196, 0.2)',
                color: '#00e5c4',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              <UserIcon />
              Sign In
            </button>
          )}

          {/* Mobile menu */}
          <button
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: 'var(--ph-text-nav-inactive)' }}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 py-2 px-4"
          style={{
            background: 'var(--ph-navbar-mobile-bg)',
            borderBottom: '1px solid var(--ph-border-md)',
            backdropFilter: 'blur(20px)',
          }}>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium my-1 transition-all duration-200"
              style={({ isActive }) => ({
                color: isActive ? '#00e5c4' : 'var(--ph-text-nav-inactive)',
                background: isActive ? 'rgba(0,229,196,0.08)' : 'transparent',
              })}
            >
              <Icon />
              {label}
            </NavLink>
          ))}

          {/* Mobile auth row */}
          <div className="mt-1 pt-3 pb-1" style={{ borderTop: '1px solid var(--ph-border)' }}>
            {user ? (
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-xs truncate max-w-[160px]" style={{ color: 'var(--ph-text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                  style={{ color: '#ff4d6d', background: 'rgba(255,77,109,0.08)', fontFamily: 'DM Sans, sans-serif' }}
                >
                  <SignOutIcon />
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => { navigate('/login'); setMobileOpen(false); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium my-1"
                style={{ background: 'rgba(0,229,196,0.08)', color: '#00e5c4', fontFamily: 'DM Sans, sans-serif' }}
              >
                <UserIcon />
                Sign In
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

// Icon components
function PortfolioIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7.5 7.5 L7.5 1.5 A6 6 0 0 1 13.5 7.5 Z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.1" />
      <path d="M7.5 7.5 L13.5 7.5 A6 6 0 0 1 7.5 13.5 Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <line x1="3" y1="4" x2="12" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="3" y1="7.5" x2="12" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="3" y1="11" x2="8" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="1.5" cy="4" r="0.8" fill="currentColor" />
      <circle cx="1.5" cy="7.5" r="0.8" fill="currentColor" />
      <circle cx="1.5" cy="11" r="0.8" fill="currentColor" />
    </svg>
  );
}

function ScreenerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1" y="1" width="13" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
      <rect x="1" y="5.5" width="9" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
      <rect x="1" y="10" width="6" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="12.5" cy="11.5" r="2" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function WheelIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
      <line x1="7.5" y1="2" x2="7.5" y2="6" stroke="currentColor" strokeWidth="1.2" />
      <line x1="7.5" y1="9" x2="7.5" y2="13" stroke="currentColor" strokeWidth="1.2" />
      <line x1="2" y1="7.5" x2="6" y2="7.5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="9" y1="7.5" x2="13" y2="7.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function WheelIconSmall() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke="#00e5c4" strokeWidth="1.5" />
      <circle cx="9" cy="9" r="2" fill="#00e5c4" />
      <line x1="9" y1="2" x2="9" y2="7" stroke="#00e5c4" strokeWidth="1.5" />
      <line x1="9" y1="11" x2="9" y2="16" stroke="#00e5c4" strokeWidth="1.5" />
      <line x1="2" y1="9" x2="7" y2="9" stroke="#00e5c4" strokeWidth="1.5" />
      <line x1="11" y1="9" x2="16" y2="9" stroke="#00e5c4" strokeWidth="1.5" />
    </svg>
  );
}


function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 12c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="13" y1="3" x2="3" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M5 11.5H2.5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8.5 9.5L11 6.5l-2.5-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="11" y1="6.5" x2="5" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function CalcIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1.5" width="12" height="13" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <line x1="5" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <rect x="4" y="7.5" width="2" height="1.5" rx="0.4" fill="currentColor" />
      <rect x="7" y="7.5" width="2" height="1.5" rx="0.4" fill="currentColor" />
      <rect x="10" y="7.5" width="2" height="1.5" rx="0.4" fill="currentColor" />
      <rect x="4" y="10.5" width="2" height="1.5" rx="0.4" fill="currentColor" />
      <rect x="7" y="10.5" width="2" height="1.5" rx="0.4" fill="currentColor" />
      <rect x="10" y="10.5" width="2" height="1.5" rx="0.4" fill="currentColor" />
    </svg>
  );
}
