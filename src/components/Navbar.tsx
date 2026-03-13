import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { ThemeMode } from '../types';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: GridIcon },
  { to: '/watchlist', label: 'Watchlist', icon: ListIcon },
  { to: '/wheel', label: 'Wheel Tracker', icon: WheelIcon },
];

interface NavbarProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export function Navbar({ theme, onToggleTheme }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16" style={{
      background: 'rgba(5, 13, 26, 0.92)',
      borderBottom: '1px solid rgba(0, 229, 196, 0.1)',
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
            style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
            Wheel<span style={{ color: '#00e5c4' }}>House</span>
          </span>
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'text-[#00e5c4] bg-[rgba(0,229,196,0.08)]'
                    : 'text-[#6a8fb0] hover:text-[#e8f0fe] hover:bg-[rgba(255,255,255,0.04)]'
                }`
              }
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={onToggleTheme}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-[rgba(0,229,196,0.08)] text-[#6a8fb0] hover:text-[#00e5c4]"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          {/* Profile / auth */}
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

          {/* Mobile menu */}
          <button
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-[#6a8fb0] hover:text-[#e8f0fe] transition-colors"
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
            background: 'rgba(5, 13, 26, 0.98)',
            borderBottom: '1px solid rgba(0, 229, 196, 0.1)',
            backdropFilter: 'blur(20px)',
          }}>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium my-1 transition-all duration-200 ${
                  isActive
                    ? 'text-[#00e5c4] bg-[rgba(0,229,196,0.08)]'
                    : 'text-[#6a8fb0] hover:text-[#e8f0fe]'
                }`
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
}

// Icon components
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

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
      <line x1="8" y1="1" x2="8" y2="2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="8" y1="13.5" x2="8" y2="15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="1" y1="8" x2="2.5" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="13.5" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="3.05" y1="3.05" x2="4.12" y2="4.12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="11.88" y1="11.88" x2="12.95" y2="12.95" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="12.95" y1="3.05" x2="11.88" y2="4.12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="4.12" y1="11.88" x2="3.05" y2="12.95" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
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
