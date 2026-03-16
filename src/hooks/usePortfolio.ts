import { useState, useEffect, useCallback } from 'react';
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

export function usePortfolio() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [openHoldings, setOpenHoldings] = useState<PortfolioHolding[]>([]);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [holdingsWithPrice, setHoldingsWithPrice] = useState<HoldingWithPrice[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Derived totals
  const [totalValue, setTotalValue] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [unrealizedPnl, setUnrealizedPnl] = useState(0);
  const [realizedPnl, setRealizedPnl] = useState(0);
  const [optionsPremium, setOptionsPremium] = useState(0);

  const loadData = useCallback(async () => {
    if (!user) {
      setOpenHoldings([]);
      setSnapshots([]);
      setHoldingsWithPrice([]);
      return;
    }

    setIsLoading(true);

    const [holdingsRes, snapshotsRes, closedRes, wheelRes] = await Promise.allSettled([
      supabase
        .from('portfolio_holdings')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('ticker', { ascending: true }),
      supabase
        .from('portfolio_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: true }),
      supabase
        .from('portfolio_holdings')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'closed'),
      supabase
        .from('wheel_positions')
        .select('premium_collected, contracts, closing_price')
        .eq('user_id', user.id)
        .eq('status', 'closed'),
    ]);

    // Process open holdings
    let holdings: PortfolioHolding[] = [];
    if (holdingsRes.status === 'fulfilled' && !holdingsRes.value.error && holdingsRes.value.data) {
      holdings = (holdingsRes.value.data as DbHolding[]).map(dbToHolding);
      setOpenHoldings(holdings);
    }

    // Process snapshots
    let snapshotList: PortfolioSnapshot[] = [];
    if (snapshotsRes.status === 'fulfilled' && !snapshotsRes.value.error && snapshotsRes.value.data) {
      snapshotList = (snapshotsRes.value.data as DbSnapshot[]).map(dbToSnapshot);
      setSnapshots(snapshotList);
    }

    // Compute realized P&L from closed holdings
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
    // Compute net wheel position P&L and add to realized P&L
    let computedPremium = 0;
    if (wheelRes.status === 'fulfilled' && !wheelRes.value.error && wheelRes.value.data) {
      const wheelPositions = wheelRes.value.data as DbWheelPosition[];
      // Net options premium: premium collected minus BTC cost (or full premium if expired worthless)
      computedPremium = wheelPositions.reduce((acc, p) => {
        const premium = Number(p.premium_collected);
        const btcCost = p.closing_price != null ? Number(p.closing_price) : 0;
        return acc + (premium - btcCost) * p.contracts;
      }, 0);
      // Also roll net wheel P&L into overall realized P&L
      computedRealizedPnl += computedPremium;
    }
    setRealizedPnl(computedRealizedPnl);
    setOptionsPremium(computedPremium);

    // Fetch live prices via Finnhub (portfolio has few tickers; queue overhead is fine)
    // Cash holdings don't need price fetching — their value is always their quantity in dollars
    const nonCashHoldings = holdings.filter((h) => h.holdingType !== 'cash');

    if (holdings.length > 0) {
      const uniqueTickers = [...new Set(nonCashHoldings.map((h) => h.ticker))];

      // Also fetch IV for any LEAPS holdings (needed for Black-Scholes valuation)
      const leapsTickers = [...new Set(
        nonCashHoldings
          .filter((h) => (h.holdingType === 'leaps_call' || h.holdingType === 'leaps_put') && h.strike != null && h.expiry)
          .map((h) => h.ticker)
      )];

      const [quoteResults, ivResults] = await Promise.all([
        Promise.allSettled(uniqueTickers.map((t) => getQuote(t))),
        Promise.allSettled(leapsTickers.map((t) => getIVData(t))),
      ]);

      const priceMap = new Map<string, { price: number | null; priceChangePct: number | null }>();
      uniqueTickers.forEach((ticker, i) => {
        const r = quoteResults[i];
        if (r.status === 'fulfilled') {
          const q = r.value;
          const price = q.c > 0 ? q.c : (q.pc > 0 ? q.pc : null);
          priceMap.set(ticker, { price, priceChangePct: q.dp });
        } else {
          priceMap.set(ticker, { price: null, priceChangePct: null });
        }
      });

      // Volatility map for LEAPS tickers (HV30 as decimal, or hardcoded fallback)
      const volMap = new Map<string, number>();
      leapsTickers.forEach((ticker, i) => {
        const r = ivResults[i];
        const vol =
          r.status === 'fulfilled' && r.value.currentHV > 0
            ? r.value.currentHV / 100
            : estimateVolatility(ticker);
        volMap.set(ticker, vol);
      });

      const enriched: HoldingWithPrice[] = holdings.map((h) => {
        // Cash: value is always face value (quantity = dollar amount, avgCost = 1)
        if (h.holdingType === 'cash') {
          return { ...h, currentPrice: 1, marketValue: h.quantity, unrealizedPnl: 0, unrealizedPnlPct: 0 };
        }

        const isLeaps =
          (h.holdingType === 'leaps_call' || h.holdingType === 'leaps_put') &&
          h.strike != null &&
          h.expiry != null;

        const spotPrice = priceMap.get(h.ticker)?.price ?? null;

        if (isLeaps && spotPrice != null && h.strike != null && h.expiry != null) {
          // For options: market value = BS price × contracts × 100
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

          const currentPrice = bsResult?.price ?? null; // per-share option price
          const marketValue  = currentPrice != null ? currentPrice * h.quantity * 100 : null;
          const costBasis    = h.avgCost * h.quantity * 100; // avgCost is per-share basis
          const unrealized   = marketValue != null ? marketValue - costBasis : null;
          const unrealizedPct = unrealized != null && costBasis > 0 ? (unrealized / costBasis) * 100 : null;
          return { ...h, currentPrice, marketValue, unrealizedPnl: unrealized, unrealizedPnlPct: unrealizedPct };
        }

        // Shares / other: standard price × quantity
        const currentPrice = spotPrice;
        const marketValue  = currentPrice != null ? currentPrice * h.quantity : null;
        const costBasis    = h.avgCost * h.quantity;
        const unrealized   = marketValue != null ? marketValue - costBasis : null;
        const unrealizedPct = unrealized != null && costBasis > 0 ? (unrealized / costBasis) * 100 : null;
        return { ...h, currentPrice, marketValue, unrealizedPnl: unrealized, unrealizedPnlPct: unrealizedPct };
      });

      setHoldingsWithPrice(enriched);

      // Compute portfolio totals
      // LEAPS cost basis = avgCost × qty × 100 (avgCost is per-share); shares = avgCost × qty
      const holdingCostBasis = (h: HoldingWithPrice) =>
        (h.holdingType === 'leaps_call' || h.holdingType === 'leaps_put') && h.strike != null && h.expiry != null
          ? h.avgCost * h.quantity * 100
          : h.avgCost * h.quantity;

      const tv = enriched.reduce((acc, h) => acc + (h.marketValue ?? holdingCostBasis(h)), 0);
      const tc = enriched.reduce((acc, h) => acc + holdingCostBasis(h), 0);
      const up = enriched.reduce((acc, h) => acc + (h.unrealizedPnl ?? 0), 0);
      setTotalValue(tv);
      setTotalCost(tc);
      setUnrealizedPnl(up);

      // Check if today's snapshot exists; if not, upsert one
      const today = new Date().toISOString().split('T')[0];
      const hasToday = snapshotList.some((s) => s.snapshotDate === today);
      if (!hasToday && enriched.length > 0) {
        const { data: inserted, error: snapErr } = await supabase
          .from('portfolio_snapshots')
          .upsert(
            {
              user_id: user.id,
              snapshot_date: today,
              total_value: tv,
              total_cost: tc,
              unrealized_pnl: up,
              realized_pnl: computedRealizedPnl,
              options_premium: computedPremium,
            },
            { onConflict: 'user_id,snapshot_date' }
          )
          .select('*')
          .single();

        if (!snapErr && inserted) {
          const newSnap = dbToSnapshot(inserted as DbSnapshot);
          setSnapshots((prev) => {
            const filtered = prev.filter((s) => s.snapshotDate !== today);
            return [...filtered, newSnap].sort((a, b) =>
              a.snapshotDate.localeCompare(b.snapshotDate)
            );
          });
        }
      }
    } else {
      setHoldingsWithPrice([]);
      setTotalValue(0);
      setTotalCost(0);
      setUnrealizedPnl(0);
    }

    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const addHolding = useCallback(
    async (data: AddHoldingData) => {
      if (!user) return;

      const { error } = await supabase.from('portfolio_holdings').insert({
        user_id: user.id,
        ticker: data.ticker.toUpperCase(),
        holding_type: data.holdingType,
        quantity: data.quantity,
        avg_cost: data.avgCost,
        opened_at: data.openedAt,
        expiry: data.expiry ?? null,
        strike: data.strike ?? null,
        notes: data.notes ?? null,
        status: 'open',
      });

      if (error) {
        showToast(`Failed to add holding: ${error.message}`, 'error');
      } else {
        showToast('Holding added', 'success');
        await loadData();
      }
    },
    [user, showToast, loadData]
  );

  const closeHolding = useCallback(
    async (id: string, closingPrice: number) => {
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('portfolio_holdings')
        .update({
          status: 'closed',
          closing_price: closingPrice,
          closed_at: today,
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        showToast(`Failed to close holding: ${error.message}`, 'error');
      } else {
        showToast('Holding closed', 'success');
        await loadData();
      }
    },
    [user, showToast, loadData]
  );

  const editHolding = useCallback(
    async (id: string, data: Partial<Pick<AddHoldingData, 'ticker' | 'quantity' | 'avgCost' | 'holdingType' | 'openedAt' | 'expiry' | 'strike' | 'notes'>>) => {
      if (!user) return;

      const updates: Record<string, unknown> = {};
      if (data.ticker !== undefined) updates.ticker = data.ticker.toUpperCase();
      if (data.quantity !== undefined) updates.quantity = data.quantity;
      if (data.avgCost !== undefined) updates.avg_cost = data.avgCost;
      if (data.holdingType !== undefined) updates.holding_type = data.holdingType;
      if (data.openedAt !== undefined) updates.opened_at = data.openedAt;
      if ('expiry' in data) updates.expiry = data.expiry ?? null;
      if ('strike' in data) updates.strike = data.strike ?? null;
      if ('notes' in data) updates.notes = data.notes ?? null;

      const { error } = await supabase
        .from('portfolio_holdings')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        showToast(`Failed to update holding: ${error.message}`, 'error');
      } else {
        showToast('Holding updated', 'success');
        await loadData();
      }
    },
    [user, showToast, loadData]
  );

  return {
    holdingsWithPrice,
    openHoldings,
    snapshots,
    isLoading,
    addHolding,
    closeHolding,
    editHolding,
    totalValue,
    totalCost,
    unrealizedPnl,
    realizedPnl,
    optionsPremium,
  };
}
