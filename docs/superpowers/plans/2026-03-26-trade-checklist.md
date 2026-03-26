# Trade Checklist Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real-time 8-check trade checklist panel to the Add Position modal in Wheel Tracker, evaluating IV, earnings, buying power, position size, support, concentration, DTE, and premium quality as the user fills in the form.

**Architecture:** Pure engine in `tradeChecklist.ts` → reactive `useTradeChecklist` hook → `TradeChecklist` visual component rendered inside a widened `AddPositionModal`. The modal widens from `max-w-md` to `max-w-2xl` on desktop with form on the left and checklist on the right; stacked on mobile. Two Supabase schema changes: add columns to `user_preferences` and `wheel_positions`. No other pages or hooks are touched.

**Tech Stack:** React 18, TypeScript, Supabase JS v2, Tailwind (utility classes only, inline styles for custom colours matching existing palette), Finnhub REST API.

---

## Chunk 1: Schema + Finnhub helper

### Task 1: Supabase schema migrations

**Files:**
- Create: `supabase/migrations/20260326_trade_checklist.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Add risk preference columns to user_preferences
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS max_risk_percent DECIMAL(5,2) DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS account_balance  DECIMAL(14,2) DEFAULT 0;

-- Store checklist snapshot on each wheel position
ALTER TABLE wheel_positions
  ADD COLUMN IF NOT EXISTS checklist_snapshot JSONB;

-- Anonymous checklist analytics (no user_id)
CREATE TABLE IF NOT EXISTS checklist_analytics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker        text NOT NULL,
  strategy      text NOT NULL,
  checks_passed int  NOT NULL DEFAULT 0,
  checks_warned int  NOT NULL DEFAULT 0,
  checks_failed int  NOT NULL DEFAULT 0,
  checks_overridden int NOT NULL DEFAULT 0,
  submitted_anyway  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with the SQL above. Confirm cost first with `mcp__plugin_supabase_supabase__confirm_cost`.

- [ ] **Step 3: Verify columns exist**

Run in Supabase SQL editor:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('user_preferences', 'wheel_positions')
  AND column_name IN ('max_risk_percent','account_balance','checklist_snapshot');
```
Expected: 3 rows returned.

---

### Task 2: Add `getStockBasicFinancials` to finnhub.ts

**Files:**
- Modify: `src/lib/finnhub.ts`

The 52-week low is not in the `/quote` endpoint. Finnhub's `/stock/metric?symbol=X&metric=all` returns `{ metric: { "52WeekLow": number, "52WeekHigh": number, ... } }`.

- [ ] **Step 1: Add interface + function to `finnhub.ts`**

Append after the existing `getNextEarnings` function:

```typescript
export interface FhBasicFinancials {
  metric: {
    '52WeekLow': number | null;
    '52WeekHigh': number | null;
  };
}

export async function getStockBasicFinancials(ticker: string): Promise<FhBasicFinancials> {
  return get<FhBasicFinancials>(`/stock/metric?symbol=${ticker}&metric=all`);
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build 2>&1 | tail -20
```
Expected: No new errors.

---

## Chunk 2: Pure checklist engine

### Task 3: Create `src/lib/tradeChecklist.ts`

**Files:**
- Create: `src/lib/tradeChecklist.ts`

This file is pure TypeScript — no React, no Supabase, no imports outside the standard library. All functions take `TradeChecklistInput` and return `CheckResult`.

- [ ] **Step 1: Write the full engine file**

```typescript
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
  const { strategy, strike, contracts, currentPrice, buyingPower } = input;
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
    reasoning = `${buyingPowerUsedPct.toFixed(0)}% of buying power used — ${strategy === 'CSP' ? 'collateral' : 'share cost'} within safe limits.`;
  }

  const remaining = Math.max(0, buyingPowerAfter);

  return {
    id: 'buying-power',
    label: 'Buying Power',
    description: 'Capital required vs available buying power',
    status,
    value: `Requires $${requiredCapital.toLocaleString()} — $${remaining.toLocaleString()} remaining`,
    threshold: 'Must have sufficient buying power',
    reasoning,
    isCritical,
    canOverride: buyingPowerAfter > 0,
  };
}

// ── Check 4: Position Size vs Risk Tolerance ──────────────────────────────────

export function checkPositionSize(input: TradeChecklistInput): CheckResult {
  const { accountBalance, maxRiskPercent, strike, contracts } = input;
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
```

