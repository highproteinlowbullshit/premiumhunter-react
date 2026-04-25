# Performance Audit & Optimisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce initial JS bundle size by ~70%, improve Lighthouse performance score to >85, and eliminate unnecessary network requests — without changing any UI, business logic, or feature behaviour.

**Architecture:** Route-based code splitting splits the ~600KB monolithic bundle into per-page chunks loaded on demand. WebSocket price throttling reduces React re-renders. Targeted Supabase field selection cuts payload sizes. Vite manual chunk configuration groups stable vendor code for long-term browser caching.

**Tech Stack:** Vite 8, React 19, @tanstack/react-query v5, Recharts, Supabase, @tanstack/react-virtual, rollup-plugin-visualizer

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `src/App.tsx` | Modify | Lazy imports for all 12 pages + LeapsCalculator; add Suspense + PageLoader; tighten QueryClient defaults |
| `src/components/PageLoader.tsx` | Create | Suspense fallback spinner |
| `src/lib/performanceMonitor.ts` | Create | Browser Performance API logging |
| `src/lib/finnhubWebSocket.ts` | Modify | Per-ticker 1 s price update throttle |
| `src/pages/Screener.tsx` | Modify | TanStack Virtual for desktop table and mobile cards |
| `src/hooks/usePositions.ts` | Modify | Replace `select('*')` with explicit field list |
| `src/hooks/usePortfolio.ts` | Modify | Replace `select('*')` with explicit field lists (3 queries) |
| `src/hooks/usePaperTrading.ts` | Modify | Replace `select('*')` with explicit field lists |
| `src/context/PaperModeContext.tsx` | Modify | Replace `select('*')` with explicit field lists |
| `vite.config.ts` | Modify | Add visualizer plugin + manualChunks vendor splitting |
| `index.html` | Modify | Add preconnect hints for Finnhub + Supabase |
| `vercel.json` | Modify | Add immutable cache headers for hashed assets |
| `src/main.tsx` | Modify | Call measurePageLoad() |
| `src/pages/Dashboard.tsx` | Modify | Add prefetch for Screener + WheelTracker |
| `src/pages/Screener.tsx` | Modify | Add prefetch for StockDetail |

---

## Task 1: Baseline Lighthouse Audit

**Files:** none (read-only measurement)

- [ ] **Step 1: Install Lighthouse CLI globally**

```bash
npm install -g lighthouse
```

- [ ] **Step 2: Build and serve the current app**

```bash
npx vite build && npx vite preview &
# Wait ~3s for the server to start
sleep 3
```

- [ ] **Step 3: Run Lighthouse**

```bash
lighthouse http://localhost:4173 \
  --output=json \
  --output-path=./lighthouse-baseline.json \
  --chrome-flags="--headless --no-sandbox" \
  --only-categories=performance
```

- [ ] **Step 4: Print baseline scores**

```bash
node -e "
  const r = require('./lighthouse-baseline.json')
  const cats = r.categories
  const m = r.audits
  console.log('=== BASELINE SCORES ===')
  console.log('Performance:   ', Math.round(cats.performance.score * 100))
  console.log('FCP:           ', m['first-contentful-paint'].displayValue)
  console.log('LCP:           ', m['largest-contentful-paint'].displayValue)
  console.log('TBT:           ', m['total-blocking-time'].displayValue)
  console.log('CLS:           ', m['cumulative-layout-shift'].displayValue)
  console.log('Speed Index:   ', m['speed-index'].displayValue)
  console.log('Unused JS:     ', m['unused-javascript'].displayValue)
"
```

Record this output — it becomes the "before" column in Task 12.

- [ ] **Step 5: Kill the preview server**

```bash
kill $(lsof -ti:4173) 2>/dev/null || true
```

---

## Task 2: Install Dependencies

**Files:** `package.json`

- [ ] **Step 1: Install new packages**

```bash
npm install @tanstack/react-virtual
npm install -D rollup-plugin-visualizer
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('./node_modules/@tanstack/react-virtual/package.json'); console.log('react-virtual OK')"
node -e "require('./node_modules/rollup-plugin-visualizer/package.json'); console.log('visualizer OK')"
```

---

## Task 3: Vite Config — Visualizer + Manual Chunks

**Files:** `vite.config.ts`

