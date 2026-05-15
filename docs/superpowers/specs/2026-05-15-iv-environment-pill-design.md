# Design: Market IV Environment Pill

**Date:** 2026-05-15  
**Status:** Approved  
**Scope:** `useDashboardIntelligence.ts`, `DashboardCommandCentre.tsx`

---

## Problem

The dashboard's `QuickStatsRow` shows portfolio-level stats (This month, Win rate, Open, Deployed) but gives no signal about the broader market IV environment. A trader needs to know at a glance whether premium conditions are generally favourable or thin before opening the screener.

---

## Solution

Add a **Market IV** `StatPill` in the `QuickStatsRow` — exactly where the Streak pill was removed — showing the current SPY IV rank translated into a plain-English environment label with a conditions line.

---

## Section 1: Data Layer

### New query in `useDashboardIntelligence`

Add a dedicated SPY fetch as a parallel query alongside the existing `Promise.all` batch. Fetch the single most-recent row from `iv_snapshots` for ticker `SPY`:

```ts
supabase
  .from('iv_snapshots')
  .select('iv_rank, snapshot_date')
  .eq('ticker', 'SPY')
  .eq('calculation_success', true)
  .order('snapshot_date', { ascending: false })
  .limit(1)
  .maybeSingle()
```

**Why not reuse the existing iv_snapshots query?**  
The existing query filters `.gte('iv_rank', 30)` — SPY would be silently excluded during low-IV regimes. A dedicated query with no rank filter and a descending date order guarantees a result on weekends and holidays (same pattern used by the per-position IV fallback).

### New field on `DashboardIntelligence`

```ts
spyIvRank: number | null;
```

Added to the interface. `null` means the snapshot table has no SPY record yet (edge case: fresh deployment before first cron run).

### Thresholds

- `>= 50` → **Elevated** — amber/gold (`#f5c842`) — favourable for premium sellers
- `20–49` → **Normal** — teal (`#00e5c4`) — standard conditions
- `< 20` → **Suppressed** — muted blue (`#9ab4d4`) — thin premium, harder to find value

The hook returns only the raw `spyIvRank: number | null`. Label, color, and conditions text are derived in the component via a local `classifyIvEnvironment` helper — this is presentation logic and does not belong in the data layer.

---

## Section 2: UI

### Location

In `QuickStatsRow` (inside `DashboardCommandCentre.tsx`), appended after the Deployed pill — exactly where Streak was.

### StatPill structure

```
┌──────────────────────────────┐
│ MARKET IV                    │  ← label (10px uppercase muted)
│ Elevated                     │  ← value (18px bold, threshold color)
│ SPY rank 71                  │  ← sub (10px muted)
│ [Sun]  Favourable for sellers│  ← child row (9px, threshold color)
└──────────────────────────────┘
```

- **Label:** `"Market IV"`
- **Value:** `"Elevated"` / `"Normal"` / `"Suppressed"` — colored by threshold
- **Sub:** `"SPY rank {N}"` — raw number for traders who want to verify
- **Child row:** Lucide icon (size 10) + conditions text (9px), both in threshold color
  - Elevated → `Sun` · "Favourable for sellers"
  - Normal → `Cloud` · "Standard conditions"
  - Suppressed → `CloudDrizzle` · "Thin premium"

### Null / no-data state

When `spyIvRank` is `null`, the pill is **not rendered** — no broken placeholder. The row simply shows four pills instead of five, same as before Streak existed.

### New Lucide imports needed

`Sun`, `Cloud`, `CloudDrizzle` — added to the existing lucide-react import in `DashboardCommandCentre.tsx`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useDashboardIntelligence.ts` | Add SPY query to Promise.all; add `spyIvRank: number \| null` to type |
| `src/components/DashboardCommandCentre.tsx` | Add `Sun`, `Cloud`, `CloudDrizzle` imports; add `classifyIvEnvironment` local helper; add Market IV `StatPill` to `QuickStatsRow` |

---

## Out of Scope

- No changes to the `iv_snapshots` table or `calculate-iv-rank` edge function (SPY is already in the ticker list)
- No historical IV chart or trend line
- No per-ticker IV environment (this is market-wide only)
- No feature gating — all tiers see this (it's a market context indicator, not a premium feature)
