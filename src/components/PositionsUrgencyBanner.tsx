import { useState } from 'react';
import type { AssignmentProbabilityResult } from '../lib/blackScholes';
import type { WheelPosition } from '../types';

function IconCalendar({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, display: 'inline', verticalAlign: 'middle' }}>
      <rect x="1" y="2" width="10" height="9" rx="1.5" stroke={color} strokeWidth="1.1" fill={color} fillOpacity="0.1" />
      <line x1="1" y1="5" x2="11" y2="5" stroke={color} strokeWidth="1" />
      <line x1="4" y1="1" x2="4" y2="3.5" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      <line x1="8" y1="1" x2="8" y2="3.5" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function IconWarningBanner({ color }: { color: string }) {
  return (
    <svg width="13" height="12" viewBox="0 0 13 12" fill="none" style={{ flexShrink: 0, display: 'inline', verticalAlign: 'middle' }}>
      <path d="M6.5 1.5L11.5 10.5H1.5L6.5 1.5Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" fill={color} fillOpacity="0.12" />
      <line x1="6.5" y1="5" x2="6.5" y2="7.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="6.5" cy="9" r="0.6" fill={color} />
    </svg>
  );
}

function IconBellBanner({ color }: { color: string }) {
  return (
    <svg width="12" height="13" viewBox="0 0 12 13" fill="none" style={{ flexShrink: 0, display: 'inline', verticalAlign: 'middle' }}>
      <path d="M6 1C6 1 3 2.5 3 6V8H9V6C9 2.5 6 1 6 1Z" stroke={color} strokeWidth="1.1" strokeLinejoin="round" fill={color} fillOpacity="0.12" />
      <line x1="1.5" y1="8" x2="10.5" y2="8" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M4.5 8.5C4.5 9.33 5.17 10 6 10C6.83 10 7.5 9.33 7.5 8.5" stroke={color} strokeWidth="1" fill="none" />
    </svg>
  );
}

function IconEye({ color }: { color: string }) {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" style={{ flexShrink: 0, display: 'inline', verticalAlign: 'middle' }}>
      <path d="M1 5C1 5 3 1 7 1C11 1 13 5 13 5C13 5 11 9 7 9C3 9 1 5 1 5Z" stroke={color} strokeWidth="1.1" fill={color} fillOpacity="0.1" />
      <circle cx="7" cy="5" r="2" stroke={color} strokeWidth="1.1" fill={color} fillOpacity="0.2" />
    </svg>
  );
}

function IconWeek({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, display: 'inline', verticalAlign: 'middle' }}>
      <rect x="1" y="2" width="10" height="9" rx="1.5" stroke={color} strokeWidth="1.1" fill={color} fillOpacity="0.08" />
      <line x1="1" y1="5" x2="11" y2="5" stroke={color} strokeWidth="1" />
      <line x1="4" y1="1" x2="4" y2="3.5" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      <line x1="8" y1="1" x2="8" y2="3.5" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      <rect x="3.5" y="6.5" width="2" height="2" rx="0.5" fill={color} fillOpacity="0.6" />
      <rect x="6.5" y="6.5" width="2" height="2" rx="0.5" fill={color} fillOpacity="0.6" />
    </svg>
  );
}

function IconCheckmark({ color }: { color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, display: 'inline', verticalAlign: 'middle' }}>
      <path d="M2 5L4.5 7.5L8 3" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconAlert({ color }: { color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, display: 'inline', verticalAlign: 'middle' }}>
      <line x1="5" y1="3" x2="5" y2="6" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="5" cy="7.5" r="0.6" fill={color} />
    </svg>
  );
}

interface Props {
  positions: WheelPosition[];
  probabilities: Map<string, AssignmentProbabilityResult>;
  dteSummary?: { expiringToday: number; criticalDTE: number; urgentDTE: number };
  isPaperMode?: boolean;
}

function isThirdFriday(date: Date = new Date()): boolean {
  if (date.getDay() !== 5) return false;
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstFriday = new Date(firstDay);
  firstFriday.setDate(1 + (5 - firstDay.getDay() + 7) % 7);
  const thirdFriday = new Date(firstFriday);
  thirdFriday.setDate(firstFriday.getDate() + 14);
  return date.getDate() === thirdFriday.getDate();
}

function getDismissKey(priority: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `ph_urgency_dismiss_${today}_${priority}`;
}

