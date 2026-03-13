import { useState, useCallback } from 'react';
import type { SortOption, StockTicker } from '../types';
import { MOCK_STOCKS } from '../lib/mockData';

const DEFAULT_TICKERS = ['GME', 'SOFI', 'MARA'];

export function useWatchlist() {
  const [tickers, setTickers] = useState<string[]>(DEFAULT_TICKERS);
  const [sort, setSort] = useState<SortOption>({ field: 'ivRank', direction: 'desc' });

  const stocks: StockTicker[] = MOCK_STOCKS.filter((s) => tickers.includes(s.ticker));

  const sortedStocks = [...stocks].sort((a, b) => {
    let aVal: string | number = a[sort.field === 'ticker' ? 'ticker' : sort.field];
    let bVal: string | number = b[sort.field === 'ticker' ? 'ticker' : sort.field];
    if (sort.direction === 'asc') return aVal > bVal ? 1 : -1;
    return aVal < bVal ? 1 : -1;
  });

  const addTicker = useCallback((ticker: string) => {
    const upper = ticker.toUpperCase().trim();
    if (!upper || tickers.includes(upper)) return;
    setTickers((prev) => [...prev, upper]);
  }, [tickers]);

  const removeTicker = useCallback((ticker: string) => {
    setTickers((prev) => prev.filter((t) => t !== ticker));
  }, []);

  const updateSort = useCallback((field: SortOption['field']) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  return { tickers, stocks: sortedStocks, sort, addTicker, removeTicker, updateSort };
}
