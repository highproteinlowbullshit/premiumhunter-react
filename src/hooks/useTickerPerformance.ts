import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export interface TickerPerformanceData {
  ticker: string
  totalCycles: number
  expiredWorthless: number
  assignments: number
  coveredCallCycles: number
  totalPremiumCollected: number
  totalCapitalGains: number
  totalPnL: number
  largestWin: number
  largestLoss: number
  averageCapitalDeployed: number
  totalCapitalDeployed: number
  returnOnCapital: number
  annualisedReturn: number
  winRate: number
  firstTradeDate: string
  lastTradeDate: string
  averageDTE: number
  totalDaysTraded: number
  maxDrawdown: number
  sharpeProxy: number
  consistencyScore: number
  premiumCaptureRate: number
  capitalUtilisation: number
  recentTrend: 'improving' | 'stable' | 'declining'
  monthlyBreakdown: Array<{ month: string; pnl: number }>
}

export interface TickerPerformanceSummary {
  tickers: TickerPerformanceData[]
  bestAnnualisedReturn: TickerPerformanceData | null
  bestWinRate: TickerPerformanceData | null
  mostConsistent: TickerPerformanceData | null
  highestVolume: TickerPerformanceData | null
  totalPortfolioReturn: number
  totalCapitalEverDeployed: number
  portfolioAnnualisedReturn: number
  portfolioWinRate: number
  dataFromDate: string
  dataToDate: string
  totalCompletedTrades: number
}

interface WheelPositionRow {
  id: string
  ticker: string
  strategy: string
  strike: number
  expiry: string
  premium_collected: number
  closing_price: number | null
  contracts: number
  opened_at: string
  closed_at: string | null
  status: string
}

interface AssignedLotRow {
  ticker: string
  total_premium_collected: number | null
  realized_capital_gain: number | null
  assignment_date: string | null
  exit_date: string | null
  gross_cost_basis: number | null
  status: string
}

