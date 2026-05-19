// src/hooks/useRealtimePrices.ts
import { useState, useEffect, useMemo } from 'react';
import { finnhubWS, type WSStatus } from '../lib/finnhubWebSocket';

/**
 * Subscribes to real-time prices for multiple tickers via the shared WebSocket.
 * Falls back to REST polling automatically if WebSocket fails.
 *
 * @returns `prices` - Map<ticker, latestPrice> (only tickers with received data)
 * @returns `wsStatus` - current WebSocket connection status
 */
export function useRealtimePrices(tickers: string[]): {
  prices: Map<string, number>;
  wsStatus: WSStatus;
} {
  // Seed from the singleton price cache so navigation doesn't start with empty prices.
  // The cache persists across component mounts because the WS manager is module-level.
  const [prices, setPrices] = useState<Map<string, number>>(() => {
    const seed = new Map<string, number>();
    for (const t of tickers) {
      const last = finnhubWS.getLastPrice(t);
      if (last !== undefined) seed.set(t.toUpperCase(), last);
    }
    return seed;
  });
  const [wsStatus, setWsStatus] = useState<WSStatus>(finnhubWS.getStatus());

  // Stable key so useEffect only re-runs when the ticker set actually changes.
  // Dep uses the same sorted form as the memo output — order-insensitive.
  const tickerKey = useMemo(
    () => [...tickers].map((t) => t.toUpperCase()).sort().join(','),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tickers.map((t) => t.toUpperCase()).sort().join(',')]
  );

  useEffect(() => {
    if (!tickerKey) return;
    const upperTickers = tickerKey.split(',').filter(Boolean);

    const unsubscribers = upperTickers.map((ticker) =>
      finnhubWS.subscribe(ticker, (price: number) => {
        setPrices((prev) => {
          const next = new Map(prev);
          next.set(ticker, price);
          return next;
        });
      })
    );

    const unsubStatus = finnhubWS.onStatusChange(setWsStatus);

    return () => {
      unsubscribers.forEach((u) => u());
      unsubStatus();
    };
  }, [tickerKey]);

  return { prices, wsStatus };
}
