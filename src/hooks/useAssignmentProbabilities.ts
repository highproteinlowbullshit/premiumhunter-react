import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { calculateAssignmentProbabilitiesBatch, type AssignmentProbabilityResult } from '../lib/blackScholes';

interface OpenPosition {
  id: string;
  ticker: string;
  strategy: 'CSP' | 'CC';
  strike: number;
  expiry: string;
}

export function useAssignmentProbabilities(
  positions: OpenPosition[],
  livePrices: Map<string, number>,
) {
  const { user } = useAuth();

  const tickers = useMemo(
    () => [...new Set(positions.map(p => p.ticker))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [positions.map(p => p.ticker).join(',')]
  );

  // Fetch most-recent IV data from Supabase (hv_30 used as IV proxy).
  // Cap at 30 days so stale data from months ago is never silently used.
  // Dates are computed inside queryFn so they stay current if the page is
  // open across midnight without a reload.
  const { data: ivRows } = useQuery({
    queryKey: ['iv-for-positions', user?.id, tickers.join(',')],
    queryFn: async () => {
      if (tickers.length === 0) return [];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
      const { data } = await supabase
        .from('iv_snapshots')
        .select('ticker, current_hv, hv_30, snapshot_date, iv_rank, iv_hv_ratio, earnings_date')
        .in('ticker', tickers)
        .eq('calculation_success', true)
        .gte('snapshot_date', thirtyDaysAgo)
        .order('snapshot_date', { ascending: false })
        .limit(tickers.length * 3);
      return data ?? [];
    },
    staleTime: 6 * 60 * 60 * 1000,
    enabled: tickers.length > 0 && !!user,
  });

  const ivMap = useMemo(() => {
    const map = new Map<string, number>();
    const seen = new Set<string>();
    for (const row of ivRows ?? []) {
      const hv30Raw = row.current_hv ?? row.hv_30;
      if (!seen.has(row.ticker) && hv30Raw) {
        map.set(row.ticker, Number(hv30Raw) / 100);
        seen.add(row.ticker);
      }
    }
    return map;
  }, [ivRows]);

  // Stable key derived from live prices so the memo only recomputes when prices
  // actually change — not on every render that produces a new Map reference.
  const priceKey = useMemo(
    () => [...livePrices.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([t, p]) => `${t}:${p}`).join(','),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [[...livePrices.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([t, p]) => `${t}:${p}`).join(',')]
  );

  const probabilities = useMemo<Map<string, AssignmentProbabilityResult>>(
    () => calculateAssignmentProbabilitiesBatch(positions, livePrices, ivMap),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [positions.map(p => p.id).join(','), priceKey, ivMap]
  );

  const summary = useMemo(() => {
    const results = Array.from(probabilities.values());
    return {
      highRiskCount: results.filter(r => r.status === 'itm' || r.status === 'near').length,
      watchCount: results.filter(r => r.status === 'watch').length,
      safeCount: results.filter(r => r.status === 'safe').length,
      avgProbability: results.length > 0
        ? Math.round(results.reduce((s, r) => s + r.probability, 0) / results.length * 10) / 10
        : 0,
    };
  }, [probabilities]);

  return { probabilities, summary };
}