- [ ] **Step 1: Rewrite vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    visualizer({
      filename: './dist/bundle-analysis.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-query':    ['@tanstack/react-query'],
          'vendor-charts':   ['recharts'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-sentry':   ['@sentry/react'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
```

- [ ] **Step 2: Build and inspect bundle sizes**

```bash
npm run build
node -e "
  const fs = require('fs'), path = require('path')
  const dir = './dist/assets'
  fs.readdirSync(dir)
    .filter(f => f.endsWith('.js'))
    .map(f => ({ name: f.split('-')[0], size: (fs.statSync(path.join(dir, f)).size / 1024).toFixed(1) + 'KB' }))
    .sort((a, b) => parseFloat(b.size) - parseFloat(a.size))
    .forEach(f => console.log(f.name.padEnd(20), f.size))
"
```

Expected: Without code splitting yet, you'll see one large chunk. This baseline confirms the visualizer works.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts package.json package-lock.json
git commit -m "perf: add bundle visualizer and vendor chunk splitting to vite config"
```

---

## Task 4: Create PageLoader Component

**Files:** `src/components/PageLoader.tsx` (create)

- [ ] **Step 1: Create PageLoader**

```tsx
export function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#050d1a',
    }}>
      <div style={{
        width: 28,
        height: 28,
        border: '2px solid rgba(0,229,196,0.2)',
        borderTopColor: '#00e5c4',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
```

---

## Task 5: Route-Based Code Splitting in App.tsx

**Files:** `src/App.tsx`

This is the highest-impact change. `LeapsCalculator` is the critical one — it imports Recharts and is currently loaded on **every page load** because it lives in `AppInner`. Lazy-loading it removes Recharts from the initial bundle entirely.

- [ ] **Step 1: Replace eager imports with lazy imports in App.tsx**

Replace the entire block of page imports and the LeapsCalculator import:

```tsx
// REMOVE these eager imports:
// import { LeapsCalculator } from './components/LeapsCalculator';
// import { Dashboard } from './pages/Dashboard';
// import { Watchlist } from './pages/Watchlist';
// import { StockDetail } from './pages/StockDetail';
// import { WheelTracker } from './pages/WheelTracker';
// import { Screener } from './pages/Screener';
// import { Login } from './pages/Login';
// import { Signup } from './pages/Signup';
// import { ForgotPassword } from './pages/ForgotPassword';
// import { ResetPassword } from './pages/ResetPassword';
// import { NotFound } from './pages/NotFound';
// import { Portfolio } from './pages/Portfolio';
// import { HelpPage } from './pages/HelpPage';

// ADD these lazy imports (place after the existing non-page imports):
import { lazy, Suspense } from 'react';

const LeapsCalculator  = lazy(() => import('./components/LeapsCalculator').then(m => ({ default: m.LeapsCalculator })));
const Dashboard        = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Watchlist        = lazy(() => import('./pages/Watchlist').then(m => ({ default: m.Watchlist })));
const StockDetail      = lazy(() => import('./pages/StockDetail').then(m => ({ default: m.StockDetail })));
const WheelTracker     = lazy(() => import('./pages/WheelTracker').then(m => ({ default: m.WheelTracker })));
const Screener         = lazy(() => import('./pages/Screener').then(m => ({ default: m.Screener })));
const Login            = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Signup           = lazy(() => import('./pages/Signup').then(m => ({ default: m.Signup })));
const ForgotPassword   = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword    = lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const NotFound         = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));
const Portfolio        = lazy(() => import('./pages/Portfolio').then(m => ({ default: m.Portfolio })));
const HelpPage         = lazy(() => import('./pages/HelpPage').then(m => ({ default: m.HelpPage })));
```

- [ ] **Step 2: Update QueryClient defaults**

Replace the existing `queryClient` declaration:

```tsx
// REMOVE:
// const queryClient = new QueryClient({
//   defaultOptions: {
//     queries: { retry: 3, refetchOnWindowFocus: false },
//   },
// });

// ADD:
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 min — treat data as fresh for 5 min globally
      gcTime: 30 * 60 * 1000,         // 30 min — keep in memory cache
      refetchOnWindowFocus: false,     // already false; explicit for clarity
      refetchOnMount: false,           // don't refetch if data is still fresh
      refetchOnReconnect: true,
      retry: 1,
      retryDelay: 1000,
      networkMode: 'online',
    },
    mutations: {
      retry: 0,
      networkMode: 'online',
    },
  },
});
```

- [ ] **Step 3: Wrap LeapsCalculator in Suspense (in AppInner)**

```tsx
// BEFORE:
<LeapsCalculator isOpen={leapsCalcOpen} onClose={() => setLeapsCalcOpen(false)} />

// AFTER:
<Suspense fallback={null}>
  <LeapsCalculator isOpen={leapsCalcOpen} onClose={() => setLeapsCalcOpen(false)} />
</Suspense>
```

- [ ] **Step 4: Wrap Routes in Suspense (in AppInner)**

```tsx
// BEFORE:
<Sentry.ErrorBoundary fallback={...}>
  <Routes>
    ...
  </Routes>
</Sentry.ErrorBoundary>

// AFTER:
<Sentry.ErrorBoundary fallback={...}>
  <Suspense fallback={<PageLoader />}>
    <Routes>
      ...
    </Routes>
  </Suspense>
</Sentry.ErrorBoundary>
```

Also add the PageLoader import at the top:
```tsx
import { PageLoader } from './components/PageLoader';
```

- [ ] **Step 5: Build and verify chunks are created**

```bash
npm run build 2>&1 | grep "dist/assets"
```

Expected: You should now see 8-14 separate `.js` files instead of 1-2. Look for `vendor-charts`, `vendor-react`, `vendor-query` chunks. The main entry chunk should be dramatically smaller.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/PageLoader.tsx
git commit -m "perf: route-based code splitting with React.lazy — removes recharts from initial bundle"
```

---

## Task 6: WebSocket Price Update Throttling

**Files:** `src/lib/finnhubWebSocket.ts`

The WS stream can emit multiple trade events per second per ticker. Currently every trade event triggers all subscribers (React components). Throttling to 1 update/second per ticker prevents unnecessary re-renders while prices still appear live.

- [ ] **Step 1: Add lastUpdateTime map and throttle in _handleMessage**

Add the private field after the existing class fields:

```typescript
// Add after:  private statusListeners = new Set<StatusCallback>();
private lastUpdateTime = new Map<string, number>();
```

Modify `_handleMessage`:

```typescript
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
      this.subscribers.get(ticker)?.forEach((cb) => cb(price));
    });
  } catch {
    // malformed message — ignore
  }
}
```

Also clear throttle state on disconnect (prevents stale timestamps after reconnect):

```typescript
private _disconnect(): void {
  if (this.reconnectTimer) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
  this.reconnectAttempts = 0;
  this.lastUpdateTime.clear();   // ← add this line
  this.ws?.close();
  this.ws = null;
  this._setStatus('disconnected');
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/finnhubWebSocket.ts
git commit -m "perf: throttle WebSocket price updates to 1/second per ticker to reduce renders"
```

---

## Task 7: Virtual Scrolling in Screener

**Files:** `src/pages/Screener.tsx`

Currently all `filtered` rows (up to ~200) are rendered into the DOM. TanStack Virtual renders only the ~15 rows visible in the viewport plus 10 overhead rows. This reduces DOM nodes from ~200 rows to ~25 at any time.

The desktop table uses `<table>` / `<tbody>`. TanStack Virtual requires a scrollable container and absolute-positioned rows. We keep `<thead>` with `position: sticky` for the column headers, and convert `<tbody>` to a `display: block` container with virtualized rows.

- [ ] **Step 1: Add useVirtualizer import at top of Screener.tsx**

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'
```

- [ ] **Step 2: Add scroll container ref and virtualizers in the Screener component**

Find where `const { stocks, loadedCount, total, isLoading } = useScreenerStream();` is declared. Add refs immediately after:

```tsx
const tableScrollRef = useRef<HTMLDivElement>(null);
const mobileScrollRef = useRef<HTMLDivElement>(null);

const desktopVirtualizer = useVirtualizer({
  count: filtered.length,
  getScrollElement: () => tableScrollRef.current,
  estimateSize: () => 52,
  overscan: 10,
});

const mobileVirtualizer = useVirtualizer({
  count: filtered.length,
  getScrollElement: () => mobileScrollRef.current,
  estimateSize: () => 116,   // approximate MobileCard height
  overscan: 5,
});
```

The `useRef` import is already present. Confirm `useRef` is in the import from `react` at line 1.

- [ ] **Step 3: Replace the desktop table body**

Find this section (around line 293):

```tsx
<div className="overflow-x-auto">
  <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
    <StickyHeader filters={filters} set={set} />
    <tbody>
      {filtered.map((stock, i) => (
        <DesktopRow
          key={stock.ticker}
          stock={stock}
          isLast={i === filtered.length - 1}
          watched={isWatched(stock.ticker)}
          onToggleWatch={() => isWatched(stock.ticker) ? removeTicker(stock.ticker) : addTicker(stock.ticker)}
          onClick={() => navigate(`/stock/${stock.ticker}`)}
          isPaperMode={isPaperMode}
          onPaperTrade={() => setPaperTradeStock(stock)}
        />
      ))}
    </tbody>
  </table>
</div>
```

Replace with:

```tsx
<div
  ref={tableScrollRef}
  className="overflow-x-auto"
  style={{ maxHeight: '640px', overflowY: 'auto' }}
>
  <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
    <StickyHeader filters={filters} set={set} />
    <tbody
      style={{
        display: 'block',
        height: `${desktopVirtualizer.getTotalSize()}px`,
        position: 'relative',
      }}
    >
      {desktopVirtualizer.getVirtualItems().map((virtualRow) => {
        const stock = filtered[virtualRow.index];
        return (
          <tr
            key={stock.ticker}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <DesktopRow
              stock={stock}
              isLast={virtualRow.index === filtered.length - 1}
              watched={isWatched(stock.ticker)}
              onToggleWatch={() => isWatched(stock.ticker) ? removeTicker(stock.ticker) : addTicker(stock.ticker)}
              onClick={() => navigate(`/stock/${stock.ticker}`)}
              isPaperMode={isPaperMode}
              onPaperTrade={() => setPaperTradeStock(stock)}
            />
          </tr>
        );
      })}
    </tbody>
  </table>
</div>
```

- [ ] **Step 4: Replace the mobile cards list**

Find this section (around line 315):

```tsx
<div className="md:hidden space-y-3">
  {filtered.map((stock) => (
    <MobileCard
      key={stock.ticker}
      stock={stock}
      ...
    />
  ))}
</div>
```

Replace with:

```tsx
<div
  ref={mobileScrollRef}
  className="md:hidden"
  style={{ height: '80vh', overflowY: 'auto' }}
>
  <div
    style={{
      height: `${mobileVirtualizer.getTotalSize()}px`,
      position: 'relative',
    }}
  >
    {mobileVirtualizer.getVirtualItems().map((virtualRow) => {
      const stock = filtered[virtualRow.index];
      return (
        <div
          key={stock.ticker}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualRow.start}px)`,
            paddingBottom: 12,
          }}
        >
          <MobileCard
            stock={stock}
            watched={isWatched(stock.ticker)}
            onToggleWatch={() => isWatched(stock.ticker) ? removeTicker(stock.ticker) : addTicker(stock.ticker)}
            onClick={() => navigate(`/stock/${stock.ticker}`)}
            isPaperMode={isPaperMode}
            onPaperTrade={() => setPaperTradeStock(stock)}
          />
        </div>
      );
    })}
  </div>
