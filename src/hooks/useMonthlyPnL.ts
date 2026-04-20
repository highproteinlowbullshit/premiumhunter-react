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

      const { data: closedPositions, error: closedError } = await supabase
        .from(tableName)
        .select('id, ticker, strategy, strike, expiry, premium_collected, closing_price, contracts, opened_at, closed_at, status')
        .eq('user_id', user!.id)
        .in('status', ['closed', 'assigned', 'expired'])
        .gte('closed_at', thirteenMonthsAgo.toISOString())
        .order('closed_at', { ascending: true })

      if (closedError) throw closedError

      const { data: openPositions } = await supabase
        .from(tableName)
        .select('ticker, premium_collected, contracts, expiry')
        .eq('user_id', user!.id)
        .eq('status', 'open')

      // Build month buckets for last 12 months
      const monthBuckets = new Map<string, MonthlyPnLData>()

      for (let i = 11; i >= 0; i--) {
        const date = new Date()
        date.setDate(1)
        date.setMonth(date.getMonth() - i)
        const monthKey = date.toISOString().slice(0, 7)
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
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

      // Populate buckets from closed positions
      ;(closedPositions ?? []).forEach((pos: any) => {
        const closedDate = pos.closed_at ?? pos.expiry
        if (!closedDate) return

        const monthKey = closedDate.slice(0, 7)
        const bucket = monthBuckets.get(monthKey)
        if (!bucket) return

        let pnl: number
        if (pos.status === 'expired') {
          pnl = pos.premium_collected * pos.contracts * 100
        } else if (pos.closing_price !== null) {
          pnl = (pos.premium_collected - pos.closing_price) * pos.contracts * 100
        } else {
          // Assigned — premium kept as income
          pnl = pos.premium_collected * pos.contracts * 100
        }

        pnl = Math.round(pnl * 100) / 100

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
      const currentMonthKey = new Date().toISOString().slice(0, 7)
      const currentBucket = monthBuckets.get(currentMonthKey)
      if (currentBucket) {
        const openPremium = (openPositions ?? []).reduce((sum: number, pos: any) => {
          const expiryMonth = pos.expiry?.slice(0, 7)
          if (expiryMonth === currentMonthKey) {
            return sum + (pos.premium_collected * pos.contracts * 100)
          }
          return sum
        }, 0)
        currentBucket.premiumOpen = Math.round(openPremium * 100) / 100
      }

      const months = Array.from(monthBuckets.values())
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey))

      const totalAllTime = months.reduce((s, m) => s + m.premiumCollected, 0)

      const thisYear = new Date().getFullYear().toString()
      const totalThisYear = months
        .filter(m => m.monthKey.startsWith(thisYear))
        .reduce((s, m) => s + m.premiumCollected, 0)

      const bestMonth = months.reduce(
        (best, m) => m.premiumCollected > (best?.premiumCollected ?? -Infinity) ? m : best,
        null as MonthlyPnLData | null,
      )

      const nonZeroMonths = months.filter(m => m.positionsClosed > 0)
      const averageMonthly = nonZeroMonths.length > 0 ? totalAllTime / nonZeroMonths.length : 0

      const currentMonth = months[months.length - 1]
      const lastYearSameMonth = months.find(m => {
        const [y, mo] = m.monthKey.split('-')
        const now = new Date()
        return parseInt(y) === now.getFullYear() - 1 && parseInt(mo) === now.getMonth() + 1
      })

      const growthPercent =
        lastYearSameMonth && lastYearSameMonth.premiumCollected > 0
          ? Math.round(
              ((currentMonth.premiumCollected - lastYearSameMonth.premiumCollected) /
                lastYearSameMonth.premiumCollected) *
                1000,
            ) / 10
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
