import { useMemo } from 'react';
import type { SortOption, StockTicker } from '../types';
import { STOCK_LIST } from '../lib/stockList';

// Returns placeholder StockTicker objects with name/ticker from STOCK_LIST.
// Actual live data (price, IV) is loaded separately via useWatchlistData.
export function useWatchlistStocks(tickers: string[], sort: SortOption): StockTicker[] {
  return useMemo(() => {
    const stocks: StockTicker[] = tickers.map((ticker) => {
      const meta = STOCK_LIST.find((s) => s.ticker === ticker);
      return {
        ticker,
        name: meta?.name ?? ticker,
        price: 0,
        ivRank: 0,
        ivPercentile: 0,
        currentIV: 0,
        historicalVol: 0,
        trend: 'flat' as const,
      };
    });
    return [...stocks].sort((a, b) => {
      const aVal = a[sort.field === 'ticker' ? 'ticker' : sort.field] as string | number;
      const bVal = b[sort.field === 'ticker' ? 'ticker' : sort.field] as string | number;
      if (sort.direction === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [tickers, sort]);
}
