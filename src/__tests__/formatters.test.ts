import { describe, it, expect } from 'vitest';
import { formatDate, formatCurrency, formatPercent, formatNumber } from '../lib/formatters';

describe('formatDate', () => {
  it('parses date-only strings without shifting to the prior day', () => {
    // "2026-06-15" must NOT render as June 14 — which would happen if parsed as UTC
    // midnight and displayed in a UTC+ timezone. The T12:00:00 fix ensures local noon.
    const result = formatDate('2026-06-15', 'short');
    expect(result).toContain('Jun');
    // Must not show the 14th
    expect(result).not.toMatch(/\b14\b/);
  });

  it('renders medium format with year', () => {
    const result = formatDate('2026-01-05', 'medium');
    expect(result).toContain('Jan');
    expect(result).toContain('2026');
  });

  it('does not throw on ISO timestamp input', () => {
    expect(() => formatDate('2026-06-15T12:00:00')).not.toThrow();
  });
});

describe('formatCurrency', () => {
  it('formats positive value with $ and 2 decimals by default', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('formats negative values', () => {
    expect(formatCurrency(-50)).toBe('-$50.00');
  });

  it('respects custom decimal count', () => {
    expect(formatCurrency(99.9, 0)).toBe('$100');
  });
});

describe('formatPercent', () => {
  it('adds + sign for positive values by default', () => {
    expect(formatPercent(5.5)).toBe('+5.5%');
  });

  it('no + sign for negative values', () => {
    expect(formatPercent(-3.2)).toBe('-3.2%');
  });

  it('respects showSign=false', () => {
    expect(formatPercent(10, 1, false)).toBe('10.0%');
  });
});

describe('formatNumber', () => {
  it('formats large numbers with commas', () => {
    expect(formatNumber(1_234_567)).toBe('1,234,567');
  });

  it('rounds to nearest integer', () => {
    expect(formatNumber(1234.6)).toBe('1,235');
  });
});
