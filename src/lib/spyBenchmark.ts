export interface BenchmarkDataPoint {
  date: string;
  portfolioValue: number;
  spyValue: number;       // SPY normalised to same starting portfolio value
  portfolioReturn: number; // % from start
  spyReturn: number;       // % from start
}

export interface BenchmarkComparison {
  portfolioReturn: number;
  spyReturn: number;
  outperformance: number;
  isOutperforming: boolean;
  dataPoints: BenchmarkDataPoint[];
  startDate: string;
  endDate: string;
  startPortfolioValue: number;
  startSPYPrice: number;
}

const CACHE_KEY = 'ph_spy_cache_v2';
const CACHE_TTL = 12 * 60 * 60 * 1000;

interface SPYCache {
  fetchedAt: number;
  fromDate: string;
  data: Array<{ date: string; close: number }>;
}

function loadCache(fromDate: string): Map<string, number> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as SPYCache;
    if (c.fromDate <= fromDate && Date.now() - c.fetchedAt < CACHE_TTL) {
      return new Map(c.data.filter(d => d.date >= fromDate).map(d => [d.date, d.close]));
    }
  } catch { /* ignore */ }
  return null;
}

function saveCache(fromDate: string, map: Map<string, number>): void {
  try {
    const data = Array.from(map.entries()).map(([date, close]) => ({ date, close }));
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), fromDate, data }));
  } catch { /* quota */ }
}

export async function fetchAndCacheSPYData(
  fromDate: string,
  polygonKey: string | undefined,
): Promise<Map<string, number>> {
  const cached = loadCache(fromDate);
  if (cached) return cached;

  if (!polygonKey) return new Map();

  const today = new Date().toISOString().split('T')[0];
  try {
    const url = `https://api.polygon.io/v2/aggs/ticker/SPY/range/1/day/${fromDate}/${today}?adjusted=true&sort=asc&limit=730&apiKey=${polygonKey}`;
    const res = await fetch(url);
    if (!res.ok) return new Map();
    const json = await res.json() as { results?: Array<{ t: number; c: number }> };
    if (!json.results?.length) return new Map();

    const map = new Map<string, number>(
      json.results.map(r => [new Date(r.t).toISOString().split('T')[0], r.c])
    );
    saveCache(fromDate, map);
    return map;
  } catch {
    return new Map();
  }
}

function nearestPrice(spyMap: Map<string, number>, date: string): number | undefined {
  const base = new Date(date).getTime();
  // Check backward 5 days, then forward 3 days (handles today's data not yet available)
  const offsets = [0, -1, -2, -3, -4, 1, 2, 3];
  for (const i of offsets) {
    const d = new Date(base + i * 86_400_000).toISOString().split('T')[0];
    const p = spyMap.get(d);
    if (p) return p;
  }
  return undefined;
}

export function calculateBenchmarkComparison(
  snapshots: Array<{ snapshot_date: string; total_value: number }>,
  spyMap: Map<string, number>,
): BenchmarkComparison | null {
  if (snapshots.length < 2 || spyMap.size === 0) return null;

  const sorted = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
  const startDate = sorted[0].snapshot_date;
  const endDate = sorted[sorted.length - 1].snapshot_date;

  // Require at least 7 calendar days of history — fewer gives meaningless flat charts
  const daySpan = Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000
  );
  if (daySpan < 7) return null;

  const startValue = sorted[0].total_value;
  const startSPY = nearestPrice(spyMap, startDate);

  if (!startSPY || startValue <= 0) return null;

  const dataPoints: BenchmarkDataPoint[] = sorted
    .map(s => {
      const spy = nearestPrice(spyMap, s.snapshot_date);
      if (!spy) return null;
      const portfolioReturn = Math.round(((s.total_value / startValue) - 1) * 10000) / 100;
      const spyReturn = Math.round(((spy / startSPY) - 1) * 10000) / 100;
      return {
        date: s.snapshot_date,
        portfolioValue: s.total_value,
        spyValue: Math.round(startValue * (spy / startSPY) * 100) / 100,
        portfolioReturn,
        spyReturn,
      };
    })
    .filter((p): p is BenchmarkDataPoint => p !== null);

  if (dataPoints.length === 0) return null;

  const last = dataPoints[dataPoints.length - 1];
  return {
    portfolioReturn: last.portfolioReturn,
    spyReturn: last.spyReturn,
    outperformance: Math.round((last.portfolioReturn - last.spyReturn) * 100) / 100,
    isOutperforming: last.portfolioReturn > last.spyReturn,
    dataPoints,
    startDate,
    endDate: last.date,
    startPortfolioValue: startValue,
    startSPYPrice: startSPY,
  };
}
