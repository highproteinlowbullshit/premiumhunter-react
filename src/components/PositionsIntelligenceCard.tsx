import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, TrendingDown, ExternalLink } from 'lucide-react';
import type { DashboardIntelligence, PositionSnapshot } from '../hooks/useDashboardIntelligence';

// ── Helpers ───────────────────────────────────────────────────────────────────

function urgencyColor(u: PositionSnapshot['urgency']): string {
  if (u === 'today' || u === 'critical') return '#ff4d6d';
  if (u === 'urgent') return '#f5c842';
  if (u === 'watch') return '#00c6f5';
  return '#00e5c4';
}

function moneynessStyle(m: PositionSnapshot['moneyness']): { color: string; bg: string; label: string } {
  switch (m) {
    case 'itm':     return { color: '#ff4d6d', bg: 'rgba(255,77,109,0.15)', label: 'ITM' };
    case 'near':    return { color: '#f5c842', bg: 'rgba(245,200,66,0.13)', label: 'NEAR' };
    case 'watch':   return { color: '#00c6f5', bg: 'rgba(0,198,245,0.12)', label: 'WATCH' };
    case 'safe':    return { color: '#00d68f', bg: 'rgba(0,214,143,0.1)', label: 'SAFE' };
    default:        return { color: '#4a6a8a', bg: 'rgba(74,106,138,0.12)', label: '—' };
  }
}

function strategyStyle(s: 'CSP' | 'CC') {
  return s === 'CSP'
    ? { color: '#00c6f5', bg: 'rgba(0,198,245,0.1)' }
    : { color: '#00e5c4', bg: 'rgba(0,229,196,0.1)' };
}

function fmt$(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.abs(n).toFixed(0)}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryBar({ s }: { s: DashboardIntelligence['positionsSummary'] }) {
  const thetaPositive = s.totalDailyTheta >= 0;
  return (
    <div style={{
      display: 'flex', gap: 8, flexWrap: 'wrap',
      padding: '7px 10px', marginBottom: 10,
      background: 'rgba(0,229,196,0.04)',
      border: '1px solid rgba(0,229,196,0.07)',
      borderRadius: 8,
    }}>
      <StatPill
        label="Θ/day"
        value={`${thetaPositive ? '+' : '-'}${fmt$(s.totalDailyTheta)}`}
        color={thetaPositive ? '#00e5c4' : '#ff4d6d'}
      />
      <StatPill label="Avg DTE" value={`${s.avgDTE}d`} color="#a0b4cc" />
      {s.itmCount > 0 && (
        <StatPill label="ITM" value={String(s.itmCount)} color="#ff4d6d" />
      )}
      {s.nearCount > 0 && (
        <StatPill label="Near" value={String(s.nearCount)} color="#f5c842" />
      )}
      {s.urgentExpiryCount > 0 && (
        <StatPill label="Urgent" value={String(s.urgentExpiryCount)} color="#f5c842" />
      )}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
    </div>
  );
}

