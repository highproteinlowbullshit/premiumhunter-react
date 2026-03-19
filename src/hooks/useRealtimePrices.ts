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
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [wsStatus, setWsStatus] = useState<WSStatus>(finnhubWS.getStatus());

  // Stable key so useEffect only re-runs when the ticker list actually changes
  const tickerKey = useMemo(
    () => [...tickers].map((t) => t.toUpperCase()).sort().join(','),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tickers.join(',')]
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
