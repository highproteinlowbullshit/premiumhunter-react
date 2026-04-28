import type { Sector } from './stockList';
export type { Sector };

export interface ScreenerStock {
  ticker: string;
  name: string;
  sector: Sector;
  price: number | null;
  priceChange: number | null;  // 24h %
  ivRank: number | null;       // 0–100
  ivPercentile: number | null;
  currentIV: number | null;    // annualized %
  hv30: number | null;         // 30-day historical vol %
  ivHvRatio: number | null;    // currentIV / hv30
  iv52wkHigh: number | null;
  iv52wkLow: number | null;
  volume: number | null;       // daily shares (from Polygon, null for cached rows)
  earningsDate: string | null;
  putCallSkew: number | null;     // (putIV − callIV) / atmIV; positive = puts pricier
  atmOpenInterest: number | null; // total ATM open interest (calls + puts)
  dataSource: 'live' | 'cached';
  capitalRequired: number | null; // ~10% OTM CSP collateral for 1 contract ≈ price × 0.90 × 100
}

export const SECTORS: Array<'All' | Sector> = [
  'All',
  'Technology',
  'Finance',
  'Crypto',
  'Energy',
  'Healthcare',
  'Consumer',
  'EV',
  'Automotive',
  'Industrial',
  'ETF',
  'Materials',
  'Real Estate',
  'Utilities',
  'Telecom',
];

export const SECTOR_COLORS: Record<Sector, { text: string; bg: string; border: string }> = {
  Technology:   { text: '#00c6f5', bg: 'rgba(0,198,245,0.1)',   border: 'rgba(0,198,245,0.2)'   },
  Finance:      { text: '#00e5c4', bg: 'rgba(0,229,196,0.1)',   border: 'rgba(0,229,196,0.2)'   },
  Crypto:       { text: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)'  },
  Energy:       { text: '#f5c842', bg: 'rgba(245,200,66,0.1)', border: 'rgba(245,200,66,0.2)'  },
  Healthcare:   { text: '#00d68f', bg: 'rgba(0,214,143,0.1)',  border: 'rgba(0,214,143,0.2)'   },
  Consumer:     { text: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)' },
  EV:           { text: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)'  },
  Automotive:   { text: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.2)'  },
  Industrial:   { text: '#94a3b8', bg: 'rgba(148,163,184,0.1)',border: 'rgba(148,163,184,0.2)' },
  ETF:          { text: '#e879f9', bg: 'rgba(232,121,249,0.1)', border: 'rgba(232,121,249,0.2)' },
  Materials:    { text: '#84cc16', bg: 'rgba(132,204,22,0.1)',  border: 'rgba(132,204,22,0.2)'  },
  'Real Estate':{ text: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.2)'  },
  Utilities:    { text: '#38bdf8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.2)'  },
  Telecom:      { text: '#c084fc', bg: 'rgba(192,132,252,0.1)', border: 'rgba(192,132,252,0.2)' },
};

export type SortField = 'ivRank' | 'ivPercentile' | 'price' | 'volume' | 'ticker';

export const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'ivRank',       label: 'IV Rank'     },
  { field: 'ivPercentile', label: 'IV%ile'       },
  { field: 'price',        label: 'Price'        },
  { field: 'volume',       label: 'Volume'       },
  { field: 'ticker',       label: 'Ticker A–Z'  },
];