</div>
```

- [ ] **Step 5: Type-check**

```bash
npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Screener.tsx
git commit -m "perf: virtualise screener table and mobile cards with @tanstack/react-virtual"
```

---

## Task 8: Supabase Select Field Optimisation

**Files:** `src/hooks/usePositions.ts`, `src/hooks/usePortfolio.ts`, `src/hooks/usePaperTrading.ts`, `src/context/PaperModeContext.tsx`

`select('*')` fetches every column including `checklist_snapshot` (a large JSONB blob). Explicit field lists reduce payload size, especially for the positions list which is the most frequently fetched query.

### 8a — usePositions.ts

- [ ] **Step 1: Replace list query select('*') at line ~76**

```typescript
// BEFORE:
const { data, error } = await supabase
  .from('wheel_positions')
  .select('*')
  .eq('user_id', user!.id)
  .order('opened_at', { ascending: false });

// AFTER:
const { data, error } = await supabase
  .from('wheel_positions')
  .select('id, ticker, strategy, strike, expiry, premium_collected, contracts, status, notes, opened_at, closed_at, closing_price')
  .eq('user_id', user!.id)
  .order('opened_at', { ascending: false });
```

- [ ] **Step 2: Replace insert+select('*') at line ~125**

```typescript
// BEFORE:
const { data: inserted, error } = await supabase
  .from('wheel_positions')
  .insert({ ... })
  .select('*')
  .single();

