import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePaperMode } from '../context/PaperModeContext'
import { useRealtimePrices } from './useRealtimePrices'
import {
  calculatePositionGreeks,
  aggregatePortfolioGreeks,
  emptyPortfolioGreeks,
  type PositionGreeks,
  type PortfolioGreeks,
} from '../lib/blackScholes'

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

  const today = new Date().toISOString().split('T')[0]
  const tickers = [...new Set((positions ?? []).map(p => p.ticker))]

  const { data: ivData } = useQuery({
    queryKey: ['iv-for-greeks', tickers.join(','), today],
    queryFn: async () => {
      if (tickers.length === 0) return []
      const { data } = await supabase
        .from('iv_snapshots')
        .select('ticker, current_iv, current_price, iv_rank')
        .in('ticker', tickers)
        .eq('recorded_at', today)
      return data ?? []
    },
    staleTime: 6 * 60 * 60 * 1000,
    enabled: tickers.length > 0,
  })

  const { prices: realtimePrices } = useRealtimePrices(tickers)

  const ivMap = new Map((ivData ?? []).map((d: { ticker: string; current_iv: number; current_price: number }) => [d.ticker, d]))

  const positionIds = (positions ?? []).map(p => p.id).join(',')
  const priceKey = tickers.map(t => realtimePrices.get(t) ?? 0).join(',')

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
        const impliedVolatility = iv?.current_iv ?? getDefaultIV(pos.ticker)

        const ivSource: PositionGreeks['ivSource'] =
          livePrice && iv?.current_iv ? 'polygon_live'
          : iv?.current_iv ? 'supabase_cache'
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
    placeholderData: emptyPortfolioGreeks(),
  })

  return {
    greeks: greeksQuery.data ?? null,
    isLoading: positionsLoading || greeksQuery.isLoading,
    isError,
    refetch,
  }
}

function getDefaultIV(ticker: string): number {
  const defaults: Record<string, number> = {
    GME: 1.20, MARA: 1.40, SOFI: 0.80, COIN: 1.00,
    MSTR: 1.10, RIOT: 1.20, TSLA: 0.65, NVDA: 0.55,
    AMD: 0.55, META: 0.40, AAPL: 0.28, MSFT: 0.28,
    SPY: 0.18, QQQ: 0.22, IWM: 0.25,
  }
  return defaults[ticker] ?? 0.50
}
