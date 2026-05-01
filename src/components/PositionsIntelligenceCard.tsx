import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PositionSnapshot, DashboardIntelligence } from '../hooks/useDashboardIntelligence';

// ── Color constants ───────────────────────────────────────────────────────────
// Teal: safe, positive, theta income, profit
// Green: excellent (>= 75%)
// Amber: watch, moderate risk
// Orange: near strike, elevated risk
// Red: ITM, urgent action

const C = {
  teal:   '#14b8a6',
  green:  '#22c55e',
  amber:  '#f59e0b',
  orange: '#f97316',
  red:    '#ef4444',
  muted:  '#6b7280',
  text1:  '#e8f0fe',
  text2:  '#a0b4cc',
  border: 'rgba(20,184,166,0.08)',
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function safetyColor(s: PositionSnapshot['safetyStatus']): string {
  return s === 'itm' ? C.red : s === 'near' ? C.orange : s === 'watch' ? C.amber : C.teal;
}

function profitColor(pct: number | null): string {
  if (pct === null) return C.muted;
  if (pct >= 75) return C.green;
  if (pct >= 50) return C.teal;
  if (pct >= 25) return C.amber;
  return C.muted;
}

function distColor(pct: number | null): string {
  if (pct === null) return C.muted;
  if (pct > 10) return C.teal;
  if (pct > 5) return C.amber;
  return C.orange;
}

function fmt$(n: number, abs = false): string {
  const v = abs ? Math.abs(n) : n;
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${Math.abs(v).toFixed(0)}`;
}

function fmtExpiry(expiry: string): string {
  const d = new Date(expiry);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow({ delay }: { delay: number }) {
  return (
    <div style={{
      padding: '8px 0',
      opacity: 0,
      animation: `pic-fadein 200ms ease-out ${delay}ms forwards`,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
        <div style={{ width: 3, height: 32, borderRadius: 2, background: 'rgba(74,106,138,0.2)' }} />
        <div style={{ width: 44, height: 13, borderRadius: 4, background: 'rgba(74,106,138,0.15)', animation: 'pulse 1.6s infinite' }} />
        <div style={{ width: 28, height: 11, borderRadius: 10, background: 'rgba(74,106,138,0.1)', animation: 'pulse 1.6s infinite' }} />
        <div style={{ flex: 1 }} />
        <div style={{ width: 60, height: 8, borderRadius: 3, background: 'rgba(74,106,138,0.1)', animation: 'pulse 1.6s infinite' }} />
        <div style={{ width: 48, height: 11, borderRadius: 3, background: 'rgba(74,106,138,0.12)', animation: 'pulse 1.6s infinite' }} />
      </div>
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function PositionTooltip({ pos }: { pos: PositionSnapshot }) {
  return (
    <div style={{
      position: 'absolute', left: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)',
      zIndex: 1000, width: 260,
      background: 'rgba(5,13,26,0.97)', border: '1px solid rgba(20,184,166,0.2)',
      borderRadius: 10, padding: '12px 14px', fontSize: 11,
      fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6,
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      pointerEvents: 'none',
    }}>
      <div style={{ fontWeight: 700, color: C.text1, marginBottom: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
        {pos.ticker} {pos.strategy} ${pos.strike} · {fmtExpiry(pos.expiry)}
      </div>
      <div style={{ height: 1, background: 'rgba(20,184,166,0.15)', margin: '6px 0' }} />

      <div style={{ color: C.text2 }}>Opened {pos.openedDaysAgo}d ago at {fmt$(pos.premiumCollected)}/contract</div>
      <div style={{ color: C.text2 }}>Total premium: {fmt$(pos.totalPremium)}</div>
      {pos.estimatedCurrentValue !== null && (
        <div style={{ color: C.text2 }}>Est. current value: ~${pos.estimatedCurrentValue.toFixed(2)}/share</div>
      )}
      {pos.estimatedPnL !== null && (
        <div style={{ color: pos.estimatedPnL >= 0 ? C.teal : C.red, fontWeight: 600 }}>
          Est. P&L: {pos.estimatedPnL >= 0 ? '+' : ''}{fmt$(pos.estimatedPnL)}
          {pos.estimatedPnLPercent !== null && ` (${pos.estimatedPnLPercent.toFixed(1)}%)`}
        </div>
      )}

      <div style={{ height: 1, background: 'rgba(20,184,166,0.15)', margin: '6px 0' }} />
      {pos.assignmentProbability !== null && (
        <div style={{ color: C.text2 }}>Assignment probability: ~{pos.assignmentProbability.toFixed(1)}%</div>
      )}
      {pos.dailyTheta !== null && (
        <div style={{ color: C.teal }}>Daily theta: +{fmt$(pos.dailyTheta)}/day</div>
      )}
      {pos.thetaToDate !== null && pos.thetaToDate > 0 && (
        <div style={{ color: C.text2 }}>Theta earned so far: ~{fmt$(pos.thetaToDate)}</div>
      )}
      {pos.impliedVolatility !== null && (
        <div style={{ color: C.text2 }}>IV: {pos.impliedVolatility.toFixed(1)}%</div>
      )}

      <div style={{ height: 1, background: 'rgba(20,184,166,0.15)', margin: '6px 0' }} />
      <div style={{ color: pos.suggestedAction === 'urgent' ? C.red : pos.suggestedAction === 'review' ? C.amber : C.text2, fontStyle: 'italic' }}>
        {pos.actionReason}
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProfitBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ fontSize: 10, color: C.muted }}>—</span>;
  const color = profitColor(pct);
  const show50 = pct >= 50;
  return (
    <div style={{ minWidth: 72 }}>
      {show50 && (
        <div style={{ fontSize: 9, color: C.amber, marginBottom: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.amber, display: 'inline-block' }} />
          Close?
        </div>
      )}
      <div style={{
        height: 4, borderRadius: 2, background: 'rgba(74,106,138,0.2)',
        overflow: 'hidden', marginBottom: 2,
      }}>
        <div style={{
          height: '100%', width: `${Math.min(100, pct)}%`,
          background: color, borderRadius: 2,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <div style={{ fontSize: 10, color, fontFamily: 'JetBrains Mono, monospace' }}>
        {pct.toFixed(0)}% cap.
      </div>
    </div>
  );
}

// ── Position row ──────────────────────────────────────────────────────────────

function PositionRow({ pos, index, onNavigate }: {
  pos: PositionSnapshot;
  index: number;
  onNavigate: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const borderColor = safetyColor(pos.safetyStatus);
  const showAction = pos.suggestedAction !== 'hold';
  const actionColor = pos.suggestedAction === 'urgent' ? C.red : pos.suggestedAction === 'review' ? C.amber : C.teal;
  const actionIcon = pos.suggestedAction === 'urgent' ? '⚠' : pos.suggestedAction === 'review' ? '👁' : '○';
  const stratColor = pos.strategy === 'CSP'
    ? { color: '#00c6f5', bg: 'rgba(0,198,245,0.1)' }
    : { color: '#00e5c4', bg: 'rgba(0,229,196,0.1)' };

  return (
    <div
      style={{
        position: 'relative',
        opacity: 0,
        animation: `pic-fadein 200ms ease-out ${index * 50}ms forwards`,
      }}
    >
      <button
        onClick={() => onNavigate(pos.positionId)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '100%', background: pos.isITM ? 'rgba(239,68,68,0.04)' : hovered ? 'rgba(20,184,166,0.04)' : 'none',
          border: 'none', cursor: 'pointer', textAlign: 'left', padding: '6px 0',
          borderRadius: 6, transition: 'background 0.15s',
          display: 'flex', flexDirection: 'column', gap: 0,
        }}
      >
        {/* Main data row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 10 }}>
          {/* Left status border */}
          <div style={{
            position: 'absolute', left: 0, top: 4, bottom: 4,
            width: 3, borderRadius: 2, background: borderColor,
            boxShadow: pos.isITM || pos.safetyStatus === 'near' ? `0 0 6px ${borderColor}` : 'none',
          }} />

          {/* Ticker + strategy */}
          <div style={{ minWidth: 72, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text1, fontFamily: 'JetBrains Mono, monospace' }}>
              {pos.ticker}
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, color: stratColor.color, background: stratColor.bg,
              padding: '1px 5px', borderRadius: 3, fontFamily: 'JetBrains Mono, monospace',
            }}>
              {pos.strategy}
            </span>
          </div>

          {/* Strike + expiry */}
          <div style={{ minWidth: 80 }}>
            <div style={{ fontSize: 12, color: C.text2, fontFamily: 'JetBrains Mono, monospace' }}>${pos.strike}</div>
            <div style={{ fontSize: 10, color: C.muted }}>
              {fmtExpiry(pos.expiry)} · <span style={{ color: pos.dteZone !== 'comfortable' ? safetyColor(pos.safetyStatus) : C.muted }}>
                {pos.dte === 0 ? 'exp' : `${pos.dte}d`}
              </span>
            </div>
          </div>

          {/* Price distance */}
          <div style={{ minWidth: 76 }}>
            {pos.currentPrice === null ? (
              <span style={{ fontSize: 10, color: C.muted }}>—</span>
            ) : pos.isITM ? (
              <span style={{ fontSize: 11, color: C.red, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
                ITM ${pos.distanceFromStrike?.toFixed(2)}
              </span>
            ) : (
              <span style={{ fontSize: 11, color: distColor(pos.distancePercent), fontFamily: 'JetBrains Mono, monospace' }}>
                {pos.distancePercent?.toFixed(1)}% away
              </span>
            )}
          </div>

          {/* % of max profit bar */}
          <ProfitBar pct={pos.percentOfMaxProfit} />

          {/* Daily theta */}
          <div style={{ minWidth: 52, textAlign: 'right' }}>
            {pos.dailyTheta !== null ? (
              <span style={{ fontSize: 10, color: C.teal, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
                +{fmt$(pos.dailyTheta)}/d
              </span>
            ) : (
              <span style={{ fontSize: 10, color: C.muted }}>—</span>
            )}
          </div>
        </div>

        {/* Action hint sub-row */}
        {showAction && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            paddingLeft: 18, marginTop: 2,
            fontSize: 11, color: actionColor, fontStyle: 'italic',
            maxHeight: 20, overflow: 'hidden',
          }}>
            <span style={{ fontSize: 10, flexShrink: 0 }}>{actionIcon}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pos.actionReason}
            </span>
          </div>
        )}
      </button>

      {/* Hover tooltip */}
      {hovered && <PositionTooltip pos={pos} />}
    </div>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({ summary }: { summary: DashboardIntelligence['positionsSummary'] }) {
  const avgColor = profitColor(summary.avgPercentOfMaxProfit);
  return (
    <div style={{
      display: 'flex', gap: 0, marginBottom: 10,
      background: 'rgba(20,184,166,0.03)',
      border: '1px solid rgba(20,184,166,0.07)',
      borderRadius: 8, overflow: 'hidden',
    }}>
      {/* Avg profit captured */}
      <div style={{ flex: 1, padding: '7px 10px', borderRight: '1px solid rgba(20,184,166,0.06)' }}>
        <div style={{ fontSize: 9, color: C.muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg captured</div>
        <div style={{
          height: 3, borderRadius: 2, background: 'rgba(74,106,138,0.2)',
          overflow: 'hidden', marginBottom: 3,
        }}>
          <div style={{
            height: '100%', width: `${Math.min(100, summary.avgPercentOfMaxProfit)}%`,
            background: avgColor, borderRadius: 2, transition: 'width 0.5s ease',
          }} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: avgColor, fontFamily: 'JetBrains Mono, monospace' }}>
          {summary.avgPercentOfMaxProfit.toFixed(0)}%
        </div>
      </div>

      {/* Total at stake */}
      <div style={{ flex: 1, padding: '7px 10px', borderRight: '1px solid rgba(20,184,166,0.06)' }}>
        <div style={{ fontSize: 9, color: C.muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>At stake</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, fontFamily: 'JetBrains Mono, monospace', marginTop: 6 }}>
          {fmt$(summary.totalPotentialPremium)}
        </div>
      </div>

      {/* Daily theta */}
      <div style={{ flex: 1, padding: '7px 10px' }}>
        <div style={{ fontSize: 9, color: C.muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Daily θ</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.teal, fontFamily: 'JetBrains Mono, monospace', marginTop: 6 }}>
          +{fmt$(summary.totalDailyTheta)}/d
        </div>
      </div>
    </div>
  );
}

// ── Health dots ───────────────────────────────────────────────────────────────

function HealthDots({ summary }: { summary: DashboardIntelligence['positionsSummary'] }) {
  const dots: Array<{ color: string; count: number }> = [
    { color: C.teal, count: summary.safeCount },
    { color: C.amber, count: summary.watchCount },
    { color: C.orange, count: summary.nearCount },
    { color: C.red, count: summary.itmCount },
  ];
  const title = `${summary.safeCount} safe · ${summary.watchCount} watch · ${summary.nearCount} near strike · ${summary.itmCount} ITM`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} title={title}>
      {dots.flatMap(({ color, count }) =>
        Array.from({ length: count }, (_, i) => (
          <span
            key={`${color}-${i}`}
            style={{
              width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
              background: color, flexShrink: 0,
            }}
          />
        ))
      )}
    </div>
  );
}

// ── 50% callout ───────────────────────────────────────────────────────────────

function FiftyPercentCallout({ positions, onNavigate }: {
  positions: PositionSnapshot[];
  onNavigate: () => void;
}) {
  const single = positions.length === 1 ? positions[0] : null;
  return (
    <div style={{
      margin: '10px 0',
      padding: '9px 12px',
      background: 'rgba(20,184,166,0.06)',
      borderLeft: '3px solid rgba(20,184,166,0.4)',
      borderRadius: '0 8px 8px 0',
      animation: 'softPulse 3s ease infinite',
    }}>
      <div style={{ fontSize: 12, color: C.teal, marginBottom: 3 }}>
        💡 {single
          ? `${single.ticker} at ${single.percentOfMaxProfit?.toFixed(0)}% max profit`
          : `${positions.length} positions at or above 50% profit`
        }
      </div>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 6, lineHeight: 1.4 }}>
        {single
          ? 'The 50% rule: consider closing to lock in gains and free up capital for the next cycle.'
          : 'Review in tracker — closing these frees capital for the next cycle.'
        }
      </div>
      <button
        onClick={onNavigate}
        style={{
          fontSize: 11, color: C.teal, background: 'none', border: 'none',
          cursor: 'pointer', padding: 0, fontFamily: 'DM Sans, sans-serif',
        }}
      >
        View position{positions.length > 1 ? 's' : ''} →
      </button>
    </div>
  );
}

// ── Risk summary strip ────────────────────────────────────────────────────────

function RiskSummaryStrip({ summary }: { summary: DashboardIntelligence['positionsSummary'] }) {
  const riskPill = summary.itmCount > 0
    ? { label: `⚠ ${summary.itmCount} ITM`, color: C.red, bg: 'rgba(239,68,68,0.12)' }
    : summary.nearCount > 0
    ? { label: `◎ ${summary.nearCount} near strike`, color: C.orange, bg: 'rgba(249,115,22,0.12)' }
    : summary.watchCount > 0
    ? { label: `○ ${summary.watchCount} watching`, color: C.amber, bg: 'rgba(245,158,11,0.12)' }
    : { label: '✓ All positions safe', color: C.teal, bg: 'rgba(20,184,166,0.1)' };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 10px', marginTop: 8,
      background: 'rgba(5,13,26,0.4)',
      borderTop: '1px solid rgba(20,184,166,0.06)',
      borderRadius: '0 0 10px 10px',
      margin: '8px -14px -14px',
      gap: 8, flexWrap: 'wrap',
    }}>
      {/* Risk pill */}
      <span style={{
        fontSize: 10, fontWeight: 600, color: riskPill.color, background: riskPill.bg,
        padding: '2px 8px', borderRadius: 10, fontFamily: 'DM Sans, sans-serif', flexShrink: 0,
      }}>
        {riskPill.label}
      </span>

      {/* Best performer */}
      {summary.bestPerformer && (
        <span style={{ fontSize: 10, color: C.text2, fontFamily: 'DM Sans, sans-serif' }}>
          Best: <strong style={{ color: C.teal, fontFamily: 'JetBrains Mono, monospace' }}>
            {summary.bestPerformer.ticker}
          </strong>{' '}
          <span style={{ color: C.teal }}>+{summary.bestPerformer.percentOfMaxProfit?.toFixed(0)}%</span>
        </span>
      )}

      {/* Worst performer */}
      {summary.worstPerformer && summary.worstPerformer.positionId !== summary.bestPerformer?.positionId && (
        <span style={{ fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}>
          {(summary.worstPerformer.estimatedPnL ?? 0) < 0 ? (
            <span style={{ color: C.amber }}>
              Review: <strong style={{ fontFamily: 'JetBrains Mono, monospace' }}>{summary.worstPerformer.ticker}</strong>
            </span>
          ) : (
            <span style={{ color: C.muted }}>
              Worst: <strong style={{ fontFamily: 'JetBrains Mono, monospace' }}>{summary.worstPerformer.ticker}</strong>{' '}
              {summary.worstPerformer.percentOfMaxProfit?.toFixed(0)}%
            </span>
          )}
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  positions: PositionSnapshot[];
  summary: DashboardIntelligence['positionsSummary'];
  isLoading: boolean;
  onNavigateToTracker: () => void;
}

export function PositionsIntelligenceCard({ positions, summary, isLoading, onNavigateToTracker }: Props) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  const visiblePositions = showAll ? positions : positions.slice(0, 5);
  const hiddenCount = positions.length - 5;
  const at50 = positions.filter(p => (p.percentOfMaxProfit ?? 0) >= 50);
  const hasRisk = summary.itmCount > 0 || summary.nearCount > 0;

  function handleNavigate(id: string) {
    navigate(`/wheel?highlight=${id}`);
  }

  return (
    <div style={{
      flex: 1, minWidth: 0, height: '100%', position: 'relative',
      background: 'rgba(13,27,53,0.5)',
      border: `1px solid ${hasRisk ? 'rgba(239,68,68,0.2)' : C.border}`,
      borderRadius: 12, padding: '14px 14px',
      boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes pic-fadein { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        @keyframes softPulse { 0%,100% { border-left-color:rgba(20,184,166,0.4); } 50% { border-left-color:rgba(20,184,166,0.9); } }
      `}</style>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!isLoading && positions.length === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 32, fontWeight: 200, color: C.teal, marginBottom: 8, lineHeight: 1 }}>Θ</div>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: C.text2, fontFamily: 'DM Sans, sans-serif' }}>No open positions</p>
          <p style={{ margin: '0 0 14px', fontSize: 11, color: C.muted, fontFamily: 'DM Sans, sans-serif', textAlign: 'center' }}>
            Ready to deploy capital for the next monthly cycle
          </p>
          <button
            onClick={() => navigate('/screener')}
            style={{ fontSize: 12, color: C.teal, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
          >
            Browse screener →
          </button>
        </div>
      )}

      {/* ── Loading state ────────────────────────────────────────────────── */}
      {isLoading && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ width: 120, height: 13, borderRadius: 4, background: 'rgba(74,106,138,0.15)', animation: 'pulse 1.6s infinite' }} />
            <div style={{ width: 60, height: 11, borderRadius: 4, background: 'rgba(74,106,138,0.1)', animation: 'pulse 1.6s infinite' }} />
          </div>
          {[0, 50, 100].map(delay => <SkeletonRow key={delay} delay={delay} />)}
        </>
      )}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {!isLoading && positions.length > 0 && (
        <>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text1, fontFamily: 'DM Sans, sans-serif' }}>
                Your positions
              </span>
              <span style={{ fontSize: 11, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>
                {summary.totalCount} open
              </span>
              <HealthDots summary={summary} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: C.teal, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                Θ +{fmt$(summary.totalDailyTheta)}/day
              </span>
              <button
                onClick={onNavigateToTracker}
                style={{ fontSize: 11, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: 0 }}
              >
                View all →
              </button>
            </div>
          </div>

          {/* Summary bar */}
          <SummaryBar summary={summary} />

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(20,184,166,0.06)', marginBottom: 8 }} />

          {/* Position rows */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {visiblePositions.map((pos, i) => (
              <PositionRow
                key={pos.positionId}
                pos={pos}
                index={i}
                onNavigate={handleNavigate}
              />
            ))}

            {!showAll && hiddenCount > 0 && (
              <button
                onClick={() => setShowAll(true)}
                style={{
                  fontSize: 11, color: C.muted, background: 'none', border: 'none',
                  cursor: 'pointer', padding: '4px 0', fontFamily: 'DM Sans, sans-serif',
                  width: '100%', textAlign: 'left',
                }}
              >
                Show {hiddenCount} more →
              </button>
            )}
          </div>

          {/* 50% callout */}
          {at50.length > 0 && (
            <FiftyPercentCallout positions={at50} onNavigate={onNavigateToTracker} />
          )}

          {/* Risk summary strip */}
          <RiskSummaryStrip summary={summary} />
        </>
      )}
    </div>
  );
}