- [ ] **Step 2: Build check**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build 2>&1 | tail -20
```
Expected: Clean build, 0 new errors.

---

## Chunk 3: Reactive hook

### Task 4: Create `src/hooks/useTradeChecklist.ts`

**Files:**
- Create: `src/hooks/useTradeChecklist.ts`

This hook:
1. Accepts form values as `Partial<TradeChecklistInput>`
2. Runs the checklist synchronously via `useMemo`
3. Manages override state
4. Fetches supplemental data (IV, earnings, 52wk low) from Supabase/Finnhub when ticker changes

Key data sources available in context:
- `buyingPower` = `freeCash` (cashBalance − lockedCollateral), passed as a prop
- `accountBalance` = from `user_preferences.account_balance` (new column)
- `maxRiskPercent` = from `user_preferences.max_risk_percent` (new column, default 5)
- `ivRank` / `ivPercentile` = fetched from `iv_snapshots` table (most recent row for ticker)
- `daysToEarnings` = computed from `getNextEarnings(ticker)` result
- `support52wkLow` = from `getStockBasicFinancials(ticker).metric['52WeekLow']`
- `openPositions` = passed in from `usePositions` (already in WheelTracker)

The hook does NOT call React Query — it uses `useEffect` with local state to avoid re-mounting the whole query cache.

- [ ] **Step 1: Write the hook**

```typescript
// src/hooks/useTradeChecklist.ts
import { useState, useMemo, useEffect, useCallback } from 'react';
import type { TradeChecklistInput, ChecklistResult, CheckStatus } from '../lib/tradeChecklist';
import { runTradeChecklist } from '../lib/tradeChecklist';
import { supabase } from '../lib/supabase';
import { getNextEarnings, getStockBasicFinancials } from '../lib/finnhub';
import { useAuth } from '../context/AuthContext';

interface SupplementalData {
  ivRank: number | null;
  ivPercentile: number | null;
  daysToEarnings: number | null;
  support52wkLow: number;
  accountBalance: number;
  maxRiskPercent: number;
}

export type PartialChecklistInput = Omit<
  TradeChecklistInput,
  'ivRank' | 'ivPercentile' | 'daysToEarnings' | 'support52wkLow' | 'accountBalance' | 'maxRiskPercent'
> & { ticker: string };

