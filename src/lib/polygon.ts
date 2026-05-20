import { polygonQueue } from './requestQueue';
import { supabase } from './supabase';
import type { IVDataPoint } from '../types';

const BASE = 'https://api.polygon.io';
const KEY = import.meta.env.VITE_POLYGON_API_KEY as string;
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

// ── LocalStorage cache ────────────────────────────────────────────────────────

interface CacheEntry<T> { data: T; ts: number }

function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
    return entry.data;
  } catch { return null; }
}

function setCached<T>(key: string, data: T): void {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch { /* quota exceeded */ }
}

// ── Historical Volatility calculation ─────────────────────────────────────────
// Standard annualized HV: stddev(log_returns) * sqrt(252) * 100
// Requires (window + 1) close prices to produce (window) log returns.

function calcHV(closes: number[], window: number): number {
  if (closes.length < window + 1) return 0;
  const slice = closes.slice(-(window + 1));
  const returns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    returns.push(Math.log(slice[i] / slice[i - 1]));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  return Math.round(Math.sqrt(Math.max(0, variance) * 252) * 100);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface PolygonIVData {
  ivRank: number;         // 0–100 based on rolling HV position
  ivPercentile: number;   // % of past HV30 values below current
  currentHV: number;      // most recent 30-day annualized HV (%)
  hv30: number;           // same — explicit alias
  hv52wkHigh: number;     // max 30-day HV over past year
  hv52wkLow: number;      // min 30-day HV over past year
  ivHvRatio: number | null;  // hv30 / hv60 — null when insufficient HV60 data
  weeklyHistory: IVDataPoint[];  // 52 weekly data points for chart
  volume: number | null;  // most recent day's volume
}

// ── Supabase snapshot cache helpers ───────────────────────────────────────────

async function getSupabaseSnapshot(ticker: string): Promise<PolygonIVData | null> {
  const today = new Date().toISOString().split('T')[0];
  const prevDate = new Date();
  prevDate.setUTCDate(prevDate.getUTCDate() - 1);
  const yesterday = prevDate.toISOString().split('T')[0];
  try {
    const { data, error } = await supabase
      .from('iv_snapshots')
      .select('snapshot_date,iv_rank,iv_percentile,current_hv,hv_30,hv_52wk_high,hv_52wk_low,iv_hv_ratio,weekly_history')
      .eq('ticker', ticker)
      .in('snapshot_date', [today, yesterday])
      .eq('data_source', 'edge_function')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      ivRank: data.iv_rank,
      ivPercentile: data.iv_percentile,
      currentHV: data.current_hv,
      hv30: data.hv_30,
      hv52wkHigh: data.hv_52wk_high,
      hv52wkLow: data.hv_52wk_low,
      ivHvRatio: data.iv_hv_ratio,
      volume: null,
      weeklyHistory: data.weekly_history as IVDataPoint[],
    };
  } catch { return null; }
}

function saveSupabaseSnapshot(ticker: string, result: PolygonIVData): void {
  const today = new Date().toISOString().split('T')[0];
  void (async () => {
    try {
      await supabase
        .from('iv_snapshots')
        .upsert({
          ticker,
          snapshot_date: today,
          iv_rank: result.ivRank,
          iv_percentile: result.ivPercentile,
          current_hv: result.currentHV,
          hv_30: result.hv30,
          hv_52wk_high: result.hv52wkHigh,
          hv_52wk_low: result.hv52wkLow,
          iv_hv_ratio: result.ivHvRatio,
          weekly_history: result.weeklyHistory,
        }, { onConflict: 'ticker,snapshot_date' });
    } catch { /* non-fatal */ }
  })();
}

// ── Batch snapshot (price + volume for many tickers in one call) ──────────────

export interface SnapshotQuote {
  price: number | null;
  priceChangePct: number | null;
  volume: number | null;
}

