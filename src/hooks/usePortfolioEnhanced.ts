import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { fetchAndCacheSPYData, calculateBenchmarkComparison, type BenchmarkComparison } from '../lib/spyBenchmark';

export type EnhancedTimeRange = '1M' | '3M' | '6M' | '1Y' | 'all';

export interface MonthlyAttribution {
  month: string;
  monthKey: string;
  premiumIncome: number;
  capitalGains: number;
  total: number;
}

export interface PnLAttribution {
  totalPremiumIncome: number;
  cspPremiumIncome: number;
  ccPremiumIncome: number;
  premiumFromAssignedCSPs: number;
  totalRealizedGains: number;
  totalRealizedPnL: number;
  premiumAsPercentOfTotal: number;
  capitalGainsAsPercentOfTotal: number;
  monthlyAttribution: MonthlyAttribution[];
}

export interface AssignedLotCC {
  strike: number;
  expiry: string;
  premium: number;
  dte: number;
}

export interface AssignedLotPremiumEvent {
  type: 'csp_premium' | 'cc_premium';
  amount: number;
  date: string;
}

export interface AssignedLot {
  id: string;
  ticker: string;
  shares: number;
  contracts: number;
  assignmentDate: string;
  assignmentStrike: number;
  grossCostBasis: number;
  totalPremiumCollected: number;
  netCostBasis: number;
  costBasisPerShare: number;
  status: 'holding' | 'called_away' | 'sold_manually';
  currentPrice: number | null;
  currentValue: number | null;
  unrealizedGain: number | null;
  unrealizedGainVsTrueCost: number | null;
  unrealizedGainPercent: number | null;
  currentCC: AssignedLotCC | null;
  premiumEvents: AssignedLotPremiumEvent[];
  projectedFinalCostBasis: number;
  breakEvenPrice: number;
  percentageRecovered: number;
  exitDate: string | null;
  exitPrice: number | null;
  realizedCapitalGain: number | null;
  totalLotReturn: number | null;
  lotAnnualisedReturn: number | null;
}

export interface PortfolioEnhancedData {
  benchmark: BenchmarkComparison | null;
  attribution: PnLAttribution;
  assignedLots: AssignedLot[];
  activeLots: AssignedLot[];
  closedLots: AssignedLot[];
  hasAnyLots: boolean;
  totalLotsPremiumCollected: number;
  totalLotsCapitalGains: number;
  orphanedAssignments: number;
}

const RANGE_MS: Record<EnhancedTimeRange, number> = {
  '1M': 30, '3M': 90, '6M': 180, '1Y': 365, 'all': 730,
};

