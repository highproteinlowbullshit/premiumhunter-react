import type { StockTicker, IVDataPoint, WheelPosition } from '../types';

// Generate 52 weeks of IV rank history with realistic patterns
function generateIVHistory(
  ticker: string,
  currentIVRank: number,
  volatility: 'high' | 'medium' | 'low' = 'medium'
): IVDataPoint[] {
  const weeks: IVDataPoint[] = [];
  const now = new Date();

  // Seed patterns per ticker
  const patterns: Record<string, { base: number; spikes: number[]; trend: number }> = {
    GME: { base: 65, spikes: [4, 12, 22, 36, 48], trend: 0.8 },
    SOFI: { base: 45, spikes: [8, 20, 32, 44], trend: -0.3 },
    MARA: { base: 70, spikes: [3, 14, 25, 38, 50], trend: 1.2 },
    DEFAULT: { base: 40, spikes: [10, 25, 40], trend: 0 },
  };

  const config = patterns[ticker] || patterns.DEFAULT;
  let currentVal = config.base;

  for (let i = 51; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i * 7);

    const weekNum = 52 - i;
    const isSpike = config.spikes.some((s) => Math.abs(s - weekNum) <= 1);
    const trendEffect = (config.trend * weekNum) / 52;

    // Realistic random walk with mean reversion
    const meanReversion = (config.base - currentVal) * 0.15;
    const randomWalk = (Math.random() - 0.5) * (volatility === 'high' ? 14 : volatility === 'medium' ? 10 : 6);
    const spikeEffect = isSpike ? 15 + Math.random() * 20 : 0;

    currentVal = Math.max(
      5,
      Math.min(95, currentVal + meanReversion + randomWalk + spikeEffect + trendEffect)
    );

    // Clamp last value to match current
    if (i === 0) {
      currentVal = currentIVRank;
    }

    const ivRank = Math.round(currentVal);
    const baseIV = ticker === 'GME' ? 110 : ticker === 'MARA' ? 120 : ticker === 'SOFI' ? 75 : 60;
    const iv = Math.round(baseIV * (0.5 + (ivRank / 100) * 0.8) + (Math.random() - 0.5) * 10);

    weeks.push({
      week: `W${weekNum}`,
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      ivRank,
      iv,
    });
  }

  return weeks;
}

export const MOCK_STOCKS: StockTicker[] = [
  {
    ticker: 'GME',
    name: 'GameStop Corp',
    price: 28.5,
    ivRank: 75,
    ivPercentile: 82,
    currentIV: 148,
    historicalVol: 112,
    trend: 'up',
    earningsDate: '2026-06-05',
  },
  {
    ticker: 'SOFI',
    name: 'SoFi Technologies',
    price: 12.2,
    ivRank: 55,
    ivPercentile: 61,
    currentIV: 82,
    historicalVol: 64,
    trend: 'down',
    earningsDate: '2026-04-29',
  },
  {
    ticker: 'MARA',
    name: 'Marathon Digital',
    price: 19.8,
    ivRank: 80,
    ivPercentile: 88,
    currentIV: 165,
    historicalVol: 130,
    trend: 'up',
    earningsDate: '2026-05-15',
  },
];

export const MOCK_IV_HISTORY: Record<string, IVDataPoint[]> = {
  GME: generateIVHistory('GME', 75, 'high'),
  SOFI: generateIVHistory('SOFI', 55, 'medium'),
  MARA: generateIVHistory('MARA', 80, 'high'),
};

export const MOCK_POSITIONS: WheelPosition[] = [
  {
    id: 'pos-001',
    ticker: 'GME',
    strategy: 'CSP',
    strike: 25,
    expiry: '2026-03-21',
    premiumCollected: 145,
    currentPrice: 52,
    daysToExpiry: 8,
    status: 'open',
    openedAt: '2026-03-06',
    contracts: 1,
  },
  {
    id: 'pos-002',
    ticker: 'MARA',
    strategy: 'CSP',
    strike: 18,
    expiry: '2026-03-28',
    premiumCollected: 210,
    currentPrice: 98,
    daysToExpiry: 15,
    status: 'open',
    openedAt: '2026-03-10',
    contracts: 2,
  },
  {
    id: 'pos-003',
    ticker: 'SOFI',
    strategy: 'CC',
    strike: 13,
    expiry: '2026-04-04',
    premiumCollected: 65,
    currentPrice: 22,
    daysToExpiry: 22,
    status: 'open',
    openedAt: '2026-03-08',
    contracts: 3,
  },
  {
    id: 'pos-004',
    ticker: 'GME',
    strategy: 'CC',
    strike: 30,
    expiry: '2026-04-17',
    premiumCollected: 185,
    currentPrice: 110,
    daysToExpiry: 35,
    status: 'open',
    openedAt: '2026-03-05',
    contracts: 1,
  },
  {
    id: 'pos-005',
    ticker: 'MARA',
    strategy: 'CSP',
    strike: 17,
    expiry: '2026-04-11',
    premiumCollected: 175,
    currentPrice: 60,
    daysToExpiry: 29,
    status: 'open',
    openedAt: '2026-03-12',
    contracts: 1,
  },
];

export const DASHBOARD_STATS = {
  totalOpenPositions: 5,
  monthlyPnL: 1248,
  winRate: 87,
  totalPremiumCollected: 4825,
};
