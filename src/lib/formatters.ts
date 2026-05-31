export function formatCurrency(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCurrencyCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return formatCurrency(value);
}

export function formatPercent(value: number, decimals: number = 1, showSign: boolean = true): string {
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

export function formatNumberCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

export function formatDate(dateStr: string, format: 'short' | 'medium' | 'long' = 'medium'): string {
  // Parse date-only strings as local noon to avoid UTC midnight shifting the
  // displayed date backward by one day for UTC+ users (e.g. SGT = UTC+8).
  const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
  const options: Intl.DateTimeFormatOptions =
    format === 'short' ? { month: 'short', day: 'numeric' }
    : format === 'long' ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

export function formatDTE(dte: number): string {
  if (dte === 0) return 'Today';
  if (dte === 1) return '1 day';
  return `${dte} days`;
}
