# Design: Capital Deployment Ring

**Date:** 2026-05-15  
**Status:** Approved  
**Scope:** `useDashboardIntelligence.ts`, `DashboardCommandCentre.tsx`

---

## Problem

The "Market pulse" card (ScreenerPulseColumn) duplicates the screener. The most actionable number for a wheel trader — idle capital — is buried in the Deployed stat pill as a percentage. When idle capital exists alongside high-IV screener opportunities, that connection is never surfaced explicitly.

---

## Solution

Replace `ScreenerPulseColumn` with `CapitalDeploymentRing`: a donut chart showing deployed vs idle capital, with the idle dollar amount as the center label and an explicit opportunity callout when conditions align.

---

## Section 1: Data Layer

### New field on `DashboardIntelligence`

Add `accountBalance: number` immediately after `capitalEfficiencyPercent`:

```ts
capitalEfficiencyPercent: number;
accountBalance: number;
```

`accountBalance` is already computed inside the hook at line 576 (`const accountBalance = Number(prefsRes.data?.account_balance ?? 0)`) and used for `capitalEfficiency` — it just isn't returned. Adding it to the return object exposes it without any new query.

`idleCapital` is derived in the component: `Math.max(0, accountBalance - totalCollateralDeployed)`. The `Math.max(0, ...)` guard prevents a negative value if the user has entered an account balance lower than their actual deployed collateral. No additional hook field needed.

---

## Section 2: UI — `CapitalDeploymentRing`

### Location

Replaces `ScreenerPulseColumn` entirely. Same Zone 5 slot, same flex sizing (`flex: '1 1 240px'`), same props signature `{ d: DashboardIntelligence }`.

### Layout (top to bottom)

```
┌──────────────────────────────────┐
│ CAPITAL DEPLOYMENT               │
│                                  │
│     [Recharts PieChart donut]    │
│        $4,200  ← center label    │
│         idle                     │
│                                  │
│  81% deployed · $18.5k           │
│                                  │
│  ┌──────────────────────────┐    │
│  │ ⚡ 3 elevated opps —     │    │
│  │   deploy idle capital    │    │
│  │   Open screener →        │    │
│  └──────────────────────────┘    │
└──────────────────────────────────┘
```

### Ring

- **Library:** Recharts `PieChart` + `Pie` + `Cell` (already in bundle)
- **Segments:**
  - Deployed: teal `#00e5c4`, value = `totalCollateralDeployed`
  - Idle: muted `rgba(0,229,196,0.10)`, value = `idleCapital` (= `accountBalance - totalCollateralDeployed`)
- **Shape:** `innerRadius={52}` `outerRadius={70}` — ring, not full pie
- **Start angle:** `90`, `endAngle: -270` — starts at top, goes clockwise
- **`isAnimationActive={false}`** on `<Pie>` — static, no entrance animation
- **No tooltips, no legend**

### Center label

Absolutely positioned `<div>` over the chart (cleaner than Recharts' `<Label>` API):

- Top line: `fmt$(idleCapital)` — 20px bold, white
- Bottom line: `"idle"` — 11px muted

### Below-ring stat line

```
{pct}% deployed · {fmt$(totalCollateralDeployed)}
```

Small (11px) muted text, single line.

### Opportunity callout

Shown **only when `idleCapital > 0 && d.highIVCount > 0`**:

- Teal-bordered box (same style as 50% callout in PositionsIntelligenceCard)
- `Zap` icon (size 10) + `"{d.highIVCount} elevated IV opportunities"`
- Sub-line: `"Deploy idle capital"`
- `"Open screener →"` link navigating to `/screener`

### No-account-balance state

When `accountBalance === 0` (user hasn't set account balance in preferences), render a placeholder instead of the ring:

```
Set your account balance in Settings
to track capital deployment.
```

Small muted text, centered. No broken/empty chart.

---

## Section 3: Component Structure

### Deleted

`ScreenerPulseColumn` function — removed entirely from `DashboardCommandCentre.tsx`.

### Added

`CapitalDeploymentRing` function — same file, same position, same prop signature `{ d: DashboardIntelligence }`.

### New imports in `DashboardCommandCentre.tsx`

```ts
// Lucide — add Zap to existing import
import { ..., Zap } from 'lucide-react';

// Recharts — new import (already in bundle)
import { PieChart, Pie, Cell } from 'recharts';
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useDashboardIntelligence.ts` | Add `accountBalance: number` to type + return object |
| `src/components/DashboardCommandCentre.tsx` | Add `Zap` + Recharts imports; delete `ScreenerPulseColumn`; add `CapitalDeploymentRing`; update Zone 5 render call |

---

## Out of Scope

- No changes to the screener page, positions hook, or any other component
- No breakdown of deployed capital by ticker or strategy
- No historical idle capital trend
- No feature gating — all tiers see this
