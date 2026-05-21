import { useState, useEffect, useCallback, useRef } from 'react';
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
    try {
      const { data, error } = await supabase
        .from('paper_positions')
        .select('id, ticker, strategy, strike, expiry, premium_collected, contracts, underlying_price_at_entry, status, notes, opened_at, closed_at, closing_premium, realized_pnl, created_at')
        .eq('user_id', user.id)
        .order('opened_at', { ascending: false });
      if (error) throw error;
      const all = (data ?? []).map(dbToPosition);
      setAllPositions(all);
      setPositions(all.filter((p) => p.status === 'open'));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  return { positions, allPositions, isLoading, reload: load };
}

export function usePaperActions() {
  const { user } = useAuth();
  const { showToast } = useToast();
  // Serializes close/expire/assign so concurrent calls can't race on paper_accounts
  const pendingOp = useRef(false);

  const openPaperPosition = useCallback(async (data: OpenPaperPositionData): Promise<string | null> => {
    if (!user) return 'Not authenticated';

    // Fetch account first — abort before touching any position row if it fails.
    // Never use ?? 0 as fallback: zeroing current_cash would corrupt the account.
    const { data: acctNow, error: acctErr } = await supabase
      .from('paper_accounts')
      .select('current_cash, total_premium_collected')
      .eq('user_id', user.id)
      .single();
    if (acctErr || !acctNow) { showToast('Failed to read paper account', 'error'); return 'Paper account not found'; }

    // Validate cash for CSP using the already-fetched account (include fees in the required amount)
    const openFees = data.optionFees ?? 0;
    if (data.strategy === 'CSP') {
      const required = data.strike * data.contracts * 100 + openFees;
      if (required > Number(acctNow.current_cash)) {
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

    const collateral = data.strategy === 'CSP' ? data.strike * data.contracts * 100 : 0;
    const premiumTotal = data.premiumCollected * data.contracts * 100;
    await supabase.from('paper_accounts').update({
      current_cash: Number(acctNow.current_cash) - collateral - openFees,
      total_premium_collected: Number(acctNow.total_premium_collected) + premiumTotal,
    }).eq('user_id', user.id);

    showToast(`Paper position opened: ${data.ticker} ${data.strategy}`, 'success');
    return null;
  }, [user, showToast]);

  const closePaperPosition = useCallback(async (id: string, closingPremium: number, contractsToClose?: number, optionFees?: number): Promise<void> => {
    if (!user || pendingOp.current) return;
    pendingOp.current = true;

    const { data: pos } = await supabase.from('paper_positions').select('id, ticker, strategy, strike, expiry, premium_collected, contracts, underlying_price_at_entry, status, notes, opened_at, closed_at, closing_premium, realized_pnl, created_at').eq('id', id).eq('user_id', user.id).single();
    if (!pos) { pendingOp.current = false; return; }

    const position = dbToPosition(pos as Record<string, unknown>);
    const closing = Math.min(contractsToClose ?? position.contracts, position.contracts);
    const isFullClose = closing >= position.contracts;

    const realizedPnl = (position.premiumCollected - closingPremium) * closing * 100;
    const closeFees = optionFees ?? 0;
    const realizedPnlAfterFees = realizedPnl - closeFees;
    const collateralReturn = position.strategy === 'CSP' ? position.strike * closing * 100 : 0;

    if (isFullClose) {
      await supabase.from('paper_positions').update({
        status: 'closed',
        closing_premium: closingPremium,
        realized_pnl: realizedPnlAfterFees,
        closed_at: new Date().toISOString(),
      }).eq('id', id);
    } else {
      // Partial close: reduce contracts, keep position open (premium_collected is per-share, no change needed)
      await supabase.from('paper_positions').update({
        contracts: position.contracts - closing,
      }).eq('id', id);
    }

    const { data: acct, error: acctErr } = await supabase.from('paper_accounts').select('id, user_id, starting_balance, current_cash, total_premium_collected, total_realized_pnl, trades_won, trades_total, created_at, reset_at').eq('user_id', user.id).single();
    if (acctErr || !acct) { showToast('Failed to read paper account', 'error'); pendingOp.current = false; return; }
    const currentCash = Number(acct.current_cash);
    const currentPnl = Number(acct.total_realized_pnl);
    const currentWon = Number(acct.trades_won);
    const currentTotal = Number(acct.trades_total);

    await supabase.from('paper_accounts').update({
      current_cash: currentCash + collateralReturn + realizedPnlAfterFees,
      total_realized_pnl: currentPnl + realizedPnlAfterFees,
      trades_total: currentTotal + 1,
      trades_won: realizedPnlAfterFees > 0 ? currentWon + 1 : currentWon,
    }).eq('user_id', user.id);

    const pnlStr = realizedPnl >= 0 ? `+$${realizedPnl.toFixed(0)}` : `-$${Math.abs(realizedPnl).toFixed(0)}`;
    const label = isFullClose ? 'Position closed' : `Closed ${closing}/${position.contracts} contracts`;
    showToast(`${label} · Realized P&L: ${pnlStr}`, realizedPnl >= 0 ? 'success' : 'error');
    pendingOp.current = false;
  }, [user, showToast]);

  const expirePaperPosition = useCallback(async (id: string): Promise<void> => {
    if (!user || pendingOp.current) return;
    pendingOp.current = true;

    const { data: pos } = await supabase.from('paper_positions').select('id, ticker, strategy, strike, expiry, premium_collected, contracts, underlying_price_at_entry, status, notes, opened_at, closed_at, closing_premium, realized_pnl, created_at').eq('id', id).eq('user_id', user.id).single();
    if (!pos) { pendingOp.current = false; return; }

    const position = dbToPosition(pos as Record<string, unknown>);
    const realizedPnl = position.premiumCollected * position.contracts * 100;
    const collateralReturn = position.strategy === 'CSP' ? position.strike * position.contracts * 100 : 0;

    await supabase.from('paper_positions').update({
      status: 'expired',
      closing_premium: 0,
      realized_pnl: realizedPnl,
      closed_at: new Date().toISOString(),
    }).eq('id', id);

    const { data: acct, error: acctErr2 } = await supabase.from('paper_accounts').select('id, user_id, starting_balance, current_cash, total_premium_collected, total_realized_pnl, trades_won, trades_total, created_at, reset_at').eq('user_id', user.id).single();
    if (acctErr2 || !acct) { showToast('Failed to read paper account', 'error'); pendingOp.current = false; return; }
    await supabase.from('paper_accounts').update({
      current_cash: Number(acct.current_cash) + collateralReturn + realizedPnl,
      total_realized_pnl: Number(acct.total_realized_pnl) + realizedPnl,
      trades_total: Number(acct.trades_total) + 1,
      trades_won: Number(acct.trades_won) + 1,
    }).eq('user_id', user.id);

    showToast(`Position expired worthless — full premium kept! +$${realizedPnl.toFixed(0)}`, 'success');
    pendingOp.current = false;
  }, [user, showToast]);

  const assignPaperPosition = useCallback(async (id: string): Promise<void> => {
    if (!user || pendingOp.current) return;
    pendingOp.current = true;

    const { data: pos } = await supabase.from('paper_positions').select('strategy, ticker, strike, contracts').eq('id', id).single();
    if (!pos) { pendingOp.current = false; return; }

    await supabase.from('paper_positions').update({
      status: 'assigned',
      closed_at: new Date().toISOString(),
    }).eq('id', id);

    // Update account: increment trade count; for CC assignments return the strike proceeds as cash
    const { data: acct, error: acctAssignErr } = await supabase
      .from('paper_accounts')
      .select('current_cash, trades_total')
      .eq('user_id', user.id)
      .single();
    if (acctAssignErr || !acct) { showToast('Failed to read paper account', 'error'); pendingOp.current = false; return; }

    const strategy = pos.strategy as string;
    // CC assignment: shares called away → receive strike × contracts × 100 in cash
    const cashDelta = strategy === 'CC' ? Number(pos.strike) * Number(pos.contracts) * 100 : 0;

    await supabase.from('paper_accounts').update({
      trades_total: Number(acct.trades_total) + 1,
      current_cash: Number(acct.current_cash) + cashDelta,
    }).eq('user_id', user.id);

    if (strategy === 'CSP') {
      showToast(`Assigned — you now hold virtual shares of ${pos.ticker} at $${pos.strike}. Sell covered calls to continue the wheel.`, 'success');
    } else {
      showToast(`Assigned — your virtual ${pos.ticker} shares were called away at $${pos.strike}.`, 'success');
    }
    pendingOp.current = false;
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

      if (delta !== 0) {
        // Single fetch for both solvency check and update — prevents TOCTOU race
        const { data: acct } = await supabase.from('paper_accounts').select('current_cash').eq('user_id', user.id).single();
        const cash = Number(acct?.current_cash ?? 0);
        if (delta > 0 && delta > cash) return 'Insufficient cash to cover the increased collateral requirement';
        await supabase.from('paper_accounts').update({
          current_cash: cash - delta,
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
    await supabase.from('paper_positions').delete().eq('id', id).eq('user_id', user.id);
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