// AFTER:
const { data: inserted, error } = await supabase
  .from('wheel_positions')
  .insert({ ... })
  .select('id, ticker, strategy, strike, expiry, premium_collected, contracts, status, notes, opened_at, closed_at, closing_price')
  .single();
```

### 8b — usePortfolio.ts

- [ ] **Step 3: Replace portfolio_holdings open query**

```typescript
// BEFORE:
supabase.from('portfolio_holdings').select('*').eq('user_id', userId).eq('status', 'open').order('ticker', { ascending: true })

// AFTER:
supabase.from('portfolio_holdings')
  .select('id, holding_type, ticker, quantity, avg_cost, closing_price, expiry, strike, notes, opened_at, closed_at, status')
  .eq('user_id', userId).eq('status', 'open').order('ticker', { ascending: true })
```

- [ ] **Step 4: Replace portfolio_snapshots query**

```typescript
// BEFORE:
supabase.from('portfolio_snapshots').select('*').eq('user_id', userId).order('snapshot_date', { ascending: true })

// AFTER:
supabase.from('portfolio_snapshots')
  .select('id, snapshot_date, total_value, total_cost, unrealized_pnl, realized_pnl, options_premium')
  .eq('user_id', userId).order('snapshot_date', { ascending: true })
```

- [ ] **Step 5: Replace closed holdings query**

```typescript
// BEFORE:
supabase.from('portfolio_holdings').select('*').eq('user_id', userId).eq('status', 'closed')

