import { useState, useEffect, useCallback } from 'react';
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
  status: 'open' | 'closed' | 'assigned';
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
    premiumCollected: Number(row.premium_collected) * row.contracts,
    // currentPrice: use closing price if closed, else estimate 60% of per-contract premium
    currentPrice:
      row.closing_price != null
        ? Number(row.closing_price)
        : Math.round(Number(row.premium_collected) * 0.6 * 100) / 100,
    daysToExpiry: dte,
    status: row.status as PositionStatus,
    openedAt: row.opened_at.split('T')[0],
    contracts: row.contracts,
  };
}

type AddPositionData = {
  ticker: string;
  strategy: WheelStrategy;
  strike: number;
  expiry: string;
  premiumCollected: number;  // per-contract
  contracts: number;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePositions() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [positions, setPositions] = useState<WheelPosition[]>([]);

  // Load from Supabase whenever the logged-in user changes
  useEffect(() => {
    if (!user) {
      setPositions([]);
      return;
    }

    supabase
      .from('wheel_positions')
      .select('*')
      .eq('user_id', user.id)
      .order('opened_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setPositions((data as DbPosition[]).map(dbToPosition));
        }
      });
  }, [user?.id]);

  // ── Add position ────────────────────────────────────────────────────────────
  const addPosition = useCallback(
    async (data: AddPositionData) => {
      const expDate = new Date(data.expiry);
      const dte = Math.max(0, Math.ceil((expDate.getTime() - Date.now()) / 86_400_000));
      const tempId = `tmp-${Date.now()}`;

      // Optimistic insert with temp ID
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

      setPositions((prev) => [optimistic, ...prev]);

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
        })
        .select('*')
        .single();

      if (error) {
        setPositions((prev) => prev.filter((p) => p.id !== tempId));
        Sentry.captureException(error);
        showToast('Failed to save position', 'error');
      } else {
        // Swap temp ID for the real Supabase UUID
        setPositions((prev) =>
          prev.map((p) => (p.id === tempId ? dbToPosition(inserted as DbPosition) : p))
        );
        showToast('Position added', 'success');
      }
    },
    [user, showToast]
  );

  // ── Remove (delete) position ────────────────────────────────────────────────
  const removePosition = useCallback(
    async (id: string) => {
      setPositions((prev) => prev.filter((p) => p.id !== id)); // optimistic

      if (!user || id.startsWith('tmp-')) return;

      const { error } = await supabase
        .from('wheel_positions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        Sentry.captureException(error);
        showToast('Failed to remove position — refresh to sync', 'error');
      }
    },
    [user, showToast]
  );

  // ── Close position ──────────────────────────────────────────────────────────
  const closePosition = useCallback(
    async (id: string, closingPrice: number) => {
      setPositions((prev) =>
        prev.map((p) =>
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
      } else {
        showToast('Position closed', 'success');
      }
    },
    [user, showToast]
  );

  // ── Derived values ──────────────────────────────────────────────────────────
  const openPositions = positions.filter((p) => p.status === 'open');

  const monthlyPnL = openPositions.reduce((acc, p) => {
    return acc + (p.premiumCollected - p.currentPrice * p.contracts);
  }, 0);

  return { positions, openPositions, monthlyPnL, addPosition, removePosition, closePosition };
}
