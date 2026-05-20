// src/lib/topPicksEngine.ts
import { blackScholes } from './blackScholes';
import type { ScreenerStock } from './screenerData';

// ── Scoring preferences ────────────────────────────────────────────────────

export interface ScoringPreferences {
  capitalPerTrade: number;    // max collateral per contract; default 10 000
  minAnnualReturn: number;    // minimum annualised return %; default 10
  preferredSectors: string[]; // sectors to give a score boost; default []
}

export const DEFAULT_SCORING_PREFS: ScoringPreferences = {
  capitalPerTrade: 10_000,
  minAnnualReturn: 10,
  preferredSectors: [],
};

// ── Public types ───────────────────────────────────────────────────────────

export interface TopPick {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  ivRank: number;
  ivPercentile: number | null;
  currentIV: number;
  ivHvRatio: number | null;
  putCallSkew: number | null;
  score: number;
  scoreBreakdown: {
    ivRankScore: number;
    ivHvScore: number;
    earningsSafetyScore: number;
    liquidityScore: number;
    momentumScore: number;
    skewScore: number;
    penalties: number;
  };
  strategy: 'CSP' | 'CC';
  suggestedStrike: number;
  suggestedExpiry: string;
  estimatedPremium: number;
  estimatedAnnualReturn: number;
  maxRisk: number;
  suggestedStrike2: number | null;
  suggestedExpiry2: string | null;
  estimatedPremium2: number | null;
  sectorMomentum: 'bullish' | 'bearish' | 'neutral' | null;
  reasoning: string[];
  warnings: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function daysToEarnings(stock: ScreenerStock): number | null {
  if (!stock.earningsDate) return null;
  const diff = Math.ceil(
    (new Date(stock.earningsDate).getTime() - Date.now()) / 86_400_000
  );
  return diff > 0 ? diff : null;
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

function thirdFriday(year: number, month: number): Date {
  const d = new Date(year, month, 1);
  const daysUntilFriday = (5 - d.getDay() + 7) % 7;
  d.setDate(1 + daysUntilFriday + 14);
  return d;
}

function findExpiry(
  minDte: number,
  maxDte: number,
): { label: string; dte: number } | null {
  const today = new Date();
  for (let offset = 0; offset < 5; offset++) {
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const expiry = thirdFriday(d.getFullYear(), d.getMonth());
    const dte = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
    if (dte >= minDte && dte <= maxDte) {
      const label = expiry.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
      return { label: `${label} (${dte} DTE)`, dte };
    }
  }
  return null;
}

/** Binary search for the strike where |delta| ≈ targetAbsDelta. */
function findDeltaStrike(
  spotPrice: number,
  ivPct: number,
  dteDays: number,
  targetAbsDelta: number,
  optionType: 'put' | 'call',
): number {
  const vol = ivPct / 100;
  const T = dteDays / 365;

  if (vol <= 0 || T <= 0 || spotPrice <= 0) {
    return optionType === 'put'
      ? roundToHalf(spotPrice * (1 - vol * Math.sqrt(T) * 0.5))
      : roundToHalf(spotPrice * (1 + vol * Math.sqrt(T) * 0.3));
  }

  let lo = spotPrice * 0.3;
  let hi = spotPrice * 1.8;

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const { delta } = blackScholes({
      spotPrice,
      strikePrice: mid,
      timeToExpiry: T,
      riskFreeRate: 0.045,
      volatility: vol,
      optionType,
    });
    const absDelta = Math.abs(delta);

    if (optionType === 'put') {
      // |put delta| increases as strike increases (more ITM)
      if (absDelta > targetAbsDelta) hi = mid;
      else lo = mid;
    } else {
      // call delta decreases as strike increases (more OTM)
      if (absDelta > targetAbsDelta) lo = mid;
      else hi = mid;
    }

    if (hi - lo < 0.005) break;
  }

  return roundToHalf((lo + hi) / 2);
}

function calcPremium(
  price: number,
  strike: number,
  ivPct: number,
  dteDays: number,
  strategy: 'CSP' | 'CC',
): number {
  const vol = ivPct / 100;
  if (vol <= 0 || price <= 0 || strike <= 0 || dteDays <= 0) return 0;
  const result = blackScholes({
    spotPrice: price,
    strikePrice: strike,
    timeToExpiry: dteDays / 365,
    riskFreeRate: 0.045,
    volatility: vol,
    optionType: strategy === 'CSP' ? 'put' : 'call',
  });
  return Math.max(0, result.price);
}

// ── Score sub-components ───────────────────────────────────────────────────

function volumePts(stock: ScreenerStock, allStocks: ScreenerStock[], maxPts: number): number {
  if (stock.volume == null) return Math.round(maxPts * 0.25);
  const volumes = allStocks.map((s) => s.volume).filter((v): v is number => v != null);
  if (volumes.length === 0) return Math.round(maxPts * 0.25);

  const sorted = [...volumes].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  const med = median(volumes);

  if (stock.volume >= p90) return maxPts;
  if (stock.volume >= p75) return Math.round(maxPts * 0.8);
  if (stock.volume >= med) return Math.round(maxPts * 0.5);
  return Math.round(maxPts * 0.25);
}

function oiPts(stock: ScreenerStock, maxPts: number): number {
  const oi = stock.atmOpenInterest;
  if (oi == null) return Math.round(maxPts * 0.5); // neutral when no data
  if (oi >= 2000) return maxPts;
  if (oi >= 1000) return Math.round(maxPts * 0.8);
  if (oi >= 500)  return Math.round(maxPts * 0.6);
  if (oi >= 100)  return Math.round(maxPts * 0.4);
  return Math.round(maxPts * 0.1);
}

function calcLiquidityScore(stock: ScreenerStock, allStocks: ScreenerStock[], maxPts: number): number {
  // 70% volume, 30% open interest
  return Math.round(volumePts(stock, allStocks, maxPts * 0.7) + oiPts(stock, maxPts * 0.3));
}

function calcIVHvScore(stock: ScreenerStock, maxPts: number): number {
  const ratio = stock.ivHvRatio;
  if (ratio == null) return Math.round(maxPts * 0.4);
  if (ratio >= 1.5) return maxPts;
  if (ratio >= 1.3) return Math.round(maxPts * 0.85);
  if (ratio >= 1.1) return Math.round(maxPts * 0.65);
  if (ratio >= 0.9) return Math.round(maxPts * 0.4);
  return Math.round(maxPts * 0.15);
}

function calcSkewScore(stock: ScreenerStock, strategy: 'CSP' | 'CC', maxPts: number): number {
  const skew = stock.putCallSkew;
  if (skew == null) return Math.round(maxPts * 0.5);
  if (strategy === 'CSP') {
    // Positive skew = puts more expensive = better for selling puts
    if (skew >= 0.05) return maxPts;
    if (skew >= 0.02) return Math.round(maxPts * 0.75);
    if (skew >= -0.02) return Math.round(maxPts * 0.5);
    return Math.round(maxPts * 0.25);
  } else {
    // CC: prefer when calls carry some relative premium
    if (skew <= -0.02) return maxPts;
    if (skew <= 0.02) return Math.round(maxPts * 0.6);
    return Math.round(maxPts * 0.3);
  }
}

// ── Sector momentum ────────────────────────────────────────────────────────

function buildSectorMomentumMap(
  stocks: ScreenerStock[],
): Map<string, 'bullish' | 'bearish' | 'neutral'> {
  const changes = new Map<string, number[]>();
  for (const s of stocks) {
    if (s.priceChange != null) {
      const arr = changes.get(s.sector) ?? [];
      arr.push(s.priceChange);
      changes.set(s.sector, arr);
    }
  }
  const result = new Map<string, 'bullish' | 'bearish' | 'neutral'>();
  changes.forEach((vals, sector) => {
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    result.set(sector, avg >= 0.3 ? 'bullish' : avg <= -0.3 ? 'bearish' : 'neutral');
  });
  return result;
}

// ── Score components struct ────────────────────────────────────────────────

interface ScoreComponents {
  ivRankScore: number;
  ivHvScore: number;
  earningsSafetyScore: number;
  liquidityScore: number;
  momentumScore: number;
  skewScore: number;
  penalties: number;
  total: number;
}

function computeCSPScore(
  stock: ScreenerStock,
  allStocks: ScreenerStock[],
  prefs: ScoringPreferences,
): ScoreComponents {
  const ivRank = stock.ivRank ?? 0;
  const change = stock.priceChange ?? 0;
  const dte = daysToEarnings(stock);

  // IV Rank (30 pts)
  let ivRankPts = 0;
  if (ivRank >= 80) ivRankPts = 30;
  else if (ivRank >= 70) ivRankPts = 26;
  else if (ivRank >= 60) ivRankPts = 21;
  else if (ivRank >= 50) ivRankPts = 14;
  else if (ivRank >= 30) ivRankPts = 6;

  // IV/HV ratio (12 pts)
  const ivHvPts = calcIVHvScore(stock, 12);

  // Earnings safety (20 pts)
  let earnPts = 0;
  if (dte === null) earnPts = 16;
  else if (dte > 45) earnPts = 20;
  else if (dte >= 30) earnPts = 14;
  else if (dte >= 15) earnPts = 6;

  // Liquidity (15 pts, volume + OI)
  const liqPts = calcLiquidityScore(stock, allStocks, 15);

  // Momentum (10 pts) — prefer flat to slight up for CSP
  let momPts = 0;
  if (change >= 0 && change <= 2) momPts = 10;
  else if (change > 2 && change <= 5) momPts = 5;
  else if (change >= -2 && change < 0) momPts = 8;
  else if (change >= -5 && change < -2) momPts = 3;

  // Skew (8 pts)
  const skewPts = calcSkewScore(stock, 'CSP', 8);

  // Sector bonus from preferences
  const sectorBonus = prefs.preferredSectors.includes(stock.sector) ? 5 : 0;

  // Penalties
  let penaltyPts = 0;
  if (ivRank < 50) penaltyPts += 10;
  if (dte !== null && dte <= 14) penaltyPts += 15;
  if ((stock.price ?? 0) > 200) penaltyPts += 5;
  if ((stock.ivHvRatio ?? 1) < 0.9) penaltyPts += 8;

  const raw = ivRankPts + ivHvPts + earnPts + liqPts + momPts + skewPts + sectorBonus;
  const total = Math.max(0, Math.min(100, raw - penaltyPts));

  return {
    ivRankScore: ivRankPts,
    ivHvScore: ivHvPts,
    earningsSafetyScore: earnPts,
    liquidityScore: liqPts,
    momentumScore: momPts,
    skewScore: skewPts,
    penalties: penaltyPts,
    total,
  };
}

function computeCCScore(
  stock: ScreenerStock,
  allStocks: ScreenerStock[],
  prefs: ScoringPreferences,
): ScoreComponents {
  const ivRank = stock.ivRank ?? 0;
  const change = stock.priceChange ?? 0;
  const dte = daysToEarnings(stock);

  // IV Rank (25 pts)
  let ivRankPts = 0;
  if (ivRank >= 70) ivRankPts = 25;
  else if (ivRank >= 55) ivRankPts = 20;
  else if (ivRank >= 40) ivRankPts = 13;
  else if (ivRank >= 25) ivRankPts = 6;

  // IV/HV ratio (10 pts)
  const ivHvPts = calcIVHvScore(stock, 10);

  // Trend (23 pts) — flat or mild uptrend ideal for CC
  let trendPts = 0;
  if (change >= 0 && change <= 1.5) trendPts = 23;
  else if (change >= -1 && change < 0) trendPts = 19;
  else if (change > 1.5 && change <= 3) trendPts = 15;
  else if (change > 3 && change <= 6) trendPts = 8;
  else if (change > 6) trendPts = 2;
  else if (change < -3) trendPts = 4;
  else trendPts = 9; // -3 to -1

  // Earnings safety (18 pts)
  let earnPts = 0;
  if (dte === null) earnPts = 14;
  else if (dte > 45) earnPts = 18;
  else if (dte >= 30) earnPts = 13;
  else if (dte >= 15) earnPts = 5;

  // Liquidity (12 pts)
  const liqPts = calcLiquidityScore(stock, allStocks, 12);

  // Skew (7 pts)
  const skewPts = calcSkewScore(stock, 'CC', 7);

  // Sector bonus
  const sectorBonus = prefs.preferredSectors.includes(stock.sector) ? 5 : 0;

  // Penalties
  let penaltyPts = 0;
  if (change > 5) penaltyPts += 10;
  if (dte !== null && dte <= 14) penaltyPts += 15;
  if (ivRank < 30) penaltyPts += 8;
  if ((stock.ivHvRatio ?? 1) < 0.9) penaltyPts += 6;

  const raw = ivRankPts + ivHvPts + trendPts + earnPts + liqPts + skewPts + sectorBonus;
  const total = Math.max(0, Math.min(100, raw - penaltyPts));

  return {
    ivRankScore: ivRankPts,
    ivHvScore: ivHvPts,
    earningsSafetyScore: earnPts,
    liquidityScore: liqPts,
    momentumScore: trendPts,
    skewScore: skewPts,
    penalties: penaltyPts,
    total,
  };
}

// ── Backward-compatible exports ────────────────────────────────────────────

export function scoreForCSP(stock: ScreenerStock, allStocks: ScreenerStock[]): number {
  return computeCSPScore(stock, allStocks, DEFAULT_SCORING_PREFS).total;
}

export function scoreForCC(stock: ScreenerStock, allStocks: ScreenerStock[]): number {
  return computeCCScore(stock, allStocks, DEFAULT_SCORING_PREFS).total;
}

// ── Reasoning / warnings ───────────────────────────────────────────────────

function buildReasoning(
  stock: ScreenerStock,
  strategy: 'CSP' | 'CC',
  liqScore: number,
  liqMaxPts: number,
  sectorMomentum: 'bullish' | 'bearish' | 'neutral' | null,
): string[] {
  const reasons: string[] = [];
  const ivRank = stock.ivRank ?? 0;
  const change = stock.priceChange ?? 0;
  const dte = daysToEarnings(stock);

  if (ivRank >= 70) {
    reasons.push(`IV rank ${ivRank} — premium is historically expensive`);
  } else if (ivRank >= 50) {
    reasons.push(`IV rank ${ivRank} — elevated premium environment`);
  }

  if (stock.ivHvRatio != null && stock.ivHvRatio >= 1.2) {
    reasons.push(`IV/HV ratio ${stock.ivHvRatio.toFixed(2)}x — implied vol significantly above realised`);
  }

  if (dte !== null && dte > 45) {
    reasons.push(`Earnings ${dte} days away — safe trading window`);
  } else if (dte === null) {
    reasons.push('No near-term earnings scheduled');
  }

  if (liqScore >= Math.round(liqMaxPts * 0.8)) {
    reasons.push('High volume/OI ensures tight bid-ask spreads');
  }

  if (strategy === 'CSP' && change >= 0 && change <= 2) {
    reasons.push('Flat to mild uptrend supports CSP entry');
  }
  if (strategy === 'CC' && change >= 0 && change <= 1.5) {
    reasons.push('Flat price action ideal for collecting call premium');
  }

  if (sectorMomentum === 'bullish' && strategy === 'CSP') {
    reasons.push(`${stock.sector} sector showing broad strength`);
  }
  if (sectorMomentum === 'neutral' && strategy === 'CC') {
    reasons.push(`${stock.sector} sector trending flat — low assignment risk`);
  }

  return reasons.slice(0, 4);
}

function buildWarnings(
  stock: ScreenerStock,
  strategy: 'CSP' | 'CC',
  maxRisk: number,
  prefs: ScoringPreferences,
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
  if (maxRisk > prefs.capitalPerTrade) {
    warnings.push(`1 contract requires $${maxRisk.toLocaleString()} — exceeds your capital setting`);
  }
  if (stock.putCallSkew != null && strategy === 'CSP' && stock.putCallSkew < -0.03) {
    warnings.push('Call skew elevated — put premium relatively cheap');
  }
  if (stock.ivHvRatio != null && stock.ivHvRatio < 0.9) {
    warnings.push('IV below realised vol — premium may be thin');
  }

  return warnings.slice(0, 3);
}

// ── Main selector ──────────────────────────────────────────────────────────

export function getTopPicks(
  screenerData: ScreenerStock[],
  strategy: 'CSP' | 'CC',
  count = 5,
  preferences?: ScoringPreferences,
): TopPick[] {
  const prefs = preferences ?? DEFAULT_SCORING_PREFS;
  const sectorMap = buildSectorMomentumMap(screenerData);

  const eligible = screenerData.filter((s) => {
    const earningsDte = daysToEarnings(s);
    return (
      s.ivRank != null && s.ivRank > 0 &&
      s.price != null && s.price > 0 &&
      s.currentIV != null && s.currentIV > 0 &&
      (earningsDte === null || earningsDte > 7)
    );
  });

  const scored = eligible.map((s) => ({
    stock: s,
    components:
      strategy === 'CSP'
        ? computeCSPScore(s, eligible, prefs)
        : computeCCScore(s, eligible, prefs),
  }));

  scored.sort((a, b) => b.components.total - a.components.total);

  const top = scored.slice(0, count);

  const nearExpiry = findExpiry(21, 49);
  const farExpiry = findExpiry(50, 80);

  return top.map(({ stock, components }) => {
    const price = stock.price!;
    const ivRank = stock.ivRank!;
    const currentIV = stock.currentIV!;

    const nearDte = nearExpiry?.dte ?? 30;
    const farDte = farExpiry?.dte ?? 45;

    const optionType = strategy === 'CSP' ? 'put' : 'call';
    const targetDelta = strategy === 'CSP' ? 0.30 : 0.20;

    const suggestedStrike = findDeltaStrike(price, currentIV, nearDte, targetDelta, optionType);
    const suggestedStrike2 = findDeltaStrike(price, currentIV, farDte, targetDelta, optionType);

    const estimatedPremium = calcPremium(price, suggestedStrike, currentIV, nearDte, strategy);
    const estimatedPremium2 = calcPremium(price, suggestedStrike2, currentIV, farDte, strategy);

    const maxRisk = strategy === 'CSP' ? suggestedStrike * 100 : price * 100;

    const estimatedAnnualReturn =
      maxRisk > 0
        ? Math.round((estimatedPremium * 100 / maxRisk) * (365 / nearDte) * 1000) / 10
        : 0;

    const sectorMomentum = sectorMap.get(stock.sector) ?? null;
    const liqMaxPts = strategy === 'CSP' ? 15 : 12;

    return {
      ticker: stock.ticker,
      name: stock.name,
      sector: stock.sector,
      price,
      ivRank,
      ivPercentile: stock.ivPercentile,
      currentIV,
      ivHvRatio: stock.ivHvRatio,
      putCallSkew: stock.putCallSkew,
      score: components.total,
      scoreBreakdown: {
        ivRankScore: components.ivRankScore,
        ivHvScore: components.ivHvScore,
        earningsSafetyScore: components.earningsSafetyScore,
        liquidityScore: components.liquidityScore,
        momentumScore: components.momentumScore,
        skewScore: components.skewScore,
        penalties: components.penalties,
      },
      strategy,
      suggestedStrike,
      suggestedExpiry: nearExpiry?.label ?? `(${nearDte} DTE)`,
      estimatedPremium,
      estimatedAnnualReturn,
      maxRisk,
      suggestedStrike2,
      suggestedExpiry2: farExpiry?.label ?? null,
      estimatedPremium2,
      sectorMomentum,
      reasoning: buildReasoning(stock, strategy, components.liquidityScore, liqMaxPts, sectorMomentum),
      warnings: buildWarnings(stock, strategy, maxRisk, prefs),
    } satisfies TopPick;
  });
}
