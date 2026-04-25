// ── Standard normal distribution helpers ──────────────────────────────────────
// Abramowitz & Stegun approximation (max error ±1.5×10⁻⁷)

function normalCDF(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1.0 + sign * y);
}

function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BlackScholesResult {
  price: number;          // theoretical option price per share
  delta: number;          // rate of change vs underlying
  gamma: number;          // rate of change of delta
  theta: number;          // daily time decay in dollars per share
  vega: number;           // price change per 1% IV move
  intrinsicValue: number; // max(0, S-K) for call / max(0, K-S) for put
  timeValue: number;      // price minus intrinsic
  moneyness: number;      // S/K — >1 = call ITM, <1 = call OTM
  d1: number;
  d2: number;
}

// ── Core Black-Scholes ────────────────────────────────────────────────────────

export function blackScholes(params: {
  spotPrice: number;      // current underlying price (S)
  strikePrice: number;    // option strike price (K)
  timeToExpiry: number;   // years to expiry (T) — e.g. 1.5 for 18 months
  riskFreeRate: number;   // annual risk-free rate as decimal — 0.045 = 4.5%
  volatility: number;     // annual implied volatility as decimal — 0.45 = 45%
  optionType: 'call' | 'put';
}): BlackScholesResult {
  const { spotPrice: S, strikePrice: K, timeToExpiry: T, riskFreeRate: r, volatility: v, optionType } = params;

  // Guard against degenerate inputs
  if (T <= 0 || v <= 0 || S <= 0 || K <= 0) {
    const intrinsicValue = optionType === 'call' ? Math.max(0, S - K) : Math.max(0, K - S);
    return { price: intrinsicValue, delta: optionType === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, theta: 0, vega: 0, intrinsicValue, timeValue: 0, moneyness: S / K, d1: 0, d2: 0 };
  }

  const d1 = (Math.log(S / K) + (r + 0.5 * v * v) * T) / (v * Math.sqrt(T));
  const d2 = d1 - v * Math.sqrt(T);

  let price: number;
  let delta: number;
  let theta: number;

  if (optionType === 'call') {
    price = S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
    delta = normalCDF(d1);
    theta = (-(S * normalPDF(d1) * v) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normalCDF(d2)) / 365;
  } else {
    price = K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
    delta = normalCDF(d1) - 1;
    theta = (-(S * normalPDF(d1) * v) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * normalCDF(-d2)) / 365;
  }

  const gamma = normalPDF(d1) / (S * v * Math.sqrt(T));
  const vega = S * normalPDF(d1) * Math.sqrt(T) / 100; // per 1% IV move
  const intrinsicValue = optionType === 'call' ? Math.max(0, S - K) : Math.max(0, K - S);
  const timeValue = Math.max(0, price - intrinsicValue);
  const moneyness = S / K;

  return { price: Math.max(0, price), delta, gamma, theta, vega, intrinsicValue, timeValue, moneyness, d1, d2 };
}

// ── Helper: years to expiry ───────────────────────────────────────────────────

export function yearsToExpiry(expiryDate: string): number {
  const expiry = new Date(expiryDate);
  const today = new Date();
  const diffMs = expiry.getTime() - today.getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24 * 365));
}

// ── Helper: volatility estimate fallback ─────────────────────────────────────
// Priority: caller provides HV30 decimal → this returns it.
// If not provided, falls back to per-ticker defaults, then 0.45 generic.

const DEFAULT_VOLS: Record<string, number> = {
  'GME': 1.20, 'MARA': 1.40, 'COIN': 1.00, 'MSTR': 1.10,
  'TSLA': 0.65, 'NVDA': 0.55, 'AMD': 0.55, 'META': 0.40,
  'AAPL': 0.28, 'MSFT': 0.28, 'SPY': 0.18, 'QQQ': 0.22,
  'SOFI': 0.70, 'PLTR': 0.65, 'RIVN': 0.90, 'LCID': 0.95,
};

export function estimateVolatility(ticker: string, historicalVol?: number): number {
  return historicalVol ?? DEFAULT_VOLS[ticker] ?? 0.45;
}

// ── Helper: moneyness label ───────────────────────────────────────────────────

export type MoneynessLevel = 'Deep ITM' | 'ITM' | 'ATM' | 'OTM' | 'Deep OTM';

export function getMoneynessLevel(moneyness: number, optionType: 'call' | 'put'): MoneynessLevel {
  const m = optionType === 'put' ? 1 / moneyness : moneyness;
  if (m > 1.20) return 'Deep ITM';
  if (m > 1.05) return 'ITM';
  if (m >= 0.95) return 'ATM';
  if (m >= 0.80) return 'OTM';
  return 'Deep OTM';
}

