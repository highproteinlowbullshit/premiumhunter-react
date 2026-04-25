import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { AssignmentProbabilityResult } from '../lib/blackScholes';

interface Props {
  result: AssignmentProbabilityResult | null;
  strategy: 'CSP' | 'CC';
  strike: number;
  currentPrice: number | null;
  compact?: boolean;
}

const gaugeKeyframes = `
@keyframes apg-pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
@keyframes apg-urgent { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(0.97)} }
@keyframes apg-arc { from{stroke-dashoffset:201} }
`;

function probabilityColor(p: number): string {
  if (p <= 25) return '#14b8a6';
  if (p <= 40) return '#f59e0b';
  if (p <= 60) return '#f97316';
  return '#ef4444';
}

function statusBadgeStyle(status: AssignmentProbabilityResult['status']): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
    textTransform: 'uppercase', letterSpacing: '0.04em',
    padding: '1px 6px', borderRadius: 10, display: 'inline-block',
  };
  switch (status) {
    case 'safe':
      return { ...base, color: '#14b8a6', background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.2)' };
    case 'watch':
      return { ...base, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)',
        animation: 'apg-pulse 2s ease-in-out infinite' };
    case 'near':
      return { ...base, color: '#f97316', background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.2)',
        animation: 'apg-pulse 1.5s ease-in-out infinite' };
    case 'itm':
      return { ...base, color: '#ef4444', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
        animation: 'apg-urgent 1s ease-in-out infinite' };
    default:
      return { ...base, color: '#9ab4d4', background: 'rgba(154,180,212,0.1)', border: '1px solid rgba(154,180,212,0.15)' };
  }
}

function CircularGauge({ probability }: { probability: number }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - probability / 100);
  const color = probabilityColor(probability);

  return (
    <div style={{ position: 'relative', width: 80, height: 80 }}>
      <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
        {/* Background track */}
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        {/* Active fill */}
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease-out, stroke 0.3s ease', animation: 'apg-arc 0.6s ease-out' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>
          {probability.toFixed(0)}%
        </span>
        <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: '#4a6a8a', marginTop: 2 }}>
          assignment
        </span>
      </div>
    </div>
  );
}

export function AssignmentProbabilityGauge({ result, strategy, strike, currentPrice, compact: _compact = true }: Props) {
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.bottom + 8,
        left: Math.min(rect.left, window.innerWidth - 276),
      });
    }
  };

  const handleMouseLeave = () => setTooltipPos(null);

  // Null/loading state
  if (!result || currentPrice === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 60, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }} />
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#4a6a8a' }}>--%</span>
        <span style={{
          fontSize: 10, fontFamily: 'DM Sans, sans-serif', color: '#4a6a8a',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          padding: '1px 6px', borderRadius: 10,
        }}>
          No price
        </span>
      </div>
    );
  }

  const { probability, status, label, distanceToStrike, distancePercent, recommendation } = result;
  const color = probabilityColor(probability);
  const badgeStyle = statusBadgeStyle(status);

  const itmStyle: React.CSSProperties = status === 'itm'
    ? { borderLeft: '2px solid #ef4444', paddingLeft: 4, background: 'rgba(239,68,68,0.04)', borderRadius: 3 }
    : {};

  return (
    <>
      <style>{gaugeKeyframes}</style>
      <div ref={ref} style={{ position: 'relative', display: 'inline-block', ...itmStyle }}>
        {/* Compact row */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'default' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          aria-label={`Assignment probability: ${probability}%, status: ${label}`}
          role="img"
        >
          {/* Gradient bar */}
          <div style={{ position: 'relative', width: 60, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
            <div style={{
              position: 'absolute', inset: 0,
              borderRadius: 3,
              background: 'linear-gradient(to right, #14b8a6 0%, #22c55e 25%, #f59e0b 45%, #ef4444 75%, #dc2626 100%)',
              clipPath: `inset(0 ${100 - Math.min(100, probability)}% 0 0 round 3px)`,
            }} />
          </div>
          {/* Percentage */}
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 500, color, minWidth: 34, textAlign: 'right' }}>
            {probability.toFixed(0)}%
          </span>
          {/* Status badge */}
          <span style={badgeStyle}>
            {status === 'itm' ? 'ITM' : status === 'near' ? 'Near' : label}
          </span>
        </div>

        {/* Tooltip — rendered at body level to escape overflow/stacking constraints */}
        {tooltipPos && createPortal(
          <div style={{
            position: 'fixed',
            top: tooltipPos.top,
            left: tooltipPos.left,
            zIndex: 9999,
            pointerEvents: 'none',
            width: 260,
            background: 'rgba(10,22,40,0.99)',
            border: '1px solid rgba(0,229,196,0.2)',
            borderRadius: 12,
            padding: '14px 16px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
            fontFamily: 'DM Sans, sans-serif',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <CircularGauge probability={probability} />
              <div style={{ flex: 1, paddingLeft: 14 }}>
                <p style={{ color: '#e8f0fe', fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>
                  {strategy} ${strike}
                </p>
                <span style={badgeStyle}>{label}</span>
                <p style={{ color: '#6a8fb0', fontSize: 11, marginTop: 6 }}>
                  Stock at ${currentPrice.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Distance row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
              padding: '7px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 7,
            }}>
              <span style={{ fontSize: 12, color: status === 'itm' ? '#ef4444' : '#14b8a6' }}>
                {status === 'itm' ? '▼' : '▲'}
              </span>
              <span style={{ fontSize: 12, color: status === 'itm' ? '#ef4444' : '#9ab4d4' }}>
                {status === 'itm'
                  ? `In the money by $${Math.abs(distanceToStrike).toFixed(2)}`
                  : `$${Math.abs(distanceToStrike).toFixed(2)} (${distancePercent.toFixed(1)}%) from strike`}
              </span>
            </div>

            {/* Probability split bar */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#ef4444' }}>{probability.toFixed(0)}% assigned</span>
                <span style={{ fontSize: 11, color: '#14b8a6' }}>{(100 - probability).toFixed(0)}% worthless</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: '#14b8a6', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#ef4444', width: `${probability}%`, borderRadius: 3 }} />
              </div>
            </div>

            {/* Recommendation */}
            {recommendation && (
              <div style={{
                padding: '7px 10px', background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.2)', borderRadius: 7, marginBottom: 8,
              }}>
                <p style={{ fontSize: 11, color: '#f59e0b', margin: 0, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="5.5" cy="5.5" r="4.5" stroke="#f59e0b" strokeWidth="1.1" fill="rgba(245,158,11,0.1)" />
                    <line x1="5.5" y1="4.5" x2="5.5" y2="7.5" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />
                    <circle cx="5.5" cy="3.2" r="0.55" fill="#f59e0b" />
                  </svg>
                  {recommendation}
                </p>
              </div>
            )}

            {/* Data note */}
            <p style={{ fontSize: 9, color: '#2a4a6a', fontStyle: 'italic', margin: 0, textAlign: 'right' }}>
              Probability ≈ |Δ| · Black-Scholes · live prices
            </p>
          </div>,
          document.body
        )}
      </div>
    </>
  );
}
