import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePaperMode } from '../context/PaperModeContext'

export interface MonthlyPnLData {
  month: string            // "Jan 2026"
  monthKey: string         // "2026-01" for sorting
  premiumCollected: number
  premiumOpen: number
  positionsClosed: number
  positionsWon: number
  winRate: number
  bestTrade: { ticker: string; pnl: number } | null
  worstTrade: { ticker: string; pnl: number } | null
  isCurrentMonth: boolean
  isProjected: boolean
}

export interface MonthlyPnLSummary {
  months: MonthlyPnLData[]
  totalAllTime: number
  totalThisYear: number
  bestMonth: MonthlyPnLData | null
  bestMonthAmount: number
  averageMonthly: number
  currentMonthSoFar: number
  growthPercent: number | null
  streakMonths: number
}

export function useMonthlyPnL() {
  const { user } = useAuth()
  const { isPaperMode } = usePaperMode()

  return useQuery({
    queryKey: ['monthly-pnl', user?.id, isPaperMode],
    queryFn: async (): Promise<MonthlyPnLSummary> => {
      const tableName = isPaperMode ? 'paper_positions' : 'wheel_positions'

      const thirteenMonthsAgo = new Date()
      thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13)

      // Paper positions store buyback in closing_premium; real positions use closing_price
      const closingColumn = isPaperMode ? 'closing_premium' : 'closing_price'
      const { data: closedPositions, error: closedError } = await supabase
        .from(tableName)
        .select(`id, ticker, strategy, strike, expiry, premium_collected, ${closingColumn}, contracts, opened_at, closed_at, status`)
        .eq('user_id', user!.id)
        .in('status', ['closed', 'assigned', 'expired'])
        .or(`closed_at.gte.${thirteenMonthsAgo.toISOString()},closed_at.is.null`)
        .order('closed_at', { ascending: true })

      if (closedError) throw closedError

      const { data: openPositions } = await supabase
        .from(tableName)
        .select('ticker, premium_collected, contracts, expiry')
        .eq('user_id', user!.id)
        .eq('status', 'open')

      // Build month buckets for last 12 months
      // Use UTC arithmetic throughout — DB timestamps are stored as UTC ISO strings,
      // so bucket keys must also be UTC-based to avoid off-by-one-month for UTC+ timezones.
      const monthBuckets = new Map<string, MonthlyPnLData>()

      const now = new Date()
      const nowUTCYear = now.getUTCFullYear()
      const nowUTCMonth = now.getUTCMonth() // 0-indexed

      for (let i = 11; i >= 0; i--) {
        let mo = nowUTCMonth - i
        let yr = nowUTCYear
        while (mo < 0) { mo += 12; yr-- }
        const monthKey = `${yr}-${String(mo + 1).padStart(2, '0')}`
        const monthLabel = new Date(Date.UTC(yr, mo, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        const isCurrentMonth = i === 0

        monthBuckets.set(monthKey, {
          month: monthLabel,
          monthKey,
          premiumCollected: 0,
          premiumOpen: 0,
          positionsClosed: 0,
          positionsWon: 0,
          winRate: 0,
          bestTrade: null,
          worstTrade: null,
          isCurrentMonth,
          isProjected: isCurrentMonth,
        })
      }

      // Compute P&L for one closed position, accounting for real vs paper unit conventions.
      // Real: premium_collected is per-contract dollars (price × 100 shares); multiply by contracts only.
      // Paper: premium_collected is per-share price; multiply by contracts × 100.
      // Buyback cost lives in closing_price (real) or closing_premium (paper).
      const calcPnl = (pos: any): number => {
        const buyback: number | null = pos.closing_premium ?? pos.closing_price ?? null
        const multiplier = isPaperMode ? 100 : 1
        if (buyback != null && pos.status === 'closed') {
          return (pos.premium_collected - buyback) * pos.contracts * multiplier
        }
        return pos.premium_collected * pos.contracts * multiplier
      }

      // Populate buckets from closed positions
      ;(closedPositions ?? []).forEach((pos: any) => {
        const closedDate = pos.closed_at ?? pos.expiry
        if (!closedDate) return

        const monthKey = closedDate.slice(0, 7)
        const bucket = monthBuckets.get(monthKey)
        if (!bucket) return

        const pnl = Math.round(calcPnl(pos) * 100) / 100

        bucket.premiumCollected += pnl
        bucket.positionsClosed += 1
        if (pnl > 0) bucket.positionsWon += 1

        if (bucket.bestTrade === null || pnl > bucket.bestTrade.pnl) {
          bucket.bestTrade = { ticker: pos.ticker, pnl }
        }
        if (bucket.worstTrade === null || pnl < bucket.worstTrade.pnl) {
          bucket.worstTrade = { ticker: pos.ticker, pnl }
        }
      })

      // Calculate win rates and round premiums
      monthBuckets.forEach(bucket => {
        bucket.premiumCollected = Math.round(bucket.premiumCollected * 100) / 100
        bucket.winRate = bucket.positionsClosed > 0
          ? Math.round((bucket.positionsWon / bucket.positionsClosed) * 1000) / 10
          : 0
      })

      // Add projected open premium to current month
      const currentMonthKey = `${nowUTCYear}-${String(nowUTCMonth + 1).padStart(2, '0')}`
      const currentBucket = monthBuckets.get(currentMonthKey)
      if (currentBucket) {
        const openPremium = (openPositions ?? []).reduce((sum: number, pos: any) => {
          const expiryMonth = pos.expiry?.slice(0, 7)
          if (expiryMonth === currentMonthKey) {
            const multiplier = isPaperMode ? 100 : 1
            return sum + (pos.premium_collected * pos.contracts * multiplier)
          }
          return sum
        }, 0)
        currentBucket.premiumOpen = Math.round(openPremium * 100) / 100
      }

      const months = Array.from(monthBuckets.values())
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey))

      const totalAllTime = months.reduce((s, m) => s + m.premiumCollected, 0)

      const totalThisYear = months
        .filter(m => m.monthKey.startsWith(nowUTCYear.toString()))
        .reduce((s, m) => s + m.premiumCollected, 0)

      const bestMonth = months.reduce(
        (best, m) => m.premiumCollected > (best?.premiumCollected ?? -Infinity) ? m : best,
        null as MonthlyPnLData | null,
      )

      const nonZeroMonths = months.filter(m => m.positionsClosed > 0)
      const averageMonthly = nonZeroMonths.length > 0 ? totalAllTime / nonZeroMonths.length : 0

      const currentMonth = months[months.length - 1]

      // Compute same-month-last-year premium from raw closedPositions — the 12-month
      // bucket window never includes this month, so searching monthBuckets always returns
      // undefined. Calculate directly from the data (query covers 13 months).
      const lastYearSameMonthKey = `${nowUTCYear - 1}-${String(nowUTCMonth + 1).padStart(2, '0')}`
      let lyPremium = 0
      ;(closedPositions ?? []).forEach((pos: any) => {
        const closedDate = pos.closed_at ?? pos.expiry
        if (closedDate?.slice(0, 7) === lastYearSameMonthKey) {
          lyPremium += Math.round(calcPnl(pos) * 100) / 100
        }
      })

      const growthPercent = lyPremium > 0
        ? Math.round(((currentMonth.premiumCollected - lyPremium) / lyPremium) * 1000) / 10
        : null

      let streakMonths = 0
      for (let i = months.length - 1; i >= 0; i--) {
        if (months[i].premiumCollected > 0) streakMonths++
        else break
      }

      return {
        months,
        totalAllTime: Math.round(totalAllTime * 100) / 100,
        totalThisYear: Math.round(totalThisYear * 100) / 100,
        bestMonth,
        bestMonthAmount: bestMonth?.premiumCollected ?? 0,
        averageMonthly: Math.round(averageMonthly * 100) / 100,
        currentMonthSoFar: currentMonth?.premiumCollected ?? 0,
        growthPercent,
        streakMonths,
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!user,
  })
}
