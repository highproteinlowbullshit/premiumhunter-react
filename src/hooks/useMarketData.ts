import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getWatchlistData,
  getStockDetailData,
  getSupabaseCachedToday,
  fetchScreenerStock,
} from '../lib/marketData';
import { STOCK_LIST } from '../lib/stockList';
import { getQuote } from '../lib/finnhub';
import type { ScreenerStock } from '../lib/screenerData';

const SCREENER_BATCH = 10;
const SCREENER_BATCH_DELAY_MS = 150;

// ── Screener streaming hook ───────────────────────────────────────────────────

export interface ScreenerStreamState {
  stocks: ScreenerStock[];
  loadedCount: number;
  total: number;
  isLoading: boolean;
}

/**
 * Streams screener data:
 * 1. Checks Supabase for today's cached IV rows (single query, instant)
 * 2. For cached tickers: fetches Finnhub price only (fast)
 * 3. For uncached tickers: fetches Finnhub + Polygon in batches of 10 with 150ms delay
 */
export function useScreenerStream(): ScreenerStreamState {
  const [stocks, setStocks] = useState<ScreenerStock[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setStocks([]);
    setLoadedCount(0);
    setIsLoading(true);

    async function run() {
      // ── Step 1: Check Supabase cache ──────────────────────────────────────
      const cachedMap = await getSupabaseCachedToday();
      const cachedTickers = STOCK_LIST.filter((s) => cachedMap.has(s.ticker));
      const uncachedTickers = STOCK_LIST.filter((s) => !cachedMap.has(s.ticker));

      // ── Step 2: Price-only fetch for cached tickers (fast Finnhub calls) ──
      if (cachedTickers.length > 0 && !cancelledRef.current) {
        const priceResults = await Promise.allSettled(
          cachedTickers.map((s) => getQuote(s.ticker))
        );
        if (!cancelledRef.current) {
          const cachedStocks: ScreenerStock[] = cachedTickers.map((s, i) => {
            const row = cachedMap.get(s.ticker)!;
            const quote =
              priceResults[i].status === 'fulfilled'
                ? (priceResults[i] as PromiseFulfilledResult<{ c: number; dp: number }>).value
                : null;
            return {
              ticker: s.ticker,
              name: s.name,
              sector: s.sector,
              price: quote?.c && quote.c > 0 ? quote.c : null,
              priceChange: quote?.dp ?? null,
              ivRank: row.iv_rank,
              ivPercentile: row.iv_percentile,
              currentIV: row.current_hv,
              hv30: row.hv_30,
              ivHvRatio: row.iv_hv_ratio,
              iv52wkHigh: row.hv_52wk_high,
              iv52wkLow: row.hv_52wk_low,
              volume: null,
              earningsDate: null,
              dataSource: 'cached' as const,
            };
          });
          setStocks(cachedStocks);
          setLoadedCount(cachedStocks.length);
        }
      }

      // ── Step 3: Full API fetch for uncached tickers in batches ────────────
      for (let i = 0; i < uncachedTickers.length && !cancelledRef.current; i += SCREENER_BATCH) {
        const batch = uncachedTickers.slice(i, i + SCREENER_BATCH);
        const results = await Promise.allSettled(
          batch.map((s) => fetchScreenerStock(s.ticker))
        );
        if (!cancelledRef.current) {
          const batchStocks = results.map((r, j) => {
            if (r.status === 'fulfilled') return r.value;
            // Failed: return shell with nulls
            const s = batch[j];
            console.error(`Screener fetch failed for ${s.ticker}:`, (r as PromiseRejectedResult).reason);
            return {
              ticker: s.ticker,
              name: s.name,
              sector: s.sector,
              price: null,
              priceChange: null,
              ivRank: null,
              ivPercentile: null,
              currentIV: null,
              hv30: null,
              ivHvRatio: null,
              iv52wkHigh: null,
              iv52wkLow: null,
              volume: null,
              earningsDate: null,
              dataSource: 'live' as const,
            } satisfies ScreenerStock;
          });
          setStocks((prev) => [...prev, ...batchStocks]);
          setLoadedCount((prev) => prev + batchStocks.length);
        }
        // Throttle between batches to respect Polygon rate limits
        if (i + SCREENER_BATCH < uncachedTickers.length && !cancelledRef.current) {
          await new Promise<void>((r) => setTimeout(r, SCREENER_BATCH_DELAY_MS));
        }
      }

      if (!cancelledRef.current) setIsLoading(false);
    }

    run().catch((err) => {
      console.error('useScreenerStream error:', err);
      if (!cancelledRef.current) setIsLoading(false);
    });

    return () => { cancelledRef.current = true; };
  }, []);

  return { stocks, loadedCount, total: STOCK_LIST.length, isLoading };
}

// ── Watchlist hook ────────────────────────────────────────────────────────────

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

// ── Stock detail hook ─────────────────────────────────────────────────────────

export function useStockDetailData(ticker: string) {
  return useQuery({
    queryKey: ['stockDetail', ticker],
    queryFn: () => getStockDetailData(ticker),
    staleTime: 2 * 60 * 1000,
    enabled: !!ticker,
  });
}
