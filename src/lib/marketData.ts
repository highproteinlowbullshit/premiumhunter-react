import { SCREENER_STOCKS } from './screenerData';
import { MOCK_STOCKS, MOCK_IV_HISTORY } from './mockData';
import { getQuote, getProfile, getNextEarnings } from './finnhub';
import { getIVData } from './polygon';
import type { ScreenerStock } from './screenerData';
import type { StockTicker, IVDataPoint } from '../types';

// ── Demo mode detection ───────────────────────────────────────────────────────
// When keys are missing or still the placeholder values, fall back to mock data.

export const IS_DEMO_MODE =
  !import.meta.env.VITE_FINNHUB_API_KEY ||
  !import.meta.env.VITE_POLYGON_API_KEY ||
  import.meta.env.VITE_FINNHUB_API_KEY === 'your_finnhub_key_here' ||
  import.meta.env.VITE_POLYGON_API_KEY === 'your_polygon_key_here';

// ── Unified mock lookup ───────────────────────────────────────────────────────

const MOCK_LOOKUP: Record<string, StockTicker> = {};

MOCK_STOCKS.forEach((s) => { MOCK_LOOKUP[s.ticker] = s; });

SCREENER_STOCKS.forEach((s) => {
  if (!MOCK_LOOKUP[s.ticker]) {
    MOCK_LOOKUP[s.ticker] = {
      ticker: s.ticker,
      name: s.name,
      price: s.price,
      ivRank: s.ivRank,
      ivPercentile: s.ivPercentile,
      currentIV: s.currentIV,
      historicalVol: s.hv30,
      trend: s.priceChange > 0 ? 'up' : s.priceChange < 0 ? 'down' : 'flat',
      earningsDate: s.earningsDate ?? undefined,
    };
  }
});

// ── Screener data ─────────────────────────────────────────────────────────────

export async function getScreenerData(): Promise<ScreenerStock[]> {
  if (IS_DEMO_MODE) return SCREENER_STOCKS;

  const results = await Promise.allSettled(
    SCREENER_STOCKS.map((mock) => fetchScreenerStock(mock))
  );

  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : SCREENER_STOCKS[i]
  );
}

async function fetchScreenerStock(mock: ScreenerStock): Promise<ScreenerStock> {
  const [quoteRes, hvRes] = await Promise.allSettled([
    getQuote(mock.ticker),
    getIVData(mock.ticker),
  ]);

  return {
    ...mock,
    price:
      quoteRes.status === 'fulfilled' && quoteRes.value.c > 0
        ? quoteRes.value.c
        : mock.price,
    priceChange:
      quoteRes.status === 'fulfilled' ? quoteRes.value.dp : mock.priceChange,
    ivRank: hvRes.status === 'fulfilled' ? hvRes.value.ivRank : mock.ivRank,
    ivPercentile:
      hvRes.status === 'fulfilled' ? hvRes.value.ivPercentile : mock.ivPercentile,
    currentIV:
      hvRes.status === 'fulfilled' ? hvRes.value.currentHV : mock.currentIV,
    hv30: hvRes.status === 'fulfilled' ? hvRes.value.hv30 : mock.hv30,
    ivHvRatio:
      hvRes.status === 'fulfilled' ? hvRes.value.ivHvRatio : mock.ivHvRatio,
    iv52wkHigh:
      hvRes.status === 'fulfilled' ? hvRes.value.hv52wkHigh : mock.iv52wkHigh,
    iv52wkLow:
      hvRes.status === 'fulfilled' ? hvRes.value.hv52wkLow : mock.iv52wkLow,
  };
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
    return tickers.map((t) => ({
      stock: MOCK_LOOKUP[t] ?? fallbackStock(t),
      ivHistory: MOCK_IV_HISTORY[t] ?? [],
    }));
  }

  const results = await Promise.allSettled(
    tickers.map((t) => fetchWatchlistStock(t))
  );

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    const t = tickers[i];
    return { stock: MOCK_LOOKUP[t] ?? fallbackStock(t), ivHistory: MOCK_IV_HISTORY[t] ?? [] };
  });
}

async function fetchWatchlistStock(ticker: string): Promise<WatchlistStockData> {
  const mock = MOCK_LOOKUP[ticker];

  const [quoteRes, hvRes] = await Promise.allSettled([
    getQuote(ticker),
    getIVData(ticker),
  ]);

  const quote = quoteRes.status === 'fulfilled' ? quoteRes.value : null;
  const hv = hvRes.status === 'fulfilled' ? hvRes.value : null;

  return {
    stock: {
      ticker,
      name: mock?.name ?? ticker,
      price: quote?.c && quote.c > 0 ? quote.c : mock?.price ?? 0,
      ivRank: hv?.ivRank ?? mock?.ivRank ?? 0,
      ivPercentile: hv?.ivPercentile ?? mock?.ivPercentile ?? 0,
      currentIV: hv?.currentHV ?? mock?.currentIV ?? 0,
      historicalVol: hv?.hv30 ?? mock?.historicalVol ?? 0,
      trend: quote
        ? quote.dp > 0 ? 'up' : quote.dp < 0 ? 'down' : 'flat'
        : mock?.trend ?? 'flat',
      earningsDate: mock?.earningsDate,
      priceChangePct: quote?.dp,
    },
    ivHistory: hv?.weeklyHistory ?? MOCK_IV_HISTORY[ticker] ?? [],
  };
}

// ── Stock detail data ─────────────────────────────────────────────────────────

export interface StockDetailData {
  stock: StockTicker;
  ivHistory: IVDataPoint[];
}

export async function getStockDetailData(ticker: string): Promise<StockDetailData> {
  const mock = MOCK_LOOKUP[ticker];

  if (IS_DEMO_MODE) {
    return {
      stock: mock ?? fallbackStock(ticker),
      ivHistory: MOCK_IV_HISTORY[ticker] ?? [],
    };
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
    earningsRes.status === 'fulfilled'
      ? (earningsRes.value ?? mock?.earningsDate)
      : mock?.earningsDate;
  const hv = hvRes.status === 'fulfilled' ? hvRes.value : null;

  return {
    stock: {
      ticker,
      name: profile?.name || mock?.name || ticker,
      price: quote?.c && quote.c > 0 ? quote.c : mock?.price ?? 0,
      ivRank: hv?.ivRank ?? mock?.ivRank ?? 0,
      ivPercentile: hv?.ivPercentile ?? mock?.ivPercentile ?? 0,
      currentIV: hv?.currentHV ?? mock?.currentIV ?? 0,
      historicalVol: hv?.hv30 ?? mock?.historicalVol ?? 0,
      trend: quote
        ? quote.dp > 0 ? 'up' : quote.dp < 0 ? 'down' : 'flat'
        : mock?.trend ?? 'flat',
      earningsDate,
      priceChangePct: quote?.dp,
    },
    ivHistory: hv?.weeklyHistory ?? MOCK_IV_HISTORY[ticker] ?? [],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fallbackStock(ticker: string): StockTicker {
  return {
    ticker,
    name: ticker,
    price: 0,
    ivRank: 0,
    ivPercentile: 0,
    currentIV: 0,
    historicalVol: 0,
    trend: 'flat',
  };
}
