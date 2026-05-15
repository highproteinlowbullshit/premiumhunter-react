import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Eye, Lightbulb, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import type { PositionSnapshot, DashboardIntelligence } from '../hooks/useDashboardIntelligence';
import { usePaperMode } from '../context/PaperModeContext';
import { blackScholes } from '../lib/blackScholes';

// ── Color constants ───────────────────────────────────────────────────────────

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

function profitColor(pct: number | null): string {
  if (pct === null) return C.muted;
  if (pct >= 75) return C.green;
  if (pct >= 50) return C.teal;
  if (pct >= 25) return C.amber;
  return C.muted;
}

function fmt$(n: number, abs = false): string {
  const v = abs ? Math.abs(n) : n;
  const a = Math.abs(v);
  if (a >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  if (a >= 10) return `$${a.toFixed(0)}`;
  return `$${a.toFixed(2)}`;
}

function fmtExpiry(expiry: string): string {
  const d = new Date(expiry);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Live price override ───────────────────────────────────────────────────────
// Given a snapshot position and a fresh live price, recomputes every
// price-derived field so the display reflects current market data.

function applyLivePrice(pos: PositionSnapshot, livePrice: number | undefined): PositionSnapshot {
  if (!livePrice || livePrice <= 0) return pos;

  const currentPrice = livePrice;
  const isITM = pos.strategy === 'CSP'
    ? currentPrice < pos.strike
    : currentPrice > pos.strike;
  const distanceFromStrike = Math.abs(currentPrice - pos.strike);
  const distancePercent = Math.round((distanceFromStrike / currentPrice) * 10000) / 100;
  const safetyStatus: PositionSnapshot['safetyStatus'] =
    isITM ? 'itm' :
    distancePercent < 3 ? 'near' :
    distancePercent < 8 ? 'watch' :
    'safe';

  let assignmentProbability = pos.assignmentProbability;
  let percentOfMaxProfit   = pos.percentOfMaxProfit;
  let dailyTheta           = pos.dailyTheta;

  if (pos.impliedVolatility !== null && pos.dte >= 0) {
    try {
      // impliedVolatility stored as % (e.g. 35 for 35%) — divide for BS input
      const iv = pos.impliedVolatility / 100;
      const T  = Math.max(0.001, pos.dte / 365);
      const bs = blackScholes({
        spotPrice:    currentPrice,
        strikePrice:  pos.strike,
        timeToExpiry: T,
        riskFreeRate: 0.045,
        volatility:   iv,
        optionType:   pos.strategy === 'CSP' ? 'put' : 'call',
      });
      assignmentProbability = Math.round(Math.abs(bs.delta) * 1000) / 10;
      percentOfMaxProfit    = pos.premiumCollected > 0
        ? Math.max(0, Math.round(((pos.premiumCollected - bs.price * 100) / pos.premiumCollected) * 1000) / 10)
        : pos.percentOfMaxProfit;
      dailyTheta = Math.round(Math.abs(bs.theta) * pos.contracts * 100 * 100) / 100;
    } catch { /* keep original snapshot values if BS fails */ }
  }

  return {
    ...pos,
    currentPrice,
    isITM,
    distanceFromStrike,
    distancePercent,
    safetyStatus,
    assignmentProbability,
    percentOfMaxProfit,
    dailyTheta,
  };
}

// ── Shared: probability → color (keeps dots and text in sync) ─────────────────

function dotGaugeColor(probability: number): string {
  if (probability < 40) return C.teal;
  if (probability < 60) return C.amber;
  return C.red;
}

// ── Dot gauge ─────────────────────────────────────────────────────────────────

function DotGauge({ probability }: { probability: number }) {
  const filledCount =
    probability < 20 ? 1 :
    probability < 40 ? 2 :
    probability < 60 ? 3 :
    probability < 80 ? 4 : 5;

  const color = dotGaugeColor(probability);

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          style={{
            width: 9, height: 9, borderRadius: '50%',
            background: i <= filledCount ? color : 'var(--color-border-secondary, rgba(74,106,138,0.25))',
            transition: 'background 0.2s ease',
          }}
        />
      ))}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow({ delay }: { delay: number }) {
  return (
    <div style={{
      padding: '16px 20px 0',
      opacity: 0,
      animation: `pic-fadein 200ms ease-out ${delay}ms forwards`,
      borderBottom: '0.5px solid var(--color-border-tertiary, rgba(20,184,166,0.08))',
    }}>
      <div style={{ width: '50%', height: 14, borderRadius: 4, background: 'rgba(74,106,138,0.15)', marginBottom: 10, animation: 'pulse 1.6s infinite' }} />
      <div style={{ width: '35%', height: 12, borderRadius: 4, background: 'rgba(74,106,138,0.1)', marginBottom: 10, animation: 'pulse 1.6s infinite' }} />
      <div style={{ width: '70%', height: 12, borderRadius: 4, background: 'rgba(74,106,138,0.1)', marginBottom: 10, animation: 'pulse 1.6s infinite' }} />
      {/* Progress bar */}
      <div style={{ height: 4, background: 'rgba(74,106,138,0.12)', marginLeft: -20, marginRight: -20, animation: 'pulse 1.6s infinite' }} />
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

// ── Probability badge with tooltip ───────────────────────────────────────────

function ProbabilityBadge({ probability }: { probability: number | null }) {
  const [hovered, setHovered] = useState(false);
  const pct = probability ?? 0;
  const color = dotGaugeColor(pct);

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color }}>
        {probability?.toFixed(0) ?? '--'}%
      </span>
      <span style={{ fontSize: 11, color: C.muted, cursor: 'default', lineHeight: 1 }}>ⓘ</span>

      {hovered && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1001, width: 220,
          background: 'rgba(5,13,26,0.97)',
          border: '1px solid rgba(20,184,166,0.2)',
          borderRadius: 8, padding: '10px 12px',
          fontSize: 11, fontFamily: 'DM Sans, sans-serif',
          lineHeight: 1.55, color: C.text2,
          boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
          pointerEvents: 'none', whiteSpace: 'normal',
        }}>
          <div style={{ fontWeight: 700, color: C.text1, marginBottom: 5 }}>
            Assignment probability
          </div>
          <div>
            The estimated chance this option gets assigned at expiry, based on Black-Scholes delta (≈ |Δ| × 100).
          </div>
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ color: C.teal }}>● Under 40% — low risk</span>
            <span style={{ color: C.amber }}>● 40–60% — moderate, monitor</span>
            <span style={{ color: C.red }}>● Over 60% — high, consider closing</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Position row ──────────────────────────────────────────────────────────────

