# Finnhub WebSocket Real-Time Price Feed Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace REST polling on Wheel Tracker and Portfolio pages with a singleton Finnhub WebSocket connection that streams real-time stock prices, adds live unrealized P&L to open positions, and falls back gracefully to REST polling when WebSocket is unavailable.

**Architecture:** A module-level singleton `FinnhubWSManager` class manages one WebSocket connection shared across all pages. React hooks (`useRealtimePrices`) subscribe per-ticker and push updates into component state. PositionTable and Portfolio receive live prices as props, rendering new columns and live totals.

**Tech Stack:** Finnhub WebSocket API (`wss://ws.finnhub.io`), React hooks, TypeScript, existing `blackScholes` lib from `src/lib/blackScholes.ts`, Tailwind CSS.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/finnhubWebSocket.ts` | Singleton WS manager: connect, subscribe, reconnect, fallback |
| Create | `src/hooks/useRealtimePrices.ts` | React hook: multi-ticker → `Map<string, number>` |
| Create | `src/components/WebSocketStatus.tsx` | Animated status dot (connected / connecting / error) |
| Modify | `src/components/PositionTable.tsx` | Add `livePrices?` prop; render Stock Price + Unrealized P&L columns |
| Modify | `src/pages/WheelTracker.tsx` | Wire up hook, pass prices to table, replace decorative Live dot |
| Modify | `src/pages/Portfolio.tsx` | Wire up hook, compute live total, remove manual `getQuote` price loop |

---

## Chunk 1: Core WebSocket Infrastructure

### Task 1: Create `src/lib/finnhubWebSocket.ts`

**Files:**
- Create: `src/lib/finnhubWebSocket.ts`

#### Background knowledge

Finnhub WebSocket protocol:
- Connect: `wss://ws.finnhub.io?token=YOUR_KEY`
- Subscribe: send `{"type":"subscribe","symbol":"AAPL"}`
- Unsubscribe: send `{"type":"unsubscribe","symbol":"AAPL"}`
- Price message: `{"type":"trade","data":[{"p":452.21,"s":"AAPL","t":1671234567890,"v":100}]}`
- Each trade message may contain an array of trades; use the last one as the current price.

Market hours:
- US market open: Mon–Fri, 9:30 AM ET (UTC-5 or UTC-4 depending on DST)
- US market close: 4:00 PM ET
- The simplest reliable check: `isMarketOpen()` returns `true` if the current UTC time falls in the market window on a weekday. Premarket/afterhours is excluded.

Reconnection:
- On `onclose` or `onerror`, schedule reconnect with exponential backoff: 1s, 2s, 4s, 8s, capped at 30s.
- Max 10 reconnect attempts before giving up and switching to fallback-only mode.

Fallback REST polling:
- If WebSocket is unavailable (outside market hours, connection failed after retries), or a ticker has no WS trade data for >60s, poll via `getQuote(ticker)` every 30s.
- Fallback updates go through the same callback path so hooks see no difference.

- [ ] **Step 1: Write the file**

```typescript
// src/lib/finnhubWebSocket.ts
import { getQuote } from './finnhub';

const KEY = import.meta.env.VITE_FINNHUB_API_KEY as string;
const WS_URL = `wss://ws.finnhub.io?token=${KEY}`;

export type WSStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type PriceCallback = (price: number) => void;
type StatusCallback = (status: WSStatus) => void;

/** Returns true if US equity market is likely open right now */
function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;

  // Convert UTC to ET (rough: UTC-5; DST handled approximately)
  const etOffset = isDST(now) ? -4 : -5;
  const etHour = now.getUTCHours() + etOffset;
  const etMinutes = now.getUTCMinutes();
  const minutesSinceMidnight = etHour * 60 + etMinutes;

  const marketOpen = 9 * 60 + 30;  // 9:30 AM ET
  const marketClose = 16 * 60;     // 4:00 PM ET
  return minutesSinceMidnight >= marketOpen && minutesSinceMidnight < marketClose;
}

