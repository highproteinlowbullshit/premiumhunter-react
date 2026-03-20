// src/components/TopPicksSection.tsx
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWatchlistContext } from '../context/WatchlistContext';
import { getTopPicks, type TopPick } from '../lib/topPicksEngine';
import type { ScreenerStock } from '../lib/screenerData';

// ── Constants ──────────────────────────────────────────────────────────────

const LS_KEY = 'topPicks_collapsed';

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(LS_KEY) === 'true';
  } catch {
    return false;
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

const rankColors: Record<number, string> = {
  1: '#f5c842',
  2: '#9ab4d4',
  3: '#fb923c',
};

function RankBadge({ rank }: { rank: number }) {
  const color = rankColors[rank] ?? '#4a6a8a';
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
      style={{
        background: `${color}18`,
        border: `1px solid ${color}40`,
        color,
        fontFamily: 'Syne, sans-serif',
      }}
    >
      {rank}
    </div>
  );
}

function ScoreBar({ score, breakdown }: { score: number; breakdown: TopPick['scoreBreakdown'] }) {
  const barColor = score >= 70 ? '#00d68f' : score >= 50 ? '#f5c842' : '#ff4d6d';
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative"
      tabIndex={0}
      role="button"
      aria-label="Score breakdown"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${score}%`, background: barColor }}
          />
        </div>
        <span className="text-xs tabular-nums" style={{ color: barColor, fontFamily: 'JetBrains Mono, monospace', minWidth: 40 }}>
          {score}/100
        </span>
      </div>
      {hovered && (
        <div
          className="absolute left-0 z-10 mt-1 rounded-lg p-2.5 text-xs space-y-1"
          style={{
            background: 'rgba(5,13,26,0.97)',
            border: '1px solid rgba(0,229,196,0.15)',
            minWidth: 200,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          <p className="font-medium mb-1" style={{ color: '#e8f0fe', fontFamily: 'DM Sans, sans-serif' }}>Score breakdown</p>
          {[
            { label: 'IV Rank',        pts: breakdown.ivRankScore },
            { label: 'Earnings Safety',pts: breakdown.earningsSafetyScore },
            { label: 'Liquidity',      pts: breakdown.liquidityScore },
            { label: 'Momentum',       pts: breakdown.momentumScore },
            { label: 'Penalties',      pts: -breakdown.penalties },
          ].map(({ label, pts }) => (
            <div key={label} className="flex justify-between gap-4">
              <span style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif' }}>{label}</span>
              <span style={{ color: pts < 0 ? '#ff4d6d' : '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
                {pts >= 0 ? '+' : ''}{pts}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MethodologyModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,8,19,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 overflow-y-auto max-h-[80vh]"
        style={{
          background: 'rgba(10,22,40,0.98)',
          border: '1px solid rgba(0,229,196,0.2)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
            How are picks selected?
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[rgba(255,255,255,0.06)]"
            style={{ color: '#4a6a8a' }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="space-y-4 text-sm" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', lineHeight: '1.6' }}>
          {[
            {
              title: 'IV Rank (most important)',
              body: 'Higher IV rank means more expensive premium. We target stocks where IV is historically elevated so you collect maximum income.',
            },
            {
              title: 'Earnings Safety',
              body: 'We penalise stocks with earnings within 14 days. IV collapses after earnings announcements, destroying premium value.',
            },
            {
              title: 'Liquidity',
              body: 'Higher options volume means tighter bid-ask spreads and easier fills at the price you want.',
            },
            {
              title: 'Price Momentum',
              body: 'For CSPs we prefer flat or slightly rising stocks. For CCs we prefer flat stocks where you won\'t cap significant gains.',
            },
          ].map(({ title, body }) => (
            <div key={title}>
              <p className="font-semibold mb-1" style={{ color: '#e8f0fe' }}>{title}</p>
              <p>{body}</p>
            </div>
          ))}

          <div
            className="rounded-lg p-3 mt-2"
            style={{ background: 'rgba(0,229,196,0.04)', border: '1px solid rgba(0,229,196,0.1)' }}
          >
            <p style={{ color: '#9ab4d4' }}>
              Scores above <span style={{ color: '#00d68f' }}>60</span> are strong candidates.
              Below <span style={{ color: '#ff4d6d' }}>40</span> means conditions are not ideal — consider waiting for better IV rank levels.
            </p>
          </div>

          <p className="text-xs mt-3" style={{ color: '#4a6a8a' }}>
            This is a screening tool only. Always do your own research before trading.
          </p>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.04)' }}
    >
      {[80, 60, 90, 50, 70].map((w) => (
        <div
          key={w}
          className="h-3 rounded animate-pulse"
          style={{ width: `${w}%`, background: 'rgba(255,255,255,0.05)' }}
        />
      ))}
    </div>
  );
}

function PickCard({
  pick,
  rank,
  strategy,
}: {
  pick: TopPick;
  rank: number;
  strategy: 'CSP' | 'CC';
}) {
  const navigate = useNavigate();
  const { isWatched, addTicker, removeTicker } = useWatchlistContext();
  const watched = isWatched(pick.ticker);

  const strategyColor = strategy === 'CSP' ? '#00c6f5' : '#00e5c4';

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{
        background: 'rgba(0,0,0,0.2)',
        border: '1px solid rgba(0,229,196,0.07)',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Row 1: Rank + Ticker + Name + Sector */}
      <div className="flex items-start gap-2.5">
        <RankBadge rank={rank} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-bold text-sm"
              style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}
            >
              {pick.ticker}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={{
                color: strategyColor,
                background: `${strategyColor}14`,
                border: `1px solid ${strategyColor}30`,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {strategy === 'CSP' ? 'SELL PUT' : 'SELL CALL'}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                color: '#4a6a8a',
                background: 'rgba(74,106,138,0.08)',
                border: '1px solid rgba(74,106,138,0.15)',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {pick.sector}
            </span>
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            {pick.name}
          </p>
        </div>
        {/* IV Rank badge */}
        <div
          className="text-xs px-2 py-1 rounded flex-shrink-0 font-semibold tabular-nums"
          style={{
            color: pick.ivRank >= 70 ? '#ff4d6d' : pick.ivRank >= 50 ? '#f97316' : '#f5c842',
            background: pick.ivRank >= 70 ? 'rgba(255,77,109,0.1)' : pick.ivRank >= 50 ? 'rgba(249,115,22,0.1)' : 'rgba(245,200,66,0.1)',
            border: `1px solid ${pick.ivRank >= 70 ? 'rgba(255,77,109,0.2)' : pick.ivRank >= 50 ? 'rgba(249,115,22,0.2)' : 'rgba(245,200,66,0.2)'}`,
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          IV {pick.ivRank}
        </div>
      </div>

      {/* Row 2: Score bar */}
      <div>
        <p className="text-[10px] mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          Pick score
        </p>
        <ScoreBar score={pick.score} breakdown={pick.scoreBreakdown} />
      </div>

      {/* Row 3: Strike / Expiry / Premium */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Strike', value: `$${pick.suggestedStrike.toFixed(2)}` },
          { label: 'Expiry', value: pick.suggestedExpiry.split(' (')[0] },
          { label: 'Premium/contract', value: `$${(pick.estimatedPremium * 100).toFixed(2)}` },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[10px] mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>{label}</p>
            <p className="text-xs font-medium" style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Row 4: Annual return + Capital */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            Est. annualised return
          </p>
          <p className="text-xl font-bold" style={{ color: '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>
            ~{pick.estimatedAnnualReturn.toFixed(1)}%
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            Estimated. Not financial advice.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            Capital required
          </p>
          <p className="text-sm font-medium" style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>
            ${pick.maxRisk.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Row 5: Reasoning */}
      {pick.reasoning.length > 0 && (
        <ul className="space-y-1">
          {pick.reasoning.map((r, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif' }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="mt-0.5 flex-shrink-0">
                <path d="M1.5 5.5l2.5 2.5 5-5" stroke="#00e5c4" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {r}
            </li>
          ))}
        </ul>
      )}

      {/* Row 6: Warnings */}
      {pick.warnings.length > 0 && (
        <ul className="space-y-1">
          {pick.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: '#f5c842', fontFamily: 'DM Sans, sans-serif' }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="mt-0.5 flex-shrink-0">
                <path d="M5.5 1L10 10H1L5.5 1z" stroke="#f5c842" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="5.5" y1="4.5" x2="5.5" y2="7" stroke="#f5c842" strokeWidth="1.2" strokeLinecap="round"/>
                <circle cx="5.5" cy="8.5" r="0.5" fill="#f5c842"/>
              </svg>
              {w}
            </li>
          ))}
        </ul>
      )}

      {/* Row 7: Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => navigate(`/stock/${pick.ticker}`)}
          className="flex-1 text-xs py-1.5 rounded-lg text-center font-medium transition-all duration-150"
          style={{
            background: 'rgba(0,229,196,0.06)',
            border: '1px solid rgba(0,229,196,0.12)',
            color: '#00e5c4',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          View Stock
        </button>
        <button
          onClick={() => watched ? removeTicker(pick.ticker) : addTicker(pick.ticker)}
          className="flex-1 text-xs py-1.5 rounded-lg text-center font-medium transition-all duration-150"
          style={{
            background: watched ? 'rgba(0,229,196,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${watched ? 'rgba(0,229,196,0.25)' : 'rgba(255,255,255,0.08)'}`,
            color: watched ? '#00e5c4' : '#4a6a8a',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          {watched ? '✓ Watching' : '+ Watchlist'}
        </button>
      </div>
    </div>
  );
}

