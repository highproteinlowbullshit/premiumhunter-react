import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePaperMode } from '../context/PaperModeContext';
import { blackScholes, estimateVolatility } from '../lib/blackScholes';
import { getQuote, getNextEarnings } from '../lib/finnhub';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PositionSnapshot {
  // Identity
  positionId: string
  ticker: string
  strategy: 'CSP' | 'CC'
  strike: number
  expiry: string
  contracts: number
  premiumCollected: number      // per-contract dollars (DB stores price × 100)
  totalPremium: number          // premiumCollected × contracts (total received)

  // Time
  dte: number
  dteZone: 'today' | 'critical' | 'urgent' | 'watch' | 'comfortable'
  openedDaysAgo: number

  // Price and distance
  currentPrice: number | null
  distanceFromStrike: number | null   // absolute $ distance to strike
  distancePercent: number | null      // % distance from currentPrice to strike
  isITM: boolean
  safetyStatus: 'safe' | 'watch' | 'near' | 'itm'

  // P&L estimate
  estimatedCurrentValue: number | null  // current option price per share (BS)
  estimatedPnL: number | null           // total $ P&L (positive = profit)
  estimatedPnLPercent: number | null    // pnl / totalPremium * 100
  percentOfMaxProfit: number | null     // how close to full profit capture

  // Theta
  dailyTheta: number | null             // $ earned per day from time decay
  thetaToDate: number | null            // rough theta earned so far (dailyTheta × days)

  // Greeks summary
  assignmentProbability: number | null  // % chance (≈ |delta| × 100)
  impliedVolatility: number | null      // IV used for calculations

  // Action suggestion
  suggestedAction: 'hold' | 'watch' | 'review' | 'urgent'
  actionReason: string

  // Flags
  hasEarningsRisk: boolean
  daysToEarnings: number | null
  isNearHighTheta: boolean              // DTE < 21 — theta accelerating
}

export interface DashboardIntelligence {
  greeting: string;
  isMarketOpen: boolean;
  marketStatus: string;
  marketOpensIn: string | null;
  marketClosesIn: string | null;
  dayOfWeek: string;
  isExpiryFriday: boolean;

  openPositionCount: number;
  totalPremiumAtRisk: number;
  totalCollateralDeployed: number;
  capitalEfficiencyPercent: number;

  positions: PositionSnapshot[];
  positionsSummary: {
    totalCount: number;
    safeCount: number;
    watchCount: number;
    nearCount: number;
    itmCount: number;
    totalDailyTheta: number;
    totalPotentialPremium: number;
    avgPercentOfMaxProfit: number;
    bestPerformer: PositionSnapshot | null;
    worstPerformer: PositionSnapshot | null;
    mostUrgent: PositionSnapshot | null;
  };

  thisMonth: {
    premiumCollected: number;
    positionsClosed: number;
    positionsWon: number;
    winRate: number;
    targetAmount: number;
    targetProgress: number;
    openPotential: number;
    isOnTrack: boolean;
    daysLeftInMonth: number;
    tradingDaysLeft: number;
  };

  lastMonth: {
    premiumCollected: number;
    winRate: number;
    positionsClosed: number;
    hitTarget: boolean;
  } | null;

  momChange: number | null;
  momTrend: 'up' | 'down' | 'flat' | null;

  currentWinStreak: number;
  longestWinStreak: number;
  consecutiveProfitableMonths: number;
  totalPremiumAllTime: number;
  totalTradesAllTime: number;
  allTimeWinRate: number;

  milestones: Array<{
    type:
      | 'first_trade' | 'tenth_trade' | 'hundredth_trade'
      | 'first_profitable_month' | 'three_month_streak' | 'five_month_streak'
      | 'total_premium_500' | 'total_premium_1000' | 'total_premium_5000'
      | 'total_premium_10000' | 'total_premium_50000'
      | 'win_streak_5' | 'win_streak_10';
    label: string;
    achievedAt: string;
    isNew: boolean;
  }>;

  highIVCount: number;
  surgingIVCount: number;
  topOpportunity: {
    ticker: string;
    ivRank: number;
    ivTrend: string;
    estimatedPremium: number;
    annualisedReturn: number;
    sector: string;
  } | null;
  topOpportunities: Array<{
    ticker: string;
    ivRank: number;
    estimatedPremium: number;
    annualisedReturn: number;
    daysToEarnings: number | null;
  }>;

  earningsThisWeek: Array<{
    ticker: string;
    daysToEarnings: number;
    hasOpenPosition: boolean;
    ivRank: number | null;
    warningLevel: 'danger' | 'caution';
  }>;

  watchlistCount: number;
  watchlistHighIV: number;
  watchlistBestOpportunity: {
    ticker: string;
    ivRank: number;
    ivTrend: string;
  } | null;

  portfolioHealthScore: number;
  portfolioHealthLabel: string;
  portfolioHealthFactors: Array<{
    factor: string;
    score: number;
    maxScore: number;
    note: string;
  }>;

  primaryInsight: {
    type: 'opportunity' | 'warning' | 'achievement' | 'suggestion' | 'neutral';
    headline: string;
    detail: string;
    action: { label: string; route: string } | null;
  };

  secondaryInsights: Array<{
    type: 'opportunity' | 'warning' | 'achievement' | 'suggestion';
    text: string;
  }>;