function useDismissed(key: string) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(key) === '1'; } catch { return false; }
  });
  const dismiss = () => {
    try { localStorage.setItem(key, '1'); } catch { /* quota */ }
    setDismissed(true);
  };
  return [dismissed, dismiss] as const;
}

interface BannerConfig {
  priority: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
  message: string;
  tickers: string;
  pulse?: boolean;
}

export function PositionsUrgencyBanner({ positions, probabilities, dteSummary: _dteSummary, isPaperMode }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Gather position states
  const expiringToday = positions.filter(p => {
    const d = new Date(p.expiry);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  const itmPositions = positions.filter(p => {
    const r = probabilities.get(p.id);
    return r?.status === 'itm';
  });

  const criticalPositions = positions.filter(p => {
    const expDate = new Date(p.expiry);
    expDate.setHours(0, 0, 0, 0);
    const dte = Math.ceil((expDate.getTime() - today.getTime()) / 86400000);
    const r = probabilities.get(p.id);
    return dte <= 2 && r && r.probability >= 40;
  });

  const nearPositions = positions.filter(p => {
    const r = probabilities.get(p.id);
    return r?.status === 'near';
  });

  const urgentPositions = positions.filter(p => {
    const expDate = new Date(p.expiry);
    expDate.setHours(0, 0, 0, 0);
    const dte = Math.ceil((expDate.getTime() - today.getTime()) / 86400000);
    return dte >= 1 && dte <= 7;
  });

  // Determine banner to show (highest priority wins)
  let banner: BannerConfig | null = null;
  let priorityKey = 'none';

  if (expiringToday.length > 0) {
    priorityKey = 'expiring_today';
    banner = {
      priority: priorityKey,
      bg: 'rgba(220,38,38,0.12)',
      border: '1px solid rgba(220,38,38,0.3)',
      icon: <IconCalendar color="#dc2626" />,
      message: `${expiringToday.length} position${expiringToday.length > 1 ? 's' : ''} expiring today — check status after close`,
      tickers: expiringToday.map(p => `${p.ticker} $${p.strike} ${p.strategy}`).join(' · '),
    };
  } else if (itmPositions.length > 0) {
    priorityKey = 'itm';
    banner = {
      priority: priorityKey,
      bg: 'rgba(239,68,68,0.1)',
      border: '1px solid rgba(239,68,68,0.25)',
      icon: <IconWarningBanner color="#ef4444" />,
      message: `${itmPositions.length} position${itmPositions.length > 1 ? 's' : ''} in the money — assignment likely`,
      tickers: itmPositions.map(p => {
        const sp = probabilities.get(p.id);
        return sp ? `${p.ticker} $${p.strike} ${p.strategy}` : `${p.ticker} $${p.strike}`;
      }).join(' · '),
      pulse: true,
    };
  } else if (criticalPositions.length > 0) {
    priorityKey = 'critical';
    banner = {
      priority: priorityKey,
      bg: 'rgba(249,115,22,0.08)',
      border: '1px solid rgba(249,115,22,0.22)',
      icon: <IconBellBanner color="#f97316" />,
      message: `${criticalPositions.length} position${criticalPositions.length > 1 ? 's' : ''} within 2 days with >40% assignment probability`,
      tickers: criticalPositions.map(p => `${p.ticker} $${p.strike}`).join(' · '),
    };
  } else if (nearPositions.length > 0) {
    priorityKey = 'near';
    banner = {
      priority: priorityKey,
      bg: 'rgba(245,158,11,0.08)',
      border: '1px solid rgba(245,158,11,0.2)',
      icon: <IconEye color="#f59e0b" />,
      message: `${nearPositions.length} position${nearPositions.length > 1 ? 's' : ''} approaching strike level — monitor closely`,
      tickers: nearPositions.map(p => {
        const r = probabilities.get(p.id);
        return r ? `${p.ticker} $${p.strike} — $${Math.abs(r.distanceToStrike).toFixed(2)} ${r.distanceToStrike > 0 ? 'above' : 'below'} strike` : `${p.ticker} $${p.strike}`;
      }).join(' · '),
    };
  } else if (urgentPositions.length > 0) {
    priorityKey = 'expiry_week';
    banner = {
      priority: priorityKey,
      bg: 'rgba(0,229,196,0.05)',
      border: '1px solid rgba(0,229,196,0.15)',
      icon: <IconWeek color="#00e5c4" />,
      message: `${urgentPositions.length} position${urgentPositions.length > 1 ? 's' : ''} expiring this week — prepare for next cycle`,
      tickers: '',
    };
  }

  const [dismissed, dismiss] = useDismissed(getDismissKey(priorityKey));

  // Expiry Friday special banner (shown above main banner)
  const [expiryFridayDismissed, dismissExpiryFriday] = useDismissed(getDismissKey('expiry_friday'));
  const showExpiryFriday = isThirdFriday() && positions.length > 0 && !expiryFridayDismissed;

  if (!banner && !showExpiryFriday) return null;
  if (banner && dismissed) return showExpiryFriday ? renderExpiryFriday() : null;

  function renderExpiryFriday() {
    const expiringTodayForFriday = positions.filter(p => {
      const d = new Date(p.expiry);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });
    const collateral = expiringTodayForFriday
      .filter(p => !(probabilities.get(p.id)?.status === 'itm'))
      .reduce((s, p) => s + p.strike * p.contracts * 100, 0);

    return (
      <div style={{
        background: 'rgba(0,229,196,0.06)', border: '1px solid rgba(0,229,196,0.2)',
        borderLeft: isPaperMode ? '4px solid #f5c842' : '4px solid #00e5c4',
        borderRadius: 8, padding: '10px 16px', marginBottom: 8,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#00e5c4', fontSize: 13, fontWeight: 600, marginBottom: 6, fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconCalendar color="#00e5c4" /> Expiry Friday — Monthly options settle today
          </p>
          {expiringTodayForFriday.map(p => {
            const r = probabilities.get(p.id);
            const itm = r?.status === 'itm';
            return (
              <div key={p.id} style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', marginBottom: 3, color: itm ? '#ef4444' : '#00d68f', display: 'flex', alignItems: 'center', gap: 5 }}>
                {itm ? <IconAlert color="#ef4444" /> : <IconCheckmark color="#00d68f" />}
                {p.ticker} ${p.strike} {p.strategy} {itm ? 'ITM — assignment likely' : 'OTM — expires worthless'}
              </div>
            );
          })}
          {collateral > 0 && (
            <p style={{ color: '#9ab4d4', fontSize: 11, marginTop: 6, fontFamily: 'DM Sans, sans-serif' }}>
              Capital available after expiry: ~${collateral.toLocaleString()}
            </p>
          )}
        </div>
        <button onClick={dismissExpiryFriday}
          style={{ background: 'none', border: 'none', color: '#4a6a8a', cursor: 'pointer', fontSize: 16, padding: 2, lineHeight: 1 }}>
          ×
        </button>
      </div>
    );
  }

  return (
    <>
      {showExpiryFriday && renderExpiryFriday()}
      {banner && !dismissed && (
        <div
          role="status"
          style={{
            background: isPaperMode ? 'rgba(245,200,66,0.06)' : banner.bg,
            border: isPaperMode ? '1px solid rgba(245,200,66,0.2)' : banner.border,
            borderLeft: isPaperMode ? '3px solid #f5c842' : `3px solid ${banner.border.includes('220,38') ? '#dc2626' : banner.border.includes('239,68') ? '#ef4444' : banner.border.includes('249,115') ? '#f97316' : banner.border.includes('245,158') ? '#f59e0b' : '#00e5c4'}`,
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            animation: banner.pulse ? 'apg-pulse 2s ease-in-out infinite' : 'none',
          }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600, color: '#e8f0fe', margin: '0 0 3px', display: 'flex', alignItems: 'center', gap: 6 }}>
              {banner.icon} {banner.message}
            </p>
            {banner.tickers && (
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6a8fb0', margin: 0 }}>
                {banner.tickers}
              </p>
            )}
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            style={{ background: 'none', border: 'none', color: '#4a6a8a', cursor: 'pointer', fontSize: 16, padding: 2, lineHeight: 1, flexShrink: 0 }}>
            ×
          </button>
        </div>
      )}
    </>
  );
}

// Add the pulse keyframes reference (injected by AssignmentProbabilityGauge already, but add fallback)
const _BANNER_PULSE_STYLE = `@keyframes apg-pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }`;
void _BANNER_PULSE_STYLE; // silence unused warning
