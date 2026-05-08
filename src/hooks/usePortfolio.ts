import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getQuote } from '../lib/finnhub';
import { getIVData } from '../lib/polygon';
import { blackScholes, yearsToExpiry, estimateVolatility } from '../lib/blackScholes';
import type { PortfolioHolding, PortfolioSnapshot, HoldingType } from '../types';

// DB row types (snake_case from Supabase)
interface DbHolding {
  id: string;
  user_id: string;
  ticker: string;
  holding_type: string;
  quantity: string;
  avg_cost: string;
  closing_price: string | null;
  expiry: string | null;
  strike: string | null;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
  status: string;
}

interface DbSnapshot {
  id: string;
  snapshot_date: string;
  total_value: string;
  total_cost: string;
  unrealized_pnl: string;
  realized_pnl: string;
  options_premium: string;
}

interface DbWheelPosition {
  premium_collected: string;
  contracts: number;
  closing_price: string | null;
}

function dbToHolding(row: DbHolding): PortfolioHolding {
  return {
    id: row.id,
    ticker: row.ticker,
    holdingType: row.holding_type as HoldingType,
    quantity: Number(row.quantity),
    avgCost: Number(row.avg_cost),
    closingPrice: row.closing_price != null ? Number(row.closing_price) : undefined,
    expiry: row.expiry ?? undefined,
    strike: row.strike != null ? Number(row.strike) : undefined,
    notes: row.notes ?? undefined,
    openedAt: row.opened_at.split('T')[0],
    closedAt: row.closed_at ? row.closed_at.split('T')[0] : undefined,
    status: row.status as 'open' | 'closed',
  };
}

function dbToSnapshot(row: DbSnapshot): PortfolioSnapshot {
  return {
    id: row.id,
    snapshotDate: row.snapshot_date,
    totalValue: Number(row.total_value),
    totalCost: Number(row.total_cost),
    unrealizedPnl: Number(row.unrealized_pnl),
    realizedPnl: Number(row.realized_pnl),
    optionsPremium: Number(row.options_premium),
  };
}

export interface HoldingWithPrice extends PortfolioHolding {
  currentPrice: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPct: number | null;
}

export type AddHoldingData = {
  ticker: string;
  holdingType: HoldingType;
  quantity: number;
  avgCost: number;
  openedAt: string;
  expiry?: string;
  strike?: number;
  notes?: string;
};

interface PortfolioQueryResult {
  holdingsWithPrice: HoldingWithPrice[];
  openHoldings: PortfolioHolding[];
  snapshots: PortfolioSnapshot[];
  totalValue: number;
  totalCost: number;
  unrealizedPnl: number;
  realizedPnl: number;
  optionsPremium: number;
}

