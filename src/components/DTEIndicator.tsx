import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface DTEData {
  dte: number;
  isExpired: boolean;
  isToday: boolean;
  expiryLabel: string;
}

function calculateDTE(expiry: string): DTEData {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [ey, em, ed] = expiry.split('-').map(Number);
  const expiryDate = new Date(ey, em - 1, ed); // local midnight, avoids UTC parse off-by-one
  const diffMs = expiryDate.getTime() - today.getTime();
  const dte = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return {
    dte: Math.max(0, dte),
    isExpired: dte < 0,
    isToday: dte === 0,
    expiryLabel: expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

function countTradingDays(expiry: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [ty, tm, td] = expiry.split('-').map(Number);
  const end = new Date(ty, tm - 1, td);
  let count = 0;
  const cur = new Date(today);
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

// ── Zone icons — SVG only, no emoji ──────────────────────────────────────────

function IconToday({ color }: { color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="5" cy="5" r="4.5" fill={color} fillOpacity="0.9" />
    </svg>
  );
}

function IconWarning({ color }: { color: string }) {
  return (
    <svg width="11" height="10" viewBox="0 0 11 10" fill="none" style={{ flexShrink: 0 }}>
      <path d="M5.5 1L10 9H1L5.5 1Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" fill={color} fillOpacity="0.15" />
      <line x1="5.5" y1="4" x2="5.5" y2="6.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="5.5" cy="7.8" r="0.5" fill={color} />
    </svg>
  );
}

function IconBell({ color }: { color: string }) {
  return (
    <svg width="10" height="11" viewBox="0 0 10 11" fill="none" style={{ flexShrink: 0 }}>
      <path d="M5 1C5 1 2 2.5 2 5.5V7H8V5.5C8 2.5 5 1 5 1Z" stroke={color} strokeWidth="1.1" strokeLinejoin="round" fill={color} fillOpacity="0.12" />
      <line x1="1" y1="7" x2="9" y2="7" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M4 7.5C4 8.05 4.45 8.5 5 8.5C5.55 8.5 6 8.05 6 7.5" stroke={color} strokeWidth="1" fill="none" />
    </svg>
  );
}

function IconClock({ color }: { color: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="5.5" cy="5.5" r="4.5" stroke={color} strokeWidth="1.1" fill={color} fillOpacity="0.08" />
      <line x1="5.5" y1="3" x2="5.5" y2="5.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="5.5" y1="5.5" x2="7.5" y2="6.8" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconDot({ color }: { color: string }) {
  return (
    <svg width="6" height="6" viewBox="0 0 6 6" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="3" cy="3" r="2.5" fill={color} fillOpacity="0.7" />
    </svg>
  );
}

interface ZoneConfig {
  color: string;
  bold: boolean;
  bgColor: string | null;
  pulse: boolean;
  pulseSlow: boolean;
  icon: React.ReactNode | null;
}

function getZone(dte: number, isExpired: boolean, isToday: boolean): ZoneConfig {
  if (isExpired)  return { color: '#7f1d1d', bold: false, bgColor: null,                        pulse: false, pulseSlow: false, icon: null };
  if (isToday)    return { color: '#dc2626', bold: true,  bgColor: 'rgba(220,38,38,0.15)',       pulse: true,  pulseSlow: false, icon: <IconToday color="#dc2626" /> };
  if (dte <= 2)   return { color: '#dc2626', bold: true,  bgColor: 'rgba(220,38,38,0.15)',       pulse: true,  pulseSlow: false, icon: <IconWarning color="#dc2626" /> };
  if (dte <= 6)   return { color: '#ef4444', bold: true,  bgColor: 'rgba(239,68,68,0.12)',       pulse: false, pulseSlow: true,  icon: <IconBell color="#ef4444" /> };
  if (dte <= 13)  return { color: '#f97316', bold: true,  bgColor: 'rgba(249,115,22,0.1)',       pulse: false, pulseSlow: false, icon: <IconClock color="#f97316" /> };
  if (dte <= 21)  return { color: '#f59e0b', bold: false, bgColor: null,                        pulse: false, pulseSlow: false, icon: <IconDot color="#f59e0b" /> };
  return           { color: '#9ab4d4',       bold: false, bgColor: null,                        pulse: false, pulseSlow: false, icon: null };
}

function getZoneHint(dte: number, isToday: boolean, isExpired: boolean): string {
  if (isExpired) return 'Position has expired';
  if (isToday)   return 'Expiring today — check position status after market close';
  if (dte <= 2)  return 'Final days — prepare for outcome (expire or assign)';
  if (dte <= 6)  return 'Review position now — determine hold or next action';
  if (dte <= 13) return 'Begin planning next monthly cycle';
  if (dte <= 21) return 'Start monitoring — approaching the final stretch';
  return 'Position has comfortable time remaining';
}

interface Props {
  expiry: string;
  strategy: 'CSP' | 'CC';
  compact?: boolean;
}

const pulseKeyframes = `
@keyframes dte-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
@keyframes dte-pulse-slow { 0%,100%{opacity:1} 50%{opacity:0.7} }
`;

export function DTEIndicator({ expiry, compact: _compact = true }: Props) {
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { dte, isExpired, isToday, expiryLabel } = calculateDTE(expiry);
  const zone = getZone(dte, isExpired, isToday);
  const tradingDays = countTradingDays(expiry);
  const hint = getZoneHint(dte, isToday, isExpired);

  const handleMouseEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.bottom + 6,
        left: Math.min(rect.left, window.innerWidth - 236),
      });
    }
  };

  const handleMouseLeave = () => setTooltipPos(null);

  const pulseStyle = zone.pulse
    ? { animation: 'dte-pulse 1s ease-in-out infinite' }
    : zone.pulseSlow
      ? { animation: 'dte-pulse-slow 1.5s ease-in-out infinite' }
      : {};

  const dteLabel = isExpired ? 'EXPIRED' : isToday ? 'TODAY' : `${dte}d`;

  const [fey, fem, fed] = expiry.split('-').map(Number);
  const fullExpiry = new Date(fey, fem - 1, fed).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <>
      <style>{pulseKeyframes}</style>
      <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 1, cursor: 'default' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Main DTE pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: zone.bgColor ?? 'transparent',
            borderRadius: zone.bgColor ? 5 : 0,
            padding: zone.bgColor ? '2px 6px' : 0,
            ...pulseStyle,
          }}>
            {zone.icon}
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 13,
              fontWeight: zone.bold ? 700 : 500,
              color: zone.color,
              textDecoration: isExpired ? 'line-through' : 'none',
            }}>
              {dteLabel}
            </span>
          </div>
          {/* Expiry date label */}
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: '#4a6a8a' }}>
            {expiryLabel}
          </span>
        </div>

        {/* Tooltip — portal escapes overflow/stacking constraints */}
        {tooltipPos && createPortal(
          <div style={{
            position: 'fixed', top: tooltipPos.top, left: tooltipPos.left, zIndex: 9999,
            pointerEvents: 'none',
            width: 220,
            background: 'rgba(10,22,40,0.98)',
            border: '1px solid rgba(0,229,196,0.2)',
            borderRadius: 10, padding: '12px 14px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            fontFamily: 'DM Sans, sans-serif',
          }}>
            <p style={{ color: '#9ab4d4', fontSize: 11, marginBottom: 6 }}>
              Expires: {fullExpiry}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#4a6a8a', fontSize: 12 }}>Calendar days</span>
              <span style={{ color: zone.color, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700 }}>{dte}d</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: '#4a6a8a', fontSize: 12 }}>Trading days</span>
              <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{tradingDays}d</span>
            </div>
            <p style={{ color: '#6a8fb0', fontSize: 11, lineHeight: 1.5, padding: '8px 10px', background: 'rgba(0,229,196,0.04)', borderRadius: 6, margin: 0 }}>
              {hint}
            </p>
          </div>,
          document.body
        )}
      </div>
    </>
  );
}
