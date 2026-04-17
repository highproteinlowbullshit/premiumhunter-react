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
  const [prefsFetched, setPrefsFetched] = useState(false);
  const [fetchingTicker, setFetchingTicker] = useState<string | null>(null);

  // Fetch user preferences once on mount
  useEffect(() => {
    if (!user) { setPrefsFetched(true); return; }
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
        setPrefsFetched(true);
      });
  }, [user?.id]);

  // Fetch ticker-specific data when ticker changes.
  // fetchingTicker guards against re-fetching the same ticker on unrelated re-renders —
  // intentionally not in the dep array to avoid an infinite loop.
  useEffect(() => {
    const ticker = formValues.ticker?.toUpperCase();
    if (!ticker) {
      setFetchingTicker(null);
      return;
    }
    if (fetchingTicker === ticker) return;
    setFetchingTicker(ticker);

    const fetchAll = async () => {
      // IV rank + cached earnings date from iv_snapshots
      const { data: ivRow } = await supabase
        .from('iv_snapshots')
        .select('iv_rank, iv_percentile, earnings_date')
        .eq('ticker', ticker)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Earnings: prefer Supabase cache; fall back to live Finnhub if not cached
      let daysToEarnings: number | null = null;
      const cachedEarningsDate: string | null = ivRow?.earnings_date ?? null;
      if (cachedEarningsDate) {
        daysToEarnings = Math.ceil(
          (new Date(cachedEarningsDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
      } else {
        try {
          const earningsDate = await getNextEarnings(ticker);
          if (earningsDate) {
            daysToEarnings = Math.ceil(
              (new Date(earningsDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
            );
          }
        } catch (err) {
          if (import.meta.env.DEV) console.warn(`[checklist] earnings fetch failed for ${ticker}:`, err);
        }
      }

      // 52-week low
      let support52wkLow = 0;
      try {
        const metrics = await getStockBasicFinancials(ticker);
        support52wkLow = metrics.metric?.['52WeekLow'] ?? 0;
      } catch (err) {
        if (import.meta.env.DEV) console.warn(`[checklist] 52wk low fetch failed for ${ticker}:`, err);
      }

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
      sharesHeld: formValues.sharesHeld ?? 0,
      openPositions,
      ...supplemental,
    };

    const checklistResult = runTradeChecklist(input);

    // Apply overrides: overridden non-critical fails become warns
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
      recommendation:
        newOverallStatus === 'blocked'
          ? 'Trade blocked — resolve critical issue(s) before proceeding.'
          : newOverallStatus === 'warnings'
          ? `Proceed with caution — review ${newFailCount + newWarnCount} issue(s).`
          : 'All checks passed — trade looks good.',
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
    prefsFetched,
  };
}
