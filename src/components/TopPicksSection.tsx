// src/components/TopPicksSection.tsx
import { useState, useMemo, useEffect } from 'react';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWatchlistContext } from '../context/WatchlistContext';
import { getTopPicks, type TopPick } from '../lib/topPicksEngine';
import { useScoringPreferences } from '../hooks/useScoringPreferences';
import type { ScreenerStock } from '../lib/screenerData';
import { SECTORS } from '../lib/screenerData';

// ── Constants ──────────────────────────────────────────────────────────────

const LS_KEY = 'topPicks_collapsed';

function getInitialCollapsed(): boolean {
  try { return localStorage.getItem(LS_KEY) === 'true'; } catch { return false; }
}

// ── Sub-components ─────────────────────────────────────────────────────────

const rankColors: Record<number, string> = { 1: '#f5c842', 2: '#9ab4d4', 3: '#fb923c' };

function RankBadge({ rank }: { rank: number }) {
  const color = rankColors[rank] ?? '#4a6a8a';
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
      style={{ background: `${color}18`, border: `1px solid ${color}40`, color, fontFamily: 'Syne, sans-serif' }}
    >
      {rank}
    </div>
  );
}

function ScoreBar({ score, breakdown }: { score: number; breakdown: TopPick['scoreBreakdown'] }) {
  const barColor = score >= 70 ? '#00d68f' : score >= 50 ? '#f5c842' : '#ff4d6d';
  const [hovered, setHovered] = useState(false);

  const rows = [
    { label: 'IV Rank',        pts: breakdown.ivRankScore },
    { label: 'IV/HV Ratio',    pts: breakdown.ivHvScore },
    { label: 'Earnings Safety',pts: breakdown.earningsSafetyScore },
    { label: 'Liquidity',      pts: breakdown.liquidityScore },
    { label: 'Momentum',       pts: breakdown.momentumScore },
    { label: 'Skew',           pts: breakdown.skewScore },
    { label: 'Penalties',      pts: -breakdown.penalties },
  ];

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
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: barColor }} />
        </div>
        <span className="text-xs tabular-nums" style={{ color: barColor, fontFamily: 'JetBrains Mono, monospace', minWidth: 40 }}>
          {score}/100
        </span>
      </div>
      {hovered && (
        <div
          className="absolute left-0 z-10 mt-1 rounded-lg p-2.5 text-xs space-y-1"
          style={{ background: 'rgba(5,13,26,0.97)', border: '1px solid rgba(0,229,196,0.15)', minWidth: 210, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
        >
          <p className="font-medium mb-1.5" style={{ color: '#e8f0fe', fontFamily: 'DM Sans, sans-serif' }}>Score breakdown</p>
          {rows.map(({ label, pts }) => (
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
        style={{ background: 'rgba(10,22,40,0.98)', border: '1px solid rgba(0,229,196,0.2)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}
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
              title: 'IV Rank (primary signal)',
              body: 'Higher IV rank means premium is historically expensive — you collect more for the same risk. We target stocks where IV is at elevated levels relative to the past year.',
            },
            {
              title: 'IV/HV Ratio (new)',
              body: 'Compares implied volatility to recent realised (historical) volatility. A ratio above 1.2x means the market is paying up for options versus what the stock is actually moving — ideal for premium sellers.',
            },
            {
              title: 'Earnings Safety',
              body: 'Stocks with earnings within 14 days are penalised heavily. IV collapses after announcements, destroying premium value if you\'re caught in an open position.',
            },
            {
              title: 'Liquidity (volume + open interest)',
              body: 'High stock volume and ATM open interest ensure tight bid-ask spreads and easy fills at the displayed price.',
            },
            {
              title: 'Price Momentum',
              body: 'CSPs prefer flat or mildly rising stocks. CCs prefer flat stocks so you don\'t cap significant gains. Strong downtrends penalise CSPs; strong uptrends penalise CCs.',
            },
            {
              title: 'Put/Call Skew (new)',
              body: 'Positive skew (puts priced above calls) boosts CSP scores — you get extra premium from market demand for downside protection. Negative skew boosts CC scores.',
            },
          ].map(({ title, body }) => (
            <div key={title}>
              <p className="font-semibold mb-1" style={{ color: '#e8f0fe' }}>{title}</p>
              <p>{body}</p>
            </div>
          ))}

          <div className="rounded-lg p-3 mt-2" style={{ background: 'rgba(0,229,196,0.04)', border: '1px solid rgba(0,229,196,0.1)' }}>
            <p>
              Strikes are calculated using Black-Scholes to target a{' '}
              <span style={{ color: '#e8f0fe' }}>30-delta put</span> (CSP) or{' '}
              <span style={{ color: '#e8f0fe' }}>20-delta call</span> (CC).
              Two expiry windows are shown: the nearest 28–42 DTE and an alternative 45–56 DTE.
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
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.04)' }}>
      {[80, 60, 90, 50, 70].map((w) => (
        <div key={w} className="h-3 rounded animate-pulse" style={{ width: `${w}%`, background: 'rgba(255,255,255,0.05)' }} />
      ))}
    </div>
  );
}

function PickCard({ pick, rank, strategy }: { pick: TopPick; rank: number; strategy: 'CSP' | 'CC' }) {
  const navigate = useNavigate();
  const { isWatched, addTicker, removeTicker } = useWatchlistContext();
  const watched = isWatched(pick.ticker);
  const strategyColor = strategy === 'CSP' ? '#00c6f5' : '#00e5c4';

  const ivHvColor = pick.ivHvRatio != null
    ? (pick.ivHvRatio >= 1.3 ? '#f97316' : pick.ivHvRatio >= 1.1 ? '#f5c842' : '#9ab4d4')
    : '#4a6a8a';

  const skewNote = pick.putCallSkew != null
    ? (strategy === 'CSP'
        ? pick.putCallSkew >= 0.03 ? '↑ Put skew elevated — premium favorable'
          : pick.putCallSkew <= -0.03 ? '↓ Call skew dominant — puts relatively cheap'
          : null
        : pick.putCallSkew <= -0.03 ? '↑ Call skew elevated — premium favorable'
          : null)
    : null;

  const momentumLabel = pick.sectorMomentum === 'bullish' ? '▲ Sector' : pick.sectorMomentum === 'bearish' ? '▼ Sector' : null;
  const momentumColor = pick.sectorMomentum === 'bullish' ? '#00d68f' : '#ff4d6d';

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(0,229,196,0.07)', transition: 'border-color 0.2s' }}
    >
      {/* Row 1: Rank + Ticker + Badges */}
      <div className="flex items-start gap-2.5">
        <RankBadge rank={rank} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
              {pick.ticker}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={{ color: strategyColor, background: `${strategyColor}14`, border: `1px solid ${strategyColor}30`, fontFamily: 'JetBrains Mono, monospace' }}
            >
              {strategy === 'CSP' ? 'SELL PUT' : 'SELL CALL'}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ color: '#4a6a8a', background: 'rgba(74,106,138,0.08)', border: '1px solid rgba(74,106,138,0.15)', fontFamily: 'DM Sans, sans-serif' }}
            >
              {pick.sector}
            </span>
            {momentumLabel && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                style={{ color: momentumColor, background: `${momentumColor}12`, border: `1px solid ${momentumColor}25`, fontFamily: 'JetBrains Mono, monospace' }}
              >
                {momentumLabel}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            {pick.name}
          </p>
        </div>
        {/* IV Rank + IV/HV badges */}
        <div className="flex flex-col items-end gap-1">
          <div
            className="text-xs px-2 py-0.5 rounded flex-shrink-0 font-semibold tabular-nums"
            style={{
              color: pick.ivRank >= 70 ? '#ff4d6d' : pick.ivRank >= 50 ? '#f97316' : '#f5c842',
              background: pick.ivRank >= 70 ? 'rgba(255,77,109,0.1)' : pick.ivRank >= 50 ? 'rgba(249,115,22,0.1)' : 'rgba(245,200,66,0.1)',
              border: `1px solid ${pick.ivRank >= 70 ? 'rgba(255,77,109,0.2)' : pick.ivRank >= 50 ? 'rgba(249,115,22,0.2)' : 'rgba(245,200,66,0.2)'}`,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            IV {pick.ivRank}
          </div>
          {pick.ivHvRatio != null && (
            <div
              className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 font-semibold tabular-nums"
              style={{ color: ivHvColor, background: `${ivHvColor}12`, border: `1px solid ${ivHvColor}28`, fontFamily: 'JetBrains Mono, monospace' }}
            >
              {pick.ivHvRatio.toFixed(2)}x IV/HV
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Score bar */}
      <div>
        <p className="text-[10px] mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          Pick score
        </p>
        <ScoreBar score={pick.score} breakdown={pick.scoreBreakdown} />
      </div>

      {/* Row 3: Strike / Expiry / Premium — near DTE */}
      <div>
        <p className="text-[10px] mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          Near expiry · {pick.suggestedExpiry.match(/\(.*\)/)?.[0] ?? ''}
        </p>
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
      </div>

      {/* Row 3b: Alt expiry */}
      {pick.suggestedExpiry2 && pick.estimatedPremium2 != null && (
        <div
          className="rounded-lg px-3 py-2"
          style={{ background: 'rgba(0,229,196,0.03)', border: '1px solid rgba(0,229,196,0.07)' }}
        >
          <p className="text-[10px] mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            Alt expiry · {pick.suggestedExpiry2.match(/\(.*\)/)?.[0] ?? ''}
          </p>
          <div className="flex gap-4">
            <div>
              <p className="text-[10px]" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Strike</p>
              <p className="text-xs font-medium" style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>
                ${(pick.suggestedStrike2 ?? 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[10px]" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Expiry</p>
              <p className="text-xs font-medium" style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>
                {pick.suggestedExpiry2.split(' (')[0]}
              </p>
            </div>
            <div>
              <p className="text-[10px]" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Premium</p>
              <p className="text-xs font-medium" style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>
                ${(pick.estimatedPremium2 * 100).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

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

      {/* Skew note */}
      {skewNote && (
        <p className="text-[10px]" style={{ color: strategy === 'CSP' ? '#00d68f' : '#00e5c4', fontFamily: 'DM Sans, sans-serif' }}>
          {skewNote}
        </p>
      )}

      {/* Reasoning */}
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

      {/* Warnings */}
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

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => navigate(`/stock/${pick.ticker}`)}
          className="flex-1 text-xs py-1.5 rounded-lg text-center font-medium transition-all duration-150"
          style={{ background: 'rgba(0,229,196,0.06)', border: '1px solid rgba(0,229,196,0.12)', color: '#00e5c4', fontFamily: 'DM Sans, sans-serif' }}
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
          {watched
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={11} /> Watching</span>
            : '+ Watchlist'
          }
        </button>
      </div>
    </div>
  );
}

// ── Preferences panel ──────────────────────────────────────────────────────

function PreferencesPanel({
  prefs,
  setPrefs,
  resetPrefs,
  onClose,
}: {
  prefs: ReturnType<typeof useScoringPreferences>['prefs'];
  setPrefs: ReturnType<typeof useScoringPreferences>['setPrefs'];
  resetPrefs: () => void;
  onClose: () => void;
}) {
  const inputStyle = {
    background: 'rgba(5,13,26,0.8)',
    border: '1px solid rgba(0,229,196,0.15)',
    color: '#e8f0fe',
    fontFamily: 'JetBrains Mono, monospace',
    outline: 'none',
    caretColor: '#00e5c4',
  };

  const sectorList = SECTORS.filter((s) => s !== 'All');

  function toggleSector(s: string) {
    const current = prefs.preferredSectors;
    const next = current.includes(s) ? current.filter((x) => x !== s) : [...current, s];
    setPrefs({ preferredSectors: next });
  }

  return (
    <div
      className="rounded-xl p-4 space-y-4 mb-4"
      style={{ background: 'rgba(5,13,26,0.7)', border: '1px solid rgba(0,229,196,0.12)', backdropFilter: 'blur(8px)' }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: '#e8f0fe', fontFamily: 'DM Sans, sans-serif' }}>
          Scoring Preferences
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={resetPrefs}
            className="text-[10px] px-2 py-0.5 rounded transition-opacity hover:opacity-70"
            style={{ color: '#ff4d6d', background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.2)', fontFamily: 'DM Sans, sans-serif' }}
          >
            Reset
          </button>
          <button onClick={onClose} style={{ color: '#4a6a8a' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] block mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            Capital per trade ($)
          </label>
          <input
            type="number"
            value={prefs.capitalPerTrade}
            onChange={(e) => setPrefs({ capitalPerTrade: Math.max(0, Number(e.target.value)) })}
            className="w-full px-2.5 py-1.5 rounded-lg text-xs"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = 'rgba(0,229,196,0.35)')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(0,229,196,0.15)')}
          />
        </div>
        <div>
          <label className="text-[10px] block mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            Min annual return (%)
          </label>
          <input
            type="number"
            value={prefs.minAnnualReturn}
            onChange={(e) => setPrefs({ minAnnualReturn: Math.max(0, Number(e.target.value)) })}
            className="w-full px-2.5 py-1.5 rounded-lg text-xs"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = 'rgba(0,229,196,0.35)')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(0,229,196,0.15)')}
          />
        </div>
      </div>

      <div>
        <p className="text-[10px] mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          Preferred sectors <span style={{ color: '#2e4a6a' }}>(get score boost)</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {sectorList.map((s) => {
            const active = prefs.preferredSectors.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleSector(s)}
                className="text-[10px] px-2 py-0.5 rounded transition-all"
                style={{
                  color: active ? '#00e5c4' : '#4a6a8a',
                  background: active ? 'rgba(0,229,196,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? 'rgba(0,229,196,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────

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
        style={{ background: 'rgba(13,27,53,0.6)', border: '1px solid rgba(0,229,196,0.1)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
                {title}
              </h2>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                style={{ color: strategyColor, background: `${strategyColor}14`, border: `1px solid ${strategyColor}30`, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}
              >
                {badge}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
              Ranked by IV rank, IV/HV ratio, skew, earnings safety &amp; liquidity
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
  prefs: ReturnType<typeof useScoringPreferences>['prefs'];
  setPrefs: ReturnType<typeof useScoringPreferences>['setPrefs'];
  resetPrefs: () => void;
}

export function TopPicksSection({ screenerData, isLoading, prefs, setPrefs, resetPrefs }: TopPicksSectionProps) {
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const [showPrefs, setShowPrefs] = useState(false);

  const qualifiedData = useMemo(
    () => screenerData.filter((s) => s.ivRank != null && s.price != null),
    [screenerData],
  );

  const cspPicks = useMemo(() => getTopPicks(qualifiedData, 'CSP', 5, prefs), [qualifiedData, prefs]);
  const ccPicks  = useMemo(() => getTopPicks(qualifiedData, 'CC',  5, prefs), [qualifiedData, prefs]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(LS_KEY, String(next)); } catch { /* non-fatal */ }
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
        <div className="flex items-center gap-3">
          {/* Preferences toggle */}
          <button
            onClick={() => setShowPrefs((p) => !p)}
            className="flex items-center gap-1.5 text-xs transition-colors hover:text-[#9ab4d4]"
            style={{ color: showPrefs ? '#00e5c4' : '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}
            title="Scoring preferences"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M6 1v1.5M6 9.5V11M1 6h1.5M9.5 6H11M2.6 2.6l1.1 1.1M8.3 8.3l1.1 1.1M2.6 9.4l1.1-1.1M8.3 3.7l1.1-1.1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            Preferences
          </button>
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
                Show picks
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 8l4-4 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Hide picks
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preferences panel */}
      {showPrefs && (
        <PreferencesPanel
          prefs={prefs}
          setPrefs={setPrefs}
          resetPrefs={resetPrefs}
          onClose={() => setShowPrefs(false)}
        />
      )}

      {!collapsed && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel strategy="CSP" picks={cspPicks} isLoading={isLoading && screenerData.length === 0} />
            <Panel strategy="CC"  picks={ccPicks}  isLoading={isLoading && screenerData.length === 0} />
          </div>

          <p
            className="text-xs mt-4 leading-relaxed text-center"
            style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', maxWidth: 640, margin: '16px auto 0' }}
          >
            Top picks are generated algorithmically based on IV rank, IV/HV ratio, put/call skew, earnings dates, and liquidity.
            They do not constitute financial advice or trading recommendations.
            Always conduct your own research before opening any position.
          </p>
        </>
      )}
    </div>
  );
}
