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
  volatility: number;     // annual implied volatility as decimal — 0.45 = 45%, if needed, this has to be changed for accuracy
  optionType: 'call' | 'put';
}): BlackScholesResult {
  const { spotPrice: S, strikePrice: K, timeToExpiry: T, riskFreeRate: r, volatility: v, optionType } = params;

  // Guard against degenerate inputs
  if (T <= 0 || v <= 0 || S <= 0 || K <= 0) {
    const intrinsicValue = optionType === 'call' ? Math.max(0, S - K) : Math.max(0, K - S);
    return { price: intrinsicValue, delta: optionType === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, theta: 0, vega: 0, intrinsicValue, timeValue: 0, moneyness: K > 0 ? S / K : 0, d1: 0, d2: 0 };
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

// ── Portfolio Greeks ──────────────────────────────────────────────────────────

export interface PositionGreeks {
  positionId: string
  ticker: string
  strategy: 'CSP' | 'CC'
  strike: number
  expiry: string
  contracts: number
  currentPrice: number
  impliedVolatility: number
  dte: number
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
  positionDelta: number
  positionGamma: number
  positionTheta: number
  positionVega: number
  sellerDelta: number
  sellerTheta: number
  sellerVega: number
  sellerGamma: number
  dollarThetaToday: number
  dollarThetaToExpiry: number
  dollarVegaImpact: number
  dollarDeltaImpact: number
  moneyness: number
  moneynessLabel: 'Deep ITM' | 'ITM' | 'ATM' | 'OTM' | 'Deep OTM'
  distanceFromStrike: number
  distancePercent: number
  ivSource: 'polygon_live' | 'supabase_cache' | 'estimated'
  calculatedAt: string
}

export interface PortfolioGreeks {
  totalDelta: number
  totalGamma: number
  totalTheta: number
  totalVega: number
  totalRho: number
  dailyThetaIncome: number
  weeklyThetaIncome: number
  monthlyThetaIncome: number
  thetaToMaxProfitPercent: number
  dollarDeltaPerPoint: number
  dollarVegaPerPoint: number
  gammaRisk: 'low' | 'moderate' | 'high' | 'extreme'
  vegaRisk: 'low' | 'moderate' | 'high'
  deltaExposure: 'bullish' | 'slightly_bullish' | 'neutral' | 'slightly_bearish' | 'bearish'
  thetaByPosition: Array<{
    positionId: string
    ticker: string
    strategy: 'CSP' | 'CC'
    strike: number
    dte: number
    dailyTheta: number
    percentOfTotal: number
    thetaPercentOfPremium: number
  }>
  thetaByTicker: Array<{
    ticker: string
    dailyTheta: number
    percentOfTotal: number
  }>
  weightedAverageDTE: number
  positionsExpiringThisWeek: number
  premiumExpiringThisWeek: number
  thetaAccelerationNote: string | null
  scenarios: {
    stocksUp5Percent: number
    stocksDown5Percent: number
    stocksUp10Percent: number
    stocksDown10Percent: number
    ivUp10Percent: number
    ivDown10Percent: number
    oneWeekFromNow: number
    atExpiry: number
  }
  positions: PositionGreeks[]
  positionsWithLiveIV: number
  positionsWithEstimatedIV: number
  calculatedAt: string
}

function _getMoneynessLabel(
  moneyness: number,
  strategy: 'CSP' | 'CC',
): PositionGreeks['moneynessLabel'] {
  if (strategy === 'CSP') {
    if (moneyness > 1.20) return 'Deep OTM'
    if (moneyness > 1.03) return 'OTM'
    if (moneyness >= 0.97) return 'ATM'
    if (moneyness >= 0.80) return 'ITM'
    return 'Deep ITM'
  } else {
    if (moneyness > 1.20) return 'Deep ITM'
    if (moneyness > 1.03) return 'ITM'
    if (moneyness >= 0.97) return 'ATM'
    if (moneyness >= 0.80) return 'OTM'
    return 'Deep OTM'
  }
}

export function calculatePositionGreeks(params: {
  positionId: string
  ticker: string
  strategy: 'CSP' | 'CC'
  strike: number
  expiry: string
  contracts: number
  currentPrice: number
  impliedVolatility: number
  riskFreeRate?: number
  ivSource: PositionGreeks['ivSource']
}): PositionGreeks {
  const {
    positionId, ticker, strategy, strike, expiry,
    contracts, currentPrice, impliedVolatility,
    riskFreeRate = 0.045, ivSource,
  } = params

  const today = new Date()
  const expiryDate = new Date(expiry)
  const dte = Math.max(0, Math.ceil(
    (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  ))

  const moneyness = currentPrice > 0 ? currentPrice / strike : 0

  if (dte === 0 || currentPrice <= 0 || impliedVolatility <= 0) {
    const intrinsicDelta = strategy === 'CSP'
      ? (currentPrice < strike ? -1 : 0)
      : (currentPrice > strike ? 1 : 0)
    return {
      positionId, ticker, strategy, strike, expiry,
      contracts, currentPrice, impliedVolatility, dte,
      delta: intrinsicDelta, gamma: 0, theta: 0, vega: 0, rho: 0,
      positionDelta: intrinsicDelta * contracts * 100,
      positionGamma: 0, positionTheta: 0, positionVega: 0,
      sellerDelta: -intrinsicDelta * contracts * 100,
      sellerTheta: 0, sellerVega: 0, sellerGamma: 0,
      dollarThetaToday: 0, dollarThetaToExpiry: 0,
      dollarVegaImpact: 0, dollarDeltaImpact: 0,
      moneyness,
      moneynessLabel: _getMoneynessLabel(moneyness, strategy),
      distanceFromStrike: Math.abs(currentPrice - strike),
      distancePercent: currentPrice > 0 ? Math.abs((currentPrice - strike) / currentPrice) * 100 : 0,
      ivSource,
      calculatedAt: new Date().toISOString(),
    }
  }

  const optionType = strategy === 'CSP' ? 'put' : 'call'
  const T = dte / 365

  const bs = blackScholes({
    spotPrice: currentPrice,
    strikePrice: strike,
    timeToExpiry: T,
    riskFreeRate,
    volatility: impliedVolatility,
    optionType,
  })

  const rho = optionType === 'call'
    ? strike * T * Math.exp(-riskFreeRate * T) * normalCDF(bs.d2) / 100
    : -strike * T * Math.exp(-riskFreeRate * T) * normalCDF(-bs.d2) / 100

  const multiplier = contracts * 100
  const positionDelta = bs.delta * multiplier
  const positionGamma = bs.gamma * multiplier
  const positionTheta = bs.theta * multiplier
  const positionVega = bs.vega * multiplier

  const sellerDelta = positionDelta * -1
  const sellerTheta = positionTheta * -1
  const sellerVega = positionVega * -1
  const sellerGamma = positionGamma * -1

  const dollarThetaToday = sellerTheta
  const dollarThetaToExpiry = bs.timeValue * multiplier
  const dollarVegaImpact = sellerVega
  const dollarDeltaImpact = sellerDelta

  const distanceFromStrike = Math.abs(currentPrice - strike)
  const distancePercent = (distanceFromStrike / currentPrice) * 100

  return {
    positionId, ticker, strategy, strike, expiry,
    contracts, currentPrice, impliedVolatility, dte,
    delta: bs.delta,
    gamma: bs.gamma,
    theta: bs.theta,
    vega: bs.vega,
    rho: Math.round(rho * 10000) / 10000,
    positionDelta, positionGamma, positionTheta, positionVega,
    sellerDelta: Math.round(sellerDelta * 100) / 100,
    sellerTheta: Math.round(sellerTheta * 100) / 100,
    sellerVega: Math.round(sellerVega * 100) / 100,
    sellerGamma: Math.round(sellerGamma * 10000) / 10000,
    dollarThetaToday: Math.round(dollarThetaToday * 100) / 100,
    dollarThetaToExpiry: Math.round(dollarThetaToExpiry * 100) / 100,
    dollarVegaImpact: Math.round(dollarVegaImpact * 100) / 100,
    dollarDeltaImpact: Math.round(dollarDeltaImpact * 100) / 100,
    moneyness: Math.round(moneyness * 10000) / 10000,
    moneynessLabel: _getMoneynessLabel(moneyness, strategy),
    distanceFromStrike: Math.round(distanceFromStrike * 100) / 100,
    distancePercent: Math.round(distancePercent * 100) / 100,
    ivSource,
    calculatedAt: new Date().toISOString(),
  }
}

export function aggregatePortfolioGreeks(
  positionGreeks: PositionGreeks[],
): PortfolioGreeks {
  if (positionGreeks.length === 0) return emptyPortfolioGreeks()

  const totalDelta = positionGreeks.reduce((s, p) => s + p.sellerDelta, 0)
  const totalGamma = positionGreeks.reduce((s, p) => s + p.sellerGamma, 0)
  const totalTheta = positionGreeks.reduce((s, p) => s + p.sellerTheta, 0)
  const totalVega = positionGreeks.reduce((s, p) => s + p.sellerVega, 0)
  const totalRho = positionGreeks.reduce((s, p) => s + p.rho, 0)

  const thetaByPosition = positionGreeks
    .map(p => ({
      positionId: p.positionId,
      ticker: p.ticker,
      strategy: p.strategy,
      strike: p.strike,
      dte: p.dte,
      dailyTheta: p.dollarThetaToday,
      percentOfTotal: totalTheta > 0 ? (p.dollarThetaToday / totalTheta) * 100 : 0,
      thetaPercentOfPremium: 0,
    }))
    .sort((a, b) => b.dailyTheta - a.dailyTheta)

  const tickerThetaMap = new Map<string, number>()
  positionGreeks.forEach(p => {
    tickerThetaMap.set(p.ticker, (tickerThetaMap.get(p.ticker) ?? 0) + p.dollarThetaToday)
  })
  const thetaByTicker = Array.from(tickerThetaMap.entries())
    .map(([ticker, dailyTheta]) => ({
      ticker,
      dailyTheta,
      percentOfTotal: totalTheta > 0 ? (dailyTheta / totalTheta) * 100 : 0,
    }))
    .sort((a, b) => b.dailyTheta - a.dailyTheta)

  const weeklyTheta = positionGreeks.reduce(
    (s, p) => s + p.dollarThetaToday * Math.min(p.dte, 5),
    0,
  )
  const monthlyTheta = positionGreeks.reduce(
    (sum, p) => sum + p.dollarThetaToday * Math.min(p.dte, 30),
    0,
  )

  const totalContracts = positionGreeks.reduce((s, p) => s + p.contracts * 100, 0)
  const weightedDTE = totalContracts > 0
    ? positionGreeks.reduce((s, p) => s + p.dte * (p.contracts * 100), 0) / totalContracts
    : 0

  const expiringThisWeek = positionGreeks.filter(p => p.dte <= 7)
  const premiumExpiringThisWeek = expiringThisWeek.reduce(
    (s, p) => s + p.dollarThetaToday * p.dte,
    0,
  )

  const highThetaPositions = positionGreeks.filter(p => p.dte < 21 && p.dte > 0)
  const thetaAccelerationNote = highThetaPositions.length > 0
    ? `${highThetaPositions.map(p => p.ticker).join(', ')} ${highThetaPositions.length === 1 ? 'is' : 'are'} under 21 DTE — theta decay is accelerating`
    : null

  function estimatePortfolioPnL(avgMovePercent: number): number {
    return positionGreeks.reduce((sum, p) => {
      const priceMove = p.currentPrice * avgMovePercent
      const deltaImpact = p.sellerDelta * priceMove
      const gammaImpact = 0.5 * p.sellerGamma * priceMove * priceMove
      return sum + deltaImpact + gammaImpact
    }, 0)
  }

  function estimateVegaPnL(ivChangePct: number): number {
    return positionGreeks.reduce((sum, p) => sum + p.sellerVega * ivChangePct, 0)
  }

  const scenarios = {
    stocksUp5Percent: Math.round(estimatePortfolioPnL(0.05) * 100) / 100,
    stocksDown5Percent: Math.round(estimatePortfolioPnL(-0.05) * 100) / 100,
    stocksUp10Percent: Math.round(estimatePortfolioPnL(0.10) * 100) / 100,
    stocksDown10Percent: Math.round(estimatePortfolioPnL(-0.10) * 100) / 100,
    ivUp10Percent: Math.round(estimateVegaPnL(10) * 100) / 100,
    ivDown10Percent: Math.round(estimateVegaPnL(-10) * 100) / 100,
    oneWeekFromNow: Math.round(totalTheta * 5 * 100) / 100,
    atExpiry: Math.round(
      positionGreeks.reduce((s, p) => s + p.dollarThetaToExpiry, 0) * 100,
    ) / 100,
  }

  const gammaRatio = Math.abs(totalGamma) / Math.max(positionGreeks.length, 1)
  const gammaRisk: PortfolioGreeks['gammaRisk'] =
    gammaRatio < 0.5 ? 'low'
    : gammaRatio < 2 ? 'moderate'
    : gammaRatio < 5 ? 'high'
    : 'extreme'

  const vegaRatio = Math.abs(totalVega) / Math.max(Math.abs(totalTheta), 1)
  const vegaRisk: PortfolioGreeks['vegaRisk'] =
    vegaRatio < 5 ? 'low'
    : vegaRatio < 15 ? 'moderate'
    : 'high'

  const deltaExposure: PortfolioGreeks['deltaExposure'] =
    totalDelta > 50 ? 'bullish'
    : totalDelta > 15 ? 'slightly_bullish'
    : totalDelta > -15 ? 'neutral'
    : totalDelta > -50 ? 'slightly_bearish'
    : 'bearish'

  return {
    totalDelta: Math.round(totalDelta * 100) / 100,
    totalGamma: Math.round(totalGamma * 10000) / 10000,
    totalTheta: Math.round(totalTheta * 100) / 100,
    totalVega: Math.round(totalVega * 100) / 100,
    totalRho: Math.round(totalRho * 100) / 100,
    dailyThetaIncome: Math.round(totalTheta * 100) / 100,
    weeklyThetaIncome: Math.round(weeklyTheta * 100) / 100,
    monthlyThetaIncome: Math.round(monthlyTheta * 100) / 100,
    thetaToMaxProfitPercent: 0,
    dollarDeltaPerPoint: Math.round(totalDelta * 100) / 100,
    dollarVegaPerPoint: Math.round(totalVega * 100) / 100,
    gammaRisk,
    vegaRisk,
    deltaExposure,
    thetaByPosition,
    thetaByTicker,
    weightedAverageDTE: Math.round(weightedDTE * 10) / 10,
    positionsExpiringThisWeek: expiringThisWeek.length,
    premiumExpiringThisWeek: Math.round(premiumExpiringThisWeek * 100) / 100,
    thetaAccelerationNote,
    scenarios,
    positions: positionGreeks,
    positionsWithLiveIV: positionGreeks.filter(p => p.ivSource !== 'estimated').length,
    positionsWithEstimatedIV: positionGreeks.filter(p => p.ivSource === 'estimated').length,
    calculatedAt: new Date().toISOString(),
  }
}

export function emptyPortfolioGreeks(): PortfolioGreeks {
  return {
    totalDelta: 0, totalGamma: 0, totalTheta: 0, totalVega: 0, totalRho: 0,
    dailyThetaIncome: 0, weeklyThetaIncome: 0, monthlyThetaIncome: 0,
    thetaToMaxProfitPercent: 0, dollarDeltaPerPoint: 0, dollarVegaPerPoint: 0,
    gammaRisk: 'low', vegaRisk: 'low', deltaExposure: 'neutral',
    thetaByPosition: [], thetaByTicker: [],
    weightedAverageDTE: 0, positionsExpiringThisWeek: 0, premiumExpiringThisWeek: 0,
    thetaAccelerationNote: null,
    scenarios: {
      stocksUp5Percent: 0, stocksDown5Percent: 0,
      stocksUp10Percent: 0, stocksDown10Percent: 0,
      ivUp10Percent: 0, ivDown10Percent: 0,
      oneWeekFromNow: 0, atExpiry: 0,
    },
    positions: [],
    positionsWithLiveIV: 0, positionsWithEstimatedIV: 0,
    calculatedAt: new Date().toISOString(),
  }
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