function isDST(date: Date): boolean {
  // US DST: 2nd Sunday of March → 1st Sunday of November
  const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  return date.getTimezoneOffset() < Math.max(jan, jul);
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
  // ticker → last seen price timestamp (for stale detection)
  private lastTradeAt = new Map<string, number>();
  // ticker → REST fallback interval
  private fallbackIntervals = new Map<string, ReturnType<typeof setInterval>>();
  // Status listeners
  private statusListeners = new Set<StatusCallback>();

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
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this._setStatus('connecting');
    try {
      this.ws = new WebSocket(WS_URL);
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
    this.ws?.close();
    this.ws = null;
    this._setStatus('disconnected');
  }

  private _scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this._setStatus('error');
      this._startAllFallbacks();
      return;
    }
    if (!isMarketOpen()) {
      this._startAllFallbacks();
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

      // Group by ticker, take last price per ticker
      const byTicker = new Map<string, number>();
      for (const trade of msg.data) {
        byTicker.set(trade.s, trade.p);
      }

      byTicker.forEach((price, ticker) => {
        this.lastTradeAt.set(ticker, Date.now());
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
        this.subscribers.get(ticker)?.forEach((cb) => cb(price));
      }
    } catch {
      // non-fatal
    }
  }
}

export const finnhubWS = FinnhubWSManager.getInstance();
```

- [ ] **Step 2: Verify TypeScript compiles (no `tsc` errors in this file)**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter
npx tsc --noEmit 2>&1 | grep finnhubWebSocket
```

Expected: no output (no errors in this file).

---

### Task 2: Create `src/hooks/useRealtimePrices.ts`

**Files:**
- Create: `src/hooks/useRealtimePrices.ts`

- [ ] **Step 1: Write the file**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "useRealtimePrices|finnhubWebSocket"
```

Expected: no output.

---

### Task 3: Create `src/components/WebSocketStatus.tsx`

**Files:**
- Create: `src/components/WebSocketStatus.tsx`

This component replaces the existing decorative `span + "Live"` in WheelTracker with a functional status indicator. It also appears in Portfolio.

- [ ] **Step 1: Write the file**

```tsx
// src/components/WebSocketStatus.tsx
import type { WSStatus } from '../lib/finnhubWebSocket';

interface WebSocketStatusProps {
  status: WSStatus;
  /** Show "Live" / "Connecting" / "Offline" label next to the dot */
  showLabel?: boolean;
}

const STATUS_CONFIG: Record<WSStatus, { color: string; label: string; animate: boolean }> = {
  connected: { color: '#00e5c4', label: 'Live', animate: true },
  connecting: { color: '#f5c842', label: 'Connecting', animate: true },
  disconnected: { color: '#4a6a8a', label: 'Offline', animate: false },
  error: { color: '#ff4d6d', label: 'Offline', animate: false },
};

