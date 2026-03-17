import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getWatchlistData,
  getStockDetailData,
  getSupabaseCachedToday,
  fetchScreenerStock,
} from '../lib/marketData';
import { STOCK_LIST } from '../lib/stockList';
import { getSnapshotBatch } from '../lib/polygon';
import { getQuote } from '../lib/finnhub';
import type { ScreenerStock } from '../lib/screenerData';

const SCREENER_BATCH = 20;         // tickers per batch
const SCREENER_BATCH_DELAY_MS = 50; // ms between batches
// 6 hours — matches the per-ticker Polygon localStorage TTL so both expire together
const SCREENER_CACHE_TTL = 6 * 60 * 60 * 1000;
const SCREENER_LS_KEY = 'ph_screener_v1';

// ── Module-level session cache ─────────────────────────────────────────────
// In-memory: survives navigation within a session.
// localStorage: survives page refreshes and tab closes (same 6h TTL).
interface ScreenerSessionCache {
  stocks: ScreenerStock[];
  loadedAt: number;
  isComplete: boolean;
}
let _cache: ScreenerSessionCache | null = null;

function loadFromStorage(): void {
  try {
    const raw = localStorage.getItem(SCREENER_LS_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw) as ScreenerSessionCache;
    if (stored.isComplete && Date.now() - stored.loadedAt < SCREENER_CACHE_TTL) {
      _cache = stored;
    } else {
      localStorage.removeItem(SCREENER_LS_KEY);
    }
  } catch { /* ignore parse errors or storage unavailable */ }
}

function saveToStorage(): void {
  if (!_cache?.isComplete) return;
  try {
    localStorage.setItem(SCREENER_LS_KEY, JSON.stringify(_cache));
  } catch { /* quota exceeded — non-fatal */ }
}

// Populate in-memory cache from localStorage at module load time
loadFromStorage();

function cacheIsFresh(): boolean {
  return !!_cache && _cache.isComplete && Date.now() - _cache.loadedAt < SCREENER_CACHE_TTL;
}

// ── Screener streaming hook ───────────────────────────────────────────────────

export interface ScreenerStreamState {
  stocks: ScreenerStock[];
  loadedCount: number;
  total: number;
  isLoading: boolean;
}

/**
 * Streams screener data with session caching:
 * - If cache is fresh (<5 min), returns instantly without any network calls.
 * 1. Supabase IV cache check + Polygon batch snapshot fire in parallel (2 calls total)
 * 2. Cached tickers: built instantly from snapshot prices — zero extra API calls
 * 3. Uncached tickers: HV-only Polygon call per ticker (snapshot already has price)
 */
