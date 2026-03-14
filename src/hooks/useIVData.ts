import { useQuery } from '@tanstack/react-query';
import { getIVData } from '../lib/polygon';
import { getStockDetailData } from '../lib/marketData';
import type { IVDataPoint, StockTicker } from '../types';

export function useIVData(ticker: string) {
  return useQuery<IVDataPoint[]>({
    queryKey: ['iv-history', ticker],
    queryFn: async () => {
      const data = await getIVData(ticker);
      return data.weeklyHistory;
    },
    staleTime: 6 * 60 * 60 * 1000, // matches Polygon cache TTL
    enabled: !!ticker,
  });
}

export function useStockDetail(ticker: string) {
  return useQuery<StockTicker | null>({
    queryKey: ['stock-detail', ticker],
    queryFn: async () => {
      const result = await getStockDetailData(ticker);
      return result.stock;
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!ticker,
  });
}
