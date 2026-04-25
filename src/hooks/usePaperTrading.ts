import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getQuote } from '../lib/finnhub';
import { getIVData } from '../lib/polygon';
import { blackScholes, yearsToExpiry, estimateVolatility } from '../lib/blackScholes';
import type { PaperAccount, PaperPosition, OpenPaperPositionData } from '../types';

function dbToAccount(row: Record<string, unknown>): PaperAccount {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    startingBalance: Number(row.starting_balance),
    currentCash: Number(row.current_cash),
    totalPremiumCollected: Number(row.total_premium_collected),
    totalRealizedPnl: Number(row.total_realized_pnl),
    tradesWon: Number(row.trades_won),
    tradesTotal: Number(row.trades_total),
    createdAt: row.created_at as string,
    resetAt: row.reset_at as string,
  };
}

function dbToPosition(row: Record<string, unknown>): PaperPosition {
  return {
    id: row.id as string,
    ticker: row.ticker as string,
    strategy: row.strategy as 'CSP' | 'CC',
    strike: Number(row.strike),
    expiry: row.expiry as string,
    premiumCollected: Number(row.premium_collected),
    contracts: Number(row.contracts) || 1,
    underlyingPriceAtEntry: Number(row.underlying_price_at_entry),
    status: row.status as PaperPosition['status'],
    notes: row.notes as string | undefined,
    openedAt: (row.opened_at as string).split('T')[0],
    closedAt: row.closed_at ? (row.closed_at as string).split('T')[0] : undefined,
    closingPremium: row.closing_premium != null ? Number(row.closing_premium) : undefined,
    realizedPnl: row.realized_pnl != null ? Number(row.realized_pnl) : undefined,
    createdAt: row.created_at as string,
  };
}

export function usePaperAccount() {
  const { user } = useAuth();
  const [account, setAccount] = useState<PaperAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setAccount(null); return; }
    setIsLoading(true);
    const { data } = await supabase.from('paper_accounts').select('id, user_id, starting_balance, current_cash, total_premium_collected, total_realized_pnl, trades_won, trades_total, created_at, reset_at').eq('user_id', user.id).maybeSingle();
    setAccount(data ? dbToAccount(data as Record<string, unknown>) : null);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  return { account, isLoading, reload: load };
}

export function usePaperPositions() {
  const { user } = useAuth();
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [allPositions, setAllPositions] = useState<PaperPosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setPositions([]); setAllPositions([]); return; }
    setIsLoading(true);
    const { data } = await supabase
      .from('paper_positions')
      .select('id, ticker, strategy, strike, expiry, premium_collected, contracts, underlying_price_at_entry, status, notes, opened_at, closed_at, closing_premium, realized_pnl, created_at')
      .eq('user_id', user.id)
      .order('opened_at', { ascending: false });
    const all = (data ?? []).map(dbToPosition);
    setAllPositions(all);
    setPositions(all.filter((p) => p.status === 'open'));
    setIsLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  return { positions, allPositions, isLoading, reload: load };
}

