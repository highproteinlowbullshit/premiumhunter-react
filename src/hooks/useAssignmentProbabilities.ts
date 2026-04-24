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

  const today = new Date().toISOString().split('T')[0];

  // Fetch most-recent IV data from Supabase (hv_30 used as IV proxy)
  const { data: ivRows } = useQuery({
    queryKey: ['iv-for-positions', tickers.join(','), today],
    queryFn: async () => {
      if (tickers.length === 0) return [];
      const { data } = await supabase
        .from('iv_snapshots')
        .select('ticker, hv_30, snapshot_date')
        .in('ticker', tickers)
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
      if (!seen.has(row.ticker) && row.hv_30) {
        map.set(row.ticker, Number(row.hv_30));
        seen.add(row.ticker);
      }
    }
    return map;
  }, [ivRows]);

  const probabilities = useMemo<Map<string, AssignmentProbabilityResult>>(
    () => calculateAssignmentProbabilitiesBatch(positions, livePrices, ivMap),
    [positions, livePrices, ivMap]
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
