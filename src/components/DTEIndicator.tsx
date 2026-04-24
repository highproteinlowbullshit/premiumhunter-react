import { useState, useRef, useEffect } from 'react';

interface DTEData {
  dte: number;
  isExpired: boolean;
  isToday: boolean;
  expiryLabel: string;
}

function calculateDTE(expiry: string): DTEData {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(expiry);
  expiryDate.setHours(0, 0, 0, 0);
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
  const end = new Date(expiry);
  end.setHours(0, 0, 0, 0);
  let count = 0;
  const cur = new Date(today);
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

interface ZoneConfig {
  color: string;
  bold: boolean;
  bgColor: string | null;
  pulse: boolean;
  pulseSlow: boolean;
  icon: string | null;
}

function getZone(dte: number, isExpired: boolean, isToday: boolean): ZoneConfig {
  if (isExpired)  return { color: '#7f1d1d', bold: false, bgColor: null, pulse: false, pulseSlow: false, icon: null };
  if (isToday)    return { color: '#dc2626', bold: true,  bgColor: 'rgba(220,38,38,0.15)', pulse: true,  pulseSlow: false, icon: '🔴' };
  if (dte <= 2)   return { color: '#dc2626', bold: true,  bgColor: 'rgba(220,38,38,0.15)', pulse: true,  pulseSlow: false, icon: '⚠' };
  if (dte <= 6)   return { color: '#ef4444', bold: true,  bgColor: 'rgba(239,68,68,0.12)', pulse: false, pulseSlow: true,  icon: '🔔' };
  if (dte <= 13)  return { color: '#f97316', bold: true,  bgColor: 'rgba(249,115,22,0.1)', pulse: false, pulseSlow: false, icon: '⏰' };
  if (dte <= 21)  return { color: '#f59e0b', bold: false, bgColor: null, pulse: false, pulseSlow: false, icon: '⏱' };
  return           { color: '#9ab4d4',       bold: false, bgColor: null, pulse: false, pulseSlow: false, icon: null };
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

export function DTEIndicator({ expiry, compact = true }: Props) {
  const [tooltip, setTooltip] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { dte, isExpired, isToday, expiryLabel } = calculateDTE(expiry);
  const zone = getZone(dte, isExpired, isToday);
  const tradingDays = countTradingDays(expiry);
  const hint = getZoneHint(dte, isToday, isExpired);

  useEffect(() => {
    if (!tooltip) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setTooltip(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tooltip]);

  const pulseStyle = zone.pulse
    ? { animation: 'dte-pulse 1s ease-in-out infinite' }
    : zone.pulseSlow
      ? { animation: 'dte-pulse-slow 1.5s ease-in-out infinite' }
      : {};

  const dteLabel = isExpired ? 'EXPIRED'
    : isToday ? 'TODAY'
    : `${dte}d`;

  const fullExpiry = new Date(expiry).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <>
      <style>{pulseKeyframes}</style>
      <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 1, cursor: 'default' }}
          onMouseEnter={() => setTooltip(true)}
          onMouseLeave={() => setTooltip(false)}
        >
          {/* Main DTE pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: zone.bgColor ?? 'transparent',
            borderRadius: zone.bgColor ? 5 : 0,
            padding: zone.bgColor ? '2px 6px' : 0,
            ...pulseStyle,
          }}>
            {zone.icon && !compact && (
              <span style={{ fontSize: 11 }}>{zone.icon}</span>
            )}
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 13,
              fontWeight: zone.bold ? 700 : 500,
              color: zone.color,
              textDecoration: isExpired ? 'line-through' : 'none',
            }}>
              {zone.icon && compact ? `${zone.icon} ` : ''}{dteLabel}
            </span>
          </div>
          {/* Expiry date label */}
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: '#4a6a8a' }}>
            {expiryLabel}
          </span>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 100,
            marginTop: 6,
            width: 220,
            background: 'rgba(10,22,40,0.98)',
            border: '1px solid rgba(0,229,196,0.2)',
            borderRadius: 10,
            padding: '12px 14px',
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
          </div>
        )}
      </div>
    </>
  );
}