export function useTradeChecklist(
  formValues: Partial<PartialChecklistInput>,
  openPositions: TradeChecklistInput['openPositions'],
) {
  const { user } = useAuth();
  const [overriddenChecks, setOverriddenChecks] = useState<Set<string>>(new Set());
  const [supplemental, setSupplemental] = useState<SupplementalData>({
    ivRank: null,
    ivPercentile: null,
    daysToEarnings: null,
    support52wkLow: 0,
    accountBalance: 0,
    maxRiskPercent: 5,
  });
  const [fetchingTicker, setFetchingTicker] = useState<string | null>(null);

  // Fetch user preferences once on mount
  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_preferences')
      .select('max_risk_percent, account_balance')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSupplemental((s) => ({
            ...s,
            maxRiskPercent: Number(data.max_risk_percent) || 5,
            accountBalance: Number(data.account_balance) || 0,
          }));
        }
      });
  }, [user?.id]);

  // Fetch ticker-specific data when ticker changes
  useEffect(() => {
    const ticker = formValues.ticker?.toUpperCase();
    if (!ticker || fetchingTicker === ticker) return;
    setFetchingTicker(ticker);

    const fetchAll = async () => {
      // IV rank from iv_snapshots
      const { data: ivRow } = await supabase
        .from('iv_snapshots')
        .select('iv_rank, iv_percentile')
        .eq('ticker', ticker)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Earnings
      let daysToEarnings: number | null = null;
      try {
        const earningsDate = await getNextEarnings(ticker);
        if (earningsDate) {
          daysToEarnings = Math.ceil(
            (new Date(earningsDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          );
        }
      } catch { /* ignore */ }

      // 52-week low
      let support52wkLow = 0;
      try {
        const metrics = await getStockBasicFinancials(ticker);
        support52wkLow = metrics.metric['52WeekLow'] ?? 0;
      } catch { /* ignore */ }

      setSupplemental((s) => ({
        ...s,
        ivRank: ivRow ? Number(ivRow.iv_rank) : null,
        ivPercentile: ivRow ? Number(ivRow.iv_percentile) : null,
        daysToEarnings,
        support52wkLow,
      }));
    };

    void fetchAll();
  }, [formValues.ticker]);

  // Build full input and run checklist
  const result = useMemo((): ChecklistResult | null => {
    if (!formValues.ticker || !formValues.strike || !formValues.expiry || !formValues.strategy) {
      return null;
    }

    const input: TradeChecklistInput = {
      ticker: formValues.ticker,
      strategy: formValues.strategy,
      strike: formValues.strike,
      expiry: formValues.expiry,
      contracts: formValues.contracts ?? 1,
      premium: formValues.premium ?? 0,
      currentPrice: formValues.currentPrice ?? 0,
      buyingPower: formValues.buyingPower ?? 0,
      sectorExposure: formValues.sectorExposure ?? new Map(),
      openPositions,
      ...supplemental,
    };

    const checklistResult = runTradeChecklist(input);

    // Apply overrides: overridden non-critical fails/warns stay visible but don't block
    const checksWithOverrides = checklistResult.checks.map((check) => {
      if (overriddenChecks.has(check.id) && check.canOverride && check.status === 'fail') {
        return { ...check, status: 'warn' as CheckStatus };
      }
      return check;
    });

    const remainingCritical = checksWithOverrides.filter(
      (c) => c.status === 'fail' && c.isCritical,
    );

    const newPassCount = checksWithOverrides.filter((c) => c.status === 'pass').length;
    const newWarnCount = checksWithOverrides.filter((c) => c.status === 'warn').length;
    const newFailCount = checksWithOverrides.filter((c) => c.status === 'fail').length;
    const newOverallStatus: 'clear' | 'warnings' | 'blocked' =
      remainingCritical.length > 0
        ? 'blocked'
        : newFailCount > 0 || newWarnCount >= 3
        ? 'warnings'
        : 'clear';

    return {
      checks: checksWithOverrides,
      overallStatus: newOverallStatus,
      passCount: newPassCount,
      warnCount: newWarnCount,
      failCount: newFailCount,
      recommendation: checklistResult.recommendation,
      canProceed: remainingCritical.length === 0,
    };
  }, [formValues, overriddenChecks, supplemental, openPositions]);

  const toggleOverride = useCallback((checkId: string) => {
    setOverriddenChecks((prev) => {
      const next = new Set(prev);
      next.has(checkId) ? next.delete(checkId) : next.add(checkId);
      return next;
    });
  }, []);

  const resetOverrides = useCallback(() => setOverriddenChecks(new Set()), []);

  return {
    result,
    isRunning: fetchingTicker !== formValues.ticker?.toUpperCase() && !!formValues.ticker,
    overriddenChecks,
    toggleOverride,
    resetOverrides,
    supplemental,
  };
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build 2>&1 | tail -20
```
Expected: Clean build.

---

## Chunk 4: Visual component

### Task 5: Create `src/components/TradeChecklist.tsx`

**Files:**
- Create: `src/components/TradeChecklist.tsx`

Design spec:
- Dark background `rgba(5,13,26,0.6)`, border `rgba(0,229,196,0.08)`
- Status icons inline SVG (no icon library)
- Each row: icon + label + value pill + reasoning (on hover tooltip via `title`)
- Override button: small text "Override" / "Undo" shown when `canOverride && (status === 'fail' || status === 'warn')`
- Progress bar: X/8 checks with colour thresholding
- Status banner at bottom: green / amber / red with icon
- Skeleton loading: 8 rows with shimmer when `isLoading`
- CSS transitions only (no animation libraries)

Colour palette (matches existing app):
- pass: `#00d68f`
- fail: `#ff4d6d`
- warn: `#f5c842`
- pending/skip: `#4a6a8a`
- overridden: `#f5c842` (same as warn, with strikethrough on old value)

- [ ] **Step 1: Write the component file**

```typescript
// src/components/TradeChecklist.tsx
import type { ChecklistResult, CheckResult, CheckStatus } from '../lib/tradeChecklist';

interface TradeChecklistProps {
  result: ChecklistResult | null;
  overriddenChecks: Set<string>;
  onToggleOverride: (checkId: string) => void;
  isLoading: boolean;
  strategy: 'CSP' | 'CC';
}

const STATUS_COLOR: Record<CheckStatus, string> = {
  pass:    '#00d68f',
  fail:    '#ff4d6d',
  warn:    '#f5c842',
  pending: '#4a6a8a',
  skip:    '#2a4060',
};

function StatusIcon({ status }: { status: CheckStatus }) {
  const color = STATUS_COLOR[status];
  if (status === 'pass') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="8" cy="8" r="7" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.2" />
        <path d="M5 8l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'fail') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="8" cy="8" r="7" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.2" />
        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === 'warn') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <path d="M8 2L14.5 13H1.5L8 2z" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M8 6v3.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11" r="0.75" fill={color} />
      </svg>
    );
  }
  if (status === 'pending') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="8" cy="8" r="7" stroke={color} strokeWidth="1.2" strokeDasharray="3 2" />
        <text x="8" y="11.5" textAnchor="middle" fontSize="9" fill={color} fontFamily="monospace">?</text>
      </svg>
    );
  }
  // skip
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M4 8h8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-2 py-2" style={{ borderBottom: '1px solid rgba(0,229,196,0.04)' }}>
      <div className="rounded-full" style={{ width: 16, height: 16, background: 'rgba(74,106,138,0.2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div className="rounded" style={{ width: 80, height: 10, background: 'rgba(74,106,138,0.15)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div className="rounded ml-auto" style={{ width: 60, height: 10, background: 'rgba(74,106,138,0.1)', animation: 'pulse 1.5s ease-in-out infinite' }} />
    </div>
  );
}

function CheckRow({ check, isOverridden, onToggleOverride }: {
  check: CheckResult;
  isOverridden: boolean;
  onToggleOverride: () => void;
}) {
  const color = STATUS_COLOR[check.status];
  const canInteract = check.canOverride && (check.status === 'fail' || check.status === 'warn' || isOverridden);

  return (
    <div
      className="flex items-start gap-2 py-2"
      style={{
        borderBottom: '1px solid rgba(0,229,196,0.04)',
        transition: 'background 0.2s ease',
      }}
      title={check.reasoning}
    >
      <div style={{ paddingTop: 1 }}>
        <StatusIcon status={check.status} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: '#c8daf0', fontFamily: 'DM Sans, sans-serif' }}>
            {check.label}
          </span>
          {isOverridden && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={{ color: '#f5c842', background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.2)', fontFamily: 'DM Sans, sans-serif' }}>
              Overridden
            </span>
          )}
        </div>
        {check.value && (
          <p className="text-[11px] mt-0.5 truncate" style={{ color: color, fontFamily: 'JetBrains Mono, monospace', opacity: isOverridden ? 0.5 : 1 }}>
            {check.value}
          </p>
        )}
      </div>

      {canInteract && (
        <button
          type="button"
          onClick={onToggleOverride}
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded transition-opacity hover:opacity-80"
          style={{
            color: isOverridden ? '#4a6a8a' : '#f5c842',
            background: isOverridden ? 'rgba(74,106,138,0.08)' : 'rgba(245,200,66,0.08)',
            border: isOverridden ? '1px solid rgba(74,106,138,0.2)' : '1px solid rgba(245,200,66,0.15)',
            fontFamily: 'DM Sans, sans-serif',
            flexShrink: 0,
            cursor: 'pointer',
          }}
          title={isOverridden ? 'Remove override' : 'Acknowledge this risk and proceed anyway'}
        >
          {isOverridden ? 'Undo' : 'Override'}
        </button>
      )}
    </div>
  );
}

export function TradeChecklist({ result, overriddenChecks, onToggleOverride, isLoading }: TradeChecklistProps) {
  if (isLoading || !result) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'rgba(5,13,26,0.5)', border: '1px solid rgba(0,229,196,0.08)' }}>
        <p className="text-xs mb-3 font-semibold tracking-wide uppercase"
          style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}>
          Trade Checklist
        </p>
        {isLoading ? (
          <>
            <p className="text-xs mb-3" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Checking trade conditions…</p>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
          </>
        ) : (
          <p className="text-xs" style={{ color: '#2a4060', fontFamily: 'DM Sans, sans-serif' }}>
            Fill in Ticker, Strategy, Strike, and Expiry to run checks.
          </p>
        )}
      </div>
    );
  }

  const { checks, overallStatus, passCount, canProceed } = result;
  const total = checks.filter((c) => c.status !== 'skip').length;
  const scoreColor = passCount >= 7 ? '#00d68f' : passCount >= 5 ? '#f5c842' : '#ff4d6d';
  const criticalFails = checks.filter((c) => c.status === 'fail' && c.isCritical);

  const bannerBg = overallStatus === 'clear'
    ? 'rgba(0,214,143,0.08)'
    : overallStatus === 'warnings'
    ? 'rgba(245,200,66,0.08)'
    : 'rgba(255,77,109,0.08)';
  const bannerBorder = overallStatus === 'clear'
    ? 'rgba(0,214,143,0.2)'
    : overallStatus === 'warnings'
    ? 'rgba(245,200,66,0.2)'
    : 'rgba(255,77,109,0.2)';
  const bannerColor = overallStatus === 'clear' ? '#00d68f' : overallStatus === 'warnings' ? '#f5c842' : '#ff4d6d';

  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(5,13,26,0.5)', border: '1px solid rgba(0,229,196,0.08)' }}>
      {/* Header + progress */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold tracking-wide uppercase"
          style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}>
          Trade Checklist
        </p>
        <span className="text-xs font-semibold" style={{ color: scoreColor, fontFamily: 'JetBrains Mono, monospace' }}>
          {passCount}/{total}
        </span>
      </div>

      {/* Mini progress bar */}
      <div className="rounded-full mb-3" style={{ height: 3, background: 'rgba(0,229,196,0.06)' }}>
        <div
          className="rounded-full"
          style={{
            height: 3,
            width: `${(passCount / Math.max(total, 1)) * 100}%`,
            background: scoreColor,
            transition: 'width 0.3s ease, background 0.3s ease',
          }}
        />
      </div>

      {/* Check rows */}
      <div>
        {checks.map((check) => (
          <CheckRow
            key={check.id}
            check={check}
            isOverridden={overriddenChecks.has(check.id)}
            onToggleOverride={() => onToggleOverride(check.id)}
          />
        ))}
      </div>

      {/* Status banner */}
      <div
        className="rounded-lg px-3 py-2.5 mt-3"
        style={{
          background: bannerBg,
          border: `1px solid ${bannerBorder}`,
          transition: 'background 0.3s ease, border-color 0.3s ease',
        }}
      >
        <p className="text-xs font-semibold" style={{ color: bannerColor, fontFamily: 'DM Sans, sans-serif' }}>
          {overallStatus === 'clear' && '✓ All checks passed'}
          {overallStatus === 'warnings' && `⚠ Proceed with caution — ${result.warnCount + result.failCount} issue(s)`}
          {overallStatus === 'blocked' && '✗ Trade blocked'}
        </p>
        {!canProceed && criticalFails.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {criticalFails.map((c) => (
              <li key={c.id} className="text-[11px]" style={{ color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif' }}>
                • {c.reasoning}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build 2>&1 | tail -20
```
Expected: Clean build.

---

## Chunk 5: Modal integration + usePositions update

### Task 6: Widen ModalShell and integrate checklist into `AddPositionModal`

**Files:**
- Modify: `src/pages/WheelTracker.tsx` (AddPositionModal and ModalShell only)

Key changes:
1. Add a `wide` prop to `ModalShell` to allow `max-w-2xl`
2. In `AddPositionModal`:
   - Import `useTradeChecklist`, `TradeChecklist`
   - Pass `openPositions` as a prop (add to `AddPositionModalProps`)
   - Call `useTradeChecklist` with form state
   - Wire `freeCash` → `buyingPower`, `spotPrice` → `currentPrice`
   - Render `<TradeChecklist>` to the right on desktop / below on mobile
   - Update submit button to reflect `result.overallStatus`

- [ ] **Step 1: Add `wide` prop to ModalShell**

In `WheelTracker.tsx`, find the `ModalShell` function. Change:

```typescript
// OLD
function ModalShell({ title, subtitle, onClose, children }: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
```
to:
```typescript
// NEW
function ModalShell({ title, subtitle, onClose, children, wide = false }: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
```

And change the inner container from:
```typescript
<div className="w-full max-w-md rounded-2xl p-6"
```
to:
```typescript
<div className={`w-full ${wide ? 'max-w-4xl' : 'max-w-md'} rounded-2xl p-6`}
```

- [ ] **Step 2: Add `openPositions` prop to `AddPositionModalProps`**

Find the `AddPositionModalProps` interface (around line 715). Add:
```typescript
  openPositions: Array<{ ticker: string; strategy: string; strike: number; contracts: number }>;
```

Update the `RealWheelTracker` render of `<AddPositionModal>` to pass:
```tsx
<AddPositionModal
  cashBalance={cashBalance}
  lockedCollateral={lockedCollateral}
  openPositions={openPositions}   // ← add this
  onClose={() => setShowAddModal(false)}
  onAdd={(data) => { addPosition(data); setShowAddModal(false); }}
/>
```

- [ ] **Step 3: Wire `useTradeChecklist` inside `AddPositionModal`**

At the top of `AddPositionModal` function body, after existing state declarations, add:

```typescript
import { useTradeChecklist } from '../hooks/useTradeChecklist';
import { TradeChecklist } from '../components/TradeChecklist';
```

(Add imports at top of file.)

Inside the function body:

```typescript
// Derive values for checklist
const premiumPerShare = Number(form.premium) / 100; // form.premium is per-contract
const freeCash = cashBalance !== null ? Math.max(0, cashBalance - lockedCollateral) : 0;

const { result: checklistResult, isRunning, overriddenChecks, toggleOverride, resetOverrides, supplemental } =
  useTradeChecklist(
    {
      ticker: form.ticker,
      strategy: form.strategy,
      strike: Number(form.strike) || 0,
      expiry: form.expiry,
      contracts: contracts,
      premium: premiumPerShare,
      currentPrice: spotPrice ?? 0,
      buyingPower: freeCash,
      sectorExposure: new Map(),
    },
    openPositions,
  );
```

Reset overrides when ticker changes:

```typescript
useEffect(() => {
  resetOverrides();
}, [form.ticker, resetOverrides]);
```

- [ ] **Step 4: Change modal layout to side-by-side on desktop**

In the `AddPositionModal` return, change:
```tsx
<ModalShell title="Add Position" subtitle="Log a new wheel trade" onClose={onClose}>
  <form onSubmit={handleSubmit} className="space-y-4">
    {/* ... existing form fields ... */}
    <div className="flex gap-3 pt-2">
      {/* cancel + submit */}
    </div>
  </form>
</ModalShell>
```

to:
```tsx
<ModalShell title="Add Position" subtitle="Log a new wheel trade" onClose={onClose} wide>
  <div className="flex flex-col lg:flex-row gap-6">
    {/* Left: form */}
    <form onSubmit={handleSubmit} className="space-y-4 flex-1 min-w-0">
      {/* ... all existing form fields unchanged ... */}

      {/* Checklist on mobile: below form */}
      <div className="lg:hidden">
        <TradeChecklist
          result={checklistResult}
          overriddenChecks={overriddenChecks}
          onToggleOverride={toggleOverride}
          isLoading={isRunning}
          strategy={form.strategy}
        />
      </div>

      {/* Submit row */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} ...>Cancel</button>
        <SubmitButton result={checklistResult} />
      </div>
    </form>

    {/* Right: checklist on desktop */}
    <div className="hidden lg:block w-72 flex-shrink-0">
      <TradeChecklist
        result={checklistResult}
        overriddenChecks={overriddenChecks}
        onToggleOverride={toggleOverride}
        isLoading={isRunning}
        strategy={form.strategy}
      />
    </div>
  </div>
</ModalShell>
```

- [ ] **Step 5: Add `SubmitButton` helper inside `AddPositionModal`**

Add inline just before the `return` in `AddPositionModal`:

```typescript
function SubmitButton({ result }: { result: ChecklistResult | null }) {
  const status = result?.overallStatus;
  const canProceed = result?.canProceed ?? true;

  if (!result || status === 'clear') {
    return (
      <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #00e5c4, #00b4d8)', color: '#050d1a', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 4px 16px rgba(0,229,196,0.2)' }}>
        Add Position
      </button>
    );
  }
  if (status === 'warnings') {
    return (
      <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90"
        style={{ background: 'transparent', border: '1px solid rgba(245,200,66,0.4)', color: '#f5c842', fontFamily: 'DM Sans, sans-serif' }}>
        Add Position Anyway
        <span className="block text-[10px] font-normal opacity-70">{result.warnCount + result.failCount} warning(s)</span>
      </button>
    );
  }
  // blocked
  return (
    <button type="submit" disabled={!canProceed} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
      style={{ background: canProceed ? 'transparent' : 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.3)', color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif', cursor: canProceed ? 'pointer' : 'not-allowed', opacity: canProceed ? 1 : 0.7 }}
      title={canProceed ? undefined : 'Fix critical issues above to enable this trade'}>
      {canProceed ? 'Add Position Anyway' : 'Blocked — Resolve Issues'}
    </button>
  );
}
```

Note: `SubmitButton` must be defined inside `AddPositionModal` (or extracted to a named function at module scope) and must import `ChecklistResult` type at the top of the file.

- [ ] **Step 6: Build check**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build 2>&1 | tail -20
```
Expected: Clean build.

---

### Task 7: Store checklist snapshot in `usePositions.ts`

**Files:**
- Modify: `src/hooks/usePositions.ts` (addPosition only)

Add `checklistSnapshot?: object` to `AddPositionData` and include it in the Supabase insert.

- [ ] **Step 1: Extend `AddPositionData` type**

```typescript
// OLD
type AddPositionData = {
  ticker: string;
  strategy: WheelStrategy;
  strike: number;
  expiry: string;
  premiumCollected: number;
  contracts: number;
};

// NEW
type AddPositionData = {
  ticker: string;
  strategy: WheelStrategy;
  strike: number;
  expiry: string;
  premiumCollected: number;
  contracts: number;
  checklistSnapshot?: object;  // serialised ChecklistResult
};
```

- [ ] **Step 2: Include in Supabase insert**

In the `supabase.from('wheel_positions').insert({...})` call, add:

```typescript
...(data.checklistSnapshot ? { checklist_snapshot: data.checklistSnapshot } : {}),
```

- [ ] **Step 3: Pass snapshot from AddPositionModal**

In `AddPositionModal.handleSubmit`, pass the checklist result:

```typescript
onAdd({
  ticker: form.ticker,
  strategy: form.strategy,
  strike: Number(form.strike),
  expiry: form.expiry,
  premiumCollected: Number(form.premium),
  contracts: Number(form.contracts),
  checklistSnapshot: checklistResult ?? undefined,
});
```

- [ ] **Step 4: Build check**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build 2>&1 | tail -20
```
Expected: Clean build, 0 errors.

---

## Chunk 6: Risk settings + Paper mode

### Task 8: Risk settings prompt inside `AddPositionModal`

Show a one-line banner when `accountBalance === 0` to prompt the user to set their account size.

**Files:**
- Modify: `src/pages/WheelTracker.tsx` (AddPositionModal only)

- [ ] **Step 1: Add account balance save helper**

Inside `AddPositionModal`, add:

```typescript
const saveAccountBalance = useCallback(async (amount: number) => {
  if (!user) return;
  await supabase
    .from('user_preferences')
    .upsert(
      { user_id: user.id, account_balance: amount },
      { onConflict: 'user_id' }
    );
}, [user]);
```

- [ ] **Step 2: Add inline prompt in the form**

Above the checklist (or above the submit buttons), add:

```tsx
{supplemental.accountBalance === 0 && (
  <div className="rounded-lg px-3 py-2.5 text-xs flex items-center gap-2"
    style={{ background: 'rgba(0,198,245,0.06)', border: '1px solid rgba(0,198,245,0.12)' }}>
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5" stroke="#00c6f5" strokeWidth="1.2" />
      <path d="M6 5v4M6 4v-.5" stroke="#00c6f5" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
    <span style={{ color: '#4a8ab0', fontFamily: 'DM Sans, sans-serif' }}>
      Set account size for position-sizing checks:
    </span>
    <input
      type="number"
      placeholder="100000"
      className="px-2 py-0.5 rounded text-xs ml-1"
      style={{ background: 'rgba(0,198,245,0.08)', border: '1px solid rgba(0,198,245,0.2)', color: '#00c6f5', fontFamily: 'JetBrains Mono, monospace', width: 90, outline: 'none' }}
      onBlur={(e) => {
        const v = Number(e.target.value);
        if (v > 0) void saveAccountBalance(v);
      }}
    />
  </div>
)}
```

- [ ] **Step 3: Build check**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build 2>&1 | tail -20
```
Expected: Clean build.

---

### Task 9: Paper mode — use paper account balance in checklist

The `PaperWheelTracker` has its own `AddPositionModal`. For now, the paper modal is a separate component in `PaperWheelTracker.tsx`. The checklist should also run there using `account.currentCash` as `buyingPower`.

**Files:**
- Modify: `src/pages/PaperWheelTracker.tsx` (paper AddPositionModal only)

- [ ] **Step 1: Check if `PaperWheelTracker` has its own add-position modal**

Read lines 130–350 of `PaperWheelTracker.tsx`. If it shares `AddPositionModal` from `WheelTracker.tsx`, skip this task. If it has its own modal, apply the same integration pattern (Tasks 6–8) using `account.currentCash` as `buyingPower` and `account.startingBalance` as the `accountBalance` fallback.

```bash
grep -n "AddPositionModal\|openPaperPosition\|handleAdd" \
  /Users/brandonyeo/Documents/Repository/premiumhunter/src/pages/PaperWheelTracker.tsx
```

- [ ] **Step 2: If separate modal, wire checklist with paper balance**

Pass to `useTradeChecklist`:
```typescript
buyingPower: account?.currentCash ?? 0,
```

Override `accountBalance` in the supplemental merge with `account?.startingBalance ?? 0` if `supplemental.accountBalance === 0`.

- [ ] **Step 3: Build + smoke test**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build 2>&1 | tail -20
```

---

## Chunk 7: Analytics + final verification

### Task 10: Write checklist analytics on submit

**Files:**
- Modify: `src/pages/WheelTracker.tsx` (AddPositionModal `handleSubmit` only)

After `onAdd(...)` is called successfully (inside `handleSubmit`), fire-and-forget the analytics insert:

- [ ] **Step 1: Add analytics write in `handleSubmit`**

```typescript
// After onAdd(...) call, best-effort analytics (no await, no error surfacing)
if (checklistResult) {
  void supabase.from('checklist_analytics').insert({
    ticker: form.ticker,
    strategy: form.strategy,
    checks_passed: checklistResult.passCount,
    checks_warned: checklistResult.warnCount,
    checks_failed: checklistResult.failCount,
    checks_overridden: overriddenChecks.size,
    submitted_anyway: checklistResult.overallStatus !== 'clear',
  });
}
```

- [ ] **Step 2: Final build**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build 2>&1 | tail -20
```
Expected: Clean build, 0 TS errors.

- [ ] **Step 3: Manual smoke test checklist**

Open the app locally (`npm run dev`). Open Wheel Tracker → Add Position. Verify:

1. With only ticker filled: checklist shows 8 skeleton/pending rows
2. With ticker + strategy + strike + expiry + premium filled:
   - IV Rank check shows a value (pass/warn/fail based on cached data)
   - Earnings Safety shows days to next earnings
   - Buying Power shows collateral required
   - DTE shows days and appropriate status
   - Premium Quality shows annualised return
   - Overall status banner updates
3. Click "Override" on a failing check — it changes to amber "Overridden"
4. With a critical earnings fail (within 7 days) — button shows "Blocked — Resolve Issues"
5. With all checks green — button shows "Add Position" in teal
6. Submit a position — confirm checklist_snapshot appears in Supabase `wheel_positions` row

---

## Key decisions and constraints

- **`SubmitButton`** must be defined at module scope or with a stable reference (not inside render) to avoid remount on every render. Define it as a named function component above `AddPositionModal`.
- **`premium` field** in the form is per-contract (e.g. $145 for 1 contract). The checklist `premium` field is per-share = per-contract / 100. The conversion `Number(form.premium) / 100` happens in the modal before passing to the hook.
- **`buyingPower`** is computed as `Math.max(0, cashBalance - lockedCollateral)` — same as the existing `freeCash` value already in `AddPositionModal`. No new Supabase query needed.
- **`accountBalance`** is stored in `user_preferences.account_balance` (new column). Defaults to 0, which makes `checkPositionSize` return `status: 'pass'` with 0% risk (passable). The inline prompt nudges users to set it.
- **Step 6 (checklist history on position detail)** is deferred — it requires modifying `PositionTable.tsx` or adding a dedicated position detail page, which contradicts the "no changes to existing tables/hooks/pages outside add-position flow" constraint.
- **52-week low** is fetched from Finnhub `/stock/metric?symbol=X&metric=all`. If this returns null (e.g. for newer tickers), the check returns `pending` status gracefully.