export function useTickerPerformance() {
  const { user } = useAuth()

  return useQuery<TickerPerformanceSummary>({
    queryKey: ['ticker-performance', user?.id],
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<TickerPerformanceSummary> => {
      const emptyState: TickerPerformanceSummary = {
        tickers: [],
        bestAnnualisedReturn: null,
        bestWinRate: null,
        mostConsistent: null,
        highestVolume: null,
        totalPortfolioReturn: 0,
        totalCapitalEverDeployed: 0,
        portfolioAnnualisedReturn: 0,
        portfolioWinRate: 0,
        dataFromDate: '',
        dataToDate: '',
        totalCompletedTrades: 0,
      }

      const [positionsResult, lotsResult] = await Promise.all([
        supabase
          .from('wheel_positions')
          .select('id, ticker, strategy, strike, expiry, premium_collected, closing_price, contracts, opened_at, closed_at, status')
          .eq('user_id', user!.id)
          .in('status', ['closed', 'expired', 'assigned'])
          .order('ticker', { ascending: true })
          .order('opened_at', { ascending: true }),
        supabase
          .from('assigned_share_lots')
          .select('ticker, total_premium_collected, realized_capital_gain, assignment_date, exit_date, gross_cost_basis, status')
          .eq('user_id', user!.id)
          .neq('status', 'holding'),
      ])

      if (positionsResult.error) throw positionsResult.error
      if (lotsResult.error) throw lotsResult.error

      const positions = (positionsResult.data ?? []) as WheelPositionRow[]
      const lots = (lotsResult.data ?? []) as AssignedLotRow[]

      if (positions.length === 0) return emptyState

      // Build capital gains map by ticker from assigned lots
      const capitalGainsMap: Record<string, number> = {}
      for (const lot of lots) {
        if (lot.realized_capital_gain != null) {
          capitalGainsMap[lot.ticker] = (capitalGainsMap[lot.ticker] ?? 0) + Number(lot.realized_capital_gain)
        }
      }

      // Group positions by ticker
      const byTicker: Record<string, WheelPositionRow[]> = {}
      for (const pos of positions) {
        if (!byTicker[pos.ticker]) byTicker[pos.ticker] = []
        byTicker[pos.ticker].push(pos)
      }

      const tickerData: TickerPerformanceData[] = []

      // Portfolio-level accumulators
      let portTotalPnL = 0
      let portTotalCapital = 0
      let portTotalWins = 0
      let portTotalTrades = 0

      for (const [ticker, tickerPositions] of Object.entries(byTicker)) {
        let totalPnL = 0
        let totalCapital = 0
        let expiredCount = 0
        let assignmentCount = 0
        let coveredCallCycles = 0
        let wins = 0
        let largestWin = 0
        let largestLoss = 0
        const monthlyReturns = new Map<string, number>()
        const dteList: number[] = []
        const pnlList: number[] = []
        const captureRates: number[] = []

        // Sort by resolution date so pnlList is in chronological closed order (correct for drawdown)
        const sortedPositions = [...tickerPositions].sort((a, b) =>
          (a.closed_at ?? a.expiry).localeCompare(b.closed_at ?? b.expiry)
        )
        for (const pos of sortedPositions) {
          const capital = pos.strike * pos.contracts * 100

          let pnl: number
          if (pos.status === 'expired') {
            pnl = Number(pos.premium_collected) * Number(pos.contracts)
            expiredCount++
            wins++
          } else if (pos.status === 'assigned') {
            pnl = Number(pos.premium_collected) * Number(pos.contracts)
            assignmentCount++
            wins++
          } else if (pos.closing_price !== null) {
            pnl = (Number(pos.premium_collected) - Number(pos.closing_price)) * Number(pos.contracts)
            if (pnl > 0) {
              wins++
            }
          } else {
            pnl = 0
          }

          if (pos.status === 'expired' || pos.status === 'assigned') {
            captureRates.push(100)
          } else if (pos.closing_price !== null && Number(pos.premium_collected) > 0) {
            captureRates.push(
              ((Number(pos.premium_collected) - Number(pos.closing_price)) / Number(pos.premium_collected)) * 100
            )
          }

          if (pos.strategy === 'CC') {
            coveredCallCycles++
          }

          totalPnL += pnl
          totalCapital += capital
          pnlList.push(pnl)

          if (pnl > largestWin) largestWin = pnl
          if (pnl < largestLoss) largestLoss = pnl

          const monthKey = (pos.closed_at ?? pos.expiry).slice(0, 7)
          monthlyReturns.set(monthKey, (monthlyReturns.get(monthKey) ?? 0) + pnl)

          const dte = Math.ceil(
            (new Date(pos.expiry + 'T00:00:00').getTime() - new Date(pos.opened_at).getTime()) / 86400000
          )
          if (dte > 0) dteList.push(dte)
        }

        const capitalGains = capitalGainsMap[ticker] ?? 0
        const combinedPnL = totalPnL + capitalGains

        const n = tickerPositions.length
        const avgCapital = n > 0 ? totalCapital / n : 0

        // Period = first opened_at → last (closed_at ?? expiry), i.e. full capital-commitment window
        const openDates = tickerPositions.map(p => p.opened_at).sort()
        const closeDates = tickerPositions.map(p => p.closed_at ?? p.expiry).sort()
        const firstDate = openDates[0] ?? ''
        const lastDate = closeDates[closeDates.length - 1] ?? ''
        const totalDays = firstDate && lastDate
          ? Math.max(1, Math.ceil((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / 86400000))
          : 1

        // Denominator is avgCapital (capital per trade), not totalCapital (sum across all trades).
        // Sequential wheel trades recycle the same capital — summing it would divide by n×capital
        // and understate returns by the number of trades.
        const returnOnCapital = avgCapital > 0 ? (combinedPnL / avgCapital) * 100 : 0
        const annualisedReturn =
          totalDays > 0 && avgCapital > 0
            ? ((combinedPnL / avgCapital) * (365 / totalDays)) * 100
            : 0

        const totalTrades = tickerPositions.length
        const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0
        const averageDTE = dteList.length > 0
          ? dteList.reduce((a, b) => a + b, 0) / dteList.length
          : 0

        const premiumCaptureRate = captureRates.length > 0
          ? captureRates.reduce((a, b) => a + b, 0) / captureRates.length
          : 0

        // Actual holding days per position (closed_at ?? expiry − opened_at), not DTE at entry.
        // Capital is freed when you close early, so this correctly reflects idle periods.
        const totalHoldingDays = tickerPositions.reduce((sum, pos) => {
          const closeDate = pos.closed_at ?? pos.expiry
          return sum + Math.max(0, Math.ceil(
            (new Date(closeDate).getTime() - new Date(pos.opened_at).getTime()) / 86400000
          ))
        }, 0)
        const capitalUtilisation = totalDays > 0 ? (totalHoldingDays / totalDays) * 100 : 0

        // Consistency / Sharpe — expressed as monthly return % (normalised by avgCapital)
        // so the Sharpe is comparable across tickers with different capital levels
        const monthValues = Array.from(monthlyReturns.values())
        const avgCap = avgCapital > 0 ? avgCapital : 1
        const monthReturnPcts = monthValues.map(v => (v / avgCap) * 100)
        const avgMonthlyPct = monthReturnPcts.length > 0
          ? monthReturnPcts.reduce((a, b) => a + b, 0) / monthReturnPcts.length
          : 0
        const variancePct = monthReturnPcts.length > 1
          ? monthReturnPcts.reduce((sum, v) => sum + Math.pow(v - avgMonthlyPct, 2), 0) / (monthReturnPcts.length - 1)
          : 0
        const stdDevPct = Math.sqrt(variancePct)
        const consistencyScore =
          stdDevPct > 0 && avgMonthlyPct > 0
            ? Math.min(100, Math.max(0, 100 - (stdDevPct / avgMonthlyPct) * 50))
            : avgMonthlyPct > 0
            ? 100
            : 0
        const sharpeProxy = stdDevPct > 0 ? avgMonthlyPct / stdDevPct : 0

        // Max drawdown
        let maxDrawdown = 0
        let peak = 0
        let running = 0
        for (const p of pnlList) {
          running += p
          if (running > peak) peak = running
          const dd = peak - running
          if (dd > maxDrawdown) maxDrawdown = dd
        }

        // Recent trend — compare last 3 vs previous 3 months
        const sortedMonths = Array.from(monthlyReturns.entries()).sort(([a], [b]) => a.localeCompare(b))
        let recentTrend: 'improving' | 'stable' | 'declining' = 'stable'
        if (sortedMonths.length >= 6) {
          const recent3 = sortedMonths.slice(-3).map(([, v]) => v)
          const prev3 = sortedMonths.slice(-6, -3).map(([, v]) => v)
          const recentAvg = recent3.reduce((a, b) => a + b, 0) / 3
          const prevAvg = prev3.reduce((a, b) => a + b, 0) / 3
          if (prevAvg !== 0) {
            const threshold = Math.abs(prevAvg) * 0.1
            if (recentAvg - prevAvg > threshold) recentTrend = 'improving'
            else if (prevAvg - recentAvg > threshold) recentTrend = 'declining'
          } else if (recentAvg > 0) {
            recentTrend = 'improving'
          }
        }

        tickerData.push({
          ticker,
          totalCycles: totalTrades,
          expiredWorthless: expiredCount,
          assignments: assignmentCount,
          coveredCallCycles,
          totalPremiumCollected: Math.round(totalPnL * 100) / 100,
          totalCapitalGains: Math.round(capitalGains * 100) / 100,
          totalPnL: Math.round(combinedPnL * 100) / 100,
          largestWin: Math.round(largestWin * 100) / 100,
          largestLoss: Math.round(largestLoss * 100) / 100,
          averageCapitalDeployed: Math.round(avgCapital * 100) / 100,
          totalCapitalDeployed: Math.round(totalCapital * 100) / 100,
          returnOnCapital: Math.round(returnOnCapital * 100) / 100,
          annualisedReturn: Math.round(annualisedReturn * 100) / 100,
          winRate: Math.round(winRate * 10) / 10,
          firstTradeDate: firstDate,
          lastTradeDate: lastDate,
          averageDTE: Math.round(averageDTE),
          totalDaysTraded: totalDays,
          maxDrawdown: Math.round(maxDrawdown * 100) / 100,
          sharpeProxy: Math.round(sharpeProxy * 100) / 100,
          consistencyScore: Math.round(consistencyScore * 10) / 10,
          premiumCaptureRate: Math.round(premiumCaptureRate * 10) / 10,
          capitalUtilisation: Math.round(capitalUtilisation * 10) / 10,
          recentTrend,
          monthlyBreakdown: Array.from(monthlyReturns.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, pnl]) => ({ month, pnl: Math.round(pnl * 100) / 100 })),
        })

        portTotalPnL += combinedPnL
        portTotalCapital += totalCapital
        portTotalWins += wins
        portTotalTrades += totalTrades
      }

      // Sort by annualised return descending
      tickerData.sort((a, b) => b.annualisedReturn - a.annualisedReturn)

      const allOpenDates = positions.map(p => p.opened_at).sort()
      const allCloseDates = positions.map(p => p.closed_at ?? p.expiry).sort()
      const dataFromDate = allOpenDates[0] ?? ''
      const dataToDate = allCloseDates[allCloseDates.length - 1] ?? ''
      const totalPortDays = dataFromDate && dataToDate
        ? Math.max(1, Math.ceil((new Date(dataToDate).getTime() - new Date(dataFromDate).getTime()) / 86400000))
        : 1

      const portAvgCapital = portTotalTrades > 0 ? portTotalCapital / portTotalTrades : 0
      const portfolioAnnualisedReturn =
        portAvgCapital > 0
          ? ((portTotalPnL / portAvgCapital) * (365 / totalPortDays)) * 100
          : 0
      const portfolioWinRate = portTotalTrades > 0 ? (portTotalWins / portTotalTrades) * 100 : 0

      return {
        tickers: tickerData,
        bestAnnualisedReturn: tickerData[0] ?? null,
        bestWinRate: tickerData.length > 0
          ? [...tickerData].sort((a, b) => b.winRate - a.winRate)[0]
          : null,
        mostConsistent: tickerData.length > 0
          ? [...tickerData].sort((a, b) => b.consistencyScore - a.consistencyScore)[0]
          : null,
        highestVolume: tickerData.length > 0
          ? [...tickerData].sort((a, b) => b.totalCycles - a.totalCycles)[0]
          : null,
        totalPortfolioReturn: Math.round(portTotalPnL * 100) / 100,
        totalCapitalEverDeployed: Math.round(portTotalCapital * 100) / 100,
        portfolioAnnualisedReturn: Math.round(portfolioAnnualisedReturn * 100) / 100,
        portfolioWinRate: Math.round(portfolioWinRate * 10) / 10,
        dataFromDate,
        dataToDate,
        totalCompletedTrades: portTotalTrades,
      }
    },
  })
}
