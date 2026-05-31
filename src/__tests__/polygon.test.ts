import { describe, it, expect, vi } from 'vitest';

// polygon.ts imports supabase at module scope; mock it before importing calcHV
// so the missing-env-var throw never fires in the test environment.
vi.mock('../lib/supabase', () => ({ supabase: {} }));

import { calcHV } from '../lib/polygon';

// Build a deterministic close series with alternating up/down moves.
// A constant uptrend has stddev(log_returns)=0 (no variance), so we alternate
// to simulate realistic daily volatility of the given magnitude.
function syntheticClosesWithVol(dailyVolPct: number, days: number, startPrice = 100): number[] {
  const closes: number[] = [startPrice];
  let sign = 1;
  for (let i = 1; i < days; i++) {
    closes.push(closes[i - 1] * (1 + sign * dailyVolPct / 100));
    sign = -sign;
  }
  return closes;
}

describe('calcHV', () => {
  it('returns 0 when fewer than window+1 prices are provided', () => {
    const closes = [100, 101, 102]; // only 3 prices, window=30 needs 31
    expect(calcHV(closes, 30)).toBe(0);
  });

  it('returns 0 for a perfectly flat price series (zero vol)', () => {
    const closes = Array(35).fill(100) as number[];
    expect(calcHV(closes, 30)).toBe(0);
  });

  it('returns a positive value for a non-flat series', () => {
    // Alternating up/down prices create non-zero log-return variance
    const closes = Array.from({ length: 35 }, (_, i) => i % 2 === 0 ? 100 : 102);
    expect(calcHV(closes, 30)).toBeGreaterThan(0);
  });

  it('is expressed as annualized percentage (integer)', () => {
    // Alternating ±1% daily moves → stddev(log_returns)≈1% → HV≈sqrt(252)×1≈16
    const closes = syntheticClosesWithVol(1, 35);
    const hv = calcHV(closes, 30);
    expect(Number.isInteger(hv)).toBe(true);
    expect(hv).toBeGreaterThan(10);
    expect(hv).toBeLessThan(25);
  });

  it('higher daily moves produce higher HV', () => {
    const low  = calcHV(syntheticClosesWithVol(0.5, 35), 30);
    const high = calcHV(syntheticClosesWithVol(2.0, 35), 30);
    expect(high).toBeGreaterThan(low);
  });

  it('uses only the last (window+1) prices when given more data', () => {
    // Flat series with a single large move at the very beginning — should be ignored
    // when window only covers recent prices
    const flat = Array(50).fill(100) as number[];
    flat[0] = 1; // early outlier
    // The last 31 prices are all 100 → HV should be 0
    expect(calcHV(flat, 30)).toBe(0);
  });
});
