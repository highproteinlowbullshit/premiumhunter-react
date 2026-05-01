import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePaperMode } from '../context/PaperModeContext';
import { blackScholes, calculatePositionGreeks } from '../lib/blackScholes';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PositionSnapshot {
  id: string;
  ticker: string;
  strategy: 'CSP' | 'CC';
  strike: number;
  expiry: string;
  contracts: number;
  premiumCollected: number; // total dollars (premium × contracts)

  dte: number;
  urgency: 'today' | 'critical' | 'urgent' | 'watch' | 'ok';

  currentPrice: number | null;
  distancePercent: number | null;
  moneyness: 'itm' | 'near' | 'watch' | 'safe' | 'unknown';

  dailyTheta: number | null; // positive = daily income for seller
  delta: number | null; // seller-perspective delta

  openedAt: string | null;
  openedDaysAgo: number | null;

  ivSource: 'live' | 'cached' | 'estimated';
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

  expiringThisWeek: Array<{
    ticker: string;
    strategy: 'CSP' | 'CC';
    strike: number;
    expiry: string;
    dte: number;
    premiumCollected: number;
    contracts: number;
    urgency: 'today' | 'critical' | 'urgent' | 'watch';
  }>;

  positionsNearStrike: Array<{
    ticker: string;
    strategy: 'CSP' | 'CC';
    strike: number;
    currentPrice: number;
    distancePercent: number;
    status: 'itm' | 'near' | 'watch';
  }>;

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

  positions: PositionSnapshot[];
  positionsSummary: {
    itmCount: number;
    nearCount: number;
    urgentExpiryCount: number;
    totalDailyTheta: number;
    avgDelta: number | null;
    avgDTE: number;
  };

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
  return pos.premium_collected * pos.contracts; // assigned
}

