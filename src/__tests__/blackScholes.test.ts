import { describe, it, expect } from 'vitest';
import { blackScholes, yearsToExpiry, estimateVolatility } from '../lib/blackScholes';

describe('blackScholes', () => {
  const BASE = {
    spotPrice: 100,
    strikePrice: 100,
    timeToExpiry: 30 / 365,
    riskFreeRate: 0.045,
    volatility: 0.30,
  };

  it('returns non-negative price for call', () => {
    const r = blackScholes({ ...BASE, optionType: 'call' });
    expect(r.price).toBeGreaterThan(0);
  });

  it('returns non-negative price for put', () => {
    const r = blackScholes({ ...BASE, optionType: 'put' });
    expect(r.price).toBeGreaterThan(0);
  });

  it('put-call parity holds approximately (ATM, low rate, short T)', () => {
    const call = blackScholes({ ...BASE, optionType: 'call' });
    const put  = blackScholes({ ...BASE, optionType: 'put' });
    // C - P ≈ S - K*e^(-rT)
    const parity = BASE.spotPrice - BASE.strikePrice * Math.exp(-BASE.riskFreeRate * BASE.timeToExpiry);
    expect(call.price - put.price).toBeCloseTo(parity, 2);
  });

  it('ATM call delta is near 0.5', () => {
    const r = blackScholes({ ...BASE, optionType: 'call' });
    expect(r.delta).toBeGreaterThan(0.4);
    expect(r.delta).toBeLessThan(0.6);
  });

  it('ATM put delta is near -0.5', () => {
    const r = blackScholes({ ...BASE, optionType: 'put' });
    expect(r.delta).toBeGreaterThan(-0.6);
    expect(r.delta).toBeLessThan(-0.4);
  });

  it('theta is negative per share (time decay costs the buyer)', () => {
    const r = blackScholes({ ...BASE, optionType: 'call' });
    expect(r.theta).toBeLessThan(0);
  });

  it('deep OTM put has near-zero price', () => {
    const r = blackScholes({ ...BASE, strikePrice: 50, optionType: 'put' });
    expect(r.price).toBeLessThan(0.01);
  });

  it('deep ITM call has price close to intrinsic value', () => {
    const S = 150, K = 100;
    const r = blackScholes({ ...BASE, spotPrice: S, strikePrice: K, optionType: 'call' });
    expect(r.price).toBeCloseTo(S - K, 0);
  });

  it('degenerate input (T=0) returns intrinsic value', () => {
    const S = 105, K = 100;
    const r = blackScholes({ ...BASE, spotPrice: S, strikePrice: K, timeToExpiry: 0, optionType: 'call' });
    expect(r.price).toBeCloseTo(S - K, 4);
  });

  it('degenerate input (T=0) OTM option returns 0', () => {
    const r = blackScholes({ ...BASE, spotPrice: 95, strikePrice: 100, timeToExpiry: 0, optionType: 'call' });
    expect(r.price).toBe(0);
  });

  it('higher volatility → higher option price (all else equal)', () => {
    const low  = blackScholes({ ...BASE, volatility: 0.20, optionType: 'call' });
    const high = blackScholes({ ...BASE, volatility: 0.60, optionType: 'call' });
    expect(high.price).toBeGreaterThan(low.price);
  });

  it('gamma is positive', () => {
    const r = blackScholes({ ...BASE, optionType: 'call' });
    expect(r.gamma).toBeGreaterThan(0);
  });

  it('vega is positive (per 1% IV move)', () => {
    const r = blackScholes({ ...BASE, optionType: 'call' });
    expect(r.vega).toBeGreaterThan(0);
  });
});

describe('yearsToExpiry', () => {
  it('returns 0 for a past date', () => {
    expect(yearsToExpiry('2020-01-01')).toBe(0);
  });

  it('returns a positive value for a future date', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const dateStr = future.toISOString().split('T')[0];
    expect(yearsToExpiry(dateStr)).toBeGreaterThan(0);
  });

  it('is approximately 1.0 for a date roughly one year out', () => {
    const future = new Date();
    future.setDate(future.getDate() + 365);
    const dateStr = future.toISOString().split('T')[0];
    expect(yearsToExpiry(dateStr)).toBeCloseTo(1, 0);
  });
});

describe('estimateVolatility', () => {
  it('returns ticker-specific vol for known tickers', () => {
    expect(estimateVolatility('SPY')).toBe(0.18);
    expect(estimateVolatility('TSLA')).toBe(0.65);
  });

  it('returns 0.45 generic fallback for unknown ticker', () => {
    expect(estimateVolatility('UNKNOWN_TICKER_XYZ')).toBe(0.45);
  });
});
