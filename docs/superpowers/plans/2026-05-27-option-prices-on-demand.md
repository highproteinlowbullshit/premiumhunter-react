# On-Demand Option Prices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch real bid/ask/mid for open positions on page load, after position creation, and on manual refresh — and use the mid price to drive unrealized P&L and a new Market column in the Wheel Tracker.

**Architecture:** A new user-authenticated edge function (`get-option-prices`) sits alongside the existing nightly cron (`fetch-option-prices`). Both write to `option_price_snapshots`. The edge function is called from `usePositions` at three trigger points and exposes `refreshPrices()` for a manual refresh button.

**Tech Stack:** Deno (edge function), Supabase JWT auth, React Query, Yahoo Finance v7 options API, TypeScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/functions/get-option-prices/index.ts` | Create | User-authenticated edge function: JWT auth, Yahoo Finance fetch, upsert + return snapshots |
| `src/hooks/usePositions.ts` | Modify | Add `pricesLoading`, `refreshPrices`, auto-fetch on load, edge fn call after add |
| `src/components/PositionTable.tsx` | Modify | Update P&L formula to use option mid; add Market column (desktop only) |
| `src/pages/WheelTracker.tsx` | Modify | Add RefreshCw button in Open Positions header |

---

## Task 1: Create the `get-option-prices` edge function

**Files:**
- Create: `supabase/functions/get-option-prices/index.ts`

- [ ] **Step 1: Create the edge function file**

```typescript
// supabase/functions/get-option-prices/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

type OptionContract = {
  strike: number
  impliedVolatility?: number
  bid?: number
  ask?: number
  lastPrice?: number
  volume?: number
  openInterest?: number
}

type YahooOptionSet = {
  expirationDate: number
  calls: OptionContract[]
  puts: OptionContract[]
}