// AFTER:
supabase.from('portfolio_holdings')
  .select('id, holding_type, ticker, quantity, avg_cost, closing_price, expiry, strike, notes, opened_at, closed_at, status')
  .eq('user_id', userId).eq('status', 'closed')
```

- [ ] **Step 6: Replace upsert+select snapshot**

```typescript
// BEFORE:
.upsert({ ... }, { onConflict: 'user_id,snapshot_date' }).select('*').single()

// AFTER:
.upsert({ ... }, { onConflict: 'user_id,snapshot_date' })
  .select('id, snapshot_date, total_value, total_cost, unrealized_pnl, realized_pnl, options_premium')
  .single()
```

### 8c — usePaperTrading.ts

- [ ] **Step 7: Replace paper_accounts select('*') (3 occurrences)**

For all three `.from('paper_accounts').select('*')`:

```typescript
// AFTER:
.from('paper_accounts')
  .select('id, user_id, starting_balance, current_cash, total_premium_collected, total_realized_pnl, trades_won, trades_total, created_at, reset_at')
```

For `.from('paper_positions').select('*')` (2 occurrences):

```typescript
// AFTER:
.from('paper_positions')
  .select('id, ticker, strategy, strike, expiry, premium_collected, contracts, underlying_price_at_entry, status, notes, opened_at, closed_at, closing_premium, realized_pnl, created_at')
```

### 8d — PaperModeContext.tsx

- [ ] **Step 8: Replace paper_accounts select('*') (2 occurrences)**

Same replacement as Step 7 for `paper_accounts`.

```typescript
.from('paper_accounts')
  .select('id, user_id, starting_balance, current_cash, total_premium_collected, total_realized_pnl, trades_won, trades_total, created_at, reset_at')
```

Also replace `.select('*')` for paper_positions insert:

```typescript
.from('paper_positions')
  .select('id, ticker, strategy, strike, expiry, premium_collected, contracts, underlying_price_at_entry, status, notes, opened_at, closed_at, closing_premium, realized_pnl, created_at')