function Panel({
  strategy,
  picks,
  isLoading,
}: {
  strategy: 'CSP' | 'CC';
  picks: TopPick[];
  isLoading: boolean;
}) {
  const [showMethodology, setShowMethodology] = useState(false);
  const strategyColor = strategy === 'CSP' ? '#00c6f5' : '#00e5c4';
  const title = strategy === 'CSP' ? 'Top 5 CSP Opportunities' : 'Top 5 CC Opportunities';
  const badge = strategy === 'CSP' ? 'SELL PUT' : 'SELL CALL';

  return (
    <>
      {showMethodology && <MethodologyModal onClose={() => setShowMethodology(false)} />}
      <div
        className="rounded-2xl p-4 sm:p-5 flex flex-col gap-4"
        style={{
          background: 'rgba(13,27,53,0.6)',
          border: '1px solid rgba(0,229,196,0.1)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Panel header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
                {title}
              </h2>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                style={{
                  color: strategyColor,
                  background: `${strategyColor}14`,
                  border: `1px solid ${strategyColor}30`,
                  fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: '0.06em',
                }}
              >
                {badge}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
              Ranked by IV rank, earnings safety, and liquidity
            </p>
          </div>
          <button
            onClick={() => setShowMethodology(true)}
            className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center transition-colors hover:bg-[rgba(255,255,255,0.06)]"
            style={{ color: '#4a6a8a' }}
            title="How are picks selected?"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M5 5.5a2 2 0 0 1 3.9.7c0 1.2-1.9 1.6-1.9 2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="7" cy="10.5" r="0.65" fill="currentColor"/>
            </svg>
          </button>
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }, (_, i) => <SkeletonCard key={i} />)
          ) : picks.length === 0 ? (
            <div
              className="rounded-xl p-6 text-center"
              style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.04)' }}
            >
              <p className="text-sm" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
                Not enough qualifying stocks right now. Try again during high-volatility periods.
              </p>
            </div>
          ) : (
            picks.map((pick, i) => (
              <PickCard key={pick.ticker} pick={pick} rank={i + 1} strategy={strategy} />
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

interface TopPicksSectionProps {
  screenerData: ScreenerStock[];
  isLoading: boolean;
}

export function TopPicksSection({ screenerData, isLoading }: TopPicksSectionProps) {
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);

  const qualifiedData = useMemo(
    () => screenerData.filter((s) => s.ivRank != null && s.price != null),
    [screenerData],
  );

  const cspPicks = useMemo(() => getTopPicks(qualifiedData, 'CSP', 5), [qualifiedData]);
  const ccPicks = useMemo(() => getTopPicks(qualifiedData, 'CC', 5), [qualifiedData]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(LS_KEY, String(next));
    } catch { /* non-fatal */ }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 mt-4 mb-6">
      {/* Section header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-px w-12" style={{ background: 'linear-gradient(90deg, rgba(0,229,196,0.4), transparent)' }} />
          <span
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace' }}
          >
            Score-Ranked Picks
          </span>
        </div>
        <button
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          className="flex items-center gap-1.5 text-xs transition-colors hover:text-[#9ab4d4]"
          style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}
        >
          {collapsed ? (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Show top picks
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 8l4-4 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Hide top picks
            </>
          )}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Two-panel grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel strategy="CSP" picks={cspPicks} isLoading={isLoading && screenerData.length === 0} />
            <Panel strategy="CC" picks={ccPicks} isLoading={isLoading && screenerData.length === 0} />
          </div>

          {/* Disclaimer */}
          <p
            className="text-xs mt-4 leading-relaxed text-center"
            style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', maxWidth: 640, margin: '16px auto 0' }}
          >
            Top picks are generated algorithmically based on IV rank, earnings dates, and liquidity.
            They do not constitute financial advice or trading recommendations.
            Always conduct your own research before opening any position.
            Premium Hunter accepts no liability for trading decisions made using this tool.
          </p>
        </>
      )}
    </div>
  );
}