function PositionRow({ pos, onNavigate }: { pos: PositionSnapshot; onNavigate: (id: string) => void }) {
  const ms = moneynessStyle(pos.moneyness);
  const ss = strategyStyle(pos.strategy);
  const uColor = urgencyColor(pos.urgency);

  const hasRisk = pos.moneyness === 'itm' || pos.moneyness === 'near';

  return (
    <button
      onClick={() => onNavigate(pos.id)}
      title={`Open ${pos.ticker} ${pos.strategy} in Wheel Tracker`}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        width: '100%', padding: '6px 4px', background: 'none', border: 'none',
        cursor: 'pointer', borderRadius: 6, textAlign: 'left',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,196,0.05)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {/* Urgency dot */}
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: uColor, flexShrink: 0,
        boxShadow: hasRisk ? `0 0 4px ${uColor}` : 'none',
      }} />

      {/* Ticker */}
      <span style={{
        fontSize: 12, fontWeight: 700,
        color: 'var(--ph-text-1)', fontFamily: 'JetBrains Mono, monospace',
        minWidth: 44,
      }}>
        {pos.ticker}
      </span>

      {/* Strategy badge */}
      <span style={{
        fontSize: 9, fontWeight: 700,
        color: ss.color, background: ss.bg,
        padding: '1px 5px', borderRadius: 3,
        fontFamily: 'JetBrains Mono, monospace',
        flexShrink: 0,
      }}>
        {pos.strategy}
      </span>

      {/* DTE */}
      <span style={{
        fontSize: 11, color: pos.urgency !== 'ok' ? uColor : 'var(--ph-text-3)',
        fontFamily: 'JetBrains Mono, monospace', flexShrink: 0,
        minWidth: 26,
      }}>
        {pos.dte === 0 ? 'exp' : `${pos.dte}d`}
      </span>

      {/* Moneyness badge */}
      <span style={{
        fontSize: 9, fontWeight: 700,
        color: ms.color, background: ms.bg,
        padding: '1px 5px', borderRadius: 10,
        fontFamily: 'DM Sans, sans-serif', flexShrink: 0,
      }}>
        {ms.label}
      </span>

      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {/* Delta */}
      {pos.delta !== null && (
        <span style={{
          fontSize: 10, color: 'var(--ph-text-3)',
          fontFamily: 'JetBrains Mono, monospace', flexShrink: 0,
        }}>
          Δ{pos.delta > 0 ? '+' : ''}{pos.delta.toFixed(2)}
        </span>
      )}

      {/* Daily theta */}
      {pos.dailyTheta !== null && (
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: pos.dailyTheta >= 0 ? '#00e5c4' : '#ff4d6d',
          fontFamily: 'JetBrains Mono, monospace', flexShrink: 0,
          minWidth: 46, textAlign: 'right',
        }}>
          {pos.dailyTheta >= 0 ? '+' : '-'}{fmt$(pos.dailyTheta)}/d
        </span>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PositionsIntelligenceCard({ d }: { d: DashboardIntelligence }) {
  const navigate = useNavigate();
  const { positions, positionsSummary, openPositionCount } = d;

  const allSafe = openPositionCount > 0
    && positionsSummary.itmCount === 0
    && positionsSummary.nearCount === 0
    && positionsSummary.urgentExpiryCount === 0;

  const hasRisks = positionsSummary.itmCount > 0 || positionsSummary.urgentExpiryCount > 0;

  function handleNavigate(id: string) {
    navigate(`/wheel?highlight=${id}`);
  }

  return (
    <div style={{
      flex: 1, minWidth: 0, height: '100%',
      background: 'rgba(13,27,53,0.5)',
      border: `1px solid ${hasRisks ? 'rgba(255,77,109,0.2)' : 'rgba(0,229,196,0.08)'}`,
      borderRadius: 12, padding: '14px 14px',
      boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--ph-text-3)',
            fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.07em', textTransform: 'uppercase',
          }}>
            Positions
          </span>
          {openPositionCount > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: hasRisks ? '#ff4d6d' : '#00e5c4',
              background: hasRisks ? 'rgba(255,77,109,0.12)' : 'rgba(0,229,196,0.1)',
              padding: '1px 7px', borderRadius: 10,
              fontFamily: 'DM Sans, sans-serif',
            }}>
              {openPositionCount} open
            </span>
          )}
        </div>
        {openPositionCount > 0 && (
          <button
            onClick={() => navigate('/wheel')}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 11, color: '#00e5c4', background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: 0,
            }}
          >
            View all <ExternalLink size={10} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Empty state */}
      {openPositionCount === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px 0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--ph-text-2)', fontFamily: 'DM Sans, sans-serif' }}>No open positions</p>
          <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>Ready to deploy capital for the next cycle</p>
          <button
            onClick={() => navigate('/screener')}
            style={{ fontSize: 12, color: '#00e5c4', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
          >
            Open screener →
          </button>
        </div>
      ) : (
        <>
          {/* All safe banner */}
          {allSafe && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8,
              fontSize: 12, color: '#00d68f', fontFamily: 'DM Sans, sans-serif',
            }}>
              <Check size={12} strokeWidth={2.5} />
              All {openPositionCount} positions are comfortable
            </div>
          )}

          {/* Has-risk banner */}
          {hasRisks && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8,
              fontSize: 12, color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif',
            }}>
              <AlertTriangle size={12} strokeWidth={2} />
              {positionsSummary.itmCount > 0 && `${positionsSummary.itmCount} ITM`}
              {positionsSummary.itmCount > 0 && positionsSummary.urgentExpiryCount > 0 && ' · '}
              {positionsSummary.urgentExpiryCount > 0 && `${positionsSummary.urgentExpiryCount} urgent expiry`}
            </div>
          )}

          {/* Summary stats */}
          <SummaryBar s={positionsSummary} />

          {/* Position rows */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {positions.slice(0, 6).map(pos => (
              <PositionRow key={pos.id} pos={pos} onNavigate={handleNavigate} />
            ))}
            {positions.length > 6 && (
              <div style={{ fontSize: 11, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif', padding: '4px 4px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                <TrendingDown size={10} />
                +{positions.length - 6} more position{positions.length - 6 !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