  dataAsOf: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getMarketInfo(): {
  isOpen: boolean;
  status: string;
  opensIn: string | null;
  closesIn: string | null;
} {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  const timeInMinutes = et.getHours() * 60 + et.getMinutes();

  const isWeekday = day >= 1 && day <= 5;
  const OPEN = 9 * 60 + 30;
  const CLOSE = 16 * 60;
  const PRE = 4 * 60;
  const AFTER = 20 * 60;

  if (!isWeekday) {
    return { isOpen: false, status: 'Closed for weekend', opensIn: null, closesIn: null };
  }
  if (timeInMinutes >= OPEN && timeInMinutes < CLOSE) {
    return {
      isOpen: true,
      status: 'Market open',
      opensIn: null,
      closesIn: `Closes in ${minutesToHHMM(CLOSE - timeInMinutes)}`,
    };
  }
  if (timeInMinutes >= PRE && timeInMinutes < OPEN) {
    return {
      isOpen: false,
      status: 'Pre-market',
      opensIn: `Opens in ${minutesToHHMM(OPEN - timeInMinutes)}`,
      closesIn: null,
    };
  }
  if (timeInMinutes >= CLOSE && timeInMinutes < AFTER) {
    return { isOpen: false, status: 'After-hours', opensIn: null, closesIn: null };
  }
  return { isOpen: false, status: 'Market closed', opensIn: null, closesIn: null };
}

function isThirdFriday(): boolean {
  const today = new Date();
  if (today.getDay() !== 5) return false;
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const offset = (5 - firstDay.getDay() + 7) % 7;
  const thirdFriday = 1 + offset + 14;
  return today.getDate() === thirdFriday;
}

function calcPnl(pos: {
  status: string;
  premium_collected: number;
  closing_price: number | null;
  contracts: number;
}): number {
  // DB stores per-contract dollar amount; no ×100
  if (pos.status === 'expired') return pos.premium_collected * pos.contracts;
  if (pos.closing_price !== null) return (pos.premium_collected - pos.closing_price) * pos.contracts;
  return pos.premium_collected * pos.contracts;
}


// ── Portfolio health ───────────────────────────────────────────────────────────

function calcHealth(
  capitalEfficiency: number,
  allTimeWinRate: number,
  itmCount: number,
  targetProgress: number,
  targetSet: boolean,
  dangerEarnings: number,
): DashboardIntelligence['portfolioHealthFactors'] & { score: number; label: string } {
  const factors: DashboardIntelligence['portfolioHealthFactors'] = [];
  let total = 0;

  const dep = capitalEfficiency >= 60 ? 20 : capitalEfficiency >= 40 ? 14 : capitalEfficiency >= 20 ? 8 : 4;
  factors.push({ factor: 'Capital deployment', score: dep, maxScore: 20, note: `${Math.min(100, capitalEfficiency).toFixed(0)}% of capital working` });
  total += dep;

  const wr = allTimeWinRate >= 80 ? 25 : allTimeWinRate >= 70 ? 20 : allTimeWinRate >= 60 ? 14 : allTimeWinRate >= 50 ? 8 : 4;
  factors.push({ factor: 'Win rate', score: wr, maxScore: 25, note: `${allTimeWinRate.toFixed(0)}% all-time` });
  total += wr;

  const itm = itmCount === 0 ? 25 : itmCount === 1 ? 12 : 0;
  factors.push({ factor: 'Position safety', score: itm, maxScore: 25, note: itmCount === 0 ? 'No ITM positions' : `${itmCount} position${itmCount > 1 ? 's' : ''} ITM` });
  total += itm;

  const tgt = !targetSet ? 10 : targetProgress >= 100 ? 15 : targetProgress >= 80 ? 12 : targetProgress >= 50 ? 8 : 4;
  factors.push({ factor: 'Monthly target', score: tgt, maxScore: 15, note: targetSet ? `${targetProgress.toFixed(0)}% of target reached` : 'No target set' });
  total += tgt;

  const earn = dangerEarnings === 0 ? 15 : dangerEarnings === 1 ? 7 : 0;
  factors.push({ factor: 'Earnings risk', score: earn, maxScore: 15, note: dangerEarnings === 0 ? 'No earnings risk this week' : `${dangerEarnings} position near earnings` });
  total += earn;

  const score = Math.round((total / 100) * 100);
  const label = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Needs attention';
  return Object.assign(factors, { score, label }) as any;
}

// ── Primary insight ────────────────────────────────────────────────────────────

function primaryInsight(d: DashboardIntelligence): DashboardIntelligence['primaryInsight'] {
  // P1: expiring today
  const today = d.positions.filter(p => p.dteZone === 'today');
  if (today.length > 0) {
    return {
      type: 'warning',
      headline: `${today.length} position${today.length > 1 ? 's' : ''} expiring today`,
      detail: `${today.map(p => `${p.ticker} ${p.strategy}`).join(', ')} settle${today.length === 1 ? 's' : ''} today. Check your brokerage after market close.`,
      action: { label: 'View wheel tracker', route: '/wheel' },
    };
  }

  // P2: ITM
  const itm = d.positions.filter(p => p.safetyStatus === 'itm');
  if (itm.length > 0) {
    return {
      type: 'warning',
      headline: `${itm[0].ticker} is in the money`,
      detail: `${itm[0].ticker} is trading ${itm[0].distancePercent?.toFixed(1) ?? '—'}% through your ${itm[0].strategy} strike of $${itm[0].strike}. Assignment is likely if this continues to expiry.`,
      action: { label: 'Review position', route: '/wheel' },
    };
  }

  // P3: new milestone
  const newMs = d.milestones.find(m => m.isNew);
  if (newMs) {
    return {
      type: 'achievement',
      headline: newMs.label,
      detail: 'You just hit a new milestone in your wheel strategy journey. Keep compounding.',
      action: null,
    };
  }

  // P4: near target
  if (d.thisMonth.targetAmount > 0 && d.thisMonth.targetProgress >= 80 && d.thisMonth.targetProgress < 100) {
    const remaining = d.thisMonth.targetAmount - d.thisMonth.premiumCollected;
    return {
      type: 'opportunity',
      headline: `${d.thisMonth.targetProgress.toFixed(0)}% to monthly target — ${fmt$(remaining)} to go`,
      detail: `You need ${fmt$(remaining)} more to hit your ${fmt$(d.thisMonth.targetAmount)} target with ${d.thisMonth.tradingDaysLeft} trading day${d.thisMonth.tradingDaysLeft !== 1 ? 's' : ''} left.`,
      action: { label: 'Find opportunities', route: '/screener' },
    };
  }

  // P5: expiry Friday
  if (d.isExpiryFriday) {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthName = nextMonth.toLocaleString('en-US', { month: 'long' });
    const urgentCount = d.positions.filter(p => p.dteZone !== 'comfortable').length;
    return {
      type: 'neutral',
      headline: 'Expiry Friday — monthly options settle today',
      detail: `${urgentCount} position${urgentCount !== 1 ? 's' : ''} expire today. Plan your ${monthName} cycle — capital will be available to redeploy.`,
      action: { label: 'Plan next cycle', route: '/screener' },
    };
  }

  // P6: strong screener opportunity
  if (d.topOpportunity && d.topOpportunity.ivRank >= 70) {
    return {
      type: 'opportunity',
      headline: `${d.topOpportunity.ticker} at IV rank ${d.topOpportunity.ivRank} — elevated premium`,
      detail: `${d.topOpportunity.ticker} IV rank is historically elevated. Estimated ${d.topOpportunity.annualisedReturn.toFixed(0)}% annualised return at 30-delta.`,
      action: { label: 'View in screener', route: '/screener' },
    };
  }

  // P7: earnings danger
  const danger = d.earningsThisWeek.filter(e => e.hasOpenPosition && e.warningLevel === 'danger');
  if (danger.length > 0) {
    return {
      type: 'warning',
      headline: `${danger[0].ticker} earnings within 7 days — you have an open position`,
      detail: `${danger[0].ticker} reports earnings in ${danger[0].daysToEarnings} days. IV may collapse after the announcement.`,
      action: { label: 'View position', route: '/wheel' },
    };
  }

  // P8: behind target with few days left
  if (d.thisMonth.targetAmount > 0 && !d.thisMonth.isOnTrack && d.thisMonth.tradingDaysLeft <= 7) {
    return {
      type: 'suggestion',
      headline: `Behind monthly target with ${d.thisMonth.tradingDaysLeft} trading days left`,
      detail: `You've collected ${fmt$(d.thisMonth.premiumCollected)} of your ${fmt$(d.thisMonth.targetAmount)} target. Consider opening a position to close the gap.`,
      action: { label: 'Screen for opportunities', route: '/screener' },
    };
  }

  // P9: idle capital
  if (d.openPositionCount === 0) {
    return {
      type: 'suggestion',
      headline: 'No open positions — capital is idle',
      detail: `The screener has ${d.highIVCount} stock${d.highIVCount !== 1 ? 's' : ''} with elevated IV right now. Consider opening positions for the next monthly cycle.`,
      action: { label: 'Find opportunities', route: '/screener' },
    };
  }

  // P10: win streak
  if (d.currentWinStreak >= 5) {
    return {
      type: 'achievement',
      headline: `${d.currentWinStreak} trade win streak — your strategy is working`,
      detail: `${d.currentWinStreak} consecutive winning trades. Your all-time win rate is ${d.allTimeWinRate.toFixed(1)}% across ${d.totalTradesAllTime} trades.`,
      action: null,
    };
  }

  // Default
  const nextExpiry = d.positions.filter(p => p.dteZone !== 'comfortable')[0];
  return {
    type: 'neutral',
    headline: d.openPositionCount > 0
      ? `${d.openPositionCount} position${d.openPositionCount > 1 ? 's' : ''} open — all on track`
      : 'Ready to trade — no open positions',
    detail: d.openPositionCount > 0
      ? `Total open premium: ${fmt$(d.totalPremiumAtRisk)}. Next expiry in ${nextExpiry?.dte ?? '—'} days.`
      : `${d.highIVCount} high-IV opportunities in the screener right now.`,
    action: d.openPositionCount > 0
      ? { label: 'View positions', route: '/wheel' }
      : { label: 'Browse screener', route: '/screener' },
  };
}

// ── Secondary insights ─────────────────────────────────────────────────────────

function secondaryInsights(d: DashboardIntelligence): DashboardIntelligence['secondaryInsights'] {
  const out: DashboardIntelligence['secondaryInsights'] = [];

  const critical = d.positions.filter(p => p.dteZone === 'critical' || p.dteZone === 'urgent');
  if (critical.length > 0) {
    out.push({ type: 'warning', text: `${critical.length} position${critical.length > 1 ? 's' : ''} expiring within ${critical[0].dte} days` });
  }

  if (d.thisMonth.positionsClosed >= 3) {
    out.push({
      type: d.thisMonth.winRate >= 70 ? 'achievement' : d.thisMonth.winRate >= 50 ? 'suggestion' : 'warning',
      text: `${d.thisMonth.winRate.toFixed(0)}% win rate this month (${d.thisMonth.positionsWon}/${d.thisMonth.positionsClosed} trades)`,
    });
  }

  if (d.momChange !== null) {
    out.push({
      type: d.momChange >= 0 ? 'achievement' : 'suggestion',
      text: d.momChange >= 0
        ? `${d.momChange.toFixed(0)}% more premium than last month`
        : `${Math.abs(d.momChange).toFixed(0)}% less premium than last month`,
    });
  }

  if (d.watchlistBestOpportunity) {
    out.push({ type: 'opportunity', text: `${d.watchlistBestOpportunity.ticker} on your watchlist: IV rank ${d.watchlistBestOpportunity.ivRank}` });
  }

  if (d.surgingIVCount >= 3) {
    out.push({ type: 'opportunity', text: `${d.surgingIVCount} stocks with elevated IV in screener` });
  }

  if (d.consecutiveProfitableMonths >= 3) {
    out.push({ type: 'achievement', text: `${d.consecutiveProfitableMonths} consecutive profitable months` });
  }

  return out.slice(0, 4);
}

// ── Main hook ──────────────────────────────────────────────────────────────────

export function useDashboardIntelligence() {
  const { user } = useAuth();
  const { isPaperMode } = usePaperMode();
  const positionsTable = isPaperMode ? 'paper_positions' : 'wheel_positions';

  return useQuery({
    queryKey: ['dashboard-intelligence', user?.id, isPaperMode],
    queryFn: async (): Promise<DashboardIntelligence> => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
      const currentMonthKey = todayStr.slice(0, 7);
      const lastMonthKey = lastMonthStart.slice(0, 7);

      const [
        openRes,
        thisMonthRes,
        lastMonthRes,
        allTimeRes,
        ivRes,
        watchlistRes,
        targetRes,
        prefsRes,
      ] = await Promise.all([
        supabase
          .from(positionsTable)
          .select('id, ticker, strategy, strike, expiry, premium_collected, contracts, opened_at')
          .eq('user_id', user!.id)
          .eq('status', 'open'),

        supabase
          .from(positionsTable)
          .select('ticker, strategy, strike, expiry, premium_collected, closing_price, contracts, status, closed_at')
          .eq('user_id', user!.id)
          .in('status', ['closed', 'expired', 'assigned'])
          .gte('closed_at', monthStart),

        supabase
          .from(positionsTable)
          .select('premium_collected, closing_price, contracts, status')
          .eq('user_id', user!.id)
          .in('status', ['closed', 'expired', 'assigned'])
          .gte('closed_at', lastMonthStart)
          .lte('closed_at', lastMonthEnd),

        supabase
          .from(positionsTable)
          .select('premium_collected, closing_price, contracts, status, closed_at, expiry')
          .eq('user_id', user!.id)
          .in('status', ['closed', 'expired', 'assigned'])
          .order('closed_at', { ascending: false }),

        supabase
          .from('iv_snapshots')
          .select('ticker, iv_rank, current_price, iv_percentile, current_hv, hv_30')
          .eq('snapshot_date', todayStr)
          .eq('calculation_success', true)
          .gte('iv_rank', 30)
          .order('iv_rank', { ascending: false })
          .limit(60),

        supabase
          .from('watchlist_items')
          .select('ticker')
          .eq('user_id', user!.id),

        supabase
          .from('monthly_income_targets')
          .select('target, month_key')
          .eq('user_id', user!.id)
          .in('month_key', [currentMonthKey, lastMonthKey]),

        supabase
          .from('user_preferences')
          .select('account_balance')
          .eq('user_id', user!.id)
          .maybeSingle(),
      ]);

      const open = openRes.data ?? [];
      const thisMonthClosed = thisMonthRes.data ?? [];
      const lastMonthClosed = lastMonthRes.data ?? [];
      const allTime = allTimeRes.data ?? [];
      const ivSnaps = ivRes.data ?? [];
      const watchlist = watchlistRes.data ?? [];
      const targetsByMonth = new Map(
        ((targetRes.data ?? []) as Array<{ month_key: string; target: number }>).map(r => [r.month_key, Number(r.target)])
      );
      const targetAmount = targetsByMonth.get(currentMonthKey) ?? 0;
      const lastMonthTargetAmount = targetsByMonth.get(lastMonthKey) ?? null;
      const accountBalance = Number(prefsRes.data?.account_balance ?? 0);

      const ivMap = new Map(ivSnaps.map(s => [s.ticker, s]));
      const openTickers = new Set(open.map(p => p.ticker));

      // ── Per-position IV (sequential — needs open tickers) ──────────────────
      // Use most recent snapshot within 30 days so weekends, holidays, and
      // extended cron gaps still yield a price for Black-Scholes.
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const posIVRes = open.length > 0
        ? await supabase
            .from('iv_snapshots')
            .select('ticker, current_hv, current_price')
            .in('ticker', [...openTickers])
            .gte('snapshot_date', thirtyDaysAgoStr)
            .eq('calculation_success', true)
            .order('snapshot_date', { ascending: false })
            .limit((openTickers.size + 1) * 30)
        : { data: [] };
      const posIVMap = new Map<string, { current_hv: number | null; current_price: number | null }>();
      for (const r of (posIVRes.data ?? [])) {
        if (!posIVMap.has(r.ticker)) posIVMap.set(r.ticker, r);
      }

      // Always fetch fresh quotes from Finnhub REST for all open-position tickers.
      // iv_snapshots.current_price can be hours or days old (it's set by a cron job at
      // snapshot time), so we can't trust it as the displayed price. The WebSocket overlay
      // in PositionsIntelligenceCard will keep prices live after initial render, but on
      // first load we need a fresh REST price to avoid showing stale values.
      if (openTickers.size > 0) {
        const allOpenTickers = [...openTickers];
        const quoteResults = await Promise.allSettled(allOpenTickers.map(t => getQuote(t)));
        allOpenTickers.forEach((ticker, i) => {
          const r = quoteResults[i];
          if (r.status === 'fulfilled') {
            const q = r.value;
            const price = q.c > 0 ? q.c : q.pc > 0 ? q.pc : null;
            if (price != null) {
              const existing = posIVMap.get(ticker);
              posIVMap.set(ticker, { current_hv: existing?.current_hv ?? null, current_price: price });
            }
          }
        });
      }

      // ── Fetch earnings dates for open positions ────────────────────────────
      const earningsDaysMap = new Map<string, number>();
      if (open.length > 0) {
        const earningsResults = await Promise.allSettled([...openTickers].map(t => getNextEarnings(t)));
        [...openTickers].forEach((ticker, i) => {
          const r = earningsResults[i];
          if (r.status === 'fulfilled' && r.value) {
            const days = Math.ceil((new Date(r.value).getTime() - now.getTime()) / 86_400_000);
            if (days >= 0) earningsDaysMap.set(ticker, days);
          }
        });
      }

      const earningsThisWeek: DashboardIntelligence['earningsThisWeek'] = [];
      earningsDaysMap.forEach((days, ticker) => {
        if (days <= 7) {
          earningsThisWeek.push({
            ticker,
            daysToEarnings: days,
            hasOpenPosition: openTickers.has(ticker),
            ivRank: ivMap.get(ticker)?.iv_rank ?? null,
            warningLevel: days <= 3 ? 'danger' : 'caution',
          });
        }
      });
      earningsThisWeek.sort((a, b) => a.daysToEarnings - b.daysToEarnings);

      // ── Build enriched positions ───────────────────────────────────────────
      const positions: PositionSnapshot[] = open.map(pos => {
        const premiumCollected = Number(pos.premium_collected);
        const contracts = Number(pos.contracts);
        const strike = Number(pos.strike);
        const totalPremium = Math.round(premiumCollected * contracts * 100) / 100;

        // DTE
        const expiryDate = new Date(pos.expiry as string);
        const dte = Math.max(0, Math.ceil(
          (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ));
        const dteZone: PositionSnapshot['dteZone'] =
          dte === 0 ? 'today'
          : dte <= 2 ? 'critical'
          : dte <= 6 ? 'urgent'
          : dte <= 14 ? 'watch'
          : 'comfortable';

        // Days since opened
        const openedAt = pos.opened_at as string | null;
        const openedDaysAgo = openedAt
          ? Math.floor((now.getTime() - new Date(openedAt).getTime()) / 86400000)
          : 0;

        // IV lookup
        const posIV = posIVMap.get(pos.ticker as string);
        const screenIV = ivMap.get(pos.ticker as string);
        const currentPrice = posIV?.current_price
          ? Number(posIV.current_price)
          : screenIV?.current_price
          ? Number(screenIV.current_price)
          : null;
        // Prefer position-specific current_hv, then iv_snapshots hv_30 (same source WheelTracker uses), then estimate
        const rawIV = posIV?.current_hv
          ? Number(posIV.current_hv) / 100
          : screenIV?.hv_30
          ? Number(screenIV.hv_30) / 100
          : null;
        const iv = rawIV ?? estimateVolatility(pos.ticker as string);

        // Price distance and safety
        const isITM = currentPrice !== null
          ? (pos.strategy as string) === 'CSP' ? currentPrice < strike : currentPrice > strike
          : false;
        const distanceFromStrike = currentPrice !== null ? Math.abs(currentPrice - strike) : null;
        const distancePercent = currentPrice !== null && distanceFromStrike !== null
          ? Math.round((distanceFromStrike / currentPrice) * 10000) / 100
          : null;
        const safetyStatus: PositionSnapshot['safetyStatus'] =
          isITM ? 'itm'
          : distancePercent !== null && distancePercent < 3 ? 'near'
          : distancePercent !== null && distancePercent < 8 ? 'watch'
          : 'safe';

        // Black-Scholes estimates
        let estimatedCurrentValue: number | null = null;
        let estimatedPnL: number | null = null;
        let estimatedPnLPercent: number | null = null;
        let percentOfMaxProfit: number | null = null;
        let dailyTheta: number | null = null;
        let assignmentProbability: number | null = null;

        if (currentPrice !== null && currentPrice > 0 && dte >= 0) {
          try {
            const T = Math.max(0.001, dte / 365);
            const optionType = (pos.strategy as string) === 'CSP' ? 'put' : 'call';
            const bs = blackScholes({
              spotPrice: currentPrice,
              strikePrice: strike,
              timeToExpiry: T,
              riskFreeRate: 0.045,
              volatility: iv,
              optionType,
            });

            estimatedCurrentValue = Math.round(bs.price * 100) / 100;

            // DB premium_collected is per-contract (= price × 100 shares)
            // bs.price is per-share — multiply by 100 to compare units
            const currentCostPerContract = bs.price * 100;
            const currentCostTotal = currentCostPerContract * contracts;
            estimatedPnL = Math.round((totalPremium - currentCostTotal) * 100) / 100;
            estimatedPnLPercent = totalPremium > 0
              ? Math.round((estimatedPnL / totalPremium) * 1000) / 10
              : null;
            percentOfMaxProfit = premiumCollected > 0
              ? Math.max(0, Math.round(((premiumCollected - currentCostPerContract) / premiumCollected) * 1000) / 10)
              : null;

            // Seller theta: abs(theta) per share × 100 shares/contract × contracts
            dailyTheta = Math.round(Math.abs(bs.theta) * contracts * 100 * 100) / 100;
            assignmentProbability = Math.round(Math.abs(bs.delta) * 1000) / 10;
          } catch {
            // Black-Scholes failed — leave null
          }
        }

        // Action suggestion
        let suggestedAction: PositionSnapshot['suggestedAction'] = 'hold';
        let actionReason = 'Position on track — hold to expiry';

        if (isITM) {
          suggestedAction = 'urgent';
          actionReason = `${pos.ticker} ITM by $${distanceFromStrike?.toFixed(2) ?? '?'} — assignment likely`;
        } else if (dteZone === 'today') {
          suggestedAction = 'urgent';
          actionReason = 'Expiring today — check outcome after market close';
        } else if (dteZone === 'critical') {
          suggestedAction = 'review';
          actionReason = `${dte} DTE — review position and prepare for expiry`;
        } else if (percentOfMaxProfit !== null && percentOfMaxProfit >= 50) {
          suggestedAction = 'watch';
          actionReason = `${percentOfMaxProfit.toFixed(0)}% max profit reached — consider closing`;
        } else if (safetyStatus === 'near') {
          suggestedAction = 'watch';
          actionReason = `Only ${distancePercent?.toFixed(1) ?? '?'}% from strike — monitor closely`;
        } else if (dteZone === 'urgent' && safetyStatus === 'watch') {
          suggestedAction = 'review';
          actionReason = `${dte} DTE and approaching strike — elevated risk`;
        }

        return {
          positionId: pos.id as string,
          ticker: pos.ticker as string,
          strategy: pos.strategy as 'CSP' | 'CC',
          strike,
          expiry: pos.expiry as string,
          contracts,
          premiumCollected,
          totalPremium,
          dte,
          dteZone,
          openedDaysAgo,
          currentPrice,
          distanceFromStrike,
          distancePercent,
          isITM,
          safetyStatus,
          estimatedCurrentValue,
          estimatedPnL,
          estimatedPnLPercent,
          percentOfMaxProfit,
          dailyTheta,
          thetaToDate: dailyTheta !== null ? Math.round(dailyTheta * openedDaysAgo * 100) / 100 : null,
          assignmentProbability,
          impliedVolatility: Math.round(iv * 1000) / 10,
          suggestedAction,
          actionReason,
          hasEarningsRisk: earningsDaysMap.has(pos.ticker as string) && (earningsDaysMap.get(pos.ticker as string)! <= 7),
          daysToEarnings: earningsDaysMap.get(pos.ticker as string) ?? null,
          isNearHighTheta: dte < 21 && dte > 0,
        } satisfies PositionSnapshot;
      });

      // Sort: urgent first, then DTE ascending
      const urgencyOrder = { urgent: 0, review: 1, watch: 2, hold: 3 };
      positions.sort((a, b) => {
        if (urgencyOrder[a.suggestedAction] !== urgencyOrder[b.suggestedAction]) {
          return urgencyOrder[a.suggestedAction] - urgencyOrder[b.suggestedAction];
        }
        return a.dte - b.dte;
      });

      // ── Positions summary ──────────────────────────────────────────────────
      const withProfit = positions.filter(p => p.percentOfMaxProfit !== null);
      const withTheta = positions.filter(p => p.dailyTheta !== null);
      const avgPercentOfMaxProfit = withProfit.length > 0
        ? Math.round(withProfit.reduce((s, p) => s + p.percentOfMaxProfit!, 0) / withProfit.length * 10) / 10
        : 0;

      const positionsSummary: DashboardIntelligence['positionsSummary'] = {
        totalCount: positions.length,
        safeCount: positions.filter(p => p.safetyStatus === 'safe').length,
        watchCount: positions.filter(p => p.safetyStatus === 'watch').length,
        nearCount: positions.filter(p => p.safetyStatus === 'near').length,
        itmCount: positions.filter(p => p.safetyStatus === 'itm').length,
        totalDailyTheta: Math.round(withTheta.reduce((s, p) => s + p.dailyTheta!, 0) * 100) / 100,
        totalPotentialPremium: Math.round(positions.reduce((s, p) => s + p.totalPremium, 0) * 100) / 100,
        avgPercentOfMaxProfit,
        bestPerformer: withProfit.reduce<PositionSnapshot | null>(
          (best, p) => (p.percentOfMaxProfit! > (best?.percentOfMaxProfit ?? -Infinity) ? p : best), null
        ),
        worstPerformer: withProfit.reduce<PositionSnapshot | null>(
          (worst, p) => (p.percentOfMaxProfit! < (worst?.percentOfMaxProfit ?? Infinity) ? p : worst), null
        ),
        mostUrgent: positions.find(p => p.suggestedAction === 'urgent') ?? null,
      };

      // ── Premiums and collateral ────────────────────────────────────────────
      const totalPremiumAtRisk = open.reduce(
        (s, p) => s + Number(p.premium_collected) * Number(p.contracts), 0,
      );
      const totalCollateral = open.reduce(
        (s, p) => s + Number(p.strike) * Number(p.contracts) * 100, 0,
      );
      const capitalEfficiency = accountBalance > 0
        ? Math.round((totalCollateral / accountBalance) * 1000) / 10
        : 0;

      // ── This month ─────────────────────────────────────────────────────────
      let tmPremium = 0, tmWins = 0;
      for (const p of thisMonthClosed) {
        const pnl = calcPnl(p as any);
        tmPremium += pnl;
        if (pnl > 0) tmWins++;
      }

      const openPotential = open
        .filter(p => (p.expiry as string).slice(0, 7) === currentMonthKey)
        .reduce((s, p) => s + Number(p.premium_collected) * Number(p.contracts), 0);

      const targetProgress = targetAmount > 0
        ? Math.min(100, Math.round((tmPremium / targetAmount) * 1000) / 10)
        : 0;

      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      let daysLeft = 0, tradingLeft = 0;
      for (let d = new Date(now); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        daysLeft++;
        if (d.getDay() >= 1 && d.getDay() <= 5) tradingLeft++;
      }

      const dayOfMonth = now.getDate();
      const dailyRate = dayOfMonth > 1 ? tmPremium / (dayOfMonth - 1) : 0;
      const projectedTotal = tmPremium + dailyRate * tradingLeft;
      const isOnTrack = targetAmount === 0 || tmPremium >= targetAmount || projectedTotal >= targetAmount * 0.9;

      // ── Last month ─────────────────────────────────────────────────────────
      let lmPremium = 0, lmWins = 0;
      for (const p of lastMonthClosed) {
        const pnl = calcPnl(p as any);
        lmPremium += pnl;
        if (pnl > 0) lmWins++;
      }

      const momChange = lmPremium > 0
        ? Math.round(((tmPremium - lmPremium) / lmPremium) * 1000) / 10
        : null;

      // ── All time ───────────────────────────────────────────────────────────
      let atPremium = 0, atWins = 0, longestStreak = 0, currentStreak = 0, tempStreak = 0;

      for (const p of [...allTime].reverse()) {
        const pnl = calcPnl(p as any);
        atPremium += pnl;
        if (pnl > 0) { atWins++; tempStreak++; longestStreak = Math.max(longestStreak, tempStreak); }
        else { tempStreak = 0; }
      }

      for (const p of allTime) {
        if (calcPnl(p as any) > 0) currentStreak++;
        else break;
      }

      const atWinRate = allTime.length > 0 ? Math.round((atWins / allTime.length) * 1000) / 10 : 0;

      // Consecutive profitable months (walk backwards from last full month)
      const atMonthlyPnl = new Map<string, number>();
      for (const p of allTime) {
        const d = ((p as any).closed_at ?? (p as any).expiry) as string | null;
        if (!d) continue;
        const mk = d.slice(0, 7);
        atMonthlyPnl.set(mk, Math.round(((atMonthlyPnl.get(mk) ?? 0) + calcPnl(p as any)) * 100) / 100);
      }
      let consecutiveProfitableMonths = 0;
      const cmCheck = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      for (let i = 0; i < 24; i++) {
        const mk = `${cmCheck.getFullYear()}-${String(cmCheck.getMonth() + 1).padStart(2, '0')}`;
        if ((atMonthlyPnl.get(mk) ?? 0) <= 0) break;
        consecutiveProfitableMonths++;
        cmCheck.setMonth(cmCheck.getMonth() - 1);
      }

      // ── Milestones ─────────────────────────────────────────────────────────
      const seenRaw = localStorage.getItem('ph_milestones') ?? '[]';
      let seen: string[];
      try {
        seen = JSON.parse(seenRaw);
        if (!Array.isArray(seen)) seen = [];
      } catch {
        seen = [];
      }

      const checks: Array<{ type: DashboardIntelligence['milestones'][0]['type']; label: string; achieved: boolean }> = [
        { type: 'first_trade', label: 'First trade logged', achieved: allTime.length >= 1 },
        { type: 'tenth_trade', label: '10 trades completed', achieved: allTime.length >= 10 },
        { type: 'hundredth_trade', label: '100 trades completed', achieved: allTime.length >= 100 },
        { type: 'total_premium_500', label: '$500 total premium collected', achieved: atPremium >= 500 },
        { type: 'total_premium_1000', label: '$1,000 total premium collected', achieved: atPremium >= 1000 },
        { type: 'total_premium_5000', label: '$5,000 total premium milestone', achieved: atPremium >= 5000 },
        { type: 'total_premium_10000', label: '$10,000 total premium collected', achieved: atPremium >= 10000 },
        { type: 'total_premium_50000', label: '$50,000 total premium collected', achieved: atPremium >= 50000 },
        { type: 'win_streak_5', label: '5-trade win streak', achieved: longestStreak >= 5 },
        { type: 'win_streak_10', label: '10-trade win streak', achieved: longestStreak >= 10 },
      ];

      const milestones: DashboardIntelligence['milestones'] = checks
        .filter(c => c.achieved)
        .map(c => ({ type: c.type, label: c.label, achievedAt: todayStr, isNew: !seen.includes(c.type) }));

      const newSeen = milestones.filter(m => m.isNew).map(m => m.type);
      if (newSeen.length > 0) {
        localStorage.setItem('ph_milestones', JSON.stringify([...seen, ...newSeen]));
      }

      // ── IV / screener ──────────────────────────────────────────────────────
      const highIV = ivSnaps.filter(s => (s.iv_rank ?? 0) >= 60);
      const surging = ivSnaps.filter(s => (s.iv_rank ?? 0) >= 50);

      const calcOpp = (s: typeof ivSnaps[0]) => {
        const iv = (s.current_hv ?? 40) / 100;
        const price = s.current_price ?? 50;
        const dte = 30;
        const premium = price * Math.max(iv, 0.2) * Math.sqrt(dte / 365) * 0.4;
        const strike = price * (1 - Math.max(iv, 0.2) * Math.sqrt(dte / 365) * 0.5);
        const ann = strike > 0 ? (premium / strike) * (365 / dte) * 100 : 0;
        return {
          ticker: s.ticker,
          ivRank: s.iv_rank ?? 0,
          estimatedPremium: Math.round(premium * 100) / 100,
          annualisedReturn: Math.round(ann * 10) / 10,
        };
      };

      const eligibleSnaps = ivSnaps.filter(s => !openTickers.has(s.ticker) && (s.iv_rank ?? 0) >= 50);
      const top5Snaps = eligibleSnaps.slice(0, 5);
      const top5Tickers = top5Snaps.map(s => s.ticker);
      const oppEarningsResults = await Promise.allSettled(top5Tickers.map(t => getNextEarnings(t)));
      const oppEarningsDaysMap = new Map<string, number | null>();
      top5Tickers.forEach((ticker, i) => {
        const r = oppEarningsResults[i];
        if (r.status === 'fulfilled' && r.value) {
          const days = Math.ceil((new Date(r.value).getTime() - now.getTime()) / 86_400_000);
          oppEarningsDaysMap.set(ticker, days >= 0 ? days : null);
        } else {
          oppEarningsDaysMap.set(ticker, null);
        }
      });
      const topOpportunities = top5Snaps.map(s => ({
        ...calcOpp(s),
        daysToEarnings: oppEarningsDaysMap.get(s.ticker) ?? null,
      }));

      const topRaw = eligibleSnaps[0] ?? null;
      const topOpportunity: DashboardIntelligence['topOpportunity'] = topRaw
        ? { ...calcOpp(topRaw), ivTrend: 'elevated', sector: 'Unknown' }
        : null;

      // ── Watchlist ──────────────────────────────────────────────────────────
      const wlTickers = new Set(watchlist.map(w => w.ticker));
      const wlIV = ivSnaps.filter(s => wlTickers.has(s.ticker));
      const wlHighIV = wlIV.filter(s => (s.iv_rank ?? 0) >= 50);
      const bestWL = wlIV[0];

      // ── Health score ───────────────────────────────────────────────────────
      const dangerEarnings = earningsThisWeek.filter(e => e.hasOpenPosition && e.warningLevel === 'danger').length;
      const healthFactors = calcHealth(
        capitalEfficiency,
        atWinRate,
        positionsSummary.itmCount,
        targetProgress,
        targetAmount > 0,
        dangerEarnings,
      );
      const healthScore = (healthFactors as any).score as number;
      const healthLabel = (healthFactors as any).label as string;

      // ── Assemble ───────────────────────────────────────────────────────────
      const market = getMarketInfo();
      const hour = now.getHours();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      const partial: DashboardIntelligence = {
        greeting: hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening',
        isMarketOpen: market.isOpen,
        marketStatus: market.status,
        marketOpensIn: market.opensIn,
        marketClosesIn: market.closesIn,
        dayOfWeek: days[now.getDay()],
        isExpiryFriday: isThirdFriday(),

        openPositionCount: open.length,
        totalPremiumAtRisk: Math.round(totalPremiumAtRisk * 100) / 100,
        totalCollateralDeployed: Math.round(totalCollateral),
        capitalEfficiencyPercent: capitalEfficiency,

        positions,
        positionsSummary,

        thisMonth: {
          premiumCollected: Math.round(tmPremium * 100) / 100,
          positionsClosed: thisMonthClosed.length,
          positionsWon: tmWins,
          winRate: thisMonthClosed.length > 0 ? Math.round((tmWins / thisMonthClosed.length) * 1000) / 10 : 0,
          targetAmount,
          targetProgress,
          openPotential: Math.round(openPotential * 100) / 100,
          isOnTrack,
          daysLeftInMonth: daysLeft,
          tradingDaysLeft: tradingLeft,
        },
        lastMonth: lastMonthClosed.length > 0 ? {
          premiumCollected: Math.round(lmPremium * 100) / 100,
          winRate: lastMonthClosed.length > 0 ? Math.round((lmWins / lastMonthClosed.length) * 1000) / 10 : 0,
          positionsClosed: lastMonthClosed.length,
          hitTarget: lastMonthTargetAmount !== null && lmPremium >= lastMonthTargetAmount,
        } : null,
        momChange,
        momTrend: momChange === null ? null : momChange > 5 ? 'up' : momChange < -5 ? 'down' : 'flat',

        currentWinStreak: currentStreak,
        longestWinStreak: longestStreak,
        consecutiveProfitableMonths,
        totalPremiumAllTime: Math.round(atPremium * 100) / 100,
        totalTradesAllTime: allTime.length,
        allTimeWinRate: atWinRate,
        milestones,

        highIVCount: highIV.length,
        surgingIVCount: surging.length,
        topOpportunity,
        topOpportunities,
        earningsThisWeek,

        watchlistCount: watchlist.length,
        watchlistHighIV: wlHighIV.length,
        watchlistBestOpportunity: bestWL
          ? { ticker: bestWL.ticker, ivRank: bestWL.iv_rank ?? 0, ivTrend: 'elevated' }
          : null,

        portfolioHealthScore: healthScore,
        portfolioHealthLabel: healthLabel,
        portfolioHealthFactors: healthFactors as unknown as DashboardIntelligence['portfolioHealthFactors'],

        // filled below
        primaryInsight: null as any,
        secondaryInsights: [],
        dataAsOf: now.toISOString(),
      };

      partial.primaryInsight = primaryInsight(partial);
      partial.secondaryInsights = secondaryInsights(partial);

      return partial;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000,
    enabled: !!user,
  });
}