async function fetchYahooChain(
  ticker: string,
  expiryUnix: number,
): Promise<YahooOptionSet | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/options/${ticker}?date=${expiryUnix}`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PremiumHunter/1.0)',
          'Accept': 'application/json',
        },
      },
    )
    clearTimeout(timer)
    if (!res.ok) {
      console.warn(`  Yahoo ${ticker} (${expiryUnix}): HTTP ${res.status}`)
      return null
    }
    const data = await res.json()
    const options: YahooOptionSet[] = data?.optionChain?.result?.[0]?.options ?? []
    return options[0] ?? null
  } catch (err) {
    console.warn(`  Yahoo ${ticker} fetch failed:`, err instanceof Error ? err.message : String(err))
    return null
  }
}

type SnapshotRow = {
  ticker: string
  strike: number
  expiry: string
  contract_type: 'call' | 'put'
  snapshot_date: string
  snapshot_time: string
  bid: number | null
  ask: number | null
  mid: number | null
  last_price: number | null
  implied_volatility: number | null
  volume: number | null
  open_interest: number | null
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Auth: validate user JWT
  const authHeader = req.headers.get('Authorization') ?? ''
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await anonClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Parse optional single-contract body
  let singleContract: { ticker: string; strike: number; expiry: string; strategy: string } | null = null
  try {
    const body = await req.json()
    if (body?.ticker) singleContract = body
  } catch {
    // no body — fetch all open positions
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const today = new Date().toISOString().split('T')[0]

  type PosRow = { ticker: string; strategy: string; strike: number; expiry: string }
  let positions: PosRow[] = []

  if (singleContract) {
    positions = [{
      ticker: singleContract.ticker,
      strategy: singleContract.strategy,
      strike: singleContract.strike,
      expiry: singleContract.expiry,
    }]
  } else {
    const { data, error } = await db
      .from('wheel_positions')
      .select('ticker, strategy, strike, expiry')
      .eq('user_id', user.id)
      .eq('status', 'open')

    if (error) {
      console.error('wheel_positions query failed:', error)
      return new Response(JSON.stringify({ error: 'DB query failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    positions = data ?? []
  }

  if (positions.length === 0) {
    return new Response(
      JSON.stringify({ success: true, snapshots: [], groups_failed: 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  type ContractNeed = { strike: number; contract_type: 'call' | 'put' }
  const groups = new Map<string, { ticker: string; expiry: string; expiryUnix: number; contracts: ContractNeed[] }>()

  for (const pos of positions) {
    const contract_type: 'call' | 'put' = pos.strategy === 'CC' ? 'call' : 'put'
    const key = `${pos.ticker}:${pos.expiry}`
    if (!groups.has(key)) {
      const expiryUnix = Math.floor(new Date(pos.expiry + 'T12:00:00Z').getTime() / 1000)
      groups.set(key, { ticker: pos.ticker, expiry: pos.expiry, expiryUnix, contracts: [] })
    }
    const group = groups.get(key)!
    const alreadyHave = group.contracts.some(
      c => c.strike === pos.strike && c.contract_type === contract_type,
    )
    if (!alreadyHave) group.contracts.push({ strike: pos.strike, contract_type })
  }

  const snapshots: SnapshotRow[] = []
  let groups_failed = 0

  for (const [, group] of groups) {
    const chain = await fetchYahooChain(group.ticker, group.expiryUnix)

    if (!chain) {
      groups_failed++
      await delay(200)
      continue
    }

    for (const { strike, contract_type } of group.contracts) {
      const side: OptionContract[] = contract_type === 'call' ? chain.calls : chain.puts
      const contract = side.find(c => Math.abs(c.strike - strike) < 0.50)

      if (!contract) {
        console.warn(`  No contract: ${group.ticker} ${contract_type} $${strike} exp ${group.expiry}`)
        continue
      }

      const bid = contract.bid ?? null
      const ask = contract.ask ?? null
      const mid = bid != null && ask != null
        ? Math.round(((bid + ask) / 2) * 100) / 100
        : contract.lastPrice ?? null
      const iv = contract.impliedVolatility != null
        ? Math.round(contract.impliedVolatility * 100)
        : null
      const ivClean = iv != null && iv >= 5 && iv <= 500 ? iv : null

      snapshots.push({
        ticker:             group.ticker,
        strike,
        expiry:             group.expiry,
        contract_type,
        snapshot_date:      today,
        snapshot_time:      new Date().toISOString(),
        bid,
        ask,
        mid,
        last_price:         contract.lastPrice ?? null,
        implied_volatility: ivClean,
        volume:             contract.volume ?? null,
        open_interest:      contract.openInterest ?? null,
      })
    }

    await delay(200)
  }

  if (snapshots.length > 0) {
    const { error: upsertError } = await db
      .from('option_price_snapshots')
      .upsert(snapshots, { onConflict: 'ticker,strike,expiry,contract_type,snapshot_date', ignoreDuplicates: false })

    if (upsertError) {
      console.error('Upsert failed:', upsertError)
      return new Response(JSON.stringify({ error: 'DB upsert failed', details: upsertError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // Return the compact shape the client needs
  const responseSnapshots = snapshots.map(s => ({
    ticker:        s.ticker,
    strike:        s.strike,
    expiry:        s.expiry,
    contract_type: s.contract_type,
    bid:           s.bid,
    ask:           s.ask,
    mid:           s.mid,
  }))

  return new Response(
    JSON.stringify({ success: true, snapshots: responseSnapshots, groups_failed }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
```

- [ ] **Step 2: Deploy the edge function**

```bash
supabase functions deploy get-option-prices
```

Expected: `Deployed: get-option-prices`

Do NOT use `--no-verify-jwt` — this function relies on Supabase's standard JWT middleware + `auth.getUser()`.

- [ ] **Step 3: Smoke test with the CLI**

```bash
# Get a valid user JWT — log in via the app, then inspect the Authorization header in DevTools
# or use the supabase admin API to get a test token
# Minimal test: 401 on bad token confirms auth works
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/get-option-prices \
  -H "Authorization: Bearer bad-token"
# Expected: 401
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/get-option-prices/index.ts
git commit -m "feat: add get-option-prices edge function (user JWT auth)"
```

---

## Task 2: Update `usePositions`

**Files:**
- Modify: `src/hooks/usePositions.ts`

