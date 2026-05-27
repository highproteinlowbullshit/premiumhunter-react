import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { WheelPosition, WheelStrategy, PositionStatus } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as Sentry from '@sentry/react';

// ── DB row shape (snake_case from Supabase) ───────────────────────────────────
interface DbPosition {
  id: string;
  user_id: string;
  ticker: string;
  strategy: 'CSP' | 'CC';
  strike: number;
  expiry: string;
  premium_collected: number;
  contracts: number;
  status: 'open' | 'closed' | 'assigned' | 'expired';
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
  closing_price: number | null;
}

function dbToPosition(row: DbPosition): WheelPosition {
  const expDate = new Date(row.expiry + 'T00:00:00');
  const dte = Math.max(0, Math.ceil((expDate.getTime() - Date.now()) / 86_400_000));
  return {
    id: row.id,
    ticker: row.ticker,
    strategy: row.strategy as WheelStrategy,
    strike: Number(row.strike),
    expiry: row.expiry,
    // premiumCollected stored per-contract in DB → convert to total
    premiumCollected: Number(row.premium_collected) * (Number(row.contracts) || 1),
    // currentPrice: use closing price if recorded; 0 for closed/assigned/expired without one; 60% estimate only for open
    currentPrice:
      row.closing_price != null
        ? Number(row.closing_price)
        : row.status === 'open'
          ? Math.round(Number(row.premium_collected) * 0.6 * 100) / 100
          : 0,
    daysToExpiry: dte,
    status: row.status as PositionStatus,
    openedAt: row.opened_at.split('T')[0],
    closedAt: row.closed_at ? row.closed_at.split('T')[0] : undefined,
    contracts: Number(row.contracts) || 1,
  };
}

type AddPositionData = {
  ticker: string;
  strategy: WheelStrategy;
  strike: number;
  expiry: string;
  premiumCollected: number;  // per-contract
  contracts: number;
  checklistSnapshot?: object;
  optionFees?: number;       // total commission in dollars
};

