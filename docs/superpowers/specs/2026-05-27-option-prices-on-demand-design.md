# On-Demand Option Prices Design

**Goal:** Fetch real bid/ask/mid for open positions on page load, after position creation, and on manual refresh — and use the mid price to drive unrealized P&L and a new Market column in the Wheel Tracker.

**Architecture:** A new user-authenticated edge function (`get-option-prices`) sits alongside the existing nightly cron (`fetch-option-prices`). Both write to `option_price_snapshots`. The edge function is called from three trigger points in `usePositions` and exposes a `refreshPrices()` function for a manual refresh button.

**Tech Stack:** Deno (edge function), Supabase JWT auth, React Query, Yahoo Finance v7 options API, TypeScript

---

## Architecture

Two fetch paths share `option_price_snapshots`:

- **Nightly cron** (`fetch-option-prices`) — unchanged. Runs every 20 min during market hours across all users.
- **`get-option-prices` edge function** — user-authenticated via Supabase JWT. Fetches only the requesting user's open positions. Upserts into `option_price_snapshots` and returns the snapshot rows directly — no second DB query needed.

Three trigger points all call `get-option-prices`:

1. **Page load** — `usePositions` checks if any open position has no today snapshot (`optionBid == null` after the initial DB read). If so, calls the function automatically and patches the result into positions.
2. **After adding a position** — `addPosition` calls the function with the new contract's `{ ticker, strike, expiry, strategy }` immediately after the DB insert succeeds, then patches the snapshot into the React Query cache.
3. **Manual refresh** — a refresh icon button in the WheelTracker header calls `refreshPrices()` (returned by `usePositions`), which fetches all open positions.

---

## Edge Function: `get-option-prices`

**File:** `supabase/functions/get-option-prices/index.ts`

**Auth:** Supabase JWT (`Authorization: Bearer <user-token>`). Extract `user_id` via `supabase.auth.getUser()`.

**Request body (optional):**
```json
{ "ticker": "AAPL", "strike": 170, "expiry": "2026-06-20", "strategy": "CSP" }
```
When provided: fetches only that one contract (post-creation trigger).
When absent: fetches all open positions for the authenticated user from `wheel_positions`.

**Yahoo Finance calls:**
- Groups positions by `(ticker, expiry)` — one call per group
- 200ms delay between calls (fewer positions than cron, lower rate-limit risk)
- Same pattern as `fetch-option-prices`: `fetchYahooChain(ticker, expiryUnix)`
- Strike lookup: ±$0.50 tolerance
- `contract_type`: `'call'` for CC, `'put'` for everything else
- Mid: `Math.round(((bid + ask) / 2) * 100) / 100`, falls back to `lastPrice`
- IV clamp: integer %, 5–500

**Upsert:** `option_price_snapshots` with `onConflict: 'ticker,strike,expiry,contract_type,snapshot_date'`

**Response:**
```json
{
  "success": true,
  "snapshots": [
    { "ticker": "AAPL", "strike": 170, "expiry": "2026-06-20", "contract_type": "put", "bid": 1.20, "ask": 1.40, "mid": 1.30 }
  ],
  "groups_failed": 0
}
```
Partial results are returned — Yahoo failures for individual groups don't cause a 500.

---

## `usePositions` Changes

### Auto-fetch on load

After fetching positions and applying existing snapshot enrichment, check:
```typescript
const needsFresh = openPositions.some(p => p.optionBid == null)
```
If true, call `get-option-prices` (no body — all positions). Patch returned snapshots onto positions using the same `ticker:expiry:strike:contract_type` map key. The existing DB query to `option_price_snapshots` is kept — it runs first and is cheap. The edge function only fires when that query returns no data for one or more open positions (i.e., the cron hasn't run yet today).

### After add

In `addPosition`, after the Supabase insert succeeds:
```typescript
const { data } = await supabase.functions.invoke('get-option-prices', {
  body: { ticker, strike, expiry, strategy }
})
// patch snapshot from data.snapshots[0] onto the optimistic position in cache
```

### `refreshPrices()` exposed

`usePositions` returns a `refreshPrices: () => Promise<void>` function that calls `get-option-prices` with no body and patches the cache. Used by the refresh button.

Also return `pricesLoading: boolean` so the button can show a spinner.

---

## P&L Formula Change

**File:** `src/components/PositionTable.tsx` — `computeLivePnl()`

Current formula: `premiumCollected - (intrinsicPerShare * 100 * contracts)` (stock-price-based).

New formula when `mid` is available on the position:
```
unrealizedPnl = premiumCollected - (mid * 100 * contracts)
```

When no snapshot (`pos.optionBid == null`): fall back to the existing intrinsic-value formula so the column is never blank.

P&L display: negative = red, positive = green — unchanged from today.

---

## New "Market" Column

**File:** `src/components/PositionTable.tsx`

Added after the "Unreal P&L" column. Desktop only — not shown on mobile cards.

**Column header:** `Market`

**Cell content when snapshot available:**
```
$1.20 / $1.40       ← bid / ask, muted (#6a8fb0)
mid  $1.30           ← mid, teal (#00e5c4), JetBrains Mono
```

**Cell content when no snapshot:** `—`

---

## Refresh Button

**File:** `src/pages/WheelTracker.tsx`

Small `RefreshCw` Lucide icon button placed in the "Open Positions" section header, to the right of the heading. 

- Shows a spinning animation while `pricesLoading` is true
- Disabled during loading (prevents double-fetch)
- On click: calls `refreshPrices()`
- No label — icon only, with a tooltip "Refresh option prices"

---

## Error Handling

- If `get-option-prices` returns a non-2xx response on auto-load or after-add: silently ignore — positions display with the 60% estimate fallback. No error toast (background operation).
- If the manual refresh fails: show a brief toast "Could not refresh prices — try again."
- If Yahoo fails for individual groups: partial results are returned and applied; `groups_failed` is logged server-side.

---

## What Does Not Change

- `fetch-option-prices` cron — untouched
- `option_price_snapshots` schema — untouched
- `ClosePositionModal` bid/ask hint — already built, continues to use `pos.optionBid` / `pos.optionAsk`
- Paper positions (`PaperWheelTracker`, `PaperPositionTable`) — not in scope
- Mobile card layout — Market column not added (space constraint)