**What to add:**
1. `pricesLoading` state
2. `hasAutoFetched` ref (prevents double-firing the auto-fetch)
3. `applySnapshots(snapshots)` — patches React Query cache with new snapshot data
4. `fetchAndApplyPrices(body?, silent)` — calls edge function; shows toast only when `silent=false`
5. Auto-fetch `useEffect` — fires once after initial load when any open position lacks a snapshot
6. After-add: call `fetchAndApplyPrices` silently with the new contract
7. Expose `refreshPrices`, `pricesLoading` in return value

- [ ] **Step 1: Add imports — `useEffect`, `useRef`, `useState` to the existing react import**

Current line 1:
```typescript
import { useCallback } from 'react';
```

Replace with:
```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
```

- [ ] **Step 2: Add `pricesLoading` state and `hasAutoFetched` ref inside `usePositions`, after `const qKey`**

Add after `const qKey = ['positions', user?.id] as const;`:

```typescript
  const [pricesLoading, setPricesLoading] = useState(false);
  const hasAutoFetched = useRef(false);
```

- [ ] **Step 3: Add `applySnapshots` callback after the `qKey` declarations**

Add after the `hasAutoFetched` ref:

```typescript
  type SnapshotPatch = {
    ticker: string;
    strike: number;
    expiry: string;
    contract_type: 'call' | 'put';
    bid: number | null;
    ask: number | null;
    mid: number | null;
  };

  const applySnapshots = useCallback((snapshots: SnapshotPatch[]) => {
    const snapMap = new Map<string, SnapshotPatch>();
    for (const s of snapshots) {
      const key = `${s.ticker}:${s.expiry}:${s.strike}:${s.contract_type}`;
      if (!snapMap.has(key)) snapMap.set(key, s);
    }
    queryClient.setQueryData(qKey, (old: WheelPosition[] = []) =>
      old.map(pos => {
        if (pos.status !== 'open') return pos;
        const contract_type = pos.strategy === 'CC' ? 'call' : 'put';
        const key = `${pos.ticker}:${pos.expiry}:${pos.strike}:${contract_type}`;
        const snap = snapMap.get(key);
        if (!snap) return pos;
        return {
          ...pos,
          currentPrice: snap.mid != null ? snap.mid : pos.currentPrice,
          optionBid: snap.bid ?? null,
          optionAsk: snap.ask ?? null,
        };
      })
    );
  }, [queryClient, qKey]);
```

- [ ] **Step 4: Add `fetchAndApplyPrices` callback after `applySnapshots`**

```typescript
  const fetchAndApplyPrices = useCallback(async (
    body?: { ticker: string; strike: number; expiry: string; strategy: string },
    silent = true,
  ) => {
    if (!silent) setPricesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-option-prices', {
        ...(body ? { body } : {}),
      });
      if (error || !data?.success) {
        if (!silent) showToast('Could not refresh prices — try again.', 'error');
        return;
      }
      applySnapshots(data.snapshots ?? []);
    } catch {
      if (!silent) showToast('Could not refresh prices — try again.', 'error');
    } finally {
      if (!silent) setPricesLoading(false);
    }
  }, [applySnapshots, showToast]);
```

- [ ] **Step 5: Add the auto-fetch `useEffect` after the `useQuery` block (after line `refetchOnWindowFocus: true,` closing brace)**

Add this after the `useQuery` closing `});`:

```typescript
  // Auto-fetch on load: if any open position has no snapshot from DB, call the edge function once
  useEffect(() => {
    if (isLoading) return;
    if (hasAutoFetched.current) return;
    const open = positions.filter(p => p.status === 'open');
    if (open.length === 0) return;
    const needsFresh = open.some(p => p.optionBid == null);
    if (!needsFresh) return;
    hasAutoFetched.current = true;
    void fetchAndApplyPrices(undefined, true);
  }, [positions, isLoading, fetchAndApplyPrices]);
```

- [ ] **Step 6: In `addPosition`, after the `queryClient.setQueryData` that replaces the `tempId` with the real position, add the edge function call**

Find this block (around line 171-173):
```typescript
        queryClient.setQueryData(qKey, (old: WheelPosition[] = []) =>
          old.map((p) => (p.id === tempId ? dbToPosition(inserted as DbPosition) : p))
        );
```

