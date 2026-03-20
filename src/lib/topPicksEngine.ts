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
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  const medVol = median(volumes);

  if (stock.volume >= p90) return maxPts;
  if (stock.volume >= p75) return Math.round(maxPts * 0.8);
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
  const eligible = screenerData.filter((s) => {
    const earningsDte = daysToEarnings(s);
    return (
      s.ivRank != null &&
      s.ivRank > 0 &&
      s.price != null &&
      s.price > 0 &&
      s.currentIV != null &&
      s.currentIV > 0 &&
      (earningsDte === null || earningsDte > 7)
    );
  });

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
    const momentumScore =
      strategy === 'CSP'
        ? change > 2 ? 8 : change >= 0 ? 15 : change >= -2 ? 12 : change >= -5 ? 5 : 0
        : change >= 0 && change <= 1.5 ? 30 : change >= -1 && change < 0 ? 25 : change > 1.5 && change <= 3 ? 20 : change > 3 && change <= 6 ? 10 : change > 6 ? 3 : change < -3 ? 5 : 12;

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