// ── Pure fetch function (no setState, returns data) ───────────────────────────
async function fetchPortfolioData(userId: string): Promise<PortfolioQueryResult> {
  const [holdingsRes, snapshotsRes, closedRes, wheelRes] = await Promise.allSettled([
    supabase
      .from('portfolio_holdings')
      .select('id, holding_type, ticker, quantity, avg_cost, closing_price, expiry, strike, notes, opened_at, closed_at, status')
      .eq('user_id', userId)
      .eq('status', 'open')
      .order('ticker', { ascending: true }),
    supabase
      .from('portfolio_snapshots')
      .select('id, snapshot_date, total_value, total_cost, unrealized_pnl, realized_pnl, options_premium')
      .eq('user_id', userId)
      .order('snapshot_date', { ascending: true }),
    supabase
      .from('portfolio_holdings')
      .select('id, holding_type, ticker, quantity, avg_cost, closing_price, expiry, strike, notes, opened_at, closed_at, status')
      .eq('user_id', userId)
      .eq('status', 'closed'),
    supabase
      .from('wheel_positions')
      .select('premium_collected, contracts, closing_price')
      .eq('user_id', userId)
      .eq('status', 'closed'),
  ]);

  // Open holdings
  let holdings: PortfolioHolding[] = [];
  if (holdingsRes.status === 'fulfilled' && !holdingsRes.value.error && holdingsRes.value.data) {
    holdings = (holdingsRes.value.data as DbHolding[]).map(dbToHolding);
  }

  // Snapshots
  let snapshotList: PortfolioSnapshot[] = [];
  if (snapshotsRes.status === 'fulfilled' && !snapshotsRes.value.error && snapshotsRes.value.data) {
    snapshotList = (snapshotsRes.value.data as DbSnapshot[]).map(dbToSnapshot);
  }

  // Realized P&L from closed holdings
  let computedRealizedPnl = 0;
  if (closedRes.status === 'fulfilled' && !closedRes.value.error && closedRes.value.data) {
    const closed = (closedRes.value.data as DbHolding[]).map(dbToHolding);
    computedRealizedPnl = closed.reduce((acc, h) => {
      if (h.closingPrice != null) {
        return acc + (h.closingPrice - h.avgCost) * h.quantity;
      }
      return acc;
    }, 0);
  }

  // Net wheel premium P&L
  let computedPremium = 0;
  if (wheelRes.status === 'fulfilled' && !wheelRes.value.error && wheelRes.value.data) {
    const wheelPositions = wheelRes.value.data as DbWheelPosition[];
    computedPremium = wheelPositions.reduce((acc, p) => {
      const premium = Number(p.premium_collected);
      const btcCost = p.closing_price != null ? Number(p.closing_price) : 0;
      return acc + (premium - btcCost) * p.contracts;
    }, 0);
    computedRealizedPnl += computedPremium;
  }

  if (holdings.length === 0) {
    return {
      holdingsWithPrice: [],
      openHoldings: [],
      snapshots: snapshotList,
      totalValue: 0,
      totalCost: 0,
      unrealizedPnl: 0,
      realizedPnl: computedRealizedPnl,
      optionsPremium: computedPremium,
    };
  }

  // Fetch prices — primary source: iv_snapshots (same DB, reliable nightly data).
  // Fallback to Finnhub only for tickers absent from the screener universe.
  const nonCashHoldings = holdings.filter((h) => h.holdingType !== 'cash');
  const uniqueTickers = [...new Set(nonCashHoldings.map((h) => h.ticker))];
  const leapsTickers = [...new Set(
    nonCashHoldings
      .filter((h) => (h.holdingType === 'leaps_call' || h.holdingType === 'leaps_put') && h.strike != null && h.expiry)
      .map((h) => h.ticker)
  )];

  // iv_snapshots covers all 488 screener tickers with prices from the nightly cron.
  // Query the last 3 days so weekends/holidays don't cause a fallback to Finnhub.
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString().split('T')[0];
  const [snapshotPriceResult, ivResults] = await Promise.all([
    uniqueTickers.length > 0
      ? supabase
          .from('iv_snapshots')
          .select('ticker, current_price')
          .in('ticker', uniqueTickers)
          .gte('snapshot_date', threeDaysAgo)
          .eq('calculation_success', true)
          .order('snapshot_date', { ascending: false })
      : Promise.resolve({ data: [] as Array<{ ticker: string; current_price: number | null }>, error: null }),
    Promise.allSettled(leapsTickers.map((t) => getIVData(t))),
  ]);

  // Build priceMap: first seen per ticker = most recent (ordered desc by date)
  const priceMap = new Map<string, { price: number | null; priceChangePct: number | null }>();
  if (!snapshotPriceResult.error && snapshotPriceResult.data) {
    for (const row of snapshotPriceResult.data as Array<{ ticker: string; current_price: number | null }>) {
      if (!priceMap.has(row.ticker)) {
        priceMap.set(row.ticker, { price: row.current_price != null ? Number(row.current_price) : null, priceChangePct: null });
      }
    }
  }

  // Finnhub fallback for tickers absent from iv_snapshots OR whose price resolved to null
  const missingTickers = uniqueTickers.filter((t) => {
    const entry = priceMap.get(t);
    return !entry || entry.price == null;
  });
  if (missingTickers.length > 0) {
    const quoteResults = await Promise.allSettled(missingTickers.map((t) => getQuote(t)));
    missingTickers.forEach((ticker, i) => {
      const r = quoteResults[i];
      if (r.status === 'fulfilled') {
        const q = r.value;
        const price = q.c > 0 ? q.c : (q.pc > 0 ? q.pc : null);
        priceMap.set(ticker, { price, priceChangePct: q.dp ?? null });
      } else {
        priceMap.set(ticker, { price: null, priceChangePct: null });
      }
    });
  }

  const volMap = new Map<string, number>();
  leapsTickers.forEach((ticker, i) => {
    const r = ivResults[i];
    const vol =
      r.status === 'fulfilled' && r.value.currentHV > 0
        ? r.value.currentHV / 100
        : estimateVolatility(ticker);
    volMap.set(ticker, vol);
  });

  const holdingCostBasis = (h: HoldingWithPrice) =>
    (h.holdingType === 'leaps_call' || h.holdingType === 'leaps_put') && h.strike != null && h.expiry != null
      ? h.avgCost * h.quantity * 100
      : h.avgCost * h.quantity;

  const enriched: HoldingWithPrice[] = holdings.map((h) => {
    if (h.holdingType === 'cash') {
      return { ...h, currentPrice: 1, marketValue: h.quantity, unrealizedPnl: 0, unrealizedPnlPct: 0 };
    }

    const isLeaps =
      (h.holdingType === 'leaps_call' || h.holdingType === 'leaps_put') &&
      h.strike != null &&
      h.expiry != null;

    const spotPrice = priceMap.get(h.ticker)?.price ?? null;

    if (isLeaps && spotPrice != null && h.strike != null && h.expiry != null) {
      const T = yearsToExpiry(h.expiry);
      const vol = volMap.get(h.ticker) ?? estimateVolatility(h.ticker);
      const bsResult = T > 0
        ? blackScholes({
            spotPrice,
            strikePrice: h.strike,
            timeToExpiry: T,
            riskFreeRate: 0.045,
            volatility: vol,
            optionType: h.holdingType === 'leaps_call' ? 'call' : 'put',
          })
        : null;

      const currentPrice = bsResult?.price ?? null;
      const marketValue  = currentPrice != null ? currentPrice * h.quantity * 100 : null;
      const costBasis    = h.avgCost * h.quantity * 100;
      const unrealized   = marketValue != null ? marketValue - costBasis : null;
      const unrealizedPct = unrealized != null && costBasis > 0 ? (unrealized / costBasis) * 100 : null;
      return { ...h, currentPrice, marketValue, unrealizedPnl: unrealized, unrealizedPnlPct: unrealizedPct };
    }

    const currentPrice = spotPrice;
    const marketValue  = currentPrice != null ? currentPrice * h.quantity : null;
    const costBasis    = h.avgCost * h.quantity;
    const unrealized   = marketValue != null ? marketValue - costBasis : null;
    const unrealizedPct = unrealized != null && costBasis > 0 ? (unrealized / costBasis) * 100 : null;
    return { ...h, currentPrice, marketValue, unrealizedPnl: unrealized, unrealizedPnlPct: unrealizedPct };
  });

  const tv = enriched.reduce((acc, h) => acc + (h.marketValue ?? holdingCostBasis(h)), 0);
  const tc = enriched.reduce((acc, h) => acc + holdingCostBasis(h), 0);
  const up = enriched.reduce((acc, h) => acc + (h.unrealizedPnl ?? 0), 0);

  // Write today's snapshot only when every non-cash price resolved.
  // If any price fell back to cost basis (marketValue === null), the tv would be
  // artificially low, corrupting the benchmark chart for the rest of the day
  // because the hasToday guard prevents any correction on subsequent visits.
  const today = new Date().toISOString().split('T')[0];
  const hasToday = snapshotList.some((s) => s.snapshotDate === today);
  const allPricesResolved = enriched.every(h => h.holdingType === 'cash' || h.marketValue !== null);
  if (!hasToday && allPricesResolved && enriched.length > 0) {
    const { data: inserted, error: snapErr } = await supabase
      .from('portfolio_snapshots')
      .upsert(
        {
          user_id: userId,
          snapshot_date: today,
          total_value: tv,
          total_cost: tc,
          unrealized_pnl: up,
          realized_pnl: computedRealizedPnl,
          options_premium: computedPremium,
        },
        { onConflict: 'user_id,snapshot_date' }
      )
      .select('id, snapshot_date, total_value, total_cost, unrealized_pnl, realized_pnl, options_premium')
      .single();

    if (!snapErr && inserted) {
      const newSnap = dbToSnapshot(inserted as DbSnapshot);
      const filtered = snapshotList.filter((s) => s.snapshotDate !== today);
      snapshotList = [...filtered, newSnap].sort((a, b) =>
        a.snapshotDate.localeCompare(b.snapshotDate)
      );
    }
  }

  return {
    holdingsWithPrice: enriched,
    openHoldings: holdings,
    snapshots: snapshotList,
    totalValue: tv,
    totalCost: tc,
    unrealizedPnl: up,
    realizedPnl: computedRealizedPnl,
    optionsPremium: computedPremium,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const EMPTY: PortfolioQueryResult = {
  holdingsWithPrice: [],
  openHoldings: [],
  snapshots: [],
  totalValue: 0,
  totalCost: 0,
  unrealizedPnl: 0,
  realizedPnl: 0,
  optionsPremium: 0,
};

export function usePortfolio() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const qKey = ['portfolio', user?.id] as const;

  const { data = EMPTY, isLoading } = useQuery({
    queryKey: qKey,
    queryFn: () => fetchPortfolioData(user!.id),
    enabled: !!user,
    staleTime: 30 * 1000,
    refetchOnMount: true,
    retry: 3,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: qKey }),
    [queryClient, qKey]
  );

  const addHolding = useCallback(
    async (holdingData: AddHoldingData): Promise<boolean> => {
      if (!user) return false;

      const { error } = await supabase.from('portfolio_holdings').insert({
        user_id: user.id,
        ticker: holdingData.ticker.toUpperCase(),
        holding_type: holdingData.holdingType,
        quantity: holdingData.quantity,
        avg_cost: holdingData.avgCost,
        opened_at: holdingData.openedAt,
        expiry: holdingData.expiry ?? null,
        strike: holdingData.strike ?? null,
        notes: holdingData.notes ?? null,
        status: 'open',
      });

      if (error) {
        showToast(`Failed to add holding: ${error.message}`, 'error');
        return false;
      }
      showToast('Holding added', 'success');
      await invalidate();
      return true;
    },
    [user, showToast, invalidate]
  );

  const closeHolding = useCallback(
    async (id: string, closingPrice: number): Promise<boolean> => {
      if (!user) return false;

      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('portfolio_holdings')
        .update({ status: 'closed', closing_price: closingPrice, closed_at: today })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        showToast(`Failed to close holding: ${error.message}`, 'error');
        return false;
      }
      showToast('Holding closed', 'success');
      await invalidate();
      return true;
    },
    [user, showToast, invalidate]
  );

  const editHolding = useCallback(
    async (id: string, editData: Partial<Pick<AddHoldingData, 'ticker' | 'quantity' | 'avgCost' | 'holdingType' | 'openedAt' | 'expiry' | 'strike' | 'notes'>>): Promise<boolean> => {
      if (!user) return false;

      const updates: Record<string, unknown> = {};
      if (editData.ticker !== undefined) updates.ticker = editData.ticker.toUpperCase();
      if (editData.quantity !== undefined) updates.quantity = editData.quantity;
      if (editData.avgCost !== undefined) updates.avg_cost = editData.avgCost;
      if (editData.holdingType !== undefined) updates.holding_type = editData.holdingType;
      if (editData.openedAt !== undefined) updates.opened_at = editData.openedAt;
      if ('expiry' in editData) updates.expiry = editData.expiry ?? null;
      if ('strike' in editData) updates.strike = editData.strike ?? null;
      if ('notes' in editData) updates.notes = editData.notes ?? null;

      const { error } = await supabase
        .from('portfolio_holdings')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        showToast(`Failed to update holding: ${error.message}`, 'error');
        return false;
      }
      showToast('Holding updated', 'success');
      await invalidate();
      return true;
    },
    [user, showToast, invalidate]
  );

  const adjustCash = useCallback(
    async (delta: number) => {
      if (!user) {
        showToast('Holding saved — but failed to adjust cash position. Update manually.', 'error');
        return;
      }

      const { data: cashRow, error: fetchError } = await supabase
        .from('portfolio_holdings')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('holding_type', 'cash')
        .eq('status', 'open')
        .order('quantity', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        showToast('Holding saved — but failed to adjust cash position. Update manually.', 'error');
        return;
      }

      if (cashRow) {
        const newQty = Number(cashRow.quantity) + delta;
        if (isNaN(newQty)) {
          showToast('Holding saved — but failed to adjust cash position. Update manually.', 'error');
          return;
        }
        const { error } = await supabase
          .from('portfolio_holdings')
          .update({ quantity: newQty })
          .eq('id', cashRow.id)
          .eq('user_id', user.id);
        if (error) {
          showToast('Holding saved — but failed to adjust cash position. Update manually.', 'error');
        }
      } else {
        if (delta <= 0) return;
        const { error } = await supabase
          .from('portfolio_holdings')
          .insert({
            user_id: user.id,
            holding_type: 'cash',
            ticker: 'USD',
            quantity: delta,
            avg_cost: 1,
            status: 'open',
            opened_at: new Date().toISOString().split('T')[0],
          });
        if (error) {
          showToast('Holding saved — but failed to adjust cash position. Update manually.', 'error');
        }
      }
    },
    [user, showToast]
  );

  return {
    holdingsWithPrice: data.holdingsWithPrice,
    openHoldings: data.openHoldings,
    snapshots: data.snapshots,
    isLoading,
    addHolding,
    closeHolding,
    editHolding,
    adjustCash,
    totalValue: data.totalValue,
    totalCost: data.totalCost,
    unrealizedPnl: data.unrealizedPnl,
    realizedPnl: data.realizedPnl,
    optionsPremium: data.optionsPremium,
  };
}