After that block (before the cash credit logic), add:
```typescript
        // Fetch fresh snapshot for the new position — silent, best-effort
        void fetchAndApplyPrices({
          ticker: data.ticker.toUpperCase(),
          strike: data.strike,
          expiry: data.expiry,
          strategy: data.strategy,
        }, true);
```

- [ ] **Step 7: Add `refreshPrices` callback and update the return value**

Add this callback after `fetchAndApplyPrices`:
```typescript
  const refreshPrices = useCallback(async () => {
    await fetchAndApplyPrices(undefined, false);
  }, [fetchAndApplyPrices]);
```

Find the return statement at the bottom of the hook:
```typescript
  return { positions, openPositions, monthlyPnL, isLoading, addPosition, removePosition, closePosition, editPosition, assignPosition };
```

Replace with:
```typescript
  return { positions, openPositions, monthlyPnL, isLoading, addPosition, removePosition, closePosition, editPosition, assignPosition, refreshPrices, pricesLoading };
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any type errors before continuing.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/usePositions.ts
git commit -m "feat: add refreshPrices, auto-fetch, and after-add snapshot fetch to usePositions"
```

---

## Task 3: Update `PositionTable` — P&L formula and Market column

**Files:**
- Modify: `src/components/PositionTable.tsx`

**What to change:**
1. `computeLivePnl`: when bid+ask available on the position, use mid as cost-to-close instead of intrinsic value
2. Desktop `<thead>`: add `Market` column header after `Unreal P&L`
3. Desktop `<tbody>` rows: add Market column cell after the existing Unreal P&L cells

- [ ] **Step 1: Update `computeLivePnl` to use option mid when available**

Find the function (lines 35-48):
```typescript
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

Replace with:
```typescript
function computeLivePnl(pos: WheelPosition, stockPrice: number): LivePnl {
  const intrinsicPerShare =
    pos.strategy === 'CSP'
      ? Math.max(0, pos.strike - stockPrice)
      : Math.max(0, stockPrice - pos.strike);
  const isItm = intrinsicPerShare > 0;

  let costToClose: number;
  if (pos.optionBid != null && pos.optionAsk != null) {
    const mid = Math.round(((pos.optionBid + pos.optionAsk) / 2) * 100) / 100;
    costToClose = mid * 100 * pos.contracts;
  } else {
    costToClose = intrinsicPerShare * 100 * pos.contracts;
  }

  const unrealizedPnl = pos.premiumCollected - costToClose;
  const pctMaxProfit =
    pos.premiumCollected > 0
      ? Math.min(100, Math.max(0, (unrealizedPnl / pos.premiumCollected) * 100))
      : 0;
  return { unrealizedPnl, pctMaxProfit, isItm, stockPrice };
}
```

- [ ] **Step 2: Add `Market` column header in desktop `<thead>`, after the Unreal P&L header**

Find (around line 432):
```typescript
              {livePrices && <th className="text-left py-3 px-4" style={thStyle}>Unreal P&L</th>}
              {hasActions && <th className="text-left py-3 px-4 last:pr-0" style={thStyle}></th>}
```

Replace with:
```typescript
              {livePrices && <th className="text-left py-3 px-4" style={thStyle}>Unreal P&L</th>}
              <th className="text-left py-3 px-4" style={thStyle}>Market</th>
              {hasActions && <th className="text-left py-3 px-4 last:pr-0" style={thStyle}></th>}
