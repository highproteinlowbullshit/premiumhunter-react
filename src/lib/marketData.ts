import { STOCK_LIST, STOCK_META } from './stockList';
import { getQuote, getProfile, getNextEarnings } from './finnhub';
import { getIVData } from './polygon';
import { supabase } from './supabase';
import type { ScreenerStock } from './screenerData';
import type { StockTicker, IVDataPoint } from '../types';

// ── Demo mode detection ───────────────────────────────────────────────────────
export const IS_DEMO_MODE =
  !import.meta.env.VITE_FINNHUB_API_KEY ||
  !import.meta.env.VITE_POLYGON_API_KEY ||
  import.meta.env.VITE_FINNHUB_API_KEY === 'your-finnhub-key' ||
  import.meta.env.VITE_POLYGON_API_KEY === 'your-polygon-key';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fallbackStock(ticker: string): StockTicker {
  const meta = STOCK_META[ticker];
  return {
    ticker,
    name: meta?.name ?? ticker,
    price: 0,
    ivRank: 0,
    ivPercentile: 0,
    currentIV: 0,
    historicalVol: 0,
    trend: 'flat',
  };
}

// ── Screener: Supabase cache layer ────────────────────────────────────────────

interface SupabaseIVRow {
  ticker: string;
  snapshot_date: string;
  iv_rank: number;
  iv_percentile: number;
  current_hv: number;
  hv_30: number;
  hv_52wk_high: number;
  hv_52wk_low: number;
  iv_hv_ratio: number;
  current_price: number | null;
  prev_close: number | null;
  price_change_pct: number | null;
  volume: number | null;
  put_call_skew: number | null;
  atm_open_interest: number | null;
}

/** Fetch cached IV rows from Supabase for all tickers in STOCK_LIST.
 *  Queries the two most recent calendar dates to handle the nightly cron's
 *  UTC midnight boundary: batches 0–59 run at 23:xx UTC and write snapshot_date=D,
 *  while batches 60–243 run at 00:xx–03:xx UTC and write snapshot_date=D+1.
 *  Querying only "today" would miss the 120 tickers from the prior-date batches.
 *  When a ticker appears on both dates, the more recent date wins. */
export async function getSupabaseCachedToday(): Promise<Map<string, SupabaseIVRow>> {
  const today = new Date().toISOString().split('T')[0];
  const prevDate = new Date();
  prevDate.setUTCDate(prevDate.getUTCDate() - 1);
  const yesterday = prevDate.toISOString().split('T')[0];
  const known = new Set(STOCK_LIST.map((s) => s.ticker));
  try {
    const { data, error } = await supabase
      .from('iv_snapshots')
      .select('ticker,snapshot_date,iv_rank,iv_percentile,current_hv,hv_30,hv_52wk_high,hv_52wk_low,iv_hv_ratio,current_price,prev_close,price_change_pct,volume,put_call_skew,atm_open_interest')
      .in('snapshot_date', [today, yesterday])
      .eq('calculation_success', true)
      .eq('data_source', 'edge_function'); // exclude frontend-written rows (no price/volume)

    if (error || !data) return new Map();

    // Prefer today's row over yesterday's when both exist for the same ticker
    const result = new Map<string, SupabaseIVRow>();
    for (const row of data) {
      if (!known.has(row.ticker)) continue;
      const existing = result.get(row.ticker);
      if (!existing || row.snapshot_date > existing.snapshot_date) {
        result.set(row.ticker, row as SupabaseIVRow);
      }
    }
    return result;
  } catch {
    return new Map();
  }
}

/** Build a ScreenerStock from live API data */
function buildScreenerFromLive(
  ticker: string,
  quote: { c: number; dp: number; pc?: number } | null,
  hv: { ivRank: number; ivPercentile: number; currentHV: number; hv30: number; hv52wkHigh: number; hv52wkLow: number; ivHvRatio: number; volume: number | null } | null,
  earningsDate: string | null = null,
): ScreenerStock {
  const meta = STOCK_META[ticker];
  return {
    ticker,
    name: meta?.name ?? ticker,
    sector: meta?.sector ?? 'Technology',
    price: quote?.c && quote.c > 0 ? quote.c : (quote?.pc && quote.pc > 0 ? quote.pc : null),
    priceChange: quote?.dp ?? null,
    ivRank: hv?.ivRank ?? null,
    ivPercentile: hv?.ivPercentile ?? null,
    currentIV: hv?.currentHV ?? null,
    hv30: hv?.hv30 ?? null,
    ivHvRatio: hv?.ivHvRatio ?? null,
    iv52wkHigh: hv?.hv52wkHigh ?? null,
    iv52wkLow: hv?.hv52wkLow ?? null,
    volume: hv?.volume ?? null,
    earningsDate,
    putCallSkew: null,
    atmOpenInterest: null,
    dataSource: 'live',
    capitalRequired: (() => {
      const p = quote?.c && quote.c > 0 ? quote.c : (quote?.pc && quote.pc > 0 ? quote.pc : null);
      return p != null && p > 0 ? Math.round(p * 0.90 * 100) : null;
    })(),
  };
}