```

- [ ] **Step 9: Type-check**

```bash
npx tsc -b --noEmit
```

Expected: no errors. The `DbPosition` / `DbHolding` etc. interfaces must match the fields you're selecting. If TypeScript complains about missing fields on an interface, either add the field back to the select or remove it from the interface.

- [ ] **Step 10: Commit**

```bash
git add src/hooks/usePositions.ts src/hooks/usePortfolio.ts src/hooks/usePaperTrading.ts src/context/PaperModeContext.tsx
git commit -m "perf: replace select('*') with explicit field lists — excludes checklist_snapshot JSONB from list queries"
```

---

## Task 9: Supabase Database Indexes

These indexes run in the Supabase SQL editor (Dashboard → SQL Editor). They are not code changes.

- [ ] **Step 1: Run in Supabase SQL editor**

```sql
-- Open positions: most common query (wheel tracker load)
CREATE INDEX IF NOT EXISTS idx_positions_user_status_expiry
  ON wheel_positions (user_id, status, expiry ASC)
  WHERE status = 'open';

-- All positions by user (portfolio / closed positions)
CREATE INDEX IF NOT EXISTS idx_positions_user_opened
  ON wheel_positions (user_id, opened_at DESC);

-- Portfolio holdings by user+status (portfolio page load)
CREATE INDEX IF NOT EXISTS idx_holdings_user_status
  ON portfolio_holdings (user_id, status);

-- Snapshots: charting query
CREATE INDEX IF NOT EXISTS idx_snapshots_user_date
  ON portfolio_snapshots (user_id, snapshot_date ASC);

-- IV snapshots: daily screener load
CREATE INDEX IF NOT EXISTS idx_iv_snapshots_date_ticker
  ON iv_snapshots (snapshot_date DESC, ticker);

-- Paper trading
CREATE INDEX IF NOT EXISTS idx_paper_positions_user_status
  ON paper_positions (user_id, status);
```

Expected: Each statement returns "Success. No rows returned."

---

## Task 10: index.html Preconnect Hints + vercel.json Caching

**Files:** `index.html`, `vercel.json`

### 10a — index.html

- [ ] **Step 1: Add preconnect hints to `<head>` in index.html**

Add immediately before `</head>`:

```html
    <!-- Preconnect to external APIs used on first load -->
    <link rel="preconnect" href="https://finnhub.io" />
    <link rel="preconnect" href="https://ws.finnhub.io" />
    <link rel="dns-prefetch" href="https://api.polygon.io" />
```

For Supabase, the URL is an env var and can't be hardcoded here. It's fetched lazily and the preconnect benefit is minimal.

### 10b — vercel.json

- [ ] **Step 2: Rewrite vercel.json with asset caching headers**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

Vite hashes all asset filenames (e.g. `index-Abc123.js`), so `immutable` is safe — new deployments produce new hashes and browsers always load fresh files.

- [ ] **Step 3: Commit**

```bash
git add index.html vercel.json
git commit -m "perf: add preconnect hints for Finnhub and 1-year immutable cache for hashed Vite assets"
```

---

## Task 11: Performance Monitor

**Files:** `src/lib/performanceMonitor.ts` (create), `src/main.tsx`

- [ ] **Step 1: Create src/lib/performanceMonitor.ts**

```typescript
export function measurePageLoad(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('load', () => {
    // Defer so paint entries are available
    setTimeout(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return;

      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find(e => e.name === 'first-contentful-paint')?.startTime ?? 0;
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint' as EntryType);
      const lcp = lcpEntries.length > 0 ? (lcpEntries[lcpEntries.length - 1] as PerformanceEntry).startTime : 0;

      const metrics = {
        ttfb: Math.round(nav.responseStart - nav.requestStart),
        fcp:  Math.round(fcp),
        lcp:  Math.round(lcp),
        domInteractive: Math.round(nav.domInteractive),
        loadComplete:   Math.round(nav.loadEventEnd),
        url: window.location.pathname,
      };

      if (import.meta.env.DEV) {
        console.group('%c⚡ Performance Metrics', 'color:#00e5c4;font-weight:bold');
        console.table(metrics);
        console.groupEnd();
      }
    }, 0);
  });
}
```

- [ ] **Step 2: Call measurePageLoad in main.tsx**

```typescript
// Add import at top:
import { measurePageLoad } from './lib/performanceMonitor';