export const MONEYNESS_COLORS: Record<MoneynessLevel, string> = {
  'Deep ITM': '#00d68f',
  'ITM':      '#00e5c4',
  'ATM':      '#f5c842',
  'OTM':      '#ff8c42',
  'Deep OTM': '#ff4d6d',
};

// ── Assignment Probability ────────────────────────────────────────────────────

export interface AssignmentProbabilityResult {
  probability: number;
  delta: number;
  moneyness: number;
  status: 'safe' | 'watch' | 'near' | 'itm' | 'assigned' | 'expired_worthless';
  distanceToStrike: number;
  distancePercent: number;
  safetyBuffer: number;
  label: string;
  recommendation: string | null;
}

export function calculateAssignmentProbability(params: {
  spotPrice: number;
  strikePrice: number;
  daysToExpiry: number;
  impliedVolatility: number;
  strategy: 'CSP' | 'CC';
  riskFreeRate?: number;
}): AssignmentProbabilityResult {
  const { spotPrice, strikePrice, daysToExpiry, impliedVolatility, strategy, riskFreeRate = 0.045 } = params;

  if (daysToExpiry <= 0) {
    const isAssigned = strategy === 'CSP' ? spotPrice <= strikePrice : spotPrice >= strikePrice;
    return {
      probability: isAssigned ? 100 : 0,
      delta: isAssigned ? (strategy === 'CSP' ? -1 : 1) : 0,
      moneyness: spotPrice / strikePrice,
      status: isAssigned ? 'assigned' : 'expired_worthless',
      distanceToStrike: Math.abs(spotPrice - strikePrice),
      distancePercent: Math.abs((spotPrice - strikePrice) / spotPrice) * 100,
      safetyBuffer: strategy === 'CSP' ? spotPrice - strikePrice : strikePrice - spotPrice,
      label: isAssigned ? 'Assigned' : 'Expired worthless',
      recommendation: null,
    };
  }

  const T = daysToExpiry / 365;
  const result = blackScholes({
    spotPrice,
    strikePrice,
    timeToExpiry: T,
    riskFreeRate,
    volatility: impliedVolatility,
    optionType: strategy === 'CSP' ? 'put' : 'call',
  });

  const probability = Math.round(Math.abs(result.delta) * 1000) / 10;
  const distanceToStrike = strategy === 'CSP' ? spotPrice - strikePrice : strikePrice - spotPrice;
  const distancePercent = Math.round(Math.abs(distanceToStrike / spotPrice) * 10000) / 100;
  const moneyness = spotPrice / strikePrice;

  let status: AssignmentProbabilityResult['status'];
  if (strategy === 'CSP') {
    if (spotPrice < strikePrice) status = 'itm';
    else if (distancePercent < 3) status = 'near';
    else if (distancePercent < 8) status = 'watch';
    else status = 'safe';
  } else {
    if (spotPrice > strikePrice) status = 'itm';
    else if (distancePercent < 3) status = 'near';
    else if (distancePercent < 8) status = 'watch';
    else status = 'safe';
  }

  const labels: Record<string, string> = { safe: 'Safe', watch: 'Watch', near: 'Near strike', itm: 'In the money' };

  let recommendation: string | null = null;
  if (status === 'itm' && daysToExpiry > 7) recommendation = 'Position ITM — monitor closely, assignment likely';
  else if (status === 'near' && daysToExpiry <= 14) recommendation = 'Near strike with low DTE — consider accepting assignment';
  else if (status === 'watch' && daysToExpiry <= 7) recommendation = 'Watch closely — approaching strike near expiry';

  return {
    probability,
    delta: result.delta,
    moneyness,
    status,
    distanceToStrike,
    distancePercent,
    safetyBuffer: distanceToStrike,
    label: labels[status],
    recommendation,
  };
}

export function calculateAssignmentProbabilitiesBatch(
  positions: Array<{ id: string; ticker: string; strategy: 'CSP' | 'CC'; strike: number; expiry: string }>,
  priceMap: Map<string, number>,
  ivMap: Map<string, number>,
): Map<string, AssignmentProbabilityResult> {
  const results = new Map<string, AssignmentProbabilityResult>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  positions.forEach(position => {
    const spotPrice = priceMap.get(position.ticker);
    if (!spotPrice || spotPrice <= 0) return;

    const expiryDate = new Date(position.expiry);
    expiryDate.setHours(0, 0, 0, 0);
    const daysToExpiry = Math.max(0, Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    ));

    const iv = ivMap.get(position.ticker) ?? estimateVolatility(position.ticker);

    results.set(position.id, calculateAssignmentProbability({
      spotPrice,
      strikePrice: position.strike,
      daysToExpiry,
      impliedVolatility: iv,
      strategy: position.strategy,
    }));
  });

  return results;
}
