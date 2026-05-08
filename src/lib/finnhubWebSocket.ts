// src/lib/finnhubWebSocket.ts
import { getQuote } from './finnhub';

const KEY: string | undefined = import.meta.env.VITE_FINNHUB_API_KEY as string | undefined;

export type WSStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type PriceCallback = (price: number) => void;
type StatusCallback = (status: WSStatus) => void;

function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;

  // Use Intl API to get accurate ET time regardless of user's local timezone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const minutesSinceMidnight = hour * 60 + minute;

  const marketOpen = 9 * 60 + 30;  // 9:30 AM ET
  const marketClose = 16 * 60;     // 4:00 PM ET
  return minutesSinceMidnight >= marketOpen && minutesSinceMidnight < marketClose;
}

class FinnhubWSManager {
  private static _instance: FinnhubWSManager | null = null;

  private ws: WebSocket | null = null;
  private status: WSStatus = 'disconnected';
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // ticker → Set of callbacks
  private subscribers = new Map<string, Set<PriceCallback>>();
  // ticker → REST fallback interval
  private fallbackIntervals = new Map<string, ReturnType<typeof setInterval>>();
  // Status listeners
  private statusListeners = new Set<StatusCallback>();
  // Track last update time per ticker for throttling
  private lastUpdateTime = new Map<string, number>();
  // Persistent price cache — survives component unmounts so navigation is instant
  private priceCache = new Map<string, number>();

  static getInstance(): FinnhubWSManager {
    if (!FinnhubWSManager._instance) {
      FinnhubWSManager._instance = new FinnhubWSManager();
    }
    return FinnhubWSManager._instance;
  }

  /** Subscribe to live price updates for a ticker.
   *  Returns an unsubscribe function. */
  subscribe(ticker: string, cb: PriceCallback): () => void {
    const upper = ticker.toUpperCase();
    if (!this.subscribers.has(upper)) {
      this.subscribers.set(upper, new Set());
      this._wsSubscribe(upper);
      // Note: _wsSubscribe is a no-op if the socket isn't open yet.
      // The onopen handler re-subscribes all active tickers when the connection is established.
    }
    this.subscribers.get(upper)!.add(cb);

    // Ensure WS is connected
    if (this.ws === null || this.ws.readyState === WebSocket.CLOSED) {
      this._connect();
    }

    return () => this._unsubscribe(upper, cb);
  }

  private _unsubscribe(ticker: string, cb: PriceCallback): void {
    const set = this.subscribers.get(ticker);
    if (!set) return;
    set.delete(cb);
    if (set.size === 0) {
      this.subscribers.delete(ticker);
      this._wsUnsubscribe(ticker);
      this._clearFallback(ticker);
      if (this.subscribers.size === 0) {
        this._disconnect();
      }
    }
  }

  onStatusChange(cb: StatusCallback): () => void {
    this.statusListeners.add(cb);
    cb(this.status); // emit current status immediately
    return () => this.statusListeners.delete(cb);
  }

  getStatus(): WSStatus {
    return this.status;
  }

  /** Returns the last received price for a ticker, or undefined if never seen. */
  getLastPrice(ticker: string): number | undefined {
    return this.priceCache.get(ticker.toUpperCase());
  }

  private _setStatus(s: WSStatus): void {
    this.status = s;
    this.statusListeners.forEach((cb) => cb(s));
  }

  private _connect(): void {
    if (!KEY || KEY === 'your-finnhub-key') {
      this._setStatus('error');
      this._startAllFallbacks();
      return;
    }
    if (!isMarketOpen()) {
      // Outside market hours: use REST polling only
      this._setStatus('disconnected');
      this._startAllFallbacks();
      return;
    }
    if (this.ws && (
      this.ws.readyState === WebSocket.OPEN ||
      this.ws.readyState === WebSocket.CONNECTING ||
      this.ws.readyState === WebSocket.CLOSING
    )) {
      return;
    }

    this._setStatus('connecting');
    try {
      this.ws = new WebSocket(`wss://ws.finnhub.io?token=${KEY}`);
    } catch {
      this._setStatus('error');
      this._startAllFallbacks();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this._setStatus('connected');
      // Re-subscribe all active tickers
      this.subscribers.forEach((_, ticker) => this._wsSubscribe(ticker));
      // Stop REST fallbacks now that WS is connected
      this.subscribers.forEach((_, ticker) => this._clearFallback(ticker));
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this._handleMessage(event);
    };

    this.ws.onclose = () => {
      this._setStatus('disconnected');
      this._scheduleReconnect();
    };

    this.ws.onerror = () => {
      this._setStatus('error');
      this.ws?.close();
    };
  }

  private _disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.lastUpdateTime.clear();
    this.ws?.close();
    this.ws = null;
    this._setStatus('disconnected');
  }

  private _scheduleReconnect(): void {
    this._startAllFallbacks();
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this._setStatus('error');
      return;
    }
    if (!isMarketOpen()) {
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this._connect(), delay);
  }

  private _wsSubscribe(ticker: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', symbol: ticker }));
    }
  }

  private _wsUnsubscribe(ticker: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe', symbol: ticker }));
    }
  }

  private _handleMessage(event: MessageEvent): void {
    try {
      const msg = JSON.parse(event.data as string) as {
        type: string;
        data?: Array<{ p: number; s: string; t: number; v: number }>;
      };
      if (msg.type !== 'trade' || !msg.data?.length) return;

      const now = Date.now();

      // Group by ticker, take last price per ticker in this batch
      const byTicker = new Map<string, number>();
      for (const trade of msg.data) {
        byTicker.set(trade.s, trade.p);
      }

      byTicker.forEach((price, ticker) => {
        // Throttle: skip if we emitted an update for this ticker within the last 1s
        const lastUpdate = this.lastUpdateTime.get(ticker) ?? 0;
        if (now - lastUpdate < 1000) return;
        this.lastUpdateTime.set(ticker, now);
        this.priceCache.set(ticker, price);
        this.subscribers.get(ticker)?.forEach((cb) => cb(price));
      });
    } catch {
      // malformed message — ignore
    }
  }

  // ── REST fallback ──────────────────────────────────────────────────────────

  private _startAllFallbacks(): void {
    this.subscribers.forEach((_, ticker) => this._startFallback(ticker));
  }

  private _startFallback(ticker: string): void {
    if (this.fallbackIntervals.has(ticker)) return;
    // Fetch immediately, then every 30s
    this._fetchFallback(ticker);
    const interval = setInterval(() => this._fetchFallback(ticker), 30_000);
    this.fallbackIntervals.set(ticker, interval);
  }

  private _clearFallback(ticker: string): void {
    const interval = this.fallbackIntervals.get(ticker);
    if (interval) {
      clearInterval(interval);
      this.fallbackIntervals.delete(ticker);
    }
  }

  private async _fetchFallback(ticker: string): Promise<void> {
    try {
      const quote = await getQuote(ticker);
      const price = quote.c > 0 ? quote.c : quote.pc;
      if (price > 0) {
        this.priceCache.set(ticker, price);
        this.subscribers.get(ticker)?.forEach((cb) => cb(price));
      }
    } catch {
      // non-fatal
    }
  }
}

export const finnhubWS = FinnhubWSManager.getInstance();
