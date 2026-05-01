import { finnhubQueue, sleep } from './requestQueue';

const BASE = 'https://finnhub.io/api/v1';
const KEY = import.meta.env.VITE_FINNHUB_API_KEY as string;

async function get<T>(path: string): Promise<T> {
  return finnhubQueue.enqueue(async () => {
    const url = `${BASE}${path}&token=${KEY}`;
    let res = await fetch(url);
    if (res.status === 429) {
      // Rate limited — back off 5 seconds and retry once
      await sleep(5000);
      res = await fetch(url);
    }
    if (!res.ok) throw new Error(`Finnhub ${path}: ${res.status}`);
    return res.json() as Promise<T>;
  });
}

export interface FhQuote {
  c: number;   // current price
  d: number;   // change
  dp: number;  // percent change
  h: number;   // high
  l: number;   // low
  o: number;   // open
  pc: number;  // previous close
}

export interface FhProfile {
  name: string;
  finnhubIndustry: string;
  country: string;
  currency: string;
  marketCapitalization: number;
}

export function getQuote(ticker: string): Promise<FhQuote> {
  return get<FhQuote>(`/quote?symbol=${ticker}`);
}

// Uses Frankfurter (ECB-backed, free, no API key) — Finnhub free plan returns 0 for all forex
export async function getForexRate(from: string, to: string): Promise<number> {
  const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
  if (!res.ok) throw new Error(`Frankfurter ${from}/${to}: ${res.status}`);
  const data = await res.json() as { rates: Record<string, number> };
  const rate = data.rates[to];
  if (typeof rate !== 'number' || rate <= 0) throw new Error(`No rate for ${to}`);
  return rate;
}

export function getProfile(ticker: string): Promise<FhProfile> {
  return get<FhProfile>(`/stock/profile2?symbol=${ticker}`);
}

export async function getNextEarnings(ticker: string): Promise<string | null> {
  const from = new Date().toISOString().split('T')[0];
  const to = new Date(Date.now() + 180 * 86_400_000).toISOString().split('T')[0];
  const data = await get<{ earningsCalendar: Array<{ date: string }> }>(
    `/calendar/earnings?from=${from}&to=${to}&symbol=${ticker}`
  );
  return data.earningsCalendar?.[0]?.date ?? null;
}

export interface FhBasicFinancials {
  metric: {
    '52WeekLow': number | null | undefined;
    '52WeekHigh': number | null | undefined;
    [key: string]: unknown;
  };
}

export async function getStockBasicFinancials(ticker: string): Promise<FhBasicFinancials> {
  return get<FhBasicFinancials>(`/stock/metric?symbol=${ticker}&metric=all`);
}