export function useScreenerStream(): ScreenerStreamState {
  const [stocks, setStocks] = useState<ScreenerStock[]>(_cache?.stocks ?? []);
  const [loadedCount, setLoadedCount] = useState(_cache?.stocks.length ?? 0);
  const [isLoading, setIsLoading] = useState(!cacheIsFresh());
  const cancelledRef = useRef(false);

  useEffect(() => {
    // Return cached results immediately — no network needed
    if (cacheIsFresh()) return;

    cancelledRef.current = false;
    if (!_cache) {
      setStocks([]);
      setLoadedCount(0);
    }
    setIsLoading(true);

    async function run() {
      // ── Step 1: Supabase IV cache + Polygon batch snapshot (parallel) ──────
      // Single snapshot call replaces N individual Finnhub price calls.
      const [cachedMap, snapshotMap] = await Promise.all([
        getSupabaseCachedToday(),
        getSnapshotBatch(STOCK_LIST.map((s) => s.ticker)),
      ]);
      const cachedTickers = STOCK_LIST.filter((s) => cachedMap.has(s.ticker));
      const uncachedTickers = STOCK_LIST.filter((s) => !cachedMap.has(s.ticker));

      // ── Step 2: Build cached rows instantly — prices from snapshot ──────────
      if (cachedTickers.length > 0 && !cancelledRef.current) {
        const cachedStocks: ScreenerStock[] = cachedTickers.map((s) => {
          const row = cachedMap.get(s.ticker)!;
          const snap = snapshotMap.get(s.ticker);
          return {
            ticker: s.ticker,
            name: s.name,
            sector: s.sector,
            price: snap?.price ?? null,
            priceChange: snap?.priceChangePct ?? null,
            ivRank: row.iv_rank,
            ivPercentile: row.iv_percentile,
            currentIV: row.current_hv,
            hv30: row.hv_30,
            ivHvRatio: row.iv_hv_ratio,
            iv52wkHigh: row.hv_52wk_high,
            iv52wkLow: row.hv_52wk_low,
            volume: snap?.volume ?? null,
            earningsDate: null,
            dataSource: 'cached' as const,
          };
        });
        if (!cancelledRef.current) {
          setStocks(cachedStocks);
          setLoadedCount(cachedStocks.length);
          _cache = { stocks: cachedStocks, loadedAt: Date.now(), isComplete: uncachedTickers.length === 0 };
        }

        // ── Step 2b: Finnhub price fallback for cached tickers with null price ─
        // Polygon snapshot requires a paid plan — if it 403'd, snapshotMap is
        // empty and all prices are null. Fall back to Finnhub (free plan) for
        // only the tickers that are missing a price, batched to respect rate limits.
        const needsPrice = cachedTickers.filter((s) => snapshotMap.get(s.ticker)?.price == null);
        for (let i = 0; i < needsPrice.length && !cancelledRef.current; i += SCREENER_BATCH) {
          const batch = needsPrice.slice(i, i + SCREENER_BATCH);
          const quoteResults = await Promise.allSettled(batch.map((s) => getQuote(s.ticker)));
          if (!cancelledRef.current) {
            setStocks((prev) => {
              const updates = new Map<string, { price: number | null; priceChange: number | null }>();
              batch.forEach((s, j) => {
                const r = quoteResults[j];
                if (r.status === 'fulfilled') {
                  const q = r.value;
                  updates.set(s.ticker, {
                    price: q.c > 0 ? q.c : (q.pc > 0 ? q.pc : null),
                    priceChange: q.dp ?? null,
                  });
                }
              });
              const next = prev.map((stock) => {
                const update = updates.get(stock.ticker);
                return update ? { ...stock, ...update } : stock;
              });
              if (_cache) _cache = { ..._cache, stocks: next };
              return next;
            });
          }
          if (i + SCREENER_BATCH < needsPrice.length && !cancelledRef.current) {
            await new Promise<void>((r) => setTimeout(r, SCREENER_BATCH_DELAY_MS));
          }
        }
      }

      // ── Step 3: HV-only fetch for uncached tickers in batches ──────────────
      // skipSupabase=true: confirmed absent from Supabase in step 1.
      // preloadedQuote: snapshot already has price — skip the Finnhub call entirely.
      for (let i = 0; i < uncachedTickers.length && !cancelledRef.current; i += SCREENER_BATCH) {
        const batch = uncachedTickers.slice(i, i + SCREENER_BATCH);
        const results = await Promise.allSettled(
          batch.map((s) => {
            const snap = snapshotMap.get(s.ticker);
            // Only pass preloadedQuote when snapshot has a real price —
            // c:0 causes buildScreenerFromLive to cache a null price permanently.
            return fetchScreenerStock(s.ticker, {
              skipSupabase: true,
              preloadedQuote: snap?.price != null
                ? { c: snap.price, dp: snap.priceChangePct ?? 0 }
                : undefined,
            });
          })
        );
        if (!cancelledRef.current) {
          const batchStocks = results.map((r, j) => {
            if (r.status === 'fulfilled') return r.value;
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
          setStocks((prev) => {
            const next = [...prev, ...batchStocks];
            _cache = { stocks: next, loadedAt: _cache?.loadedAt ?? Date.now(), isComplete: false };
            return next;
          });
          setLoadedCount((prev) => prev + batchStocks.length);
        }
        if (i + SCREENER_BATCH < uncachedTickers.length && !cancelledRef.current) {
          await new Promise<void>((r) => setTimeout(r, SCREENER_BATCH_DELAY_MS));
        }
      }

      if (!cancelledRef.current) {
        setIsLoading(false);
        if (_cache) {
          _cache = { ..._cache, isComplete: true, loadedAt: Date.now() };
          saveToStorage();
        }
      }
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