export function usePortfolioEnhanced(timeRange: EnhancedTimeRange) {
  const { user } = useAuth();
  const polygonKey = import.meta.env.VITE_POLYGON_API_KEY as string | undefined;

  return useQuery({
    queryKey: ['portfolio-enhanced', user?.id, timeRange],
    queryFn: async (): Promise<PortfolioEnhancedData> => {
      const today = new Date();
      const fromDate = new Date(today.getTime() - RANGE_MS[timeRange] * 86_400_000)
        .toISOString().split('T')[0];

      const [
        snapshotsResult,
        closedResult,
        lotsResult,
        openCCsResult,
        spyMap,
      ] = await Promise.all([
        supabase
          .from('portfolio_snapshots')
          .select('snapshot_date, total_value')
          .eq('user_id', user!.id)
          .gte('snapshot_date', fromDate)
          .order('snapshot_date', { ascending: true }),
        supabase
          .from('wheel_positions')
          .select('ticker, strategy, premium_collected, closing_price, contracts, status, closed_at, opened_at, expiry')
          .eq('user_id', user!.id)
          .in('status', ['closed', 'expired', 'assigned'])
          .order('closed_at', { ascending: false })
          .limit(500),
        supabase
          .from('assigned_share_lots')
          .select(`
            id, ticker, shares, contracts, assignment_date, assignment_strike,
            gross_cost_basis, total_premium_collected, net_cost_basis, cost_basis_per_share,
            status, exit_date, exit_price, realized_capital_gain, total_lot_return,
            lot_premium_events ( event_type, premium_amount, event_date )
          `)
          .eq('user_id', user!.id)
          .order('assignment_date', { ascending: false }),
        supabase
          .from('wheel_positions')
          .select('id, ticker, strike, expiry, premium_collected')
          .eq('user_id', user!.id)
          .eq('status', 'open')
          .eq('strategy', 'CC'),
        fetchAndCacheSPYData(fromDate, polygonKey),
      ]);

      // ── Benchmark ────────────────────────────────────────────────────────────
      const snapshots = (snapshotsResult.data ?? []).map(s => ({
        snapshot_date: s.snapshot_date as string,
        total_value: Number(s.total_value),
      }));
      const benchmark = calculateBenchmarkComparison(snapshots, spyMap);

      // ── P&L Attribution ──────────────────────────────────────────────────────
      // No ×100: DB stores dollar amount per contract (same as useMonthlyPnL.ts)
      const closed = closedResult.data ?? [];
      let cspPremium = 0, ccPremium = 0, assignmentPremium = 0;

      const monthMap = new Map<string, { premium: number; gains: number }>();

      closed.forEach((pos: any) => {
        const collected = Number(pos.premium_collected) * Number(pos.contracts);
        const buyback = pos.closing_price !== null
          ? Number(pos.closing_price) * Number(pos.contracts)
          : 0;
        const net = collected - buyback;

        if (pos.strategy === 'CSP') {
          if (pos.status === 'assigned') {
            assignmentPremium += collected;
          } else {
            cspPremium += net;
          }
        } else if (pos.strategy === 'CC') {
          ccPremium += net;
        }

        // Expired positions sometimes have null closed_at (pre-migration records);
        // fall back to expiry date so their premium appears in the right month.
        const d = (pos.closed_at as string | null) ?? (pos.status === 'expired' ? (pos.expiry as string | null) : null);
        if (d) {
          const mk = d.slice(0, 7);
          if (!monthMap.has(mk)) monthMap.set(mk, { premium: 0, gains: 0 });
          monthMap.get(mk)!.premium += net;
        }
      });

      const lots = (lotsResult.data ?? []) as any[];
      let totalGains = 0;
      lots.forEach(lot => {
        if (lot.realized_capital_gain != null && lot.exit_date) {
          const gain = Number(lot.realized_capital_gain);
          totalGains += gain;
          const mk = (lot.exit_date as string).slice(0, 7);
          if (!monthMap.has(mk)) monthMap.set(mk, { premium: 0, gains: 0 });
          monthMap.get(mk)!.gains += gain;
        }
      });

      // assignmentPremium is premium income — include it so the % split is premium vs capital gains only
      const totalPremiumIncome = cspPremium + ccPremium + assignmentPremium;
      const totalRealizedPnL = totalPremiumIncome + totalGains;
      const premiumPct = totalRealizedPnL > 0
        ? Math.round((totalPremiumIncome / totalRealizedPnL) * 1000) / 10
        : 100;

      const monthlyAttribution: MonthlyAttribution[] = Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mk, d]) => ({
          month: new Date(mk + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          monthKey: mk,
          premiumIncome: Math.round(d.premium * 100) / 100,
          capitalGains: Math.round(d.gains * 100) / 100,
          total: Math.round((d.premium + d.gains) * 100) / 100,
        }));

      const attribution: PnLAttribution = {
        totalPremiumIncome: Math.round(totalPremiumIncome * 100) / 100,
        cspPremiumIncome: Math.round(cspPremium * 100) / 100,
        ccPremiumIncome: Math.round(ccPremium * 100) / 100,
        premiumFromAssignedCSPs: Math.round(assignmentPremium * 100) / 100,
        totalRealizedGains: Math.round(totalGains * 100) / 100,
        totalRealizedPnL: Math.round(totalRealizedPnL * 100) / 100,
        premiumAsPercentOfTotal: premiumPct,
        capitalGainsAsPercentOfTotal: Math.round((100 - premiumPct) * 10) / 10,
        monthlyAttribution,
      };

      // ── Assigned lots enrichment ──────────────────────────────────────────────
      const lotTickers = [...new Set(lots.map(l => l.ticker as string))];

      // Get latest prices (most recent iv_snapshot per ticker, last 7 days only)
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0];
      const priceMap = new Map<string, number>();
      if (lotTickers.length > 0) {
        const { data: priceRows } = await supabase
          .from('iv_snapshots')
          .select('ticker, current_price, snapshot_date')
          .in('ticker', lotTickers)
          .eq('calculation_success', true)
          .gte('snapshot_date', sevenDaysAgo)
          .order('snapshot_date', { ascending: false })
          .limit(lotTickers.length * 3);

        for (const row of priceRows ?? []) {
          if (!priceMap.has(row.ticker) && row.current_price) {
            priceMap.set(row.ticker, Number(row.current_price));
          }
        }
      }

      // Accumulate total premium_collected per ticker across all open CCs
      // (a user may have multiple CCs on the same ticker from different lots)
      const ccMap = new Map<string, number>();
      for (const cc of openCCsResult.data ?? []) {
        ccMap.set(cc.ticker, (ccMap.get(cc.ticker) ?? 0) + Number(cc.premium_collected));
      }

      const assignedLots: AssignedLot[] = lots.map(lot => {
        const totalShares = Number(lot.shares) * Number(lot.contracts);
        const currentPrice = priceMap.get(lot.ticker) ?? null;
        const currentValue = currentPrice ? currentPrice * totalShares : null;
        const gross = Number(lot.gross_cost_basis);
        const net = Number(lot.net_cost_basis);
        const totalPremium = Number(lot.total_premium_collected);

        const unrealizedGain = currentValue !== null ? currentValue - gross : null;
        const unrealizedGainVsTrueCost = currentValue !== null ? currentValue - net : null;
        const unrealizedGainPercent = unrealizedGainVsTrueCost !== null && net > 0
          ? Math.round((unrealizedGainVsTrueCost / net) * 1000) / 10
          : null;

        const currentCC = openCCsResult.data?.find(cc => cc.ticker === lot.ticker) ?? null;
        const ccPremiumPerContract = ccMap.get(lot.ticker) ?? 0;
        const projectedFinalCostBasis = ccPremiumPerContract > 0
          ? net - ccPremiumPerContract * Number(lot.contracts)
          : net;

        const percentRecovered = gross > 0
          ? Math.round((totalPremium / gross) * 1000) / 10
          : 0;

        const premiumEvents: AssignedLotPremiumEvent[] = (lot.lot_premium_events ?? []).map((e: any) => ({
          type: e.event_type as 'csp_premium' | 'cc_premium',
          amount: Number(e.premium_amount),
          date: e.event_date as string,
        }));

        let lotAnnualisedReturn: number | null = null;
        if (lot.status !== 'holding' && lot.exit_date && lot.total_lot_return) {
          const daysHeld = Math.ceil(
            (new Date(lot.exit_date).getTime() - new Date(lot.assignment_date).getTime()) / 86_400_000
          );
          if (daysHeld > 0 && gross > 0) {
            const r = Number(lot.total_lot_return) / gross;
            lotAnnualisedReturn = Math.round(r * (365 / daysHeld) * 1000) / 10;
          }
        }

        return {
          id: lot.id as string,
          ticker: lot.ticker as string,
          shares: Number(lot.shares),
          contracts: Number(lot.contracts),
          assignmentDate: lot.assignment_date as string,
          assignmentStrike: Number(lot.assignment_strike),
          grossCostBasis: gross,
          totalPremiumCollected: totalPremium,
          netCostBasis: net,
          costBasisPerShare: Number(lot.cost_basis_per_share),
          status: lot.status as 'holding' | 'called_away' | 'sold_manually',
          currentPrice,
          currentValue,
          unrealizedGain,
          unrealizedGainVsTrueCost,
          unrealizedGainPercent,
          currentCC: currentCC ? {
            strike: Number(currentCC.strike),
            expiry: currentCC.expiry as string,
            premium: Number(currentCC.premium_collected),
            dte: Math.max(0, Math.ceil((new Date(currentCC.expiry).getTime() - Date.now()) / 86_400_000)),
          } : null,
          premiumEvents,
          projectedFinalCostBasis: Math.round(projectedFinalCostBasis * 100) / 100,
          breakEvenPrice: Number(lot.cost_basis_per_share),
          percentageRecovered: percentRecovered,
          exitDate: lot.exit_date ?? null,
          exitPrice: lot.exit_price != null ? Number(lot.exit_price) : null,
          realizedCapitalGain: lot.realized_capital_gain != null ? Number(lot.realized_capital_gain) : null,
          totalLotReturn: lot.total_lot_return != null ? Number(lot.total_lot_return) : null,
          lotAnnualisedReturn,
        };
      });

      // ── Count orphaned assignments (existing assigned positions without lots) ─
      const existingLotTickers = new Set(lots.map(l => l.ticker + '|' + l.assignment_date));
      const orphanedAssignments = closed.filter((pos: any) => {
        if (pos.status !== 'assigned') return false;
        const rawTs = pos.closed_at ?? pos.opened_at ?? '';
        // Use local-time date (sv-SE locale gives YYYY-MM-DD) to match assignment_date
        // which is a date column stored in the user's trading day, not UTC.
        const localDate = rawTs ? new Date(rawTs).toLocaleDateString('sv-SE') : rawTs.split('T')[0];
        const key = pos.ticker + '|' + localDate;
        return !existingLotTickers.has(key);
      }).length;

      const activeLots = assignedLots.filter(l => l.status === 'holding');
      const closedLots = assignedLots.filter(l => l.status !== 'holding');

      return {
        benchmark,
        attribution,
        assignedLots,
        activeLots,
        closedLots,
        hasAnyLots: assignedLots.length > 0,
        totalLotsPremiumCollected: Math.round(
          assignedLots.reduce((s, l) => s + l.totalPremiumCollected, 0) * 100
        ) / 100,
        totalLotsCapitalGains: Math.round(
          closedLots.reduce((s, l) => s + (l.realizedCapitalGain ?? 0), 0) * 100
        ) / 100,
        orphanedAssignments,
      };
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!user,
  });
}