export async function getSnapshotBatch(tickers: string[]): Promise<Map<string, SnapshotQuote>> {
  if (tickers.length === 0) return new Map();
  const url =
    `${BASE}/v2/snapshot/locale/us/markets/stocks/tickers` +
    `?tickers=${tickers.join(',')}&apiKey=${KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return new Map();
    const json = await res.json() as {
      tickers?: Array<{
        ticker: string;
        day?: { c?: number; v?: number };
        prevDay?: { c?: number };
        todaysChangePerc?: number;
      }>;
    };
    const map = new Map<string, SnapshotQuote>();
    for (const t of json.tickers ?? []) {
      const dayClose = t.day?.c && t.day.c > 0 ? t.day.c : null;
      const prevClose = t.prevDay?.c && t.prevDay.c > 0 ? t.prevDay.c : null;
      map.set(t.ticker, {
        price: dayClose ?? prevClose,
        priceChangePct: t.todaysChangePerc ?? null,
        volume: t.day?.v ?? null,
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getIVData(
  ticker: string,
  opts?: { skipSupabase?: boolean }
): Promise<PolygonIVData> {
  const cacheKey = `wh_hv_v4_${ticker}`;

  // 1. Check localStorage (fastest, per-device, 6h TTL)
  const cached = getCached<PolygonIVData>(cacheKey);
  if (cached) return cached;

  // 2. Check Supabase daily snapshot (skip if caller already knows it's not there)
  if (!opts?.skipSupabase) {
    const snapshot = await getSupabaseSnapshot(ticker);
    if (snapshot) {
      setCached(cacheKey, snapshot); // warm localStorage from Supabase hit
      return snapshot;
    }
  }

  return polygonQueue.enqueue(async () => {
    // Fetch 1 year + 35 extra days of daily OHLCV
    // The extra days provide the bootstrap prices needed for HV calculation
    const to = new Date();
    const from = new Date(to);
    from.setFullYear(from.getFullYear() - 1);
    from.setDate(from.getDate() - 35);
    const toStr = to.toISOString().split('T')[0];
    const fromStr = from.toISOString().split('T')[0];

    const url =
      `${BASE}/v2/aggs/ticker/${ticker}/range/1/day/${fromStr}/${toStr}` +
      `?adjusted=true&sort=asc&limit=500&apiKey=${KEY}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Polygon ${ticker}: ${res.status}`);

    const json = await res.json();
    const results: Array<{ c: number; t: number; v?: number }> = json.results || [];
    if (results.length < 65) throw new Error(`Not enough data for ${ticker} (got ${results.length})`);

    const closes = results.map((r) => r.c);
    const timestamps = results.map((r) => r.t);
    const volume = results[results.length - 1]?.v ?? null;

    // Rolling 30-day HV series (one value per trading day once bootstrapped)
    const hvSeries: number[] = [];
    for (let i = 31; i <= closes.length; i++) {
      hvSeries.push(calcHV(closes.slice(i - 31, i), 30));
    }

    const currentHV = hvSeries[hvSeries.length - 1] ?? 0;
    const hv52wkHigh = Math.max(...hvSeries);
    const hv52wkLow = Math.min(...hvSeries);

    // IV Rank: position of current HV within the year's HV range
    const ivRank =
      hv52wkHigh > hv52wkLow
        ? Math.round(((currentHV - hv52wkLow) / (hv52wkHigh - hv52wkLow)) * 100)
        : 50;

    // IV Percentile: % of past HV values that were <= current
    const belowCount = hvSeries.filter((v) => v < currentHV).length;
    const ivPercentile = Math.round((belowCount / hvSeries.length) * 100);

    // HV60 for the IV/HV ratio (elevated recent vol vs medium-term baseline)
    const hv60 = calcHV(closes, 60);
    const ivHvRatio = hv60 > 0 ? parseFloat((currentHV / hv60).toFixed(2)) : null;

    // 52 weekly data points sampled so the first point is the oldest bar and
    // the last point is always the most recent bar (today).
    const weeklyHistory: IVDataPoint[] = [];
    const totalPoints = Math.min(52, hvSeries.length);
    for (let p = 0; p < totalPoints; p++) {
      const i = Math.round(p * (hvSeries.length - 1) / (totalPoints - 1));
      const tsIndex = 31 + i;
      const ts = timestamps[tsIndex] ?? Date.now();
      const weekHV = hvSeries[i];
      const weekIVRank =
        hv52wkHigh > hv52wkLow
          ? Math.min(100, Math.max(0, Math.round(((weekHV - hv52wkLow) / (hv52wkHigh - hv52wkLow)) * 100)))
          : 50;
      weeklyHistory.push({
        week: `W${p + 1}`,
        date: new Date(ts).toISOString().split('T')[0],
        ivRank: weekIVRank,
        iv: weekHV,
      });
    }

    const result: PolygonIVData = {
      ivRank: Math.min(100, Math.max(0, ivRank)),
      ivPercentile: Math.min(100, Math.max(0, ivPercentile)),
      currentHV,
      hv30: currentHV,
      hv52wkHigh,
      hv52wkLow,
      ivHvRatio,
      weeklyHistory,
      volume,
    };

    setCached(cacheKey, result);
    saveSupabaseSnapshot(ticker, result); // fire-and-forget cross-device cache
    return result;
  });
}
