export interface StockTicker {
  ticker: string;
  name: string;
  price: number;
  ivRank: number;
  ivPercentile: number;
  currentIV: number;
  historicalVol: number;
  trend: 'up' | 'down' | 'flat';
  earningsDate?: string;
  priceChangePct?: number;  // live % change from Finnhub dp field
}

export interface IVDataPoint {
  week: string;
  date: string;
  ivRank: number;
  iv: number;
}

export type WheelStrategy = 'CSP' | 'CC';
export type PositionStatus = 'open' | 'closed' | 'assigned';

export interface WheelPosition {
  id: string;
  ticker: string;
  strategy: WheelStrategy;
  strike: number;
  expiry: string;
  premiumCollected: number;
  currentPrice: number; // current option price
  daysToExpiry: number;
  status: PositionStatus;
  openedAt: string;
  contracts: number;
}

export interface SortOption {
  field: 'ticker' | 'ivRank' | 'price' | 'ivPercentile';
  direction: 'asc' | 'desc';
}

export type ThemeMode = 'dark' | 'light';
