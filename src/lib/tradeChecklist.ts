// src/lib/tradeChecklist.ts

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'pending' | 'skip';

export interface CheckResult {
  id: string;
  label: string;
  description: string;
  status: CheckStatus;
  value: string | null;
  threshold: string;
  reasoning: string;
  isCritical: boolean;
  canOverride: boolean;
}

export interface ChecklistResult {
  checks: CheckResult[];
  overallStatus: 'clear' | 'warnings' | 'blocked';
  passCount: number;
  warnCount: number;
  failCount: number;
  recommendation: string;
  canProceed: boolean;
}

export interface TradeChecklistInput {
  ticker: string;
  strategy: 'CSP' | 'CC';
  strike: number;
  expiry: string;              // ISO date YYYY-MM-DD
  contracts: number;
  premium: number;             // per share (= per-contract value / 100)
  accountBalance: number;
  buyingPower: number;
  maxRiskPercent: number;
  currentPrice: number;
  ivRank: number | null;
  ivPercentile: number | null;
  daysToEarnings: number | null;
  support52wkLow: number;
  openPositions: Array<{ ticker: string; strategy: string; strike: number; contracts: number }>;
  sectorExposure: Map<string, string>;
  sharesHeld?: number;          // shares of ticker held in portfolio (for CC coverage checks)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function dteFromExpiry(expiry: string): number {
  return Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ── Check 1: IV Rank ──────────────────────────────────────────────────────────

export function checkIVRank(input: TradeChecklistInput): CheckResult {
  const { ivRank, strategy } = input;
  const threshold = strategy === 'CSP' ? 50 : 40;
  const warnThreshold = strategy === 'CSP' ? 35 : 25;

  if (ivRank === null) {
    return {
      id: 'iv-rank',
      label: 'IV Rank',
      description: 'Implied volatility rank vs past year',
      status: 'pending',
      value: 'No data',
      threshold: `Requires IV Rank ≥ ${threshold}`,
      reasoning: 'IV rank data unavailable — check manually before entering.',
      isCritical: false,
      canOverride: true,
    };
  }

  let status: CheckStatus;
  let reasoning: string;

  if (ivRank >= threshold) {
    status = 'pass';
    reasoning = 'IV rank is elevated — good premium selling conditions.';
  } else if (ivRank >= warnThreshold) {
    status = 'warn';
    reasoning = 'IV rank is moderate — premium is acceptable but not ideal.';
  } else {
    status = 'fail';
    reasoning = 'IV rank is low — premium is cheap, not ideal for selling.';
  }

  return {
    id: 'iv-rank',
    label: 'IV Rank',
    description: 'Implied volatility rank vs past year',
    status,
    value: `IV Rank: ${ivRank.toFixed(0)}`,
    threshold: `Requires IV Rank ≥ ${threshold}`,
    reasoning,
    isCritical: false,
    canOverride: true,
  };
}

// ── Check 2: Earnings Safety ──────────────────────────────────────────────────

export function checkEarningsSafety(input: TradeChecklistInput): CheckResult {
  const { daysToEarnings, expiry } = input;
  const dte = dteFromExpiry(expiry);

  if (daysToEarnings === null) {
    return {
      id: 'earnings-safety',
      label: 'Earnings Safety',
      description: 'Earnings date vs expiry window',
      status: 'skip',
      value: 'No earnings data',
      threshold: 'Earnings must be outside expiry date',
      reasoning: 'No earnings date found — verify manually before entering.',
      isCritical: false,
      canOverride: true,
    };
  }

  let status: CheckStatus;
  let reasoning: string;
  let isCritical = false;

  if (daysToEarnings <= 7) {
    status = 'fail';
    isCritical = true;
    reasoning = `Earnings this week (${daysToEarnings}d away) — do not sell premium into earnings.`;
  } else if (daysToEarnings <= 14) {
    status = 'fail';
    reasoning = `Earnings in ${daysToEarnings} days — high IV crush risk after announcement.`;
  } else if (daysToEarnings <= dte + 7) {
    status = 'warn';
    reasoning = `Earnings ${daysToEarnings} days away — within trading window but watch IV crush risk.`;
  } else {
    status = 'pass';
    reasoning = `Earnings ${daysToEarnings} days away — safely outside expiry.`;
  }

  return {
    id: 'earnings-safety',
    label: 'Earnings Safety',
    description: 'Earnings date vs expiry window',
    status,
    value: `Earnings in ${daysToEarnings} days`,
    threshold: 'Earnings must be outside expiry date',
    reasoning,
    isCritical,
    canOverride: daysToEarnings > 7,
  };
}

// ── Check 3: Buying Power ─────────────────────────────────────────────────────

export function checkBuyingPower(input: TradeChecklistInput): CheckResult {
  const { strategy, strike, contracts, currentPrice, buyingPower, ticker, openPositions, sharesHeld } = input;

  // For CCs, check if existing shares (minus those already committed to open CCs) cover this position.
  if (strategy === 'CC') {
    const committedContracts = openPositions
      .filter((p) => p.strategy === 'CC' && p.ticker === ticker)
      .reduce((acc, p) => acc + p.contracts, 0);
    const availableShares = (sharesHeld ?? 0) - committedContracts * 100;
    const sharesNeeded = contracts * 100;

    if (availableShares >= sharesNeeded) {
      return {
        id: 'buying-power',
        label: 'Buying Power',
        description: 'Capital required vs available buying power',
        status: 'pass',
        value: `${availableShares.toLocaleString()} shares available`,
        threshold: 'Must have shares to cover or sufficient buying power',
        reasoning: 'Covered by existing share holdings — no cash buying power required.',
        isCritical: false,
        canOverride: false,
      };
    }
  }

  const requiredCapital =
    strategy === 'CSP'
      ? strike * contracts * 100
      : currentPrice * contracts * 100;

  const buyingPowerAfter = buyingPower - requiredCapital;
  const buyingPowerUsedPct = buyingPower > 0 ? (requiredCapital / buyingPower) * 100 : 100;

  let status: CheckStatus;
  let reasoning: string;
  let isCritical = false;

  if (buyingPowerAfter <= 0) {
    status = 'fail';
    isCritical = true;
    reasoning = 'Insufficient buying power for this position.';
  } else if (buyingPowerUsedPct > 70) {
    status = 'warn';
    reasoning = `Over 70% of buying power deployed (${buyingPowerUsedPct.toFixed(0)}%).`;
  } else if (buyingPowerUsedPct > 40) {
    status = 'warn';
    reasoning = `This uses ${buyingPowerUsedPct.toFixed(0)}% of buying power.`;
  } else {
    status = 'pass';
    reasoning = `${buyingPowerUsedPct.toFixed(0)}% of buying power used — collateral within safe limits.`;
  }

  const remaining = Math.max(0, buyingPowerAfter);

  return {
    id: 'buying-power',
    label: 'Buying Power',
    description: 'Capital required vs available buying power',
    status,
    value: `Requires $${requiredCapital.toLocaleString()} — $${remaining.toLocaleString()} remaining`,
    threshold: 'Must have shares to cover or sufficient buying power',
    reasoning,
    isCritical,
    canOverride: buyingPowerAfter > 0,
  };
}

// ── Check 4: Position Size vs Risk Tolerance ──────────────────────────────────

export function checkPositionSize(input: TradeChecklistInput): CheckResult {
  const { strategy, accountBalance, maxRiskPercent, strike, contracts, ticker, openPositions, sharesHeld } = input;

  // For CCs, if shares cover the position the risk is already in the portfolio (shares you hold).
  // Additional capital is not being deployed, so the position-size % check doesn't apply.
  if (strategy === 'CC') {
    const committedContracts = openPositions
      .filter((p) => p.strategy === 'CC' && p.ticker === ticker)
      .reduce((acc, p) => acc + p.contracts, 0);
    const availableShares = (sharesHeld ?? 0) - committedContracts * 100;
    const sharesNeeded = contracts * 100;

    if (availableShares >= sharesNeeded) {
      return {
        id: 'position-size',
        label: 'Position Size',
        description: 'Position risk as % of total account',
        status: 'skip',
        value: null,
        threshold: `Max ${maxRiskPercent}% of account per position`,
        reasoning: 'Covered call — shares are already held; no additional capital at risk.',
        isCritical: false,
        canOverride: false,
      };
    }
  }

  const positionRisk = strike * contracts * 100;
  const actualRiskPct = accountBalance > 0 ? (positionRisk / accountBalance) * 100 : 0;
  const maxRiskDollar = accountBalance * (maxRiskPercent / 100);

  let status: CheckStatus;
  let reasoning: string;

  if (actualRiskPct <= maxRiskPercent) {
    status = 'pass';
    reasoning = `Position is ${actualRiskPct.toFixed(1)}% of account — within your ${maxRiskPercent}% limit.`;
  } else if (actualRiskPct <= maxRiskPercent * 1.5) {
    status = 'warn';
    reasoning = `Position is ${actualRiskPct.toFixed(1)}% of account (limit: ${maxRiskPercent}%).`;
  } else {
    const maxContracts = maxRiskDollar > 0 ? Math.floor(maxRiskDollar / (strike * 100)) : 0;
    status = 'fail';
    reasoning = `Position exceeds risk tolerance at ${actualRiskPct.toFixed(1)}% of account. Consider reducing to ${maxContracts} contract(s).`;
  }

  return {
    id: 'position-size',
    label: 'Position Size',
    description: 'Position risk as % of total account',
    status,
    value: `Position risk: ${actualRiskPct.toFixed(1)}% of account`,
    threshold: `Max ${maxRiskPercent}% of account per position`,
    reasoning,
    isCritical: false,
    canOverride: true,
  };
}

// ── Check 5: Strike vs 52-Week Low Support ────────────────────────────────────

export function checkStrikeSupport(input: TradeChecklistInput): CheckResult {
  const { strategy, strike, support52wkLow } = input;

  if (strategy !== 'CSP') {
    return {
      id: 'strike-support',
      label: 'Strike Support',
      description: 'Strike vs 52-week low support level',
      status: 'skip',
      value: null,
      threshold: 'CSP strike should be above 52-week low',
      reasoning: 'Support check not applicable for covered calls.',
      isCritical: false,
      canOverride: false,
    };
  }

  if (!support52wkLow) {
    return {
      id: 'strike-support',
      label: 'Strike Support',
      description: 'Strike vs 52-week low support level',
      status: 'pending',
      value: null,
      threshold: 'CSP strike should be above 52-week low',
      reasoning: '52-week low unavailable — check manually.',
      isCritical: false,
      canOverride: true,
    };
  }

  const strikeVsSupport = ((strike - support52wkLow) / support52wkLow) * 100;
  let status: CheckStatus;
  let reasoning: string;

  if (strike <= support52wkLow) {
    status = 'fail';
    reasoning = `Strike $${strike} is below the 52-week low ($${support52wkLow.toFixed(2)}) — assignment likely in a continuation move.`;
  } else if (strike <= support52wkLow * 1.05) {
    status = 'warn';
    reasoning = `Strike is only ${strikeVsSupport.toFixed(1)}% above 52-week low — near key support, watch closely.`;
  } else {
    status = 'pass';
    reasoning = `Strike is ${strikeVsSupport.toFixed(1)}% above 52-week low — solid support buffer.`;
  }

  return {
    id: 'strike-support',
    label: 'Strike Support',
    description: 'Strike vs 52-week low support level',
    status,
    value: `Strike $${strike} vs 52wk Low $${support52wkLow.toFixed(2)}`,
    threshold: 'CSP strike should be above 52-week low',
    reasoning,
    isCritical: false,
    canOverride: true,
  };
}

// ── Check 6: Ticker Concentration ────────────────────────────────────────────

export function checkConcentration(input: TradeChecklistInput): CheckResult {
  const { ticker, openPositions } = input;
  const sameTickerCount = openPositions.filter((p) => p.ticker === ticker).length;

  let status: CheckStatus;
  let reasoning: string;

  if (sameTickerCount === 0) {
    status = 'pass';
    reasoning = `No existing positions on ${ticker}.`;
  } else if (sameTickerCount === 1) {
    status = 'warn';
    reasoning = `You already have 1 open position on ${ticker}.`;
  } else {
    status = 'fail';
    reasoning = `You have ${sameTickerCount} open positions on ${ticker} — high concentration risk.`;
  }

  return {
    id: 'concentration',
    label: 'Concentration',
    description: 'Existing open positions on same ticker',
    status,
    value: `${sameTickerCount} existing position(s) on ${ticker}`,
    threshold: 'Maximum 1 existing position per ticker recommended',
    reasoning,
    isCritical: false,
    canOverride: true,
  };
}

// ── Check 7: DTE Appropriateness ──────────────────────────────────────────────

export function checkDTE(input: TradeChecklistInput): CheckResult {
  const dte = dteFromExpiry(input.expiry);
  let status: CheckStatus;
  let reasoning: string;
  let isCritical = false;

  if (dte <= 0) {
    status = 'fail';
    isCritical = true;
    reasoning = 'Expiry date is in the past — this position cannot be entered.';
  } else if (dte < 14) {
    status = 'fail';
    reasoning = `DTE is ${dte} days — gamma risk is elevated this close to expiry.`;
  } else if (dte >= 21 && dte <= 45) {
    status = 'pass';
    reasoning = `DTE is ${dte} days — optimal theta decay zone (21–45 days).`;
  } else if (dte >= 14 && dte < 21) {
    status = 'warn';
    reasoning = `Short DTE (${dte}d) — theta is high but gamma risk increases.`;
  } else if (dte > 45 && dte <= 60) {
    status = 'warn';
    reasoning = `Longer DTE (${dte}d) — more time value but slower theta decay.`;
  } else {
    status = 'warn';
    reasoning = `Very long DTE (${dte}d) — consider a closer expiry for faster theta capture.`;
  }

  return {
    id: 'dte',
    label: 'DTE',
    description: 'Days to expiry vs optimal theta range',
    status,
    value: `${dte} days to expiry`,
    threshold: 'Optimal DTE: 21–45 days',
    reasoning,
    isCritical,
    canOverride: dte > 0,
  };
}

// ── Check 8: Premium Quality ──────────────────────────────────────────────────

export function checkPremiumQuality(input: TradeChecklistInput): CheckResult {
  const { premium, strike, currentPrice, strategy, expiry } = input;
  const dte = dteFromExpiry(expiry);

  const base = strategy === 'CSP' ? strike : currentPrice;
  const premiumPct = base > 0 ? (premium / base) * 100 : 0;
  const annualisedReturn = dte > 0 ? (premiumPct / dte) * 365 : 0;

  let status: CheckStatus;
  let reasoning: string;

  if (annualisedReturn >= 20) {
    status = 'pass';
    reasoning = `Strong premium — ~${annualisedReturn.toFixed(0)}% annualised return.`;
  } else if (annualisedReturn >= 12) {
    status = 'pass';
    reasoning = `Acceptable premium — ~${annualisedReturn.toFixed(0)}% annualised return.`;
  } else if (annualisedReturn >= 8) {
    status = 'warn';
    reasoning = `Thin premium — ~${annualisedReturn.toFixed(0)}% annualised. Consider a higher-IV stock.`;
  } else {
    status = 'fail';
    reasoning = `Very thin premium — ~${annualisedReturn.toFixed(0)}% annualised. Not worth the capital tie-up.`;
  }

  return {
    id: 'premium-quality',
    label: 'Premium Quality',
    description: 'Annualised return on premium vs capital at risk',
    status,
    value: `$${premium}/share (~${annualisedReturn.toFixed(0)}% ann.)`,
    threshold: 'Minimum ~12% annualised return',
    reasoning,
    isCritical: false,
    canOverride: true,
  };
}

// ── Master runner ─────────────────────────────────────────────────────────────

export function runTradeChecklist(input: TradeChecklistInput): ChecklistResult {
  const checks: CheckResult[] = [
    checkIVRank(input),
    checkEarningsSafety(input),
    checkBuyingPower(input),
    checkPositionSize(input),
    checkStrikeSupport(input),
    checkConcentration(input),
    checkDTE(input),
    checkPremiumQuality(input),
  ];

  const passCount = checks.filter((c) => c.status === 'pass').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  const failCount = checks.filter((c) => c.status === 'fail').length;
  const criticalFails = checks.filter((c) => c.status === 'fail' && c.isCritical);

  let overallStatus: 'clear' | 'warnings' | 'blocked';
  let recommendation: string;

  if (criticalFails.length > 0) {
    overallStatus = 'blocked';
    recommendation = 'Trade blocked — resolve critical issue(s) before proceeding.';
  } else if (failCount > 0 || warnCount >= 3) {
    overallStatus = 'warnings';
    recommendation = `Proceed with caution — review ${failCount + warnCount} issue(s).`;
  } else {
    overallStatus = 'clear';
    recommendation = 'All checks passed — trade looks good.';
  }

  return {
    checks,
    overallStatus,
    passCount,
    warnCount,
    failCount,
    recommendation,
    canProceed: criticalFails.length === 0,
  };
}
