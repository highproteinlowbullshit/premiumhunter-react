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
  iv_rank: number;
  iv_percentile: number;
  current_hv: number;
  hv_30: number;
  hv_52wk_high: number;
  hv_52wk_low: number;
  iv_hv_ratio: number;
}

/** Fetch today's cached IV rows from Supabase for all tickers in STOCK_LIST */
export async function getSupabaseCachedToday(): Promise<Map<string, SupabaseIVRow>> {
  const today = new Date().toISOString().split('T')[0];
  try {
    const { data, error } = await supabase
      .from('iv_snapshots')
      .select('ticker,iv_rank,iv_percentile,current_hv,hv_30,hv_52wk_high,hv_52wk_low,iv_hv_ratio')
      .eq('snapshot_date', today)
      .in('ticker', STOCK_LIST.map((s) => s.ticker));

    if (error || !data) return new Map();
    return new Map(data.map((row) => [row.ticker, row as SupabaseIVRow]));
  } catch {
    return new Map();
  }
}

/** Build a ScreenerStock from live API data */
function buildScreenerFromLive(
  ticker: string,
  quote: { c: number; dp: number } | null,
  hv: { ivRank: number; ivPercentile: number; currentHV: number; hv30: number; hv52wkHigh: number; hv52wkLow: number; ivHvRatio: number; volume: number | null } | null
): ScreenerStock {
  const meta = STOCK_META[ticker];
  return {
    ticker,
    name: meta?.name ?? ticker,
    sector: meta?.sector ?? 'Technology',
    price: quote?.c && quote.c > 0 ? quote.c : null,
    priceChange: quote?.dp ?? null,
    ivRank: hv?.ivRank ?? null,
    ivPercentile: hv?.ivPercentile ?? null,
    currentIV: hv?.currentHV ?? null,
    hv30: hv?.hv30 ?? null,
    ivHvRatio: hv?.ivHvRatio ?? null,
    iv52wkHigh: hv?.hv52wkHigh ?? null,
    iv52wkLow: hv?.hv52wkLow ?? null,
    volume: hv?.volume ?? null,
    earningsDate: null,
    dataSource: 'live',
  };
}

/** Fetch a single stock from APIs (used for uncached tickers in the screener) */
export async function fetchScreenerStock(ticker: string): Promise<ScreenerStock> {
  const [quoteRes, hvRes] = await Promise.allSettled([
    getQuote(ticker),
    getIVData(ticker),
  ]);
  const quote = quoteRes.status === 'fulfilled' ? quoteRes.value : null;
  const hv = hvRes.status === 'fulfilled' ? hvRes.value : null;
  if (hvRes.status === 'rejected') {
    console.error(`IV fetch failed for ${ticker}:`, (hvRes as PromiseRejectedResult).reason);
  }
  return buildScreenerFromLive(ticker, quote, hv);
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

async function fetchWatchlistStock(ticker: string): Promise<WatchlistStockData> {
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
      price: quote?.c && quote.c > 0 ? quote.c : 0,
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
      price: quote?.c && quote.c > 0 ? quote.c : 0,
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
