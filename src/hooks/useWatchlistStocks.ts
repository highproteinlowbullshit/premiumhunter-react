import { useMemo } from 'react';
import type { SortOption, StockTicker } from '../types';
import { MOCK_STOCKS } from '../lib/mockData';

// Separated so both useWatchlist and Watchlist page can use it
export function useWatchlistStocks(tickers: string[], sort: SortOption): StockTicker[] {
  return useMemo(() => {
    const stocks = MOCK_STOCKS.filter((s) => tickers.includes(s.ticker));
    return [...stocks].sort((a, b) => {
      const aVal = a[sort.field === 'ticker' ? 'ticker' : sort.field] as string | number;
      const bVal = b[sort.field === 'ticker' ? 'ticker' : sort.field] as string | number;
      if (sort.direction === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [tickers, sort]);
}
