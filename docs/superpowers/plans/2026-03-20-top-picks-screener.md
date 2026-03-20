# Top Picks Screener Section Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible "Top Picks" section above the IV Screener table that automatically surfaces the top 5 CSP and top 5 CC opportunities using a pure-TypeScript scoring engine.

**Architecture:** A pure scoring engine (`topPicksEngine.ts`) computes scores and trade parameters from existing `ScreenerStock[]` data with no new API calls. A UI component (`TopPicksSection.tsx`) renders two side-by-side panels with rank badges, score bars, trade details, and watchlist integration. Screener.tsx is modified minimally — only an import + one JSX block above the existing filter controls.

**Tech Stack:** TypeScript, React 18, Tailwind CSS, existing `blackScholes()` from `src/lib/blackScholes.ts`, `useWatchlistContext` from `src/context/WatchlistContext.tsx`.

---

## Critical codebase facts (read before implementing)

- **`ScreenerStock.currentIV`** is stored as a **percentage** (e.g., `45` = 45%). Divide by `100` before passing to `blackScholes()`.
- **`ScreenerStock.priceChange`** is the field name (spec called it `changePercent`).
- **`ScreenerStock.earningsDate`** is a `string | null` ISO date — compute `daysToEarnings` at runtime: `Math.ceil((new Date(earningsDate).getTime() - Date.now()) / 86400000)`.
- **Watchlist:** Use `useWatchlistContext()` → `{ isWatched, addTicker, removeTicker }` (no separate hook).
- **Navigation:** `useNavigate()` from `react-router-dom`, route is `/stock/{ticker}`.
- **Screener injection point:** Inside `Screener()` in `src/pages/Screener.tsx`, add `<TopPicksSection>` between the page header div (ending at line ~197) and the table div (starting at line ~200). Use `stocks` (all loaded stocks, not `filtered`) so top picks aren't affected by the user's active filters.
- **`blackScholes()` signature:** `{ spotPrice, strikePrice, timeToExpiry, riskFreeRate, volatility, optionType }` — returns `{ price: number, ... }` where `price` is per-share (multiply by 100 for per-contract).

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/topPicksEngine.ts` | Pure scoring + trade parameter calculation |
| Create | `src/components/TopPicksSection.tsx` | UI: two panels, pick cards, collapsible, disclaimer |
| Modify | `src/pages/Screener.tsx` | Import + inject `<TopPicksSection>` |

---

## Chunk 1: Scoring Engine

### Task 1: Create `src/lib/topPicksEngine.ts`

**Files:**
- Create: `src/lib/topPicksEngine.ts`

#### Background

The engine receives `ScreenerStock[]` and returns `TopPick[]`. It must handle null values gracefully (data is still streaming when first called). All date arithmetic uses `Date.now()`. Monthly options expiries are the third Friday of each month.

`ivRank` range in the data: 0–100 (integer scale). `currentIV` range: typically 15–200 (percentage). `priceChange` is daily % change.

- [ ] **Step 1: Write the complete file**

```typescript
// src/lib/topPicksEngine.ts
import { blackScholes } from './blackScholes';
import type { ScreenerStock } from './screenerData';

// ── Public types ───────────────────────────────────────────────────────────

