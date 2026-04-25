import { useCallback } from 'react';
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
  const expDate = new Date(row.expiry);
  const dte = Math.max(0, Math.ceil((expDate.getTime() - Date.now()) / 86_400_000));
  return {
    id: row.id,
    ticker: row.ticker,
    strategy: row.strategy as WheelStrategy,
    strike: Number(row.strike),
    expiry: row.expiry,
    // premiumCollected stored per-contract in DB → convert to total
    premiumCollected: Number(row.premium_collected) * (Number(row.contracts) || 1),
    // currentPrice: use closing price if closed; 0 for assigned/expired (full premium kept); 60% estimate for open
    currentPrice:
      row.closing_price != null
        ? Number(row.closing_price)
        : row.status === 'assigned' || row.status === 'expired'
          ? 0
          : Math.round(Number(row.premium_collected) * 0.6 * 100) / 100,
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
  checklistSnapshot?: object;  // serialised ChecklistResult
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePositions() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const qKey = ['positions', user?.id] as const;

  const { data: positions = [], isLoading } = useQuery({
    queryKey: qKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wheel_positions')
        .select('id, ticker, strategy, strike, expiry, premium_collected, contracts, status, opened_at, closed_at, closing_price')
        .eq('user_id', user!.id)
        .order('opened_at', { ascending: false });
      if (error) throw error;
      return (data as DbPosition[]).map(dbToPosition);
    },
    enabled: !!user,
    staleTime: 30_000,
    retry: 3,
  });

  // ── Add position ────────────────────────────────────────────────────────────
  const addPosition = useCallback(
    async (data: AddPositionData) => {
      const expDate = new Date(data.expiry);
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

      queryClient.setQueryData(qKey, (old: WheelPosition[] = []) => [optimistic, ...old]);

      if (!user) return;

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

        // Credit premium received to cash holdings
        const totalPremium = data.premiumCollected * data.contracts;
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
            .update({ quantity: Number(cashRow.quantity) + totalPremium })
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
              quantity: totalPremium,
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

        showToast('Position added', 'success');
      }
    },
    [user, showToast, queryClient, qKey]
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

      showToast('Position deleted', 'success');
    },
    [user, showToast, queryClient, qKey]
  );

  // ── Close position ──────────────────────────────────────────────────────────
  const closePosition = useCallback(
    async (id: string, closingPrice: number) => {
      const position = positions.find((p) => p.id === id);

      queryClient.setQueryData(qKey, (old: WheelPosition[] = []) =>
        old.map((p) =>
          p.id === id
            ? { ...p, status: 'closed' as PositionStatus, currentPrice: closingPrice }
            : p
        )
      );

      if (!user) return;

      const { error } = await supabase
        .from('wheel_positions')
        .update({
          status: 'closed',
          closing_price: closingPrice,
          closed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        Sentry.captureException(error);
        showToast('Failed to close position', 'error');
        await queryClient.invalidateQueries({ queryKey: qKey });
        return;
      }

      // For CC closed early (Buy To Close), deduct the BTC cost from cash holdings.
      if (position?.strategy === 'CC' && closingPrice > 0) {
        const btcCost = closingPrice * position.contracts;

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
            .update({ quantity: Number(cashRow.quantity) - btcCost })
            .eq('id', cashRow.id);

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
              quantity: -btcCost,
              avg_cost: 1,
              status: 'open',
              notes: `Auto-created from CC BTC — ${position.ticker} $${position.strike} strike`,
              opened_at: new Date().toISOString().split('T')[0],
            });

          if (cashErr) {
            Sentry.captureException(cashErr);
            showToast('Position closed — but failed to record cash outflow. Update manually in Portfolio.', 'error');
            return;
          }
        }
      }

      showToast('Position closed', 'success');
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
      } else {
        showToast(`Assigned — ${data.contracts * 100} ${data.ticker} shares called away at $${data.strike}`, 'success');
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

      const newDte = Math.max(0, Math.ceil((new Date(data.expiry).getTime() - Date.now()) / 86_400_000));
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
      }

      showToast('Position updated', 'success');
    },
    [user, showToast, queryClient, qKey, positions]
  );

  // ── Derived values ──────────────────────────────────────────────────────────
  const openPositions = positions.filter((p) => p.status === 'open');

  // Monthly avg P&L: total realized from closed trades ÷ months elapsed since first trade
  const closedOnly = positions.filter((p) => p.status === 'closed');
  const totalRealized = closedOnly.reduce(
    (acc, p) => acc + (p.premiumCollected - p.currentPrice * p.contracts),
    0
  );
  const monthlyPnL = (() => {
    if (closedOnly.length === 0) return 0;
    const earliest = closedOnly.reduce(
      (min, p) => (p.openedAt < min ? p.openedAt : min),
      closedOnly[0].openedAt
    );
    const monthsElapsed = Math.max(
      1,
      (Date.now() - new Date(earliest).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    );
    return totalRealized / monthsElapsed;
  })();

  return { positions, openPositions, monthlyPnL, isLoading, addPosition, removePosition, closePosition, editPosition, assignPosition };
}