/** Fetch a single stock from APIs (used for uncached tickers in the screener).
 *  skipSupabase=true avoids a redundant per-ticker Supabase round-trip when the
 *  caller has already confirmed this ticker is not in today's snapshot table.
 *  preloadedQuote skips the Finnhub call when the caller already has price data.
 *  Earnings runs in parallel via finnhubQueue (rate-limited) — safe to fire per ticker. */
export async function fetchScreenerStock(
  ticker: string,
  opts?: { skipSupabase?: boolean; preloadedQuote?: { c: number; dp: number } }
): Promise<ScreenerStock> {
  const [quoteRes, hvRes, earningsRes] = await Promise.allSettled([
    opts?.preloadedQuote ? Promise.resolve(opts.preloadedQuote) : getQuote(ticker),
    getIVData(ticker, opts),
    getNextEarnings(ticker),
  ]);
  const quote = quoteRes.status === 'fulfilled' ? quoteRes.value : null;
  const hv = hvRes.status === 'fulfilled' ? hvRes.value : null;
  const earningsDate = earningsRes.status === 'fulfilled' ? earningsRes.value : null;
  if (hvRes.status === 'rejected') {
    console.error(`IV fetch failed for ${ticker}:`, (hvRes as PromiseRejectedResult).reason);
  }
  return buildScreenerFromLive(ticker, quote, hv, earningsDate);
}

// ── Watchlist data ────────────────────────────────────────────────────────────

export interface WatchlistStockData {
  stock: StockTicker;
  ivHistory: IVDataPoint[];
}

export async function getWatchlistData(
  tickers: string[]
): Promise<WatchlistStockData[]> {
  if (IS_DEMO_MODE) {
    return tickers.map((t) => ({ stock: fallbackStock(t), ivHistory: [] }));
  }

  const results = await Promise.allSettled(tickers.map((t) => fetchWatchlistStock(t)));

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    console.error(`Watchlist fetch failed for ${tickers[i]}:`, (r as PromiseRejectedResult).reason);
    return { stock: fallbackStock(tickers[i]), ivHistory: [] };
  });
}

export async function fetchWatchlistStock(ticker: string): Promise<WatchlistStockData> {
  const meta = STOCK_META[ticker];

  const [quoteRes, hvRes] = await Promise.allSettled([
    getQuote(ticker),
    getIVData(ticker),
  ]);

  const quote = quoteRes.status === 'fulfilled' ? quoteRes.value : null;
  const hv = hvRes.status === 'fulfilled' ? hvRes.value : null;

  return {
    stock: {
      ticker,
      name: meta?.name ?? ticker,
      price: quote?.c && quote.c > 0 ? quote.c : (quote?.pc && quote.pc > 0 ? quote.pc : 0),
      ivRank: hv?.ivRank ?? 0,
      ivPercentile: hv?.ivPercentile ?? 0,
      currentIV: hv?.currentHV ?? 0,
      historicalVol: hv?.hv30 ?? 0,
      trend: quote ? (quote.dp > 0 ? 'up' : quote.dp < 0 ? 'down' : 'flat') : 'flat',
      priceChangePct: quote?.dp,
    },
    ivHistory: hv?.weeklyHistory ?? [],
  };
}

// ── Stock detail data ─────────────────────────────────────────────────────────

export interface StockDetailData {
  stock: StockTicker;
  ivHistory: IVDataPoint[];
}

export async function getStockDetailData(ticker: string): Promise<StockDetailData> {
  const meta = STOCK_META[ticker];

  if (IS_DEMO_MODE) {
    return { stock: fallbackStock(ticker), ivHistory: [] };
  }

  const [quoteRes, profileRes, earningsRes, hvRes] = await Promise.allSettled([
    getQuote(ticker),
    getProfile(ticker),
    getNextEarnings(ticker),
    getIVData(ticker),
  ]);

  const quote = quoteRes.status === 'fulfilled' ? quoteRes.value : null;
  const profile = profileRes.status === 'fulfilled' ? profileRes.value : null;
  const earningsDate =
    earningsRes.status === 'fulfilled' ? earningsRes.value ?? null : null;
  const hv = hvRes.status === 'fulfilled' ? hvRes.value : null;

  return {
    stock: {
      ticker,
      name: profile?.name || meta?.name || ticker,
      price: quote?.c && quote.c > 0 ? quote.c : (quote?.pc && quote.pc > 0 ? quote.pc : 0),
      ivRank: hv?.ivRank ?? 0,
      ivPercentile: hv?.ivPercentile ?? 0,
      currentIV: hv?.currentHV ?? 0,
      historicalVol: hv?.hv30 ?? 0,
      trend: quote ? (quote.dp > 0 ? 'up' : quote.dp < 0 ? 'down' : 'flat') : 'flat',
      earningsDate: earningsDate ?? undefined,
      priceChangePct: quote?.dp,
    },
    ivHistory: hv?.weeklyHistory ?? [],
  };
}

// Re-export for hooks that import from marketData
export { STOCK_LIST, STOCK_META };