export interface TopPick {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  ivRank: number;
  ivPercentile: number | null;
  currentIV: number;           // stored as % e.g. 45 = 45%
  score: number;               // 0–100 composite
  scoreBreakdown: {
    ivRankScore: number;
    earningsSafetyScore: number;
    liquidityScore: number;
    momentumScore: number;
    penalties: number;
  };
  strategy: 'CSP' | 'CC';
  suggestedStrike: number;
  suggestedExpiry: string;     // e.g. "Apr 17, 2026 (30 DTE)"
  estimatedPremium: number;    // per share (×100 = per contract)
  estimatedAnnualReturn: number; // annualised % return on capital
  maxRisk: number;             // collateral required for one contract ($)
  reasoning: string[];
  warnings: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function daysToEarnings(stock: ScreenerStock): number | null {
  if (!stock.earningsDate) return null;
  const diff = Math.ceil(
    (new Date(stock.earningsDate).getTime() - Date.now()) / 86_400_000
  );
  return diff > 0 ? diff : null; // past earnings = null
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

/** Third Friday of a given month (0-indexed). */
function thirdFriday(year: number, month: number): Date {
  const d = new Date(year, month, 1);
  // Find first Friday
  const dayOfWeek = d.getDay(); // 0=Sun
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  d.setDate(1 + daysUntilFriday + 14); // third = +2 weeks
  return d;
}

/** Returns formatted expiry string for nearest monthly expiry 28–35 DTE. */
function nearestMonthlyExpiry(): string {
  const today = new Date();
  const targetDTE = 30;

  // Try this month and next 3 months
  for (let offset = 0; offset < 4; offset++) {
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const expiry = thirdFriday(d.getFullYear(), d.getMonth());
    const dte = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
    if (dte >= 28 && dte <= 42) {
      const label = expiry.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
      return `${label} (${dte} DTE)`;
    }
  }

  // Fallback: next month's expiry
  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const expiry = thirdFriday(next.getFullYear(), next.getMonth());
  const dte = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
  const label = expiry.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  return `${label} (${dte} DTE)`;
}

// ── Liquidity scorer (shared) ──────────────────────────────────────────────

function liquidityScore(stock: ScreenerStock, allStocks: ScreenerStock[], maxPts: number): number {
  if (stock.volume == null) return Math.round(maxPts * 0.25);
  const volumes = allStocks
    .map((s) => s.volume)
    .filter((v): v is number => v != null);
  if (volumes.length === 0) return Math.round(maxPts * 0.25);

  const sorted = [...volumes].sort((a, b) => a - b);
  const p10 = sorted[Math.floor(sorted.length * 0.9)];
  const p25 = sorted[Math.floor(sorted.length * 0.75)];
  const medVol = median(volumes);

  if (stock.volume >= p10) return maxPts;
  if (stock.volume >= p25) return Math.round(maxPts * 0.8);
  if (stock.volume >= medVol) return Math.round(maxPts * 0.5);
  return Math.round(maxPts * 0.25);
}

// ── CSP scoring ────────────────────────────────────────────────────────────

export function scoreForCSP(stock: ScreenerStock, allStocks: ScreenerStock[]): number {
  const ivRank = stock.ivRank ?? 0;
  const change = stock.priceChange ?? 0;
  const dte = daysToEarnings(stock);

  // IV Rank score (40 pts)
  let ivPts = 0;
  if (ivRank >= 80) ivPts = 40;
  else if (ivRank >= 70) ivPts = 35;
  else if (ivRank >= 60) ivPts = 28;
  else if (ivRank >= 50) ivPts = 18;
  else if (ivRank >= 30) ivPts = 8;

  // Earnings safety (25 pts)
  let earnPts = 0;
  if (dte === null) earnPts = 20;
  else if (dte > 45) earnPts = 25;
  else if (dte >= 30) earnPts = 18;
  else if (dte >= 15) earnPts = 8;
  // <=14 → 0

  // Liquidity (20 pts)
  const liqPts = liquidityScore(stock, allStocks, 20);

  // Momentum (15 pts) — prefer flat to slight up for CSP
  let momPts = 0;
  if (change > 2) momPts = 8;
  else if (change >= 0) momPts = 15;
  else if (change >= -2) momPts = 12;
  else if (change >= -5) momPts = 5;
  // < -5 → 0

  let total = ivPts + earnPts + liqPts + momPts;

  // Penalties
  if (ivRank < 50) total -= 10;
  if (dte !== null && dte <= 14) total -= 15;
  if ((stock.price ?? 0) > 200) total -= 5;

  return Math.max(0, Math.min(100, total));
}

// ── CC scoring ─────────────────────────────────────────────────────────────

export function scoreForCC(stock: ScreenerStock, allStocks: ScreenerStock[]): number {
  const ivRank = stock.ivRank ?? 0;
  const change = stock.priceChange ?? 0;
  const dte = daysToEarnings(stock);

  // IV Rank score (35 pts)
  let ivPts = 0;
  if (ivRank >= 70) ivPts = 35;
  else if (ivRank >= 55) ivPts = 28;
  else if (ivRank >= 40) ivPts = 18;
  else if (ivRank >= 25) ivPts = 8;

  // Trend score (30 pts) — CC prefers flat or mild uptrend
  let trendPts = 0;
  if (change >= 0 && change <= 1.5) trendPts = 30;
  else if (change >= -1 && change < 0) trendPts = 25;
  else if (change > 1.5 && change <= 3) trendPts = 20;
  else if (change > 3 && change <= 6) trendPts = 10;
  else if (change > 6) trendPts = 3;
  else if (change < -3) trendPts = 5;
  else trendPts = 12; // -3 to -1

  // Earnings safety (20 pts)
  let earnPts = 0;
  if (dte === null) earnPts = 16;
  else if (dte > 45) earnPts = 20;
  else if (dte >= 30) earnPts = 14;
  else if (dte >= 15) earnPts = 6;
  // <=14 → 0

  // Liquidity (15 pts)
  const liqPts = liquidityScore(stock, allStocks, 15);

  let total = ivPts + trendPts + earnPts + liqPts;

  // Penalties
  if (change > 5) total -= 10;
  if (dte !== null && dte <= 14) total -= 15;
  if (ivRank < 30) total -= 8;

  return Math.max(0, Math.min(100, total));
}

// ── Trade parameter calculators ────────────────────────────────────────────

function calcCSPStrike(price: number, currentIV: number): number {
  // ~30-delta put strike: price × (1 - IV × sqrt(30/365) × 0.5)
  const vol = currentIV / 100; // convert % to decimal
  return roundToHalf(price * (1 - vol * Math.sqrt(30 / 365) * 0.5));
}

function calcCCStrike(price: number, currentIV: number): number {
  // ~20-delta call strike: price × (1 + IV × sqrt(30/365) × 0.3)
  const vol = currentIV / 100;
  return roundToHalf(price * (1 + vol * Math.sqrt(30 / 365) * 0.3));
}

function calcPremium(
  price: number,
  strike: number,
  currentIV: number,
  strategy: 'CSP' | 'CC',
): number {
  const vol = currentIV / 100; // IMPORTANT: stored as % (45), blackScholes needs decimal (0.45)
  if (vol <= 0 || price <= 0 || strike <= 0) return 0;
  const result = blackScholes({
    spotPrice: price,
    strikePrice: strike,
    timeToExpiry: 30 / 365,
    riskFreeRate: 0.045,
    volatility: vol,
    optionType: strategy === 'CSP' ? 'put' : 'call',
  });
  return Math.max(0, result.price);
}

// ── Reasoning builder ──────────────────────────────────────────────────────

function buildReasoning(
  stock: ScreenerStock,
  strategy: 'CSP' | 'CC',
  liqScore: number,
  liqMaxPts: number,
): string[] {
  const reasons: string[] = [];
  const ivRank = stock.ivRank ?? 0;
  const change = stock.priceChange ?? 0;
  const dte = daysToEarnings(stock);

  if (ivRank >= 70) {
    reasons.push(`IV rank of ${ivRank} — premium is historically expensive`);
  } else if (ivRank >= 50) {
    reasons.push(`IV rank of ${ivRank} — elevated premium environment`);
  }

  if (dte !== null && dte > 45) {
    reasons.push(`Earnings ${dte} days away — safe trading window`);
  } else if (dte === null) {
    reasons.push('No near-term earnings scheduled');
  }

  if (liqScore >= liqMaxPts * 0.8) {
    reasons.push('High options volume ensures tight bid-ask spreads');
  }

  if (strategy === 'CSP' && change >= 0 && change <= 2) {
    reasons.push('Price action supports CSP entry — flat to mild uptrend');
  }
  if (strategy === 'CC' && change >= 0 && change <= 1.5) {
    reasons.push('Flat price action ideal for collecting CC premium');
  }

  return reasons.slice(0, 3);
}

function buildWarnings(
  stock: ScreenerStock,
  strategy: 'CSP' | 'CC',
  maxRisk: number,
): string[] {
  const warnings: string[] = [];
  const dte = daysToEarnings(stock);
  const ivRank = stock.ivRank ?? 0;
  const change = stock.priceChange ?? 0;

  if (dte !== null && dte >= 15 && dte <= 29) {
    warnings.push(`Earnings in ${dte} days — consider shorter DTE`);
  }
  if (strategy === 'CSP' && change < -2) {
    warnings.push('Stock in mild downtrend — size conservatively');
  }
  if (ivRank > 90) {
    warnings.push('Very high IV — elevated premium but expect volatility');
  }
  if (maxRisk > 10_000) {
    warnings.push(`One contract requires $${maxRisk.toLocaleString()} collateral`);
  }

  return warnings.slice(0, 2);
}

// ── Main selector ──────────────────────────────────────────────────────────

export function getTopPicks(
  screenerData: ScreenerStock[],
  strategy: 'CSP' | 'CC',
  count = 5,
): TopPick[] {
  // Step 1: filter out stocks without usable data
  const eligible = screenerData.filter(
    (s) =>
      s.ivRank != null &&
      s.ivRank > 0 &&
      s.price != null &&
      s.price > 0 &&
      s.currentIV != null &&
      s.currentIV > 0 &&
      (daysToEarnings(s) === null || (daysToEarnings(s) ?? 999) > 7),
  );

  // Step 2: score
  const scored = eligible.map((s) => ({
    stock: s,
    score:
      strategy === 'CSP'
        ? scoreForCSP(s, eligible)
        : scoreForCC(s, eligible),
  }));

  // Step 3: sort descending
  scored.sort((a, b) => b.score - a.score);

  // Step 4: take top N
  const top = scored.slice(0, count);

  // Step 5: build TopPick objects
  const expiry = nearestMonthlyExpiry();
  const liqMaxPts = strategy === 'CSP' ? 20 : 15;

  return top.map(({ stock, score }) => {
    const price = stock.price!;
    const ivRank = stock.ivRank!;
    const currentIV = stock.currentIV!;

    const suggestedStrike =
      strategy === 'CSP'
        ? calcCSPStrike(price, currentIV)
        : calcCCStrike(price, currentIV);

    const estimatedPremium = calcPremium(price, suggestedStrike, currentIV, strategy);
    const maxRisk =
      strategy === 'CSP'
        ? suggestedStrike * 100
        : price * 100;

    const estimatedAnnualReturn =
      maxRisk > 0
        ? (estimatedPremium * 100 / maxRisk) * (365 / 30) * 100
        : 0;

    const liqScore = liquidityScore(stock, eligible, liqMaxPts);

    // Score breakdown (approximate per-component values)
    const ivRankScore =
      strategy === 'CSP'
        ? ivRank >= 80 ? 40 : ivRank >= 70 ? 35 : ivRank >= 60 ? 28 : ivRank >= 50 ? 18 : ivRank >= 30 ? 8 : 0
        : ivRank >= 70 ? 35 : ivRank >= 55 ? 28 : ivRank >= 40 ? 18 : ivRank >= 25 ? 8 : 0;

    const dte = daysToEarnings(stock);
    const earnMaxPts = strategy === 'CSP' ? 25 : 20;
    const earningsSafetyScore =
      dte === null ? Math.round(earnMaxPts * 0.8)
      : dte > 45 ? earnMaxPts
      : dte >= 30 ? Math.round(earnMaxPts * 0.72)
      : dte >= 15 ? Math.round(earnMaxPts * 0.32)
      : 0;

    const change = stock.priceChange ?? 0;
    const momentumMaxPts = strategy === 'CSP' ? 15 : 30;
    const momentumScore =
      strategy === 'CSP'
        ? change > 2 ? 8 : change >= 0 ? 15 : change >= -2 ? 12 : change >= -5 ? 5 : 0
        : change >= 0 && change <= 1.5 ? 30 : change >= -1 && change < 0 ? 25 : change > 1.5 && change <= 3 ? 20 : change > 3 && change <= 6 ? 10 : change > 6 ? 3 : 5;
    void momentumMaxPts; // unused but kept for clarity

    const penalties = Math.max(0, ivRankScore + earningsSafetyScore + liqScore + momentumScore - score);

    return {
      ticker: stock.ticker,
      name: stock.name,
      sector: stock.sector,
      price,
      ivRank,
      ivPercentile: stock.ivPercentile,
      currentIV,
      score,
      scoreBreakdown: {
        ivRankScore,
        earningsSafetyScore,
        liquidityScore: liqScore,
        momentumScore,
        penalties,
      },
      strategy,
      suggestedStrike,
      suggestedExpiry: expiry,
      estimatedPremium,
      estimatedAnnualReturn,
      maxRisk,
      reasoning: buildReasoning(stock, strategy, liqScore, liqMaxPts),
      warnings: buildWarnings(stock, strategy, maxRisk),
    } satisfies TopPick;
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npx tsc --noEmit 2>&1 | grep topPicksEngine
```

Expected: no output (no errors).

---

## Chunk 2: TopPicksSection UI Component

### Task 2: Create `src/components/TopPicksSection.tsx`

**Files:**
- Create: `src/components/TopPicksSection.tsx`

#### Design language (match existing app)

- Background cards: `rgba(13,27,53,0.6)` with `border: 1px solid rgba(0,229,196,0.1)` and `backdropFilter: blur(12px)`
- Font families: Syne (headings), DM Sans (body), JetBrains Mono (numbers/mono)
- Text colours: `#e8f0fe` (primary), `#9ab4d4` (secondary), `#4a6a8a` (muted)
- Teal accent: `#00e5c4`
- Green P&L: `#00d68f`
- Red/danger: `#ff4d6d`
- Amber warning: `#f5c842`
- Skeleton shimmer: use class `animate-pulse` with `rgba(255,255,255,0.05)` background
- CSP badge colour: `#00c6f5` (blue — sell put)
- CC badge colour: `#00e5c4` (teal — sell call)
- Score bar fill: teal gradient

#### Score bar colour logic:
- score >= 70: `#00d68f` (green — strong)
- score >= 50: `#f5c842` (yellow — moderate)
- score < 50: `#ff4d6d` (red — weak)

#### Rank badge colours:
- Rank 1: `#f5c842` (gold)
- Rank 2: `#9ab4d4` (silver)
- Rank 3: `#fb923c` (bronze)
- Rank 4-5: `#4a6a8a` (muted)

- [ ] **Step 1: Write the complete file**

```tsx
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

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: '#f5c842',
    2: '#9ab4d4',
    3: '#fb923c',
  };
  const color = colors[rank] ?? '#4a6a8a';
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
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
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
      {[80, 60, 90, 50].map((w) => (
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
          {pick.reasoning.map((r) => (
            <li key={r} className="flex items-start gap-1.5 text-xs" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif' }}>
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
          {pick.warnings.map((w) => (
            <li key={w} className="flex items-start gap-1.5 text-xs" style={{ color: '#f5c842', fontFamily: 'DM Sans, sans-serif' }}>
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
            AI-Ranked Picks
          </span>
        </div>
        <button
          onClick={toggleCollapsed}
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npx tsc --noEmit 2>&1 | grep -E "TopPicksSection|topPicksEngine"
```

Expected: no output.

---

## Chunk 3: Screener.tsx Wiring

### Task 3: Wire TopPicksSection into Screener.tsx

**Files:**
- Modify: `src/pages/Screener.tsx`

#### Injection point

The TopPicksSection goes between the page header container (the `</div>` that closes at approximately line 197 in the original file) and the table container div (that starts at approximately line 200 with `<div className="max-w-[1400px] mx-auto px-4 sm:px-6 mt-4">`).

Use `stocks` (ALL loaded stocks from `useScreenerStream`), NOT `filtered` — top picks should rank from the entire universe regardless of user filters.

- [ ] **Step 1: Add import at top of Screener.tsx**

After the existing imports, add:
```typescript
import { TopPicksSection } from '../components/TopPicksSection';
```

- [ ] **Step 2: Inject component**

Find the closing `</div>` of the page header section (the one that closes at approximately: `</div>` after `</FilterControls>`). It looks like:
```tsx
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 mt-4">
```

Insert between these two elements:
```tsx
      {/* ── Top Picks ────────────────────────────────────────────────────── */}
      <TopPicksSection screenerData={stocks} isLoading={isLoading} />
```

- [ ] **Step 3: Verify TypeScript compiles — full project**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npx tsc --noEmit 2>&1
```

Expected: no output (zero errors).

- [ ] **Step 4: Dev server sanity check**

```bash
npm run dev
```

Navigate to `/screener`. Confirm:
1. TopPicksSection renders above the filter controls
2. Two panels visible (CSP left, CC right on desktop; stacked on mobile)
3. Pick cards show ticker, score bar, trade parameters, reasoning
4. "Hide top picks" / "Show top picks" toggle works and persists on refresh
5. Score bar tooltip appears on hover
6. "View Stock" button navigates to `/stock/TICKER`
7. "+ Watchlist" button adds to watchlist (checkmark appears when added)
8. Methodology modal opens on the ℹ️ button
9. Skeleton cards appear while data is loading (< 5 stocks loaded)
10. Disclaimer text visible below both panels

---

## Notes for Implementers

### Type reconciliation

The spec defined a `ScreenerRow` interface — **do not create it**. The engine uses `ScreenerStock` directly from `src/lib/screenerData.ts`. Field name mapping:
- spec `changePercent` → `ScreenerStock.priceChange`
- spec `daysToEarnings` → computed from `ScreenerStock.earningsDate` at runtime

### `currentIV` unit — critical

`currentIV` is stored as a **percentage** (e.g., `45` = 45%). The `blackScholes()` function expects a **decimal** (e.g., `0.45`). Always divide: `currentIV / 100` when calling `blackScholes`.

### Loading state logic

`isLoading && screenerData.length === 0` → show skeleton cards (data just started)
`isLoading && screenerData.length > 0` → show real cards (partial data already available)
`!isLoading` → show final cards
