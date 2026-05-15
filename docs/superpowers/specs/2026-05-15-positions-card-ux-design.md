# Design: Positions Card UX Improvements

**Date:** 2026-05-15  
**Status:** Approved  
**Scope:** `PositionsIntelligenceCard.tsx`, `useDashboardIntelligence.ts`

---

## Problem

Three UX issues in the dashboard "Your positions" card:

1. `percentOfMaxProfit` being `null` (no live price/IV) renders as `0% captured` — a misleading false zero
2. `At stake` label is ambiguous — users can't tell whether it means collateral at risk, premium collected, or something else
3. `Best: SOFI +0%` surfaces when all positions are freshly opened — the metric is noise

---

## Solution Overview

- Fix null % display per-position (honest "—" vs. misleading "0%")
- Rename "At stake" → "Open premium" with an explanatory subtext
- Add "Remaining" column to the summary bar (dollar value still to earn)
- Suppress Best/Worst performers when data is insufficient or values are trivial

---

## Section 1: Summary Bar (4 columns)

**Current:** 3-column grid — `Avg captured | At stake | Daily Θ`

**New:** 4-column grid — `Avg captured | Open premium | Remaining | Daily Θ`

### Open premium (was "At stake")
- Same value: `summary.totalPotentialPremium` (total credit received across open positions)
- Label: **"Open premium"**
- Subtext below the dollar value: `"max if all expire worthless"` in muted/small text
- Communicates: this is the ceiling — what you keep if all options expire OTM

### Remaining (new column)
- Value: `summary.totalRemainingPremium` — a new field to add to `positionsSummary`
- Computation: for each position — if `percentOfMaxProfit !== null`, remaining = `totalPremium × (1 − percentOfMaxProfit/100)`; if null (no live price), remaining = `totalPremium` (full premium still outstanding). Sum across all positions.
- Label: **"Remaining"**
- Subtext: `"left to earn"`
- Color: teal when > 0, muted otherwise
- Communicates: the uncaptured dollar profit still in play

### Data layer change
Add to `positionsSummary` in `useDashboardIntelligence.ts`:
```ts
totalRemainingPremium: Math.round(
  positions.reduce((s, p) =>
    s + (p.percentOfMaxProfit !== null
      ? p.totalPremium * (1 - p.percentOfMaxProfit / 100)
      : p.totalPremium),
  0) * 100
) / 100,
```
Also add `totalRemainingPremium: number` to the `positionsSummary` type in the `DashboardIntelligence` interface.

---

## Section 2: Per-Position Null % Fix

**File:** `PositionsIntelligenceCard.tsx` — `PositionRow` component, Row 3

### Current (line 365–366):
```tsx
{position.percentOfMaxProfit?.toFixed(0) ?? '0'}% captured
```

### New behavior:
- **When `percentOfMaxProfit` is `null`:**
  - Show a `Clock` icon (size 11) + `—` in muted color
  - Add `title="Awaiting live price data"` on the wrapping span for tooltip
  - Hide the word "captured" entirely (no label when there's no value)
  - Progress bar renders at 0 width in a dimmed/muted color (not teal) so it doesn't look like a real data point

- **When `percentOfMaxProfit` is `0`:**
  - Show `0%` normally in teal — this is real data (option at break-even)
  - Show "captured" label normally

- **When `percentOfMaxProfit > 0`:**
  - No change from current behavior

---

## Section 3: Risk Summary Strip — Best / Worst

**File:** `PositionsIntelligenceCard.tsx` — `RiskSummaryStrip` component

### Current:
Always renders `Best: TICKER +X%` even when X is 0.

### New behavior:

**Best performer:**
- Only shown when `summary.bestPerformer.percentOfMaxProfit >= 1`
- Below 1%: suppress entirely (freshly opened positions, not meaningful)

**Worst performer:**
- Shown alongside Best when both conditions hold:
  1. Best is shown (≥ 1%)
  2. `bestPerformer.percentOfMaxProfit - worstPerformer.percentOfMaxProfit >= 15` (material spread)
- Format: `Best: SOFI +47% · Worst: NVDA +3%` — same line, `·` separator, worst value in amber/muted color

**Props change:**
`RiskSummaryStrip` needs `summary.worstPerformer` — it's already computed in the hook but currently not rendered. No hook changes needed, just thread `worstPerformer` through the existing `summary` prop (already present in the type).

---

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useDashboardIntelligence.ts` | Add `totalRemainingPremium` to type + computation |
| `src/components/PositionsIntelligenceCard.tsx` | 4-column summary bar, null % fix, Best/Worst strip logic |

---

## Out of Scope

- No changes to the Portfolio page, Greeks card, or any other dashboard section
- No changes to how `percentOfMaxProfit` is computed (the null-when-no-price behavior is correct)
- No changes to `worstPerformer` computation (already correct, just unused in UI)
