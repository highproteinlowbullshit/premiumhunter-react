import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePaperMode } from '../context/PaperModeContext'
import { useRealtimePrices } from './useRealtimePrices'
import {
  calculatePositionGreeks,
  aggregatePortfolioGreeks,
  estimateVolatility,
  type PositionGreeks,
  type PortfolioGreeks,
} from '../lib/blackScholes'
import { estimateIV } from '../lib/ivEstimate'

export function usePortfolioGreeks(): {
  greeks: PortfolioGreeks | null
  isLoading: boolean
  isError: boolean
  refetch: () => void
} {
  const { user } = useAuth()
  const { isPaperMode } = usePaperMode()
  const positionsTable = isPaperMode ? 'paper_positions' : 'wheel_positions'

  const {
    data: positions,
    isLoading: positionsLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['open-positions-for-greeks', user?.id, isPaperMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(positionsTable)
        .select('id, ticker, strategy, strike, expiry, premium_collected, contracts')
        .eq('user_id', user!.id)
        .eq('status', 'open')
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  })

  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString().split('T')[0]
  const tickers = [...new Set((positions ?? []).map(p => p.ticker))]

  const { data: ivData } = useQuery({
    queryKey: ['iv-for-greeks', user?.id, tickers.join(',')],
    queryFn: async () => {
      if (tickers.length === 0) return []
      const { data } = await supabase
        .from('iv_snapshots')
        .select('ticker, current_hv, hv_30, current_price, iv_rank, iv_hv_ratio, earnings_date')
        .in('ticker', tickers)
        .gte('snapshot_date', threeDaysAgo)
        .eq('calculation_success', true)
        .order('snapshot_date', { ascending: false })
        .limit((tickers.length + 1) * 3)
      // Most recent row per ticker, preferring rows with non-null current_price.
      // Today's snapshot is written before market open so current_price can be null;
      // fall back to yesterday's row which has a valid closing price.
      type Row = NonNullable<typeof data>[0]
      const best = new Map<string, Row>()
      for (const row of (data ?? [])) {
        const existing = best.get(row.ticker)
        if (!existing || (existing.current_price == null && row.current_price != null)) {
          best.set(row.ticker, row)
        }
      }
      return Array.from(best.values())
    },
    staleTime: 30 * 60 * 1000,
    enabled: !!user && tickers.length > 0,
  })

  const { prices: realtimePrices } = useRealtimePrices(tickers)

  // Memoized so the Map object is stable between renders (ivData has a 6h staleTime)
  const ivMap = useMemo(
    () => new Map((ivData ?? []).map((d: { ticker: string; current_hv: number | null; hv_30: number | null; current_price: number | null; iv_rank: number | null; iv_hv_ratio: number | null; earnings_date: string | null }) => [d.ticker, d])),
    [ivData],
  )

  const positionIds = (positions ?? []).map(p => p.id).join(',')
  // Round to nearest dollar so minor ticks don't trigger a full recompute, but a real
  // price move (or snapshot prices loading for the first time) still invalidates the cache.
  // Using snapshot price as fallback means greeksQuery reruns when ivData loads, not just
  // when WS prices arrive — fixing the zero-on-initial-load race condition.
  const priceKey = tickers.map(t => {
    const live = realtimePrices.get(t)
    const snap = Number(ivMap.get(t)?.current_price ?? 0)
    return Math.round(live ?? snap)
  }).join(',')

  const greeksQuery = useQuery({
    queryKey: ['portfolio-greeks', positionIds, priceKey],
    queryFn: async (): Promise<PortfolioGreeks> => {
      if (!positions || positions.length === 0) {
        return aggregatePortfolioGreeks([])
      }

      const positionGreeksList: PositionGreeks[] = positions.map(pos => {
        const iv = ivMap.get(pos.ticker)
        const livePrice = realtimePrices.get(pos.ticker)

        const currentPrice = livePrice ?? iv?.current_price ?? 0
        const hv30Raw = iv?.current_hv ?? iv?.hv_30
        let impliedVolatility: number
        if (hv30Raw != null && Number(hv30Raw) > 0) {
          const hv30 = Number(hv30Raw)
          const earningsDTE = iv?.earnings_date
            ? Math.ceil((new Date(iv.earnings_date + 'T00:00:00').getTime() - Date.now()) / 86_400_000)
            : null
          impliedVolatility = estimateIV(
            hv30,
            iv?.iv_hv_ratio != null ? Number(iv.iv_hv_ratio) : null,
            iv?.iv_rank != null ? Number(iv.iv_rank) : null,
            earningsDTE,
          ) / 100
        } else {
          impliedVolatility = estimateVolatility(pos.ticker)
        }

        // current_hv is 30-day historical vol from the nightly cron, not live Polygon IV
        const ivSource: PositionGreeks['ivSource'] =
          hv30Raw ? 'supabase_cache'
          : 'estimated'

        return calculatePositionGreeks({
          positionId: pos.id,
          ticker: pos.ticker,
          strategy: pos.strategy as 'CSP' | 'CC',
          strike: pos.strike,
          expiry: pos.expiry,
          contracts: pos.contracts,
          currentPrice,
          impliedVolatility,
          ivSource,
        })
      })

      return aggregatePortfolioGreeks(positionGreeksList)
    },
    enabled: !positionsLoading && !!positions,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    // keepPreviousData: when priceKey changes (a live price crosses a dollar boundary),
    // the queryKey changes and React Query would normally show placeholderData (zeros)
    // while the new fetch runs. keepPreviousData shows the last good Greeks instead.
    placeholderData: keepPreviousData,
  })

  return {
    greeks: greeksQuery.data ?? null,
    isLoading: positionsLoading || greeksQuery.isLoading,
    isError,
    refetch,
  }
}

