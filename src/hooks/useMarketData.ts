import { useQuery } from '@tanstack/react-query';
import {
  getScreenerData,
  getWatchlistData,
  getStockDetailData,
} from '../lib/marketData';

export function useScreenerData() {
  return useQuery({
    queryKey: ['screener'],
    queryFn: getScreenerData,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useWatchlistData(tickers: string[]) {
  const key = [...tickers].sort().join(',');
  return useQuery({
    queryKey: ['watchlist', key],
    queryFn: () => getWatchlistData(tickers),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    enabled: tickers.length > 0,
  });
}

export function useStockDetailData(ticker: string) {
  return useQuery({
    queryKey: ['stockDetail', ticker],
    queryFn: () => getStockDetailData(ticker),
    staleTime: 2 * 60 * 1000,
    enabled: !!ticker,
  });
}