```

- [ ] **Step 3: Add Market column cell in desktop `<tbody>` rows, after the existing Unreal P&L cell block**

Find the end of the `{livePrices && (() => { ... })()}` block for Stock $ + Unreal P&L (around line 588):
```typescript
                  })()}

                  {hasActions && (
```

Replace with:
```typescript
                  })()}

                  {/* Market column — bid/ask + mid from live snapshot */}
                  <td className="py-3.5 px-4">
                    {pos.optionBid != null && pos.optionAsk != null ? (
                      <div className="flex flex-col gap-0.5">
                        <span style={{ color: '#6a8fb0', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                          ${pos.optionBid.toFixed(2)} / ${pos.optionAsk.toFixed(2)}
                        </span>
                        <span style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600 }}>
                          mid ${(Math.round(((pos.optionBid + pos.optionAsk) / 2) * 100) / 100).toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>—</span>
                    )}
                  </td>

                  {hasActions && (
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/PositionTable.tsx
git commit -m "feat: use option mid for P&L and add Market bid/ask column to PositionTable"
```

---

## Task 4: Update `WheelTracker` — add refresh button

**Files:**
- Modify: `src/pages/WheelTracker.tsx`

**What to change:**
1. Add `RefreshCw` to the lucide-react import
2. Destructure `refreshPrices` and `pricesLoading` from `usePositions()`
3. Add a refresh button between the "Open Positions" `<h2>` and `<WebSocketStatus>` in the section header

- [ ] **Step 1: Add `RefreshCw` to the lucide-react import**

Find the lucide-react import in `WheelTracker.tsx`. It may look like:

```typescript
import { SomeIcon } from 'lucide-react';
```

Search for `from 'lucide-react'` in the file and add `RefreshCw` to the import. For example, if the import is:
```typescript
import { ChevronDown } from 'lucide-react';
```
Change it to:
```typescript
import { ChevronDown, RefreshCw } from 'lucide-react';
```

If there is no existing lucide-react import, add:
```typescript
import { RefreshCw } from 'lucide-react';
```

- [ ] **Step 2: Destructure `refreshPrices` and `pricesLoading` from `usePositions`**

Find line 104:
```typescript
  const { positions, openPositions, monthlyPnL, isLoading, addPosition, removePosition, closePosition, editPosition, assignPosition } = usePositions();
```

Replace with:
```typescript
  const { positions, openPositions, monthlyPnL, isLoading, addPosition, removePosition, closePosition, editPosition, assignPosition, refreshPrices, pricesLoading } = usePositions();
```

- [ ] **Step 3: Replace the Open Positions header div to include the refresh button**

Find (lines 280-285):
```tsx
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
              Open Positions
            </h2>
            <WebSocketStatus status={wsStatus} />
          </div>
```

Replace with:
```tsx
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
              Open Positions
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => void refreshPrices()}
                disabled={pricesLoading}
                title="Refresh option prices"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: pricesLoading ? 'default' : 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  color: pricesLoading ? '#4a6a8a' : '#6a8fb0',
                  transition: 'color 0.2s',
                }}
              >
                <RefreshCw
                  size={14}
                  className={pricesLoading ? 'animate-spin' : ''}
                />
              </button>
              <WebSocketStatus status={wsStatus} />
            </div>
          </div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/WheelTracker.tsx
git commit -m "feat: add refresh option prices button to WheelTracker Open Positions header"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Edge function with JWT auth — Task 1
- [x] Auto-fetch on page load when `optionBid == null` — Task 2, Step 5
- [x] After-add fetch with `{ ticker, strike, expiry, strategy }` — Task 2, Step 6
- [x] Manual refresh via `refreshPrices()` — Task 2, Step 7
- [x] `pricesLoading` boolean for spinner — Task 2, Step 2
- [x] P&L formula uses mid when snapshot available — Task 3, Step 1
- [x] Market column desktop only — Task 3, Steps 2-3 (Market column in desktop table, not mobile cards)
- [x] Market column shows bid/ask (muted) + mid (teal) — Task 3, Step 3
- [x] Market column shows `—` when no snapshot — Task 3, Step 3
- [x] Refresh button with RefreshCw icon — Task 4
- [x] animate-spin during load — Task 4, Step 3
- [x] Button disabled during loading — Task 4, Step 3
- [x] Silent failure on auto-fetch/after-add — Task 2, Steps 4 (`silent=true`)
- [x] Toast on manual refresh failure — Task 2, Step 4 (`silent=false`)
- [x] CORS headers on edge function — Task 1, Step 1

**Type consistency:** `SnapshotPatch` used in `applySnapshots` matches the shape returned by the edge function and consumed in the useEffect and `refreshPrices`. `WheelPosition.optionBid / optionAsk` are already in `src/types/index.ts` from a prior commit.