function getDefaultIV(ticker: string): number {
  const highIVMap: Record<string, number> = {
    TSLA: 0.65, NVDA: 0.55, AMD: 0.55, MARA: 0.90, COIN: 0.75,
    HOOD: 0.70, PLTR: 0.60, SMCI: 0.80, GME: 0.85, AMC: 0.90,
    RIVN: 0.75, LCID: 0.80, SOFI: 0.65, UPST: 0.80, RBLX: 0.60,
    SPY: 0.18, QQQ: 0.22, IWM: 0.25, AAPL: 0.28, MSFT: 0.28,
    META: 0.40, AMZN: 0.35, GOOGL: 0.30,
  };
  return highIVMap[ticker.toUpperCase()] ?? 0.35;
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
  const today = d.expiringThisWeek.filter(p => p.urgency === 'today');
  if (today.length > 0) {
    return {
      type: 'warning',
      headline: `${today.length} position${today.length > 1 ? 's' : ''} expiring today`,
      detail: `${today.map(p => `${p.ticker} ${p.strategy}`).join(', ')} settle${today.length === 1 ? 's' : ''} today. Check your brokerage after market close.`,
      action: { label: 'View wheel tracker', route: '/wheel' },
    };
  }

  // P2: ITM
  const itm = d.positionsNearStrike.filter(p => p.status === 'itm');
  if (itm.length > 0) {
    return {
      type: 'warning',
      headline: `${itm[0].ticker} is in the money`,
      detail: `${itm[0].ticker} is trading ${itm[0].distancePercent.toFixed(1)}% through your ${itm[0].strategy} strike of $${itm[0].strike}. Assignment is likely if this continues to expiry.`,
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
    return {
      type: 'neutral',
      headline: 'Expiry Friday — monthly options settle today',
      detail: `${d.expiringThisWeek.length} position${d.expiringThisWeek.length !== 1 ? 's' : ''} expire today. Plan your ${monthName} cycle — capital will be available to redeploy.`,
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
  return {
    type: 'neutral',
    headline: d.openPositionCount > 0
      ? `${d.openPositionCount} position${d.openPositionCount > 1 ? 's' : ''} open — all on track`
      : 'Ready to trade — no open positions',
    detail: d.openPositionCount > 0
      ? `Total open premium: ${fmt$(d.totalPremiumAtRisk)}. Next expiry in ${d.expiringThisWeek[0]?.dte ?? '—'} days.`
      : `${d.highIVCount} high-IV opportunities in the screener right now.`,
    action: d.openPositionCount > 0
      ? { label: 'View positions', route: '/wheel' }
      : { label: 'Browse screener', route: '/screener' },
  };
}

// ── Secondary insights ─────────────────────────────────────────────────────────

function secondaryInsights(d: DashboardIntelligence): DashboardIntelligence['secondaryInsights'] {
  const out: DashboardIntelligence['secondaryInsights'] = [];

  const critical = d.expiringThisWeek.filter(p => p.urgency === 'critical' || p.urgency === 'urgent');
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
          .select('premium_collected, closing_price, contracts, status, closed_at')
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
          .select('target')
          .eq('user_id', user!.id)
          .eq('month_key', currentMonthKey)
          .maybeSingle(),

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
      const targetAmount = Number(targetRes.data?.target ?? 0);
      const accountBalance = Number(prefsRes.data?.account_balance ?? 0);

      const ivMap = new Map(ivSnaps.map(s => [s.ticker, s]));
      const openTickers = new Set(open.map(p => p.ticker));

      // ── Per-position IV (sequential — needs open tickers) ──────────────────
      const posIVRes = open.length > 0
        ? await supabase
            .from('iv_snapshots')
            .select('ticker, current_iv, current_price')
            .in('ticker', [...openTickers])
            .eq('snapshot_date', todayStr)
            .eq('calculation_success', true)
        : { data: [] };
      const posIVMap = new Map(
        (posIVRes.data ?? []).map(r => [r.ticker, r])
      );

      // ── Enriched positions ─────────────────────────────────────────────────
      const urgencyOrder = { today: 0, critical: 1, urgent: 2, watch: 3, ok: 4 };
      const positions: PositionSnapshot[] = open
        .map(pos => {
          const dte = Math.ceil((new Date(pos.expiry as string).getTime() - now.getTime()) / 86400000);
          const urgency: PositionSnapshot['urgency'] =
            dte <= 0 ? 'today' : dte <= 2 ? 'critical' : dte <= 6 ? 'urgent' : dte <= 7 ? 'watch' : 'ok';

          const posIV = posIVMap.get(pos.ticker as string);
          const screenIV = ivMap.get(pos.ticker as string);
          const currentPrice = posIV?.current_price
            ? Number(posIV.current_price)
            : screenIV?.current_price
            ? Number(screenIV.current_price)
            : null;

          const rawIV = posIV?.current_iv ? Number(posIV.current_iv) : null;
          const ivValue = rawIV ?? getDefaultIV(pos.ticker as string);
          const ivSource: PositionSnapshot['ivSource'] = rawIV
            ? (posIV?.current_iv ? 'cached' : 'estimated')
            : 'estimated';

          const strike = Number(pos.strike);

          let distancePercent: number | null = null;
          let moneyness: PositionSnapshot['moneyness'] = 'unknown';
          let dailyTheta: number | null = null;
          let delta: number | null = null;

          if (currentPrice !== null && currentPrice > 0) {
            const distPct = Math.abs((currentPrice - strike) / currentPrice) * 100;
            distancePercent = Math.round(distPct * 10) / 10;
            const isITM = (pos.strategy as string) === 'CSP' ? currentPrice < strike : currentPrice > strike;
            moneyness = isITM ? 'itm' : distPct < 3 ? 'near' : distPct < 8 ? 'watch' : 'safe';

            if (dte > 0) {
              try {
                const greeks = calculatePositionGreeks({
                  positionId: pos.id as string,
                  ticker: pos.ticker as string,
                  strategy: pos.strategy as 'CSP' | 'CC',
                  strike,
                  expiry: pos.expiry as string,
                  contracts: Number(pos.contracts),
                  currentPrice,
                  impliedVolatility: ivValue,
                  ivSource: 'supabase_cache',
                });
                dailyTheta = Math.round(greeks.dollarThetaToday * 100) / 100;
                delta = Math.round(greeks.sellerDelta * 1000) / 1000;
              } catch {
                // BS may fail near expiry or with edge inputs
              }
            }
          }

          const openedAt = (pos.opened_at as string | null) ?? null;
          const openedDaysAgo = openedAt
            ? Math.floor((now.getTime() - new Date(openedAt).getTime()) / 86400000)
            : null;

          return {
            id: pos.id as string,
            ticker: pos.ticker as string,
            strategy: pos.strategy as 'CSP' | 'CC',
            strike,
            expiry: pos.expiry as string,
            contracts: Number(pos.contracts),
            premiumCollected: Number(pos.premium_collected) * Number(pos.contracts),
            dte,
            urgency,
            currentPrice,
            distancePercent,
            moneyness,
            dailyTheta,
            delta,
            openedAt,
            openedDaysAgo,
            ivSource,
          } satisfies PositionSnapshot;
        })
        .sort((a, b) =>
          urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]
            ? urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
            : a.dte - b.dte
        );

      // ── Derived expiring / near-strike arrays (consumed by insight fns) ────
      const expiringThisWeek = positions
        .filter(p => p.urgency !== 'ok')
        .map(p => ({
          ticker: p.ticker,
          strategy: p.strategy,
          strike: p.strike,
          expiry: p.expiry,
          dte: p.dte,
          premiumCollected: p.premiumCollected,
          contracts: p.contracts,
          urgency: p.urgency as 'today' | 'critical' | 'urgent' | 'watch',
        })) as DashboardIntelligence['expiringThisWeek'];

      const positionsNearStrike = positions
        .filter(p => p.moneyness !== 'safe' && p.moneyness !== 'unknown' && p.currentPrice !== null)
        .map(p => ({
          ticker: p.ticker,
          strategy: p.strategy,
          strike: p.strike,
          currentPrice: p.currentPrice!,
          distancePercent: p.distancePercent ?? 0,
          status: p.moneyness as 'itm' | 'near' | 'watch',
        })) as DashboardIntelligence['positionsNearStrike'];

      // ── Positions summary ──────────────────────────────────────────────────
      const itmPositions = positions.filter(p => p.moneyness === 'itm');
      const nearPositions = positions.filter(p => p.moneyness === 'near');
      const urgentPositions = positions.filter(p => p.urgency === 'today' || p.urgency === 'critical' || p.urgency === 'urgent');
      const thetaPositions = positions.filter(p => p.dailyTheta !== null);
      const deltaPositions = positions.filter(p => p.delta !== null);
      const totalDailyTheta = thetaPositions.reduce((s, p) => s + p.dailyTheta!, 0);
      const avgDelta = deltaPositions.length > 0
        ? deltaPositions.reduce((s, p) => s + p.delta!, 0) / deltaPositions.length
        : null;
      const avgDTE = positions.length > 0
        ? Math.round(positions.reduce((s, p) => s + p.dte, 0) / positions.length)
        : 0;

      const positionsSummary: DashboardIntelligence['positionsSummary'] = {
        itmCount: itmPositions.length,
        nearCount: nearPositions.length,
        urgentExpiryCount: urgentPositions.length,
        totalDailyTheta: Math.round(totalDailyTheta * 100) / 100,
        avgDelta: avgDelta !== null ? Math.round(avgDelta * 1000) / 1000 : null,
        avgDTE,
      };

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

      // ── Milestones ─────────────────────────────────────────────────────────
      const seenRaw = localStorage.getItem('ph_milestones') ?? '[]';
      const seen: string[] = JSON.parse(seenRaw);

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

      const topRaw = ivSnaps.find(s => !openTickers.has(s.ticker) && (s.iv_rank ?? 0) >= 50);
      const topOpportunity: DashboardIntelligence['topOpportunity'] = topRaw
        ? (() => {
            const iv = (topRaw.current_hv ?? 0.4) / 100;
            const price = topRaw.current_price ?? 50;
            const dte = 30;
            const premium = price * Math.max(iv, 0.2) * Math.sqrt(dte / 365) * 0.4;
            const strike = price * (1 - Math.max(iv, 0.2) * Math.sqrt(dte / 365) * 0.5);
            const ann = strike > 0 ? (premium / strike) * (365 / dte) * 100 : 0;
            return {
              ticker: topRaw.ticker,
              ivRank: topRaw.iv_rank ?? 0,
              ivTrend: 'elevated',
              estimatedPremium: Math.round(premium * 100) / 100,
              annualisedReturn: Math.round(ann * 10) / 10,
              sector: 'Unknown',
            };
          })()
        : null;

      // ── Watchlist ──────────────────────────────────────────────────────────
      const wlTickers = new Set(watchlist.map(w => w.ticker));
      const wlIV = ivSnaps.filter(s => wlTickers.has(s.ticker));
      const wlHighIV = wlIV.filter(s => (s.iv_rank ?? 0) >= 50);
      const bestWL = wlIV[0];

      // ── Health score ───────────────────────────────────────────────────────
      const dangerEarnings = 0; // no earnings data available here
      const healthFactors = calcHealth(
        capitalEfficiency,
        atWinRate,
        positionsNearStrike.filter(p => p.status === 'itm').length,
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
        expiringThisWeek,
        positionsNearStrike,

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
          hitTarget: targetAmount > 0 && lmPremium >= targetAmount,
        } : null,
        momChange,
        momTrend: momChange === null ? null : momChange > 5 ? 'up' : momChange < -5 ? 'down' : 'flat',

        currentWinStreak: currentStreak,
        longestWinStreak: longestStreak,
        consecutiveProfitableMonths: 0,
        totalPremiumAllTime: Math.round(atPremium * 100) / 100,
        totalTradesAllTime: allTime.length,
        allTimeWinRate: atWinRate,
        milestones,

        highIVCount: highIV.length,
        surgingIVCount: surging.length,
        topOpportunity,
        earningsThisWeek: [],

        watchlistCount: watchlist.length,
        watchlistHighIV: wlHighIV.length,
        watchlistBestOpportunity: bestWL
          ? { ticker: bestWL.ticker, ivRank: bestWL.iv_rank ?? 0, ivTrend: 'elevated' }
          : null,

        positions,
        positionsSummary,

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
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: 10 * 60 * 1000,
    enabled: !!user,
  });
}
