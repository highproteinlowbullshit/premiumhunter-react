import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { SortOption } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import * as Sentry from '@sentry/react';

const DEFAULT_TICKERS = ['GME', 'SOFI', 'MARA'];

interface WatchlistContextValue {
  tickers: string[];
  sort: SortOption;
  addTicker: (ticker: string) => void;
  removeTicker: (ticker: string) => void;
  updateSort: (field: SortOption['field']) => void;
  isWatched: (ticker: string) => boolean;
}

const WatchlistContext = createContext<WatchlistContextValue | undefined>(undefined);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tickers, setTickers] = useState<string[]>(DEFAULT_TICKERS);
  const [sort, setSort] = useState<SortOption>({ field: 'ivRank', direction: 'desc' });

  // Load watchlist from Supabase whenever user changes
  useEffect(() => {
    if (!user) {
      setTickers(DEFAULT_TICKERS);
      return;
    }

    supabase
      .from('watchlist_items')
      .select('ticker')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setTickers(data.length > 0 ? data.map((r) => r.ticker) : DEFAULT_TICKERS);
        }
      });
  }, [user?.id]);

  const addTicker = useCallback(
    async (ticker: string) => {
      const upper = ticker.toUpperCase().trim();
      if (!upper || tickers.includes(upper)) return;

      // Optimistic update
      setTickers((prev) => [...prev, upper]);

      if (user) {
        const { error } = await supabase
          .from('watchlist_items')
          .insert({ user_id: user.id, ticker: upper });

        if (error) {
          // Revert on failure
          setTickers((prev) => prev.filter((t) => t !== upper));
          Sentry.captureException(error);
          showToast(`Failed to add ${upper}`, 'error');
        } else {
          showToast(`${upper} added to watchlist`, 'success');
        }
      }
    },
    [tickers, user, showToast]
  );

  const removeTicker = useCallback(
    async (ticker: string) => {
      // Optimistic update
      setTickers((prev) => prev.filter((t) => t !== ticker));

      if (user) {
        const { error } = await supabase
          .from('watchlist_items')
          .delete()
          .eq('user_id', user.id)
          .eq('ticker', ticker);

        if (error) {
          // Revert on failure
          setTickers((prev) =>
            prev.includes(ticker) ? prev : [...prev, ticker]
          );
          Sentry.captureException(error);
          showToast(`Failed to remove ${ticker}`, 'error');
        } else {
          showToast(`${ticker} removed from watchlist`, 'info');
        }
      }
    },
    [user, showToast]
  );

  const updateSort = useCallback((field: SortOption['field']) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  const isWatched = useCallback(
    (ticker: string) => tickers.includes(ticker),
    [tickers]
  );

  return (
    <WatchlistContext.Provider
      value={{ tickers, sort, addTicker, removeTicker, updateSort, isWatched }}
    >
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlistContext() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error('useWatchlistContext must be used inside <WatchlistProvider>');
  return ctx;
}
