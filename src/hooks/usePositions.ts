import { useState, useCallback } from 'react';
import type { WheelPosition, WheelStrategy } from '../types';
import { MOCK_POSITIONS } from '../lib/mockData';

let idCounter = 100;

export function usePositions() {
  const [positions, setPositions] = useState<WheelPosition[]>(MOCK_POSITIONS);

  const addPosition = useCallback((data: {
    ticker: string;
    strategy: WheelStrategy;
    strike: number;
    expiry: string;
    premiumCollected: number;
    contracts: number;
  }) => {
    const expDate = new Date(data.expiry);
    const now = new Date();
    const dte = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const newPosition: WheelPosition = {
      id: `pos-${++idCounter}`,
      ticker: data.ticker.toUpperCase(),
      strategy: data.strategy,
      strike: data.strike,
      expiry: data.expiry,
      premiumCollected: data.premiumCollected * data.contracts,
      currentPrice: Math.round(data.premiumCollected * 0.6 * 100) / 100,
      daysToExpiry: Math.max(0, dte),
      status: 'open',
      openedAt: new Date().toISOString().split('T')[0],
      contracts: data.contracts,
    };
    setPositions((prev) => [newPosition, ...prev]);
  }, []);

  const removePosition = useCallback((id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const openPositions = positions.filter((p) => p.status === 'open');

  const monthlyPnL = openPositions.reduce((acc, p) => {
    const pnl = p.premiumCollected - p.currentPrice * p.contracts;
    return acc + pnl;
  }, 0);

  return { positions, openPositions, monthlyPnL, addPosition, removePosition };
}
