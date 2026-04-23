import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePaperMode } from '../context/PaperModeContext';

export interface MonthlyTargetProgress {
  target: number | null;
  earned: number;
  progressPercent: number;
  tradingDaysLeft: number;
  tradingDaysTotal: number;
  tradingDaysElapsed: number;
  dailyPaceNeeded: number | null;
  isOnPace: boolean;
  lastMonthMissed: boolean;
  lastMonthShortfall: number;
  lastMonthTarget: number | null;
  lastMonthEarned: number;
  streak: number;
  currentMonth: string;
  currentMonthKey: string;
  lastMonthKey: string;
}

function countTradingDays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start.getTime());
  d.setHours(0, 0, 0, 0);
  const e = new Date(end.getTime());
  e.setHours(23, 59, 59, 999);
  while (d <= e) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function calcPnl(pos: {
  status: string;
  premium_collected: number;
  closing_price: number | null;
  contracts: number;
}): number {
  // No ×100: DB stores dollar amount per contract (same pattern as useMonthlyPnL.ts)
  if (pos.status === 'expired') return pos.premium_collected * pos.contracts;
  if (pos.closing_price !== null) return (pos.premium_collected - pos.closing_price) * pos.contracts;
  return pos.premium_collected * pos.contracts; // assigned
}

export function useMonthlyTarget() {
  const { user } = useAuth();
  const { isPaperMode } = usePaperMode();
  const queryClient = useQueryClient();

  const now = new Date();
  const nowUTCYear = now.getUTCFullYear();
  const nowUTCMonth = now.getUTCMonth(); // 0-indexed
  const currentMonthKey = `${nowUTCYear}-${String(nowUTCMonth + 1).padStart(2, '0')}`;

  let lmYear = nowUTCYear;
  let lmMonth = nowUTCMonth - 1;
  if (lmMonth < 0) { lmMonth = 11; lmYear--; }
  const lastMonthKey = `${lmYear}-${String(lmMonth + 1).padStart(2, '0')}`;

  const positionsTable = isPaperMode ? 'paper_positions' : 'wheel_positions';
  const qKey = ['monthly-target', user?.id, isPaperMode] as const;

  const { data: progress, isLoading } = useQuery({
    queryKey: qKey,
    queryFn: async (): Promise<MonthlyTargetProgress> => {
      // Fetch up to 13 months of targets for streak calculation
      const { data: targetRows } = await supabase
        .from('monthly_income_targets')
        .select('month_key, target')
        .eq('user_id', user!.id)
        .order('month_key', { ascending: false })
        .limit(13);

      const targetMap = new Map<string, number>(
        (targetRows ?? []).map((r: { month_key: string; target: number }) => [r.month_key, Number(r.target)])
      );

      // Fetch 13 months of closed positions
      const thirteenMonthsAgo = new Date(Date.UTC(nowUTCYear, nowUTCMonth - 12, 1));
      const { data: posRows } = await supabase
        .from(positionsTable)
        .select('premium_collected, closing_price, contracts, closed_at, expiry, status')
        .eq('user_id', user!.id)
        .in('status', ['closed', 'assigned', 'expired'])
        .gte('closed_at', thirteenMonthsAgo.toISOString());

      // Bucket realized P&L by month
      const earnedByMonth = new Map<string, number>();
      for (const pos of posRows ?? []) {
        const d = (pos.closed_at ?? pos.expiry) as string | null;
        if (!d) continue;
        const mk = d.slice(0, 7);
        earnedByMonth.set(mk, Math.round(((earnedByMonth.get(mk) ?? 0) + calcPnl(pos)) * 100) / 100);
      }

      const currentEarned = earnedByMonth.get(currentMonthKey) ?? 0;
      const lastMonthEarned = earnedByMonth.get(lastMonthKey) ?? 0;
      const currentTarget = targetMap.get(currentMonthKey) ?? null;
      const lastMonthTarget = targetMap.get(lastMonthKey) ?? null;

      // Trading days for current month
      const monthStart = new Date(Date.UTC(nowUTCYear, nowUTCMonth, 1));
      const monthEnd = new Date(Date.UTC(nowUTCYear, nowUTCMonth + 1, 0)); // last day
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const tradingDaysTotal = countTradingDays(monthStart, monthEnd);
      const tradingDaysElapsed = countTradingDays(monthStart, today);
      const tradingDaysLeft = tradingDaysTotal - tradingDaysElapsed;

      const progressPercent = currentTarget && currentTarget > 0
        ? Math.round((currentEarned / currentTarget) * 1000) / 10
        : 0;

      const dailyPaceNeeded = currentTarget !== null && tradingDaysLeft > 0
        ? Math.round(((currentTarget - currentEarned) / tradingDaysLeft) * 100) / 100
        : null;

      const expectedByNow = currentTarget && tradingDaysTotal > 0
        ? (currentTarget / tradingDaysTotal) * tradingDaysElapsed
        : 0;
      const isOnPace = currentTarget ? currentEarned >= expectedByNow : true;

      const lastMonthMissed = lastMonthTarget !== null && lastMonthEarned < lastMonthTarget;
      const lastMonthShortfall = lastMonthMissed
        ? Math.round((lastMonthTarget! - lastMonthEarned) * 100) / 100
        : 0;

      // Streak: consecutive complete months (before current) where earned >= target
      let streak = 0;
      const checkDate = new Date(Date.UTC(lmYear, lmMonth, 1));
      for (let i = 0; i < 12; i++) {
        const y = checkDate.getUTCFullYear();
        const m = checkDate.getUTCMonth();
        const mk = `${y}-${String(m + 1).padStart(2, '0')}`;
        const t = targetMap.get(mk);
        const e = earnedByMonth.get(mk) ?? 0;
        if (t === undefined || e < t) break;
        streak++;
        checkDate.setUTCMonth(checkDate.getUTCMonth() - 1);
      }

      return {
        target: currentTarget,
        earned: currentEarned,
        progressPercent,
        tradingDaysLeft,
        tradingDaysTotal,
        tradingDaysElapsed,
        dailyPaceNeeded,
        isOnPace,
        lastMonthMissed,
        lastMonthShortfall,
        lastMonthTarget,
        lastMonthEarned,
        streak,
        currentMonth: new Date(Date.UTC(nowUTCYear, nowUTCMonth, 1))
          .toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        currentMonthKey,
        lastMonthKey,
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!user,
  });

  const setTargetMutation = useMutation({
    mutationFn: async ({ monthKey, amount }: { monthKey: string; amount: number }) => {
      const { error } = await supabase
        .from('monthly_income_targets')
        .upsert(
          { user_id: user!.id, month_key: monthKey, target: amount },
          { onConflict: 'user_id,month_key' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['monthly-target'] });
    },
  });

  return {
    progress,
    isLoading,
    setTarget: (amount: number, monthKey = currentMonthKey) =>
      setTargetMutation.mutateAsync({ monthKey, amount }),
    isSetting: setTargetMutation.isPending,
    currentMonthKey,
    lastMonthKey,
  };
}