export function usePaperActions() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const openPaperPosition = useCallback(async (data: OpenPaperPositionData): Promise<string | null> => {
    if (!user) return 'Not authenticated';

    // Validate cash for CSP
    if (data.strategy === 'CSP') {
      const { data: acct } = await supabase.from('paper_accounts').select('current_cash').eq('user_id', user.id).single();
      const cash = Number(acct?.current_cash ?? 0);
      const required = data.strike * data.contracts * 100;
      if (required > cash) {
        return `Insufficient paper cash — you need $${required.toLocaleString()} to open this position`;
      }
    }

    const { error } = await supabase.from('paper_positions').insert({
      user_id: user.id,
      ticker: data.ticker.toUpperCase(),
      strategy: data.strategy,
      strike: data.strike,
      expiry: data.expiry,
      premium_collected: data.premiumCollected,
      contracts: data.contracts,
      underlying_price_at_entry: data.underlyingPriceAtEntry,
      status: 'open',
    });

    if (error) { showToast('Failed to open paper position', 'error'); return error.message; }

    // Deduct collateral for CSP; update premium collected
    const collateral = data.strategy === 'CSP' ? data.strike * data.contracts * 100 : 0;
    const premiumTotal = data.premiumCollected * data.contracts * 100;
    await supabase.rpc('paper_open_position', {
      p_user_id: user.id,
      p_collateral: collateral,
      p_premium: premiumTotal,
    }).then(async () => {
      // Fallback: direct update if RPC not available
    });

    // Direct update (works without RPC)
    await supabase.from('paper_accounts').update({
      current_cash: (await supabase.from('paper_accounts').select('current_cash').eq('user_id', user.id).single().then(r => Number(r.data?.current_cash ?? 0))) - collateral,
      total_premium_collected: (await supabase.from('paper_accounts').select('total_premium_collected').eq('user_id', user.id).single().then(r => Number(r.data?.total_premium_collected ?? 0))) + premiumTotal,
    }).eq('user_id', user.id);

    showToast(`Paper position opened: ${data.ticker} ${data.strategy}`, 'success');
    return null;
  }, [user, showToast]);

  const closePaperPosition = useCallback(async (id: string, closingPremium: number): Promise<void> => {
    if (!user) return;

    const { data: pos } = await supabase.from('paper_positions').select('id, ticker, strategy, strike, expiry, premium_collected, contracts, underlying_price_at_entry, status, notes, opened_at, closed_at, closing_premium, realized_pnl, created_at').eq('id', id).single();
    if (!pos) return;

    const position = dbToPosition(pos as Record<string, unknown>);
    const realizedPnl = (position.premiumCollected - closingPremium) * position.contracts * 100;
    const collateralReturn = position.strategy === 'CSP' ? position.strike * position.contracts * 100 : 0;

    await supabase.from('paper_positions').update({
      status: 'closed',
      closing_premium: closingPremium,
      realized_pnl: realizedPnl,
      closed_at: new Date().toISOString(),
    }).eq('id', id);

    const { data: acct } = await supabase.from('paper_accounts').select('id, user_id, starting_balance, current_cash, total_premium_collected, total_realized_pnl, trades_won, trades_total, created_at, reset_at').eq('user_id', user.id).single();
    const currentCash = Number(acct?.current_cash ?? 0);
    const currentPnl = Number(acct?.total_realized_pnl ?? 0);
    const currentWon = Number(acct?.trades_won ?? 0);
    const currentTotal = Number(acct?.trades_total ?? 0);

    await supabase.from('paper_accounts').update({
      current_cash: currentCash + collateralReturn + realizedPnl,
      total_realized_pnl: currentPnl + realizedPnl,
      trades_total: currentTotal + 1,
      trades_won: realizedPnl > 0 ? currentWon + 1 : currentWon,
    }).eq('user_id', user.id);

    const pnlStr = realizedPnl >= 0 ? `+$${realizedPnl.toFixed(0)}` : `-$${Math.abs(realizedPnl).toFixed(0)}`;
    showToast(`Position closed · Realized P&L: ${pnlStr}`, realizedPnl >= 0 ? 'success' : 'error');
  }, [user, showToast]);

  const expirePaperPosition = useCallback(async (id: string): Promise<void> => {
    if (!user) return;

    const { data: pos } = await supabase.from('paper_positions').select('id, ticker, strategy, strike, expiry, premium_collected, contracts, underlying_price_at_entry, status, notes, opened_at, closed_at, closing_premium, realized_pnl, created_at').eq('id', id).single();
    if (!pos) return;

    const position = dbToPosition(pos as Record<string, unknown>);
    const realizedPnl = position.premiumCollected * position.contracts * 100;
    const collateralReturn = position.strategy === 'CSP' ? position.strike * position.contracts * 100 : 0;

    await supabase.from('paper_positions').update({
      status: 'expired',
      closing_premium: 0,
      realized_pnl: realizedPnl,
      closed_at: new Date().toISOString(),
    }).eq('id', id);

    const { data: acct } = await supabase.from('paper_accounts').select('id, user_id, starting_balance, current_cash, total_premium_collected, total_realized_pnl, trades_won, trades_total, created_at, reset_at').eq('user_id', user.id).single();
    await supabase.from('paper_accounts').update({
      current_cash: Number(acct?.current_cash ?? 0) + collateralReturn + realizedPnl,
      total_realized_pnl: Number(acct?.total_realized_pnl ?? 0) + realizedPnl,
      trades_total: Number(acct?.trades_total ?? 0) + 1,
      trades_won: Number(acct?.trades_won ?? 0) + 1,
    }).eq('user_id', user.id);

    showToast(`Position expired worthless — full premium kept! +$${realizedPnl.toFixed(0)}`, 'success');
  }, [user, showToast]);

  const assignPaperPosition = useCallback(async (id: string): Promise<void> => {
    if (!user) return;

    const { data: pos } = await supabase.from('paper_positions').select('strategy, ticker, strike').eq('id', id).single();
    if (!pos) return;

    await supabase.from('paper_positions').update({
      status: 'assigned',
      closed_at: new Date().toISOString(),
    }).eq('id', id);

    const strategy = pos.strategy as string;
    if (strategy === 'CSP') {
      showToast(`Assigned — you now hold virtual shares of ${pos.ticker} at $${pos.strike}. Sell covered calls to continue the wheel.`, 'success');
    } else {
      showToast(`Assigned — your virtual ${pos.ticker} shares were called away at $${pos.strike}.`, 'success');
    }
  }, [user, showToast]);

  const editPaperPosition = useCallback(async (
    id: string,
    data: { strike: number; expiry: string; premiumCollected: number; contracts: number },
    oldPosition: PaperPosition,
  ): Promise<string | null> => {
    if (!user) return 'Not authenticated';

    if (oldPosition.strategy === 'CSP') {
      const oldCollateral = oldPosition.strike * oldPosition.contracts * 100;
      const newCollateral = data.strike * data.contracts * 100;
      const delta = newCollateral - oldCollateral;

      if (delta > 0) {
        const { data: acct } = await supabase.from('paper_accounts').select('current_cash').eq('user_id', user.id).single();
        const cash = Number(acct?.current_cash ?? 0);
        if (delta > cash) return 'Insufficient cash to cover the increased collateral requirement';
      }

      if (delta !== 0) {
        const { data: acct } = await supabase.from('paper_accounts').select('current_cash').eq('user_id', user.id).single();
        await supabase.from('paper_accounts').update({
          current_cash: Number(acct?.current_cash ?? 0) - delta,
        }).eq('user_id', user.id);
      }
    }

    await supabase.from('paper_positions').update({
      strike: data.strike,
      expiry: data.expiry,
      premium_collected: data.premiumCollected,
      contracts: data.contracts,
    }).eq('id', id);

    showToast('Paper position updated', 'success');
    return null;
  }, [user, showToast]);

  const deletePaperPosition = useCallback(async (id: string): Promise<void> => {
    if (!user) return;
    await supabase.from('paper_positions').delete().eq('id', id);
    showToast('Paper position deleted', 'success');
  }, [user, showToast]);

  const resetPaperAccount = useCallback(async (): Promise<void> => {
    if (!user) return;
    await supabase.from('paper_positions').delete().eq('user_id', user.id);
    await supabase.from('paper_snapshots').delete().eq('user_id', user.id);
    await supabase.from('paper_accounts').update({
      current_cash: 100000,
      starting_balance: 100000,
      total_premium_collected: 0,
      total_realized_pnl: 0,
      trades_won: 0,
      trades_total: 0,
      reset_at: new Date().toISOString(),
    }).eq('user_id', user.id);
    showToast('Paper account reset to $100,000', 'success');
  }, [user, showToast]);

  // Black-Scholes close price estimate
  const estimateClosePrice = useCallback(async (position: PaperPosition): Promise<number | null> => {
    try {
      const T = yearsToExpiry(position.expiry);
      if (T <= 0) return 0;

      let spotPrice: number;
      try {
        const quote = await getQuote(position.ticker);
        spotPrice = quote.c > 0 ? quote.c : (quote.pc > 0 ? quote.pc : position.underlyingPriceAtEntry);
      } catch {
        spotPrice = position.underlyingPriceAtEntry;
      }

      let volatility: number;
      try {
        const iv = await getIVData(position.ticker);
        volatility = iv.currentHV > 0 ? iv.currentHV / 100 : estimateVolatility(position.ticker);
      } catch {
        volatility = estimateVolatility(position.ticker);
      }

      const result = blackScholes({
        spotPrice,
        strikePrice: position.strike,
        timeToExpiry: T,
        riskFreeRate: 0.045,
        volatility,
        optionType: position.strategy === 'CSP' ? 'put' : 'call',
      });

      return Math.round(result.price * 100) / 100;
    } catch {
      return null;
    }
  }, []);

  return {
    openPaperPosition,
    closePaperPosition,
    expirePaperPosition,
    assignPaperPosition,
    editPaperPosition,
    deletePaperPosition,
    resetPaperAccount,
    estimateClosePrice,
  };
}