export function WebSocketStatus({ status, showLabel = true }: WebSocketStatusProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div className="flex items-center gap-2">
      <span
        className={cfg.animate ? 'w-2 h-2 rounded-full animate-pulse-glow' : 'w-2 h-2 rounded-full'}
        style={{ background: cfg.color }}
      />
      {showLabel && (
        <span
          className="text-xs"
          style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}
        >
          {cfg.label}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep WebSocketStatus
```

Expected: no output.

---

## Chunk 2: PositionTable Live Columns

### Task 4: Modify `src/components/PositionTable.tsx` — add live price + unrealized P&L columns

**Files:**
- Modify: `src/components/PositionTable.tsx`

#### Background knowledge

- `WheelPosition.premiumCollected` = total premium across all contracts (DB per-contract × contracts, done in usePositions hook line 35).
- `WheelPosition.strike` = strike price of the option (per-share basis).
- `WheelPosition.contracts` = number of option contracts. Each contract = 100 shares.
- Unrealized P&L formula (intrinsic approximation):
  - For CSP: `intrinsicPerShare = max(0, strike - stockPrice)`. The option costs at least this to close.
  - For CC: `intrinsicPerShare = max(0, stockPrice - strike)`.
  - `estimatedCostToClose = intrinsicPerShare * 100 * contracts`
  - `unrealizedPnl = premiumCollected - estimatedCostToClose`
  - `pctMaxProfit = clamp(unrealizedPnl / premiumCollected * 100, 0, 100)` (show 0% if no premium)
- When `livePrices` is not provided (e.g., closed positions table), skip these columns entirely.
- The new columns only appear in desktop table layout; mobile cards show OTM/ITM status only.

- [ ] **Step 1: Read the current file** (already read above — proceed)

- [ ] **Step 2: Add helper function and update `PositionTableProps`**

Add the following before the `PositionTable` function:

```typescript
// Add to imports at top of file (no new imports needed — uses inline calculation)

interface LivePnl {
  unrealizedPnl: number;
  pctMaxProfit: number;
  isItm: boolean;
  stockPrice: number;
}

function computeLivePnl(pos: WheelPosition, stockPrice: number): LivePnl {
  const intrinsicPerShare =
    pos.strategy === 'CSP'
      ? Math.max(0, pos.strike - stockPrice)
      : Math.max(0, stockPrice - pos.strike);
  const estimatedCostToClose = intrinsicPerShare * 100 * pos.contracts;
  const unrealizedPnl = pos.premiumCollected - estimatedCostToClose;
  const pctMaxProfit =
    pos.premiumCollected > 0
      ? Math.min(100, Math.max(0, (unrealizedPnl / pos.premiumCollected) * 100))
      : 0;
  const isItm = intrinsicPerShare > 0;
  return { unrealizedPnl, pctMaxProfit, isItm, stockPrice };
}
```

Update `PositionTableProps`:

```typescript
interface PositionTableProps {
  positions: WheelPosition[];
  livePrices?: Map<string, number>;  // ← new optional prop
  onRemove?: (id: string) => void;
  onClose?: (position: WheelPosition) => void;
  onEdit?: (position: WheelPosition) => void;
  onAssign?: (position: WheelPosition) => void;
}
```

- [ ] **Step 3: Update desktop table header row**

Find the line:
```typescript
{['Ticker', 'Strategy', 'Strike', 'Expiry', 'Premium', 'Return', 'DTE', ...(hasActions ? [''] : [])].map
```

Replace with:
```typescript
{[
  'Ticker', 'Strategy', 'Strike', 'Expiry', 'Premium', 'Return', 'DTE',
  ...(livePrices ? ['Stock $', 'Unreal P&L'] : []),
  ...(hasActions ? [''] : []),
].map
```

- [ ] **Step 4: Add live columns in the desktop table body**

In the `<tr>` body, after the DTE `<td>` and before the actions `<td>`, add:

```tsx
{livePrices && (() => {
  const stockPrice = livePrices.get(pos.ticker);
  if (stockPrice == null) {
    return (
      <>
        <td className="py-3.5 px-4">
          <span style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>—</span>
        </td>
        <td className="py-3.5 px-4">
          <span style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>—</span>
        </td>
      </>
    );
  }
  const { unrealizedPnl, pctMaxProfit, isItm } = computeLivePnl(pos, stockPrice);
  const pnlColor = unrealizedPnl >= 0 ? '#00d68f' : '#ff4d6d';
  return (
    <>
      <td className="py-3.5 px-4">
        <div className="flex flex-col gap-0.5">
          <span style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
            ${stockPrice.toFixed(2)}
          </span>
          <span className="text-[10px]" style={{ color: isItm ? '#ff4d6d' : '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>
            {isItm ? 'ITM' : 'OTM'}
          </span>
        </div>
      </td>
      <td className="py-3.5 px-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-medium tabular-nums" style={{ color: pnlColor, fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
            {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(0)}
          </span>
          {/* % max profit bar */}
          <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pctMaxProfit}%`,
                background: pctMaxProfit >= 75 ? '#00d68f' : pctMaxProfit >= 40 ? '#f5c842' : '#ff4d6d',
              }}
            />
          </div>
          <span className="text-[10px]" style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace' }}>
            {pctMaxProfit.toFixed(0)}% max
          </span>
        </div>
      </td>
    </>
  );
})()}
```

- [ ] **Step 5: Add ITM/OTM badge to mobile card layout**

In the mobile card Row 1 (after the strategy badge), after `{pos.contracts}x`, add:

```tsx
{livePrices && (() => {
  const sp = livePrices.get(pos.ticker);
  if (!sp) return null;
  const { isItm } = computeLivePnl(pos, sp);
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
      style={{
        color: isItm ? '#ff4d6d' : '#00d68f',
        background: isItm ? 'rgba(255,77,109,0.1)' : 'rgba(0,214,143,0.1)',
        border: `1px solid ${isItm ? 'rgba(255,77,109,0.2)' : 'rgba(0,214,143,0.2)'}`,
        fontFamily: 'JetBrains Mono, monospace',
      }}>
      {isItm ? 'ITM' : 'OTM'}
    </span>
  );
})()}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep PositionTable
```

Expected: no output.

---

## Chunk 3: WheelTracker Integration

### Task 5: Wire up WebSocket in `src/pages/WheelTracker.tsx`

**Files:**
- Modify: `src/pages/WheelTracker.tsx`

- [ ] **Step 1: Add imports**

At the top of `WheelTracker.tsx`, replace:
```typescript
import { getQuote } from '../lib/finnhub';
```

With:
```typescript
import { useRealtimePrices } from '../hooks/useRealtimePrices';
import { WebSocketStatus } from '../components/WebSocketStatus';
```

(Remove `getQuote` if it's only used for prices — confirm no other usage in the file first.)

- [ ] **Step 2: Add `useRealtimePrices` call in `RealWheelTracker`**

After the existing state declarations, add:

```typescript
// Build stable ticker list from open positions
const openTickers = useMemo(
  () => [...new Set(openPositions.map((p) => p.ticker))],
  [openPositions]
);
const { prices: livePrices, wsStatus } = useRealtimePrices(openTickers);
```

Also add `useMemo` to the imports from `react` at the top.

- [ ] **Step 3: Replace decorative Live indicator with `<WebSocketStatus />`**

Find:
```tsx
<div className="flex items-center gap-2">
  <span className="w-2 h-2 rounded-full animate-pulse-glow" style={{ background: '#00e5c4' }} />
  <span className="text-xs" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Live</span>
</div>
```

Replace with:
```tsx
<WebSocketStatus status={wsStatus} />
```

- [ ] **Step 4: Pass `livePrices` to PositionTable**

Find:
```tsx
<PositionTable
  positions={openPositions}
  onRemove={removePosition}
  onClose={setClosingPosition}
  onEdit={setEditingPosition}
  onAssign={setAssigningPosition}
/>
```

Replace with:
```tsx
<PositionTable
  positions={openPositions}
  livePrices={livePrices}
  onRemove={removePosition}
  onClose={setClosingPosition}
  onEdit={setEditingPosition}
  onAssign={setAssigningPosition}
/>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep WheelTracker
```

Expected: no output.

---

## Chunk 4: Portfolio Integration

### Task 6: Wire up WebSocket in `src/pages/Portfolio.tsx`

**Files:**
- Modify: `src/pages/Portfolio.tsx`

#### Background knowledge

- `holdingsWithPrice` (from `usePortfolio`) provides `HoldingWithPrice[]`, each with `currentPrice` already computed via REST in the hook.
- The goal: replace the `livePriceMap` ref (which copies REST prices) with WebSocket live prices. The `livePriceMap` is passed to `AddHoldingModal` for preview. This is a relatively light change.
- For Portfolio's "Live Total", add a live total portfolio value that recalculates when WebSocket prices arrive.
- **Do NOT replace** `usePortfolio` REST fetching — it provides cost basis and full holding data. Only supplement with WebSocket for current price display.
- `getQuote` in Portfolio is used for SGD exchange rate (`OANDA:USD_SGD`) — keep that call, it's not a stock ticker.

- [ ] **Step 1: Find where `useRealtimePrices` should be added**

In `RealPortfolio` component, find the line approximately:
```typescript
const livePriceMap = useRef(new Map<string, number | null>());
useEffect(() => {
  const map = new Map<string, number | null>();
  ...
  livePriceMap.current = map;
}, [holdingsWithPrice]);
```

- [ ] **Step 2: Add import at top of file**

```typescript
import { useRealtimePrices } from '../hooks/useRealtimePrices';
import { WebSocketStatus } from '../components/WebSocketStatus';
```

- [ ] **Step 3: Add `useRealtimePrices` call in `RealPortfolio`**

After `holdingsWithPrice` is derived from `usePortfolio`, add:

```typescript
// Collect unique non-cash tickers for WebSocket subscription
const holdingTickers = useMemo(
  () => [...new Set(
    holdingsWithPrice
      .filter((h) => h.holdingType !== 'cash')
      .map((h) => h.ticker.toUpperCase())
  )],
  [holdingsWithPrice]
);
const { prices: wsPrices, wsStatus } = useRealtimePrices(holdingTickers);
```

- [ ] **Step 4: Build live price map from WebSocket prices**

Replace the existing `livePriceMap` ref + useEffect block with:

```typescript
// Merge WebSocket prices with REST prices (WS takes precedence when available)
const livePriceMap = useMemo(() => {
  const map = new Map<string, number | null>();
  for (const h of holdingsWithPrice) {
    map.set(h.ticker, h.currentPrice);
  }
  // Override with fresher WebSocket prices
  wsPrices.forEach((price, ticker) => map.set(ticker, price));
  return map;
}, [holdingsWithPrice, wsPrices]);
```

- [ ] **Step 5: Compute live total portfolio value**

Find where the current portfolio total is computed (look for `totalValue` or similar calculation using `holdingsWithPrice`). Add a memo that recalculates with WebSocket prices:

```typescript
const liveTotalValue = useMemo(() => {
  return holdingsWithPrice.reduce((acc, h) => {
    if (h.holdingType === 'cash') return acc + h.quantity;
    const livePrice = wsPrices.get(h.ticker.toUpperCase()) ?? h.currentPrice ?? 0;
    return acc + livePrice * h.quantity;
  }, 0);
}, [holdingsWithPrice, wsPrices]);
```

Then use `liveTotalValue` wherever the portfolio total is displayed (replace the existing static calculation).

- [ ] **Step 6: Add `<WebSocketStatus />` to Portfolio header**

Find the Portfolio page header area and add the status indicator near the top-right (similar to WheelTracker). Look for the page title section and add:

```tsx
<WebSocketStatus status={wsStatus} />
```

- [ ] **Step 7: Update `AddHoldingModal` call to use new livePriceMap**

The existing call already passes `livePrices={livePriceMap.current}`. After Step 4, `livePriceMap` is now a `Map<string, number | null>` returned from `useMemo`, so update the call to:

```tsx
livePrices={livePriceMap}
```

(Remove the `.current` since it's no longer a ref.)

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep Portfolio
```

Expected: no output or only pre-existing errors (not newly introduced).

---

## Chunk 5: Final Validation

### Task 7: Full compile + smoke test

- [ ] **Step 1: Full TypeScript check**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter
npx tsc --noEmit 2>&1
```

Expected: no new errors introduced by this feature (pre-existing errors are acceptable if they existed before).

- [ ] **Step 2: Dev server smoke test**

```bash
npm run dev
```

Open the app:
1. Navigate to **Wheel Tracker** — should see `<WebSocketStatus>` dot. During market hours, it should connect (dot turns teal/pulse). Outside hours, dot is grey "Offline" and prices come from REST polling.
2. Open positions table should show "Stock $" and "Unreal P&L" columns (desktop) or OTM/ITM badge (mobile).
3. Navigate to **Portfolio** — should see WebSocketStatus indicator. Live prices should update in the holdings table.
4. Navigate away from both pages — subscriptions should clean up (no ongoing WebSocket traffic).
5. IV Screener — should NOT be affected (no WebSocket on that page).

- [ ] **Step 3: Confirm no Polygon snapshot calls**

Open browser DevTools → Network → filter by "polygon". Confirm no `/v2/snapshot` calls appear when loading the Screener.

- [ ] **Step 4: Confirm WS connects during market hours**

Open DevTools → Network → WS tab. Confirm:
- `wss://ws.finnhub.io` connection appears.
- Subscribe messages sent for each open position ticker.
- Trade messages received and price cells update.

---

## Notes for Implementers

### Cleanup rules (from spec Step 10)
- All WebSocket subscriptions are cleaned up via the `useEffect` return function in `useRealtimePrices`.
- The singleton `finnhubWS` persists across navigation (module-level singleton) — subscriptions are reference-counted per ticker.
- When no hooks are subscribed to any ticker, the WebSocket disconnects automatically.

### Market hours edge cases
- Outside market hours: `_connect()` skips WS and calls `_startAllFallbacks()` immediately.
- REST fallback fires once immediately, then every 30s.
- If WebSocket reconnect fails after 10 attempts: switches permanently to REST fallback for the session.

### `livePrices` prop is optional in PositionTable
- Passing no `livePrices` (undefined) hides all live columns — safe for any future use of PositionTable in a closed-positions context.

### Portfolio's `AddHoldingModal` signature
- `AddHoldingModalProps.livePrices` is typed as `Map<string, number | null>`.
- After Step 4, `livePriceMap` becomes `Map<string, number | null>` from `useMemo` — type is compatible. Pass it directly (no `.current`).