type SnapshotPatch = {
  ticker: string;
  strike: number;
  expiry: string;
  contract_type: 'call' | 'put';
  bid: number | null;
  ask: number | null;
  mid: number | null;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePositions() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const qKey = useMemo(() => ['positions', user?.id] as const, [user?.id]);

  const [pricesLoading, setPricesLoading] = useState(false);
  const hasAutoFetched = useRef(false);

  const applySnapshots = useCallback((snapshots: SnapshotPatch[]) => {
    const snapMap = new Map<string, SnapshotPatch>();
    for (const s of snapshots) {
      const key = `${s.ticker}:${s.expiry}:${s.strike}:${s.contract_type}`;
      if (!snapMap.has(key)) snapMap.set(key, s);
    }
    queryClient.setQueryData(qKey, (old: WheelPosition[] = []) =>
      old.map(pos => {
        if (pos.status !== 'open') return pos;
        const contract_type = pos.strategy === 'CC' ? 'call' : 'put';
        const key = `${pos.ticker}:${pos.expiry}:${pos.strike}:${contract_type}`;
        const snap = snapMap.get(key);
        if (!snap) return pos;
        return {
          ...pos,
          currentPrice: snap.mid != null ? snap.mid : pos.currentPrice,
          optionBid: snap.bid ?? null,
          optionAsk: snap.ask ?? null,
          optionMid: snap.mid ?? null,
        };
      })
    );
  }, [queryClient, qKey]);

  const fetchAndApplyPrices = useCallback(async (
    body?: { ticker: string; strike: number; expiry: string; strategy: string },
    silent = true,
  ) => {
    if (!silent) setPricesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-option-prices', {
        ...(body ? { body } : {}),
      });
      if (error || !data?.success) {
        if (!silent) showToast('Could not refresh prices — try again.', 'error');
        return;
      }
      applySnapshots(data.snapshots ?? []);
    } catch {
      if (!silent) showToast('Could not refresh prices — try again.', 'error');
    } finally {
      if (!silent) setPricesLoading(false);
    }
  }, [applySnapshots, showToast]);

  const { data: positions = [], isLoading } = useQuery({
    queryKey: qKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wheel_positions')
        .select('id, ticker, strategy, strike, expiry, premium_collected, contracts, status, opened_at, closed_at, closing_price')
        .eq('user_id', user!.id)
        .order('opened_at', { ascending: false });
      if (error) throw error;
      const positions = (data as DbPosition[]).map(dbToPosition);

      // Enrich open positions with real bid/ask from option_price_snapshots
      const openPositions = positions.filter(p => p.status === 'open');
      if (openPositions.length > 0) {
        const tickers = [...new Set(openPositions.map(p => p.ticker))];
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
        const { data: snapshots } = await supabase
          .from('option_price_snapshots')
          .select('ticker, strike, expiry, contract_type, mid, bid, ask')
          .in('ticker', tickers)
          .gte('snapshot_date', yesterday)
          .order('snapshot_time', { ascending: false });

        // Build map keyed by "ticker:expiry:strike:contract_type" — take most recent per key
        const snapMap = new Map<string, { mid: number | null; bid: number | null; ask: number | null }>();
        for (const s of snapshots ?? []) {
          const key = `${s.ticker}:${s.expiry}:${s.strike}:${s.contract_type}`;
          if (!snapMap.has(key)) snapMap.set(key, { mid: s.mid, bid: s.bid, ask: s.ask });
        }

        for (const pos of positions) {
          if (pos.status !== 'open') continue;
          const contract_type = pos.strategy === 'CC' ? 'call' : 'put';
          const key = `${pos.ticker}:${pos.expiry}:${pos.strike}:${contract_type}`;
          const snap = snapMap.get(key);
          if (snap) {
            if (snap.mid != null) pos.currentPrice = snap.mid;
            pos.optionBid = snap.bid ?? null;
            pos.optionAsk = snap.ask ?? null;
            pos.optionMid = snap.mid ?? null;
          }
        }
      }

      return positions;
    },
    enabled: !!user,
    staleTime: 30_000,
    retry: 3,
    refetchOnWindowFocus: true,
  });

  // Auto-fetch on load: if any open position lacks a snapshot from DB, call edge fn once
  useEffect(() => {
    if (isLoading) return;
    if (hasAutoFetched.current) return;
    const open = positions.filter(p => p.status === 'open');
    if (open.length === 0) return;
    const needsFresh = open.some(p => p.optionBid == null && p.optionMid == null);
    if (!needsFresh) return;
    hasAutoFetched.current = true;
    void fetchAndApplyPrices(undefined, true);
  }, [positions, isLoading, fetchAndApplyPrices]);

  const refreshPrices = useCallback(async () => {
    await fetchAndApplyPrices(undefined, false);
  }, [fetchAndApplyPrices]);

  // ── Add position ────────────────────────────────────────────────────────────
  const addPosition = useCallback(
    async (data: AddPositionData) => {
      const expDate = new Date(data.expiry + 'T00:00:00');
      const dte = Math.max(0, Math.ceil((expDate.getTime() - Date.now()) / 86_400_000));
      const tempId = `tmp-${Date.now()}`;

      const optimistic: WheelPosition = {
        id: tempId,
        ticker: data.ticker.toUpperCase(),
        strategy: data.strategy,
        strike: data.strike,
        expiry: data.expiry,
        premiumCollected: data.premiumCollected * data.contracts,
        currentPrice: Math.round(data.premiumCollected * 0.6 * 100) / 100,
        daysToExpiry: dte,
        status: 'open',
        openedAt: new Date().toISOString().split('T')[0],
        contracts: data.contracts,
      };

      if (!user) return;

      queryClient.setQueryData(qKey, (old: WheelPosition[] = []) => [optimistic, ...old]);

      const { data: inserted, error } = await supabase
        .from('wheel_positions')
        .insert({
          user_id: user.id,
          ticker: data.ticker.toUpperCase(),
          strategy: data.strategy,
          strike: data.strike,
          expiry: data.expiry,
          premium_collected: data.premiumCollected,
          contracts: data.contracts,
          status: 'open',
          ...(data.checklistSnapshot ? { checklist_snapshot: data.checklistSnapshot } : {}),
        })
        .select('id, ticker, strategy, strike, expiry, premium_collected, contracts, status, opened_at, closed_at, closing_price')
        .single();

      if (error) {
        queryClient.setQueryData(qKey, (old: WheelPosition[] = []) =>
          old.filter((p) => p.id !== tempId)
        );
        Sentry.captureException(error);
        showToast(`Failed to save position: ${error.message}`, 'error');
      } else {
        queryClient.setQueryData(qKey, (old: WheelPosition[] = []) =>
          old.map((p) => (p.id === tempId ? dbToPosition(inserted as DbPosition) : p))
        );

        // Fetch fresh snapshot for the new position — silent, best-effort
        void fetchAndApplyPrices({
          ticker: data.ticker.toUpperCase(),
          strike: data.strike,
          expiry: data.expiry,
          strategy: data.strategy,
        }, true);

        // Credit premium received to cash holdings, minus any option fees
        const totalPremium = data.premiumCollected * data.contracts;
        const fees = data.optionFees ?? 0;
        const netCashDelta = totalPremium - fees;
        const { data: cashRow } = await supabase
          .from('portfolio_holdings')
          .select('id, quantity')
          .eq('user_id', user.id)
          .eq('holding_type', 'cash')
          .eq('status', 'open')
          .order('quantity', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cashRow) {
          const { error: cashErr } = await supabase
            .from('portfolio_holdings')
            .update({ quantity: Number(cashRow.quantity) + netCashDelta })
            .eq('id', cashRow.id);
          if (cashErr) {
            Sentry.captureException(cashErr);
            showToast('Position added — but failed to credit premium to cash. Update manually in Portfolio.', 'error');
            return;
          }
        } else {
          const { error: cashErr } = await supabase
            .from('portfolio_holdings')
            .insert({
              user_id: user.id,
              holding_type: 'cash',
              ticker: 'USD',
              quantity: netCashDelta,
              avg_cost: 1,
              status: 'open',
              notes: `Auto-created from ${data.strategy} premium — ${data.ticker.toUpperCase()} $${data.strike} strike`,
              opened_at: new Date().toISOString().split('T')[0],
            });
          if (cashErr) {
            Sentry.captureException(cashErr);
            showToast('Position added — but failed to record premium as cash. Update manually in Portfolio.', 'error');
            return;
          }
        }

        void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
        showToast('Position added', 'success');
      }
    },
    [user, showToast, queryClient, qKey, fetchAndApplyPrices]
  );

  // ── Remove (delete) position ────────────────────────────────────────────────
  const removePosition = useCallback(
    async (id: string, cashReversalAmount?: number) => {
      queryClient.setQueryData(qKey, (old: WheelPosition[] = []) =>
        old.filter((p) => p.id !== id)
      );

      if (!user || id.startsWith('tmp-')) return;

      const { error } = await supabase
        .from('wheel_positions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        Sentry.captureException(error);
        showToast('Failed to remove position — refresh to sync', 'error');
        await queryClient.invalidateQueries({ queryKey: qKey });
        return;
      }

      if (cashReversalAmount && cashReversalAmount > 0) {
        const { data: cashRow, error: fetchErr } = await supabase
          .from('portfolio_holdings')
          .select('id, quantity')
          .eq('user_id', user.id)
          .eq('holding_type', 'cash')
          .eq('status', 'open')
          .order('quantity', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchErr) {
          showToast('Position deleted — but failed to reverse cash credit. Update manually in Portfolio.', 'error');
          return;
        }

        if (cashRow) {
          const { error: cashErr } = await supabase
            .from('portfolio_holdings')
            .update({ quantity: Number(cashRow.quantity) - cashReversalAmount })
            .eq('id', cashRow.id)
            .eq('user_id', user.id);
          if (cashErr) {
            Sentry.captureException(cashErr);
            showToast('Position deleted — but failed to reverse cash credit. Update manually in Portfolio.', 'error');
            return;
          }
        }
      }

      void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      showToast('Position deleted', 'success');
    },
    [user, showToast, queryClient, qKey]
  );

  // ── Close position ──────────────────────────────────────────────────────────
  const closePosition = useCallback(
    async (id: string, closingPrice: number, contractsToClose?: number, optionFees?: number) => {
      const position = positions.find((p) => p.id === id);
      const closing = Math.min(contractsToClose ?? position?.contracts ?? 0, position?.contracts ?? 0);
      const isFullClose = !position || closing >= position.contracts;

      queryClient.setQueryData(qKey, (old: WheelPosition[] = []) =>
        old.map((p) => {
          if (p.id !== id) return p;
          if (isFullClose) return { ...p, status: 'closed' as PositionStatus, currentPrice: closingPrice };
          return { ...p, contracts: p.contracts - closing, premiumCollected: p.premiumCollected * ((p.contracts - closing) / p.contracts) };
        })
      );

      if (!user) return;

      const updatePayload = isFullClose
        ? { status: 'closed', closing_price: closingPrice, closed_at: new Date().toISOString() }
        : { contracts: position!.contracts - closing };

      const { error } = await supabase
        .from('wheel_positions')
        .update(updatePayload)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        Sentry.captureException(error);
        showToast('Failed to close position', 'error');
        await queryClient.invalidateQueries({ queryKey: qKey });
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ['monthly-target'] });
      void queryClient.invalidateQueries({ queryKey: ['monthly-pnl'] });
      void queryClient.invalidateQueries({ queryKey: ['ticker-performance'] });

      // Buy To Close — deduct BTC cost + option fees for the closed contracts.
      if ((closingPrice > 0 || (optionFees ?? 0) > 0) && position) {
        const btcCost = closingPrice * closing;
        const fees = optionFees ?? 0;
        const totalDeduction = btcCost + fees;

        const { data: cashRow } = await supabase
          .from('portfolio_holdings')
          .select('id, quantity')
          .eq('user_id', user.id)
          .eq('holding_type', 'cash')
          .eq('status', 'open')
          .order('quantity', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cashRow) {
          const { error: cashErr } = await supabase
            .from('portfolio_holdings')
            .update({ quantity: Number(cashRow.quantity) - totalDeduction })
            .eq('id', cashRow.id)
            .eq('user_id', user.id);

          if (cashErr) {
            Sentry.captureException(cashErr);
            showToast('Position closed — but failed to deduct BTC cost from cash. Update manually in Portfolio.', 'error');
            return;
          }
        } else {
          const { error: cashErr } = await supabase
            .from('portfolio_holdings')
            .insert({
              user_id: user.id,
              holding_type: 'cash',
              ticker: 'USD',
              quantity: -totalDeduction,
              avg_cost: 1,
              status: 'open',
              notes: `Auto-created from BTC — ${position?.strategy ?? ''} ${position?.ticker ?? ''} $${position?.strike ?? ''} strike`,
              opened_at: new Date().toISOString().split('T')[0],
            });

          if (cashErr) {
            Sentry.captureException(cashErr);
            showToast('Position closed — but failed to record cash outflow. Update manually in Portfolio.', 'error');
            return;
          }
        }

        // CC close: record net premium retained for the closed contracts and update lot cost basis.
        // Always update — a loss (negative netRetained) also adjusts the lot upward.
        if (position.strategy === 'CC') {
          const premiumForClosed = position.premiumCollected * (closing / position.contracts);
          const netRetained = premiumForClosed - btcCost - (optionFees ?? 0);
          const { data: lot } = await supabase
            .from('assigned_share_lots')
            .select('id, shares, contracts, total_premium_collected, net_cost_basis')
            .eq('user_id', user.id)
            .eq('ticker', position.ticker)
            .eq('status', 'holding')
            .order('assignment_date', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lot) {
            const lotTotalShares = Number(lot.shares) * Number(lot.contracts);
            const newTotalPremium = Number(lot.total_premium_collected) + netRetained;
            const newNetCost = Math.max(0, Number(lot.net_cost_basis) - netRetained);
            const newCostPerShare = lotTotalShares > 0 ? newNetCost / lotTotalShares : 0;

            await Promise.all([
              supabase.from('lot_premium_events').insert({
                lot_id: lot.id,
                user_id: user.id,
                event_type: 'cc_premium',
                premium_amount: Math.round(netRetained * 100) / 100,
                event_date: new Date().toISOString().split('T')[0],
              }),
              supabase.from('assigned_share_lots').update({
                total_premium_collected: Math.round(newTotalPremium * 100) / 100,
                net_cost_basis: Math.round(newNetCost * 100) / 100,
                cost_basis_per_share: Math.round(newCostPerShare * 100) / 100,
              }).eq('id', lot.id),
            ]);
          }
        }
      }

      // Invalidate portfolio after all DB writes complete so the refetch sees the updated cash.
      void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      void queryClient.invalidateQueries({ queryKey: ['portfolio-enhanced'] });

      showToast(isFullClose ? 'Position closed' : `Closed ${closing}/${position?.contracts ?? closing} contracts`, 'success');
    },
    [user, showToast, queryClient, qKey, positions]
  );

  // ── Assign position ─────────────────────────────────────────────────────────
  const assignPosition = useCallback(
    async (id: string, data: { strategy: 'CSP' | 'CC'; ticker: string; strike: number; contracts: number; premiumCollected: number }) => {
      queryClient.setQueryData(qKey, (old: WheelPosition[] = []) =>
        old.map((p) => p.id === id ? { ...p, status: 'assigned' as PositionStatus } : p)
      );

      if (!user || id.startsWith('tmp-')) return;

      const { error } = await supabase
        .from('wheel_positions')
        .update({ status: 'assigned', closed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        Sentry.captureException(error);
        showToast('Failed to mark assignment', 'error');
        await queryClient.invalidateQueries({ queryKey: qKey });
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ['monthly-target'] });
      void queryClient.invalidateQueries({ queryKey: ['monthly-pnl'] });
      void queryClient.invalidateQueries({ queryKey: ['ticker-performance'] });

      if (data.strategy === 'CSP') {
        const premiumPerShare = (data.premiumCollected / data.contracts) / 100;
        const effectiveBasis = Math.max(0, data.strike - premiumPerShare);
        const newQty = data.contracts * 100;
        const today = new Date().toISOString().split('T')[0];

        const { data: existing, error: fetchErr } = await supabase
          .from('portfolio_holdings')
          .select('id, quantity, avg_cost, notes')
          .eq('user_id', user.id)
          .eq('ticker', data.ticker)
          .eq('holding_type', 'shares')
          .eq('status', 'open')
          .maybeSingle();

        if (fetchErr) {
          Sentry.captureException(fetchErr);
        }

        let holdingErr;

        if (existing) {
          const existingQty = Number(existing.quantity);
          const existingAvg = Number(existing.avg_cost);
          const mergedQty = existingQty + newQty;
          const mergedAvg = (existingQty * existingAvg + newQty * effectiveBasis) / mergedQty;

          ({ error: holdingErr } = await supabase
            .from('portfolio_holdings')
            .update({
              quantity: mergedQty,
              avg_cost: Number(mergedAvg.toFixed(4)),
              notes: `${existing.notes ?? ''} · +${newQty} assigned from CSP $${data.strike} strike`.trim(),
            })
            .eq('id', existing.id)
            .eq('user_id', user.id));

          if (!holdingErr) {
            showToast(
              `Assigned! Merged ${newQty} ${data.ticker} shares — new avg $${mergedAvg.toFixed(2)}/share (${mergedQty} total)`,
              'success',
            );
          }
        } else {
          ({ error: holdingErr } = await supabase
            .from('portfolio_holdings')
            .insert({
              user_id: user.id,
              ticker: data.ticker,
              holding_type: 'shares',
              quantity: newQty,
              avg_cost: Number(effectiveBasis.toFixed(4)),
              opened_at: today,
              status: 'open',
              notes: `Assigned from CSP — $${data.strike} strike`,
            }));

          if (!holdingErr) {
            showToast(`Assigned! Added ${newQty} ${data.ticker} shares at $${effectiveBasis.toFixed(2)}/share`, 'success');
          }
        }

        if (holdingErr) {
          Sentry.captureException(holdingErr);
          showToast('Assigned — but failed to update shares holding. Add manually in Portfolio.', 'error');
        }

        // Deduct gross share purchase cost from cash (premium was already credited at open)
        const grossCost = data.strike * data.contracts * 100;
        const { data: cspCashRow } = await supabase
          .from('portfolio_holdings')
          .select('id, quantity')
          .eq('user_id', user.id)
          .eq('holding_type', 'cash')
          .eq('status', 'open')
          .order('quantity', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cspCashRow) {
          const { error: cashErr } = await supabase
            .from('portfolio_holdings')
            .update({ quantity: Number(cspCashRow.quantity) - grossCost })
            .eq('id', cspCashRow.id)
            .eq('user_id', user.id);
          if (cashErr) {
            Sentry.captureException(cashErr);
            showToast('Assigned — but failed to deduct share purchase cost from cash. Update manually in Portfolio.', 'error');
          }
        } else {
          const { error: cashErr } = await supabase
            .from('portfolio_holdings')
            .insert({
              user_id: user.id,
              holding_type: 'cash',
              ticker: 'USD',
              quantity: -grossCost,
              avg_cost: 1,
              status: 'open',
              notes: `Auto-created from CSP assignment — ${data.ticker} $${data.strike} strike`,
              opened_at: today,
            });
          if (cashErr) {
            Sentry.captureException(cashErr);
            showToast('Assigned — but failed to record cash outflow. Update manually in Portfolio.', 'error');
          }
        }

        void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
        void queryClient.invalidateQueries({ queryKey: ['portfolio-enhanced'] });
      } else {
        // CC assigned: close the share lot and record the capital gain
        const today = new Date().toISOString().split('T')[0];
        const totalSharesCalled = data.contracts * 100;

        // Find the open lot (prefer matching contract count, fall back to oldest)
        const { data: openLots, error: lotFetchErr } = await supabase
          .from('assigned_share_lots')
          .select('id, assignment_strike, cost_basis_per_share, shares, contracts, total_premium_collected')
          .eq('user_id', user.id)
          .eq('ticker', data.ticker)
          .eq('status', 'holding')
          .order('assignment_date', { ascending: true });

        if (lotFetchErr) Sentry.captureException(lotFetchErr);

        const lot = openLots?.find(l => Number(l.contracts) === data.contracts) ?? openLots?.[0];

        let capitalGain: number | null = null;

        if (lot) {
          const totalShares = Number(lot.shares) * Number(lot.contracts);
          // Capital gain = sale price vs acquisition price (assignment strike).
          // CSP premium is tracked separately in assignmentPremium — using cost_basis_per_share
          // (which has premium subtracted) would double-count it as capital gain.
          const acquisitionPricePerShare = Number(lot.assignment_strike);
          capitalGain = Math.round((data.strike - acquisitionPricePerShare) * totalShares * 100) / 100;
          const totalLotReturn = Math.round((capitalGain + Number(lot.total_premium_collected)) * 100) / 100;

          const { error: lotUpdateErr } = await supabase
            .from('assigned_share_lots')
            .update({
              status: 'called_away',
              exit_date: today,
              exit_price: data.strike,
              realized_capital_gain: capitalGain,
              total_lot_return: totalLotReturn,
            })
            .eq('id', lot.id)
            .eq('user_id', user.id);

          if (lotUpdateErr) {
            Sentry.captureException(lotUpdateErr);
            showToast('Assigned — but failed to record capital gain. Check Portfolio.', 'error');
          }
        }

        // Close the portfolio_holdings share position
        const { error: holdingCloseErr } = await supabase
          .from('portfolio_holdings')
          .update({ status: 'closed' })
          .eq('user_id', user.id)
          .eq('ticker', data.ticker)
          .eq('holding_type', 'shares')
          .eq('status', 'open');

        if (holdingCloseErr) {
          Sentry.captureException(holdingCloseErr);
          showToast('Assigned — but failed to close shares holding. Remove manually in Portfolio.', 'error');
        }

        // Credit sale proceeds to cash (shares sold at CC strike)
        const saleProceeds = data.strike * data.contracts * 100;
        const { data: ccCashRow } = await supabase
          .from('portfolio_holdings')
          .select('id, quantity')
          .eq('user_id', user.id)
          .eq('holding_type', 'cash')
          .eq('status', 'open')
          .order('quantity', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (ccCashRow) {
          const { error: cashErr } = await supabase
            .from('portfolio_holdings')
            .update({ quantity: Number(ccCashRow.quantity) + saleProceeds })
            .eq('id', ccCashRow.id)
            .eq('user_id', user.id);
          if (cashErr) {
            Sentry.captureException(cashErr);
            showToast('Assigned — but failed to credit sale proceeds to cash. Update manually in Portfolio.', 'error');
          }
        } else {
          const { error: cashErr } = await supabase
            .from('portfolio_holdings')
            .insert({
              user_id: user.id,
              holding_type: 'cash',
              ticker: 'USD',
              quantity: saleProceeds,
              avg_cost: 1,
              status: 'open',
              notes: `Auto-created from CC assignment — ${data.ticker} $${data.strike} strike`,
              opened_at: today,
            });
          if (cashErr) {
            Sentry.captureException(cashErr);
            showToast('Assigned — but failed to record cash inflow. Update manually in Portfolio.', 'error');
          }
        }

        void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
        void queryClient.invalidateQueries({ queryKey: ['portfolio-enhanced'] });

        const gainLabel = capitalGain !== null
          ? ` · ${capitalGain >= 0 ? '+' : ''}$${Math.abs(capitalGain).toFixed(0)} capital gain`
          : '';
        showToast(`Assigned — ${totalSharesCalled} ${data.ticker} shares called away at $${data.strike}${gainLabel}`, 'success');
      }
    },
    [user, showToast, queryClient, qKey]
  );

  // ── Edit position ───────────────────────────────────────────────────────────
  const editPosition = useCallback(
    async (id: string, data: { strike: number; expiry: string; premiumCollected: number; contracts: number }) => {
      const oldPosition = positions.find((p) => p.id === id);
      const oldTotal = oldPosition ? oldPosition.premiumCollected : 0;
      const newTotal = data.premiumCollected * data.contracts;
      const premiumDelta = newTotal - oldTotal;

      const newDte = Math.max(0, Math.ceil((new Date(data.expiry + 'T00:00:00').getTime() - Date.now()) / 86_400_000));
      queryClient.setQueryData(qKey, (old: WheelPosition[] = []) =>
        old.map((p) =>
          p.id === id
            ? { ...p, strike: data.strike, expiry: data.expiry, premiumCollected: newTotal, contracts: data.contracts, daysToExpiry: newDte }
            : p
        )
      );

      if (!user || id.startsWith('tmp-')) return;

      const { error } = await supabase
        .from('wheel_positions')
        .update({
          strike: data.strike,
          expiry: data.expiry,
          premium_collected: data.premiumCollected,
          contracts: data.contracts,
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        Sentry.captureException(error);
        showToast('Failed to update position', 'error');
        await queryClient.invalidateQueries({ queryKey: qKey });
        return;
      }

      if (premiumDelta !== 0) {
        const { data: cashRow } = await supabase
          .from('portfolio_holdings')
          .select('id, quantity')
          .eq('user_id', user.id)
          .eq('holding_type', 'cash')
          .eq('status', 'open')
          .order('quantity', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cashRow) {
          const { error: cashErr } = await supabase
            .from('portfolio_holdings')
            .update({ quantity: Number(cashRow.quantity) + premiumDelta })
            .eq('id', cashRow.id);
          if (cashErr) {
            Sentry.captureException(cashErr);
            showToast('Position updated — but failed to adjust cash for premium change. Update manually in Portfolio.', 'error');
            return;
          }
        } else {
          const { error: cashErr } = await supabase
            .from('portfolio_holdings')
            .insert({
              user_id: user.id,
              holding_type: 'cash',
              ticker: 'USD',
              quantity: premiumDelta,
              avg_cost: 1,
              status: 'open',
              notes: `Auto-created from premium edit — ${oldPosition?.ticker ?? ''} position`,
              opened_at: new Date().toISOString().split('T')[0],
            });
          if (cashErr) {
            Sentry.captureException(cashErr);
            showToast('Position updated — but failed to record premium adjustment in cash. Update manually in Portfolio.', 'error');
            return;
          }
        }

        void queryClient.invalidateQueries({ queryKey: ['portfolio', user?.id] });
      }

      showToast('Position updated', 'success');
    },
    [user, showToast, queryClient, qKey, positions]
  );

  // ── Derived values ──────────────────────────────────────────────────────────
  const openPositions = positions.filter((p) => p.status === 'open');

  // Monthly avg P&L: total realized ÷ distinct calendar months that had at least one close
  const closedOnly = positions.filter((p) => p.status === 'closed' || p.status === 'assigned' || p.status === 'expired');
  const totalRealized = closedOnly.reduce(
    (acc, p) => {
      // assigned/expired: full premium kept (currentPrice is 0 for these statuses)
      const pnl = p.status === 'assigned' || p.status === 'expired'
        ? p.premiumCollected
        : p.premiumCollected - p.currentPrice * p.contracts;
      return acc + pnl;
    },
    0
  );
  const monthlyPnL = (() => {
    if (closedOnly.length === 0) return 0;
    // Use closedAt for closed positions; fall back to expiry for assigned/expired
    const distinctMonths = new Set(
      closedOnly.map(p => (p.closedAt ?? p.expiry ?? '').slice(0, 7)).filter(Boolean)
    );
    return totalRealized / Math.max(1, distinctMonths.size);
  })();

  return { positions, openPositions, monthlyPnL, isLoading, addPosition, removePosition, closePosition, editPosition, assignPosition, refreshPrices, pricesLoading };
}