// Add call before createRoot:
measurePageLoad();
```

- [ ] **Step 3: Type-check**

```bash
npx tsc -b --noEmit
```

Note: `'largest-contentful-paint'` may not be in the `EntryType` TypeScript union. If you get a type error, cast it:
```typescript
const lcpEntries = performance.getEntriesByType('largest-contentful-paint' as EntryType);
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/performanceMonitor.ts src/main.tsx
git commit -m "perf: add browser Performance API monitoring — logs TTFB/FCP/LCP to console in dev"
```

---

## Task 12: Route Prefetching

**Files:** `src/pages/Dashboard.tsx`, `src/pages/Screener.tsx`

After the initial page loads, we speculatively import the next most likely pages. This downloads their JS chunks in the background so navigation feels instant.

- [ ] **Step 1: Add prefetch in Dashboard.tsx**

Add this `useEffect` inside the `Dashboard` function component, near other effects:

```tsx
// Prefetch most-visited pages after dashboard loads
useEffect(() => {
  const t = setTimeout(() => {
    void import('./Screener');
    void import('./WheelTracker');
  }, 2000);
  return () => clearTimeout(t);
}, []);
```

Confirm `useEffect` is already imported from react at line 1. If not, add it.

- [ ] **Step 2: Add prefetch in Screener.tsx**

Add inside the `Screener` function component near other effects:

```tsx
// Prefetch stock detail — likely next step after browsing screener
useEffect(() => {
  const t = setTimeout(() => { void import('./StockDetail'); }, 1000);
  return () => clearTimeout(t);
}, []);
```

- [ ] **Step 3: Type-check**

```bash
npx tsc -b --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/Screener.tsx
git commit -m "perf: prefetch Screener/WheelTracker from Dashboard and StockDetail from Screener"
```

---

## Task 13: Final Lighthouse Audit + Comparison

**Files:** none (measurement only)

- [ ] **Step 1: Build and serve final version**

```bash
npm run build && npx vite preview &
sleep 3
```

- [ ] **Step 2: Run Lighthouse**

```bash
lighthouse http://localhost:4173 \
  --output=json \
  --output-path=./lighthouse-after.json \
  --chrome-flags="--headless --no-sandbox" \
  --only-categories=performance
```

- [ ] **Step 3: Print comparison report**

```bash
node -e "
  const before = require('./lighthouse-baseline.json')
  const after  = require('./lighthouse-after.json')

  const metrics = [
    'first-contentful-paint',
    'largest-contentful-paint',
    'total-blocking-time',
    'cumulative-layout-shift',
    'speed-index',
  ]

  console.log('=== PERFORMANCE COMPARISON ===')
  console.log('Score before:', Math.round(before.categories.performance.score * 100))
  console.log('Score after: ', Math.round(after.categories.performance.score * 100))
  console.log('')

  metrics.forEach(metric => {
    const b = before.audits[metric]
    const a = after.audits[metric]
    const improved = a.numericValue < b.numericValue
    console.log(
      (improved ? '✓' : '✗').padEnd(2),
      metric.padEnd(35),
      b.displayValue.padEnd(12), '→', a.displayValue,
      improved ? '(improved)' : '(regressed)'
    )
  })
"
```

- [ ] **Step 4: Print final bundle sizes**

```bash
node -e "
  const fs = require('fs'), path = require('path')
  const dir = './dist/assets'
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.js'))
    .map(f => {
      const size = fs.statSync(path.join(dir, f)).size
      return { name: f.replace(/-[a-z0-9]+\.js$/, '.js').padEnd(28), size: (size/1024).toFixed(1) + ' KB' }
    })
    .sort((a, b) => parseFloat(b.size) - parseFloat(a.size))
  console.log('=== FINAL BUNDLE SIZES ===')
  files.forEach(f => console.log(f.name, f.size))
"
```

- [ ] **Step 5: Kill preview server**

```bash
kill $(lsof -ti:4173) 2>/dev/null || true
```

- [ ] **Step 6: Commit lighthouse results**

```bash
git add lighthouse-baseline.json lighthouse-after.json
git commit -m "perf: add Lighthouse baseline and post-optimisation audit results"
```

---

## Target Outcomes

| Metric | Baseline (expected) | Target |
|--------|-------------------|--------|
| Performance score | 40-60 | > 85 |
| FCP | 3-4s | < 1.5s |
| LCP | 5-8s | < 2.5s |
| TBT | 500ms+ | < 200ms |
| Initial JS bundle | ~600KB | < 150KB |
| Chunk count | 1-2 | 8-14 |

The single biggest win is **Task 5 (code splitting)** — it removes all page code and Recharts from the initial bundle. Everything else is additive. If pressed for time, do Task 5 first and skip the rest.
