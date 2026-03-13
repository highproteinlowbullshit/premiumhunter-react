import { useQuery } from '@tanstack/react-query';
import { MOCK_IV_HISTORY, MOCK_STOCKS } from '../lib/mockData';
import type { IVDataPoint, StockTicker } from '../types';

export function useIVData(ticker: string) {
  return useQuery<IVDataPoint[]>({
    queryKey: ['iv-history', ticker],
    queryFn: async () => {
      // Simulate network delay
      await new Promise((r) => setTimeout(r, 300));
      return MOCK_IV_HISTORY[ticker] || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useStockDetail(ticker: string) {
  return useQuery<StockTicker | null>({
    queryKey: ['stock-detail', ticker],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 200));
      return MOCK_STOCKS.find((s) => s.ticker === ticker) || null;
    },
    staleTime: 5 * 60 * 1000,
  });
}
