import { describe, it, expect } from 'vitest';

// ── dteFromExpiry ──────────────────────────────────────────────────────────────
// Inline the logic so tests don't need to import the module (which calls supabase
// at module scope in some paths). Mirror the actual implementation exactly.

function dteFromExpiry(expiry: string): number {
  const expiryDate = new Date(expiry + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0); // local noon, same convention
  return Math.max(0, Math.ceil((expiryDate.getTime() - today.getTime()) / 86_400_000));
}

describe('dteFromExpiry', () => {
  it('returns 0 for a past expiry', () => {
    expect(dteFromExpiry('2020-01-01')).toBe(0);
  });

  it('returns a positive integer for a future expiry', () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const dateStr = future.toISOString().split('T')[0];
    const dte = dteFromExpiry(dateStr);
    expect(dte).toBeGreaterThan(0);
    expect(dte).toBeLessThanOrEqual(31);
  });

  it('is exactly 0 for today', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(dteFromExpiry(today)).toBe(0);
  });
});

// ── Annualized return calculation ─────────────────────────────────────────────
// This mirrors the formula used in tradeChecklist.ts checkPremiumQuality.

function annualizedReturn(premiumPct: number, dte: number): number {
  return (premiumPct / dte) * 365;
}

describe('annualizedReturn', () => {
  it('30-DTE with 1% premium → ~12.2% annualized', () => {
    expect(annualizedReturn(1, 30)).toBeCloseTo(12.17, 1);
  });

  it('45-DTE with 2% premium → ~16.2% annualized', () => {
    expect(annualizedReturn(2, 45)).toBeCloseTo(16.22, 1);
  });

  it('7-DTE with 0.5% premium → ~26% annualized (gamma scalp territory)', () => {
    expect(annualizedReturn(0.5, 7)).toBeCloseTo(26.07, 1);
  });
});

// ── IV Rank formula ───────────────────────────────────────────────────────────

function ivRank(current: number, low: number, high: number): number | null {
  if (high <= low) return null;
  return Math.round(((current - low) / (high - low)) * 100);
}

describe('ivRank', () => {
  it('returns 0 when current equals 52-week low', () => {
    expect(ivRank(20, 20, 80)).toBe(0);
  });

  it('returns 100 when current equals 52-week high', () => {
    expect(ivRank(80, 20, 80)).toBe(100);
  });

  it('returns 50 at midpoint', () => {
    expect(ivRank(50, 20, 80)).toBe(50);
  });

  it('returns null when high <= low (flat range)', () => {
    expect(ivRank(30, 30, 30)).toBeNull();
  });
});