function PositionRow({ position, isLast, index }: {
  position: PositionSnapshot;
  isLast: boolean;
  index: number;
}) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  const leftBorderColor =
    position.safetyStatus === 'itm' ? C.red :
    position.safetyStatus === 'near' ? C.amber :
    position.safetyStatus === 'watch' ? C.orange :
    'transparent';

  const showWarning = position.safetyStatus === 'itm' || position.safetyStatus === 'near';

  return (
    <div
      onClick={() => navigate(`/wheel?highlight=${position.positionId}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        padding: '16px 20px 0 20px',
        borderLeft: `3px solid ${leftBorderColor}`,
        borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-tertiary, rgba(20,184,166,0.08))',
        cursor: 'pointer',
        background: hovered ? 'rgba(255,255,255,0.02)' : 'transparent',
        transition: 'background 0.15s ease',
        opacity: 0,
        animation: `pic-fadein 200ms ease-out ${index * 50}ms forwards`,
      }}
    >
      {/* ── ROW 1: Badge + Ticker + Strike + Expiry + DTE ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {/* Strategy badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '3px 8px', borderRadius: 6,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.3px', flexShrink: 0,
          background: position.strategy === 'CSP' ? 'rgba(20,184,166,0.18)' : 'rgba(245,158,11,0.18)',
          color: position.strategy === 'CSP' ? C.teal : C.amber,
        }}>
          {position.strategy}
        </span>

        {/* Ticker + Strike */}
        <span style={{ fontSize: 17, fontWeight: 700, color: C.text1, letterSpacing: '-0.2px' }}>
          {position.ticker}{' '}
          <span style={{ fontWeight: 500 }}>${position.strike}</span>
        </span>

        {/* Expiry + DTE */}
        <span style={{ fontSize: 13, color: C.text2, marginLeft: 2 }}>
          · {fmtExpiry(position.expiry)} ·{' '}
          <span style={{
            color:
              position.dte <= 2 ? C.red :
              position.dte <= 6 ? C.orange :
              position.dte <= 14 ? C.amber :
              C.text2,
          }}>
            {position.dte} DTE
          </span>
        </span>

        {/* Warning icon */}
        {showWarning && (
          <AlertTriangle
            size={14}
            style={{ marginLeft: 'auto', color: position.safetyStatus === 'itm' ? C.red : C.amber, flexShrink: 0 }}
          />
        )}
      </div>

      {/* ── ROW 2: Stock price + distance ─────────────────── */}
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 10 }}>
        Stock:{' '}
        <span style={{ color: C.text1 }}>
          ${position.currentPrice?.toFixed(2) ?? '--'}
        </span>
        {' · '}
        {position.distanceFromStrike !== null ? (
          <span style={{ color: position.isITM ? C.red : C.text2 }}>
            {position.strategy === 'CSP'
              ? position.isITM
                ? `$${position.distanceFromStrike.toFixed(2)} below strike`
                : `${position.distancePercent?.toFixed(1)}% above strike`
              : position.isITM
                ? `$${position.distanceFromStrike.toFixed(2)} above strike`
                : `${position.distancePercent?.toFixed(1)}% below strike`
            }
          </span>
        ) : '--'}
      </div>

      {/* ── ROW 3: Dots + Probability + Theta + Captured ──── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <DotGauge probability={position.assignmentProbability ?? 0} />

        <ProbabilityBadge probability={position.assignmentProbability} />

        <span style={{ color: C.text2, fontSize: 10 }}>·</span>

        <span style={{ fontSize: 13, color: C.teal, fontWeight: 500 }}>
          +${position.dailyTheta?.toFixed(2) ?? '--'}/day
        </span>
        <span style={{ fontSize: 12, color: C.text2 }}>Θ</span>

        <span style={{ marginLeft: 'auto', fontSize: 13, color: C.text2 }}>
          {position.percentOfMaxProfit?.toFixed(0) ?? '0'}%{' '}
          <span style={{ fontSize: 11, opacity: 0.7 }}>captured</span>
        </span>
      </div>

      {/* ── ROW 4: Action hint (only when not hold) ────────── */}
      {position.suggestedAction !== 'hold' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 10, fontSize: 12, fontStyle: 'italic',
        }}>
          {position.suggestedAction === 'urgent'
            ? <AlertTriangle size={12} style={{ color: C.red, flexShrink: 0 }} />
            : position.suggestedAction === 'review'
            ? <Eye size={12} style={{ color: C.amber, flexShrink: 0 }} />
            : <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.teal, display: 'inline-block', flexShrink: 0, marginTop: 1 }} />
          }
          <span style={{
            color:
              position.suggestedAction === 'urgent' ? C.red :
              position.suggestedAction === 'review' ? C.amber :
              C.text2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {position.actionReason}
          </span>
        </div>
      )}

      {/* ── Progress bar — full-width, flush to card edges ─── */}
      <div style={{
        position: 'relative', height: 4,
        background: 'var(--color-border-tertiary, rgba(74,106,138,0.2))',
        marginLeft: -20, marginRight: -20, marginTop: 2,
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${Math.min(100, position.percentOfMaxProfit ?? 0)}%`,
          background: C.teal,
          transition: 'width 0.6s ease-out',
          borderRadius: '0 2px 2px 0',
        }} />
      </div>

      {/* Hover tooltip */}
      {hovered && <PositionTooltip pos={position} />}
    </div>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({ summary }: { summary: DashboardIntelligence['positionsSummary'] }) {
  const avgColor = profitColor(summary.avgPercentOfMaxProfit);
  const cells = [
    {
      label: 'Avg captured',
      value: (
        <>
          <div style={{
            height: 4, borderRadius: 2,
            background: 'var(--color-border-tertiary, rgba(74,106,138,0.2))',
            overflow: 'hidden', marginBottom: 6,
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, summary.avgPercentOfMaxProfit)}%`,
              background: avgColor, borderRadius: 2,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <span style={{ fontSize: 22, fontWeight: 600, color: avgColor }}>
            {summary.avgPercentOfMaxProfit.toFixed(0)}%
          </span>
        </>
      ),
      noBorder: false,
    },
    {
      label: 'At stake',
      value: (
        <span style={{ fontSize: 22, fontWeight: 600, color: C.text2 }}>
          {fmt$(summary.totalPotentialPremium)}
        </span>
      ),
      noBorder: false,
    },
    {
      label: 'Daily Θ',
      value: (
        <span style={{
          fontSize: 22, fontWeight: 600,
          color: summary.totalDailyTheta > 0 ? C.teal : C.muted,
        }}>
          {summary.totalDailyTheta > 0 ? `+${fmt$(summary.totalDailyTheta)}/d` : '—'}
        </span>
      ),
      noBorder: true,
    },
  ];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
      borderBottom: '0.5px solid var(--color-border-tertiary, rgba(20,184,166,0.08))',
    }}>
      {cells.map(({ label, value, noBorder }) => (
        <div key={label} style={{
          padding: '14px 20px',
          borderRight: noBorder ? 'none' : '0.5px solid var(--color-border-tertiary, rgba(20,184,166,0.08))',
        }}>
          <div style={{
            fontSize: 10, textTransform: 'uppercase', fontWeight: 600,
            letterSpacing: '0.6px', color: C.text2, marginBottom: 8,
          }}>
            {label}
          </div>
          {value}
        </div>
      ))}
    </div>
  );
}

// ── Health dots ───────────────────────────────────────────────────────────────

function HealthDots({ summary }: { summary: DashboardIntelligence['positionsSummary'] }) {
  const dots: Array<{ color: string; count: number }> = [
    { color: C.teal,   count: summary.safeCount },
    { color: C.amber,  count: summary.watchCount },
    { color: C.orange, count: summary.nearCount },
    { color: C.red,    count: summary.itmCount },
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
      margin: '0',
      padding: '12px 20px',
      background: 'rgba(20,184,166,0.06)',
      borderTop: '0.5px solid var(--color-border-tertiary, rgba(20,184,166,0.08))',
      borderLeft: '3px solid rgba(20,184,166,0.4)',
      animation: 'softPulse 3s ease infinite',
    }}>
      <div style={{ fontSize: 12, color: C.teal, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
        <Lightbulb size={12} style={{ flexShrink: 0 }} />
        <span>{single
          ? `${single.ticker} at ${single.percentOfMaxProfit?.toFixed(0)}% max profit`
          : `${positions.length} positions at or above 50% profit`
        }</span>
      </div>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 6, lineHeight: 1.4 }}>
        {single
          ? 'The 50% rule: consider closing to lock in gains and free up capital for the next cycle.'
          : 'Review in tracker — closing these frees capital for the next cycle.'
        }
      </div>
      <button
        onClick={onNavigate}
        style={{ fontSize: 11, color: C.teal, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'DM Sans, sans-serif' }}
      >
        View position{positions.length > 1 ? 's' : ''} →
      </button>
    </div>
  );
}

// ── Risk summary strip ────────────────────────────────────────────────────────

function RiskSummaryStrip({ summary }: { summary: DashboardIntelligence['positionsSummary'] }) {
  const riskPill = summary.itmCount > 0
    ? { icon: <AlertTriangle size={11} />, text: `${summary.itmCount} ITM`, color: C.red, bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' }
    : summary.nearCount > 0
    ? { icon: <AlertCircle size={11} />, text: `${summary.nearCount} near strike`, color: C.amber, bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' }
    : summary.watchCount > 0
    ? { icon: <Eye size={11} />, text: `${summary.watchCount} watching`, color: C.orange, bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.2)' }
    : { icon: <CheckCircle size={11} />, text: 'All positions safe', color: C.teal, bg: 'rgba(20,184,166,0.10)', border: 'rgba(20,184,166,0.2)' };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 20px',
      borderTop: '0.5px solid var(--color-border-tertiary, rgba(20,184,166,0.08))',
    }}>
      <span style={{
        fontSize: 12, fontWeight: 600, color: riskPill.color,
        background: riskPill.bg,
        border: `1px solid ${riskPill.border}`,
        padding: '4px 12px', borderRadius: 20,
        display: 'inline-flex', alignItems: 'center', gap: 5,
      }}>
        {riskPill.icon}{riskPill.text}
      </span>

      {summary.bestPerformer && (
        <span style={{ fontSize: 12, color: C.text2, fontFamily: 'DM Sans, sans-serif' }}>
          Best:{' '}
          <span style={{ color: C.teal, fontWeight: 600 }}>{summary.bestPerformer.ticker}</span>
          {' '}+{summary.bestPerformer.percentOfMaxProfit?.toFixed(0)}%
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const MAX_VISIBLE = 4;

interface Props {
  positions: PositionSnapshot[];
  summary: DashboardIntelligence['positionsSummary'];
  isLoading: boolean;
  onNavigateToTracker: () => void;
  /** Live prices from WebSocket — overrides stale snapshot prices at render time */
  livePrices?: Map<string, number>;
}

export function PositionsIntelligenceCard({ positions, summary, isLoading, onNavigateToTracker, livePrices }: Props) {
  const navigate = useNavigate();
  const { isPaperMode } = usePaperMode();

  // Apply live WebSocket prices on top of snapshot data at render time.
  // Tickers from WS arrive uppercase; DB tickers are typically uppercase too, but normalise both sides.
  const livePositions = useMemo(() => {
    if (!livePrices || livePrices.size === 0) return positions;
    return positions.map(p => {
      const price = livePrices.get(p.ticker.toUpperCase()) ?? livePrices.get(p.ticker);
      return applyLivePrice(p, price);
    });
  }, [positions, livePrices]);

  // Recompute all price-derived summary fields from live-price-updated positions.
  // snapshot summary.safeCount / itmCount / avgPercentOfMaxProfit etc. are frozen at
  // fetch time; this keeps the header dots, risk strip, and summary bar in sync with
  // the same live prices already shown in individual rows.
  const liveSummary = useMemo(() => {
    const withProfit = livePositions.filter(p => p.percentOfMaxProfit !== null);
    const withTheta  = livePositions.filter(p => p.dailyTheta !== null);
    return {
      ...summary,
      safeCount:  livePositions.filter(p => p.safetyStatus === 'safe').length,
      watchCount: livePositions.filter(p => p.safetyStatus === 'watch').length,
      nearCount:  livePositions.filter(p => p.safetyStatus === 'near').length,
      itmCount:   livePositions.filter(p => p.safetyStatus === 'itm').length,
      totalDailyTheta: Math.round(withTheta.reduce((s, p) => s + p.dailyTheta!, 0) * 100) / 100,
      avgPercentOfMaxProfit: withProfit.length > 0
        ? Math.round(withProfit.reduce((s, p) => s + p.percentOfMaxProfit!, 0) / withProfit.length * 10) / 10
        : 0,
      totalRemainingPremium: Math.round(
        livePositions.reduce((s, p) =>
          s + (p.percentOfMaxProfit !== null
            ? p.totalPremium * (1 - p.percentOfMaxProfit / 100)
            : p.totalPremium),
        0) * 100
      ) / 100,
      bestPerformer: withProfit.reduce<PositionSnapshot | null>(
        (best, p) => (p.percentOfMaxProfit! > (best?.percentOfMaxProfit ?? -Infinity) ? p : best), null,
      ),
      worstPerformer: withProfit.reduce<PositionSnapshot | null>(
        (worst, p) => (p.percentOfMaxProfit! < (worst?.percentOfMaxProfit ?? Infinity) ? p : worst), null,
      ),
    };
  }, [livePositions, summary]);

  const visiblePositions = livePositions.slice(0, MAX_VISIBLE);
  const hiddenCount = livePositions.length - MAX_VISIBLE;
  const at50 = livePositions.filter(p => (p.percentOfMaxProfit ?? 0) >= 50);

  return (
    <div style={{
      flex: 1, minWidth: 0, height: '100%', position: 'relative',
      background: 'var(--color-background-secondary, rgba(13,27,53,0.6))',
      border: `0.5px solid ${isPaperMode ? 'rgba(245,158,11,0.3)' : 'var(--color-border-tertiary, rgba(20,184,166,0.08))'}`,
      borderRadius: 16,
      padding: 0,
      boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes pic-fadein { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        @keyframes softPulse { 0%,100% { border-left-color:rgba(20,184,166,0.4); } 50% { border-left-color:rgba(20,184,166,0.9); } }
      `}</style>

      {/* ── Loading state ─────────────────────────────────────────────── */}
      {isLoading && (
        <>
          {/* Skeleton header */}
          <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--color-border-tertiary, rgba(20,184,166,0.08))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: 120, height: 14, borderRadius: 4, background: 'rgba(74,106,138,0.15)', animation: 'pulse 1.6s infinite' }} />
              <div style={{ width: 60, height: 11, borderRadius: 4, background: 'rgba(74,106,138,0.1)', animation: 'pulse 1.6s infinite' }} />
            </div>
          </div>
          {[0, 100].map(delay => <SkeletonRow key={delay} delay={delay} />)}
        </>
      )}

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {!isLoading && livePositions.length === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 200, color: C.teal, opacity: 0.3, marginBottom: 10, lineHeight: 1 }}>Θ</div>
          <p style={{ margin: '0 0 4px', fontSize: 14, color: C.text2, fontFamily: 'DM Sans, sans-serif' }}>No open positions</p>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: C.muted, fontFamily: 'DM Sans, sans-serif', textAlign: 'center' }}>
            Ready to deploy capital
          </p>
          <button
            onClick={() => navigate('/screener')}
            style={{ fontSize: 13, color: C.teal, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
          >
            Browse screener →
          </button>
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────────── */}
      {!isLoading && livePositions.length > 0 && (
        <>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '0.5px solid var(--color-border-tertiary, rgba(20,184,166,0.08))',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text1, fontFamily: 'DM Sans, sans-serif' }}>
                Your positions
              </span>
              {isPaperMode && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 6px',
                  background: 'rgba(245,158,11,0.12)', color: C.amber,
                  borderRadius: 4, letterSpacing: '0.5px',
                }}>
                  PAPER
                </span>
              )}
              <span style={{ fontSize: 12, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>
                {summary.totalCount} open
              </span>
              <HealthDots summary={liveSummary} />
            </div>
            <button
              onClick={onNavigateToTracker}
              style={{ fontSize: 12, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: 0 }}
            >
              View all →
            </button>
          </div>

          {/* Summary bar */}
          <SummaryBar summary={liveSummary} />

          {/* Position rows */}
          {visiblePositions.map((pos, i) => (
            <PositionRow
              key={pos.positionId}
              position={pos}
              isLast={i === visiblePositions.length - 1 && hiddenCount <= 0 && at50.length === 0}
              index={i}
            />
          ))}

          {/* Show more */}
          {hiddenCount > 0 && (
            <div
              onClick={() => navigate('/wheel')}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(20,184,166,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              style={{
                padding: '12px 20px',
                borderTop: '0.5px solid var(--color-border-tertiary, rgba(20,184,166,0.08))',
                fontSize: 13, color: C.teal, cursor: 'pointer',
                textAlign: 'center', transition: 'background 0.15s ease',
              }}
            >
              +{hiddenCount} more position{hiddenCount > 1 ? 's' : ''} →
            </div>
          )}

          {/* 50% callout */}
          {at50.length > 0 && (
            <FiftyPercentCallout positions={at50} onNavigate={onNavigateToTracker} />
          )}

          {/* Risk summary strip */}
          <RiskSummaryStrip summary={liveSummary} />
        </>
      )}
    </div>
  );
}
