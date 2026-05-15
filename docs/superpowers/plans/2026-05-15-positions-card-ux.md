# Positions Card UX Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three UX problems in the "Your positions" dashboard card: misleading 0% display, ambiguous "At stake" label, and noisy Best/Worst strip.

**Architecture:** Two files only. The hook (`useDashboardIntelligence.ts`) gets one new computed field (`totalRemainingPremium`). The card component (`PositionsIntelligenceCard.tsx`) gets four targeted changes: per-position null display, 4-column summary bar, live-summary recompute for worstPerformer, and Best/Worst strip thresholds.

**Tech Stack:** React, TypeScript, Lucide icons (Clock to be added)

---

## File Map

| File | What changes |
|------|-------------|
| `src/hooks/useDashboardIntelligence.ts` | Add `totalRemainingPremium: number` to type + computation |
| `src/components/PositionsIntelligenceCard.tsx` | Add Clock import; fix null % row; expand SummaryBar to 4 cols; update liveSummary; update RiskSummaryStrip |

---

## Task 1: Add `totalRemainingPremium` to the hook type

**Files:**
- Modify: `src/hooks/useDashboardIntelligence.ts:72-84`

- [ ] **Step 1: Add the field to the `positionsSummary` type**

  In the `DashboardIntelligence` interface (around line 79), add `totalRemainingPremium` after `totalPotentialPremium`:

  ```ts
  // before:
  totalPotentialPremium: number;
  avgPercentOfMaxProfit: number;

  // after:
  totalPotentialPremium: number;
  totalRemainingPremium: number;
  avgPercentOfMaxProfit: number;
  ```

- [ ] **Step 2: Add the computation**

  In the `positionsSummary` object literal (around line 817, after `totalPotentialPremium` line), add:

  ```ts
  // existing line stays:
  totalPotentialPremium: Math.round(positions.reduce((s, p) => s + p.totalPremium, 0) * 100) / 100,
  // add immediately after:
  totalRemainingPremium: Math.round(
    positions.reduce((s, p) =>
      s + (p.percentOfMaxProfit !== null
        ? p.totalPremium * (1 - p.percentOfMaxProfit / 100)
        : p.totalPremium),
    0) * 100
  ) / 100,
  ```

  Logic: if a position has a live % captured, remaining = `totalPremium × (1 − pct/100)`. If null (no live price), the full premium is still outstanding, so remaining = `totalPremium`.

- [ ] **Step 3: Type-check**

  ```bash
  npx tsc --noEmit 2>&1 | grep -E "useDashboardIntelligence|positionsSummary"
  ```

  Expected: no errors on these files.

- [ ] **Step 4: Commit**

  ```bash
  git add src/hooks/useDashboardIntelligence.ts
  git commit -m "feat: add totalRemainingPremium to positionsSummary"
  ```

---

## Task 2: Add Clock icon + update `liveSummary` in the card

**Files:**
- Modify: `src/components/PositionsIntelligenceCard.tsx:3` (imports)
- Modify: `src/components/PositionsIntelligenceCard.tsx:624-641` (liveSummary useMemo)

- [ ] **Step 1: Add `Clock` to the Lucide import**

  Line 3, change:
  ```ts
  import { AlertTriangle, Eye, Lightbulb, CheckCircle, AlertCircle } from 'lucide-react';
  ```
  to:
  ```ts
  import { AlertTriangle, Eye, Lightbulb, CheckCircle, AlertCircle, Clock } from 'lucide-react';
  ```

- [ ] **Step 2: Extend `liveSummary` to recompute `worstPerformer` and `totalRemainingPremium`**

  The current `liveSummary` useMemo (lines 624–641) spreads `...summary`, meaning `worstPerformer` and the new `totalRemainingPremium` come from the stale snapshot. Replace the entire useMemo body:

  ```ts
  const liveSummary = useMemo(() => {
    const withProfit = livePositions.filter(p => p.percentOfMaxProfit !== null);
    const withTheta  = livePositions.filter(p => p.dailyTheta !== null);
    return {
      ...summary,
      safeCount:  livePositions.filter(p => p.safetyStatus === 'safe').length,
      watchCount: livePositions.filter(p => p.safetyStatus === 'watch').length,
      nearCount:  livePositions.filter(p => p.safetyStatus === 'near').length,
      itmCount:   livePositions.filter(p => p.safetyStatus === 'itm').length,
      totalDailyTheta: Math.round(withTheta.reduce((s, p) => s + p.dailyTheta!, 0) * 100) / 100,
      avgPercentOfMaxProfit: withProfit.length > 0
        ? Math.round(withProfit.reduce((s, p) => s + p.percentOfMaxProfit!, 0) / withProfit.length * 10) / 10
        : 0,
      totalRemainingPremium: Math.round(
        livePositions.reduce((s, p) =>
          s + (p.percentOfMaxProfit !== null
            ? p.totalPremium * (1 - p.percentOfMaxProfit / 100)
            : p.totalPremium),
        0) * 100
      ) / 100,
      bestPerformer: withProfit.reduce<PositionSnapshot | null>(
        (best, p) => (p.percentOfMaxProfit! > (best?.percentOfMaxProfit ?? -Infinity) ? p : best), null,
      ),
      worstPerformer: withProfit.reduce<PositionSnapshot | null>(
        (worst, p) => (p.percentOfMaxProfit! < (worst?.percentOfMaxProfit ?? Infinity) ? p : worst), null,
      ),
    };
  }, [livePositions, summary]);
  ```

- [ ] **Step 3: Type-check**

  ```bash
  npx tsc --noEmit 2>&1 | grep "PositionsIntelligenceCard"
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/PositionsIntelligenceCard.tsx
  git commit -m "feat: add worstPerformer + totalRemainingPremium to liveSummary"
  ```

---

## Task 3: Fix per-position null `%` display

**Files:**
- Modify: `src/components/PositionsIntelligenceCard.tsx` — `PositionRow` component, ROW 3 (lines 364–367) and progress bar (lines 400–406)

- [ ] **Step 1: Fix ROW 3 captured % span**

  Replace lines 364–367:
  ```tsx
  <span style={{ marginLeft: 'auto', fontSize: 13, color: C.text2 }}>
    {position.percentOfMaxProfit?.toFixed(0) ?? '0'}%{' '}
    <span style={{ fontSize: 11, opacity: 0.7 }}>captured</span>
  </span>
  ```

  With:
  ```tsx
  <span style={{ marginLeft: 'auto', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    {position.percentOfMaxProfit !== null ? (
      <span style={{ color: C.text2 }}>
        {position.percentOfMaxProfit.toFixed(0)}%{' '}
        <span style={{ fontSize: 11, opacity: 0.7 }}>captured</span>
      </span>
    ) : (
      <span title="Awaiting live price data" style={{ color: C.muted, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <Clock size={11} />
        <span>—</span>
      </span>
    )}
  </span>
  ```

- [ ] **Step 2: Fix progress bar color for null positions**

  In the progress bar fill div (around line 400–406), change:
  ```tsx
  background: C.teal,
  ```
  to:
  ```tsx
  background: position.percentOfMaxProfit !== null ? C.teal : 'rgba(107,114,128,0.25)',
  ```

  This keeps the bar visually present but muted/grey when there's no live data, so it doesn't look like a real 0% reading.

- [ ] **Step 3: Type-check**

  ```bash
  npx tsc --noEmit 2>&1 | grep "PositionsIntelligenceCard"
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/PositionsIntelligenceCard.tsx
  git commit -m "fix: show — with Clock icon instead of 0% when percentOfMaxProfit is null"
  ```

---

## Task 4: Expand SummaryBar to 4 columns

**Files:**
- Modify: `src/components/PositionsIntelligenceCard.tsx` — `SummaryBar` function (lines 417–487)

- [ ] **Step 1: Update `SummaryBar` cells array and grid**

  Replace the entire `SummaryBar` function body with:

  ```tsx
  function SummaryBar({ summary }: { summary: DashboardIntelligence['positionsSummary'] }) {
    const avgColor = profitColor(summary.avgPercentOfMaxProfit);
    const cells = [
      {
        label: 'Avg captured',
        value: (
          <>
            <div style={{
              height: 4, borderRadius: 2,
              background: 'var(--color-border-tertiary, rgba(74,106,138,0.2))',
              overflow: 'hidden', marginBottom: 6,
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, summary.avgPercentOfMaxProfit)}%`,
                background: avgColor, borderRadius: 2,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <span style={{ fontSize: 22, fontWeight: 600, color: avgColor }}>
              {summary.avgPercentOfMaxProfit.toFixed(0)}%
            </span>
          </>
        ),
        noBorder: false,
      },
      {
        label: 'Open premium',
        value: (
          <>
            <span style={{ fontSize: 22, fontWeight: 600, color: C.text2 }}>
              {fmt$(summary.totalPotentialPremium)}
            </span>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4, lineHeight: 1.3 }}>
              max if all expire worthless
            </div>
          </>
        ),
        noBorder: false,
      },
      {
        label: 'Remaining',
        value: (
          <>
            <span style={{ fontSize: 22, fontWeight: 600, color: summary.totalRemainingPremium > 0 ? C.teal : C.muted }}>
              {summary.totalRemainingPremium > 0 ? fmt$(summary.totalRemainingPremium) : '—'}
            </span>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4, lineHeight: 1.3 }}>
              left to earn
            </div>
          </>
        ),
        noBorder: false,
      },
      {
        label: 'Daily Θ',
        value: (
          <span style={{
            fontSize: 22, fontWeight: 600,
            color: summary.totalDailyTheta > 0 ? C.teal : C.muted,
          }}>
            {summary.totalDailyTheta > 0 ? `+${fmt$(summary.totalDailyTheta)}/d` : '—'}
          </span>
        ),
        noBorder: true,
      },
    ];

    return (
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
        borderBottom: '0.5px solid var(--color-border-tertiary, rgba(20,184,166,0.08))',
      }}>
        {cells.map(({ label, value, noBorder }) => (
          <div key={label} style={{
            padding: '14px 16px',
            borderRight: noBorder ? 'none' : '0.5px solid var(--color-border-tertiary, rgba(20,184,166,0.08))',
          }}>
            <div style={{
              fontSize: 10, textTransform: 'uppercase', fontWeight: 600,
              letterSpacing: '0.6px', color: C.text2, marginBottom: 8,
            }}>
              {label}
            </div>
            {value}
          </div>
        ))}
      </div>
    );
  }
  ```

  Note: padding reduced from `20px` to `16px` per cell so 4 columns fit comfortably.

- [ ] **Step 2: Type-check**

  ```bash
  npx tsc --noEmit 2>&1 | grep "PositionsIntelligenceCard"
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/PositionsIntelligenceCard.tsx
  git commit -m "feat: expand summary bar to 4 columns (Open premium + Remaining)"
  ```

---

## Task 5: Fix RiskSummaryStrip Best / Worst logic

**Files:**
- Modify: `src/components/PositionsIntelligenceCard.tsx` — `RiskSummaryStrip` (lines 557–591)

- [ ] **Step 1: Update Best/Worst rendering**

  Replace lines 582–588 (the `summary.bestPerformer &&` block):

  ```tsx
  {/* before: */}
  {summary.bestPerformer && (
    <span style={{ fontSize: 12, color: C.text2, fontFamily: 'DM Sans, sans-serif' }}>
      Best:{' '}
      <span style={{ color: C.teal, fontWeight: 600 }}>{summary.bestPerformer.ticker}</span>
      {' '}+{summary.bestPerformer.percentOfMaxProfit?.toFixed(0)}%
    </span>
  )}
  ```

  With:

  ```tsx
  {summary.bestPerformer && (summary.bestPerformer.percentOfMaxProfit ?? 0) >= 1 && (() => {
    const best = summary.bestPerformer!;
    const worst = summary.worstPerformer;
    const showWorst = worst &&
      worst.ticker !== best.ticker &&
      (best.percentOfMaxProfit! - (worst.percentOfMaxProfit ?? 0)) >= 15;
    return (
      <span style={{ fontSize: 12, color: C.text2, fontFamily: 'DM Sans, sans-serif' }}>
        Best:{' '}
        <span style={{ color: C.teal, fontWeight: 600 }}>{best.ticker}</span>
        {' '}+{best.percentOfMaxProfit?.toFixed(0)}%
        {showWorst && (
          <>
            {' · '}Worst:{' '}
            <span style={{ color: C.amber, fontWeight: 600 }}>{worst!.ticker}</span>
            {' '}+{worst!.percentOfMaxProfit?.toFixed(0)}%
          </>
        )}
      </span>
    );
  })()}
  ```

- [ ] **Step 2: Type-check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/PositionsIntelligenceCard.tsx
  git commit -m "fix: suppress Best when <1% captured; add Worst when spread ≥15pts"
  ```

---

## Final Verification

- [ ] Run full type-check: `npx tsc --noEmit` — must be clean
- [ ] Start dev server: `npm run dev`
- [ ] Open dashboard tab — confirm:
  - Summary bar shows 4 columns: Avg captured | Open premium | Remaining | Daily Θ
  - "Open premium" has "max if all expire worthless" subtext
  - "Remaining" shows teal dollar value or "—" if nothing to earn
  - Any position with no live price shows Clock + `—` (not `0% captured`)
  - Best/Worst strip: no chip when best is 0%; Worst appears only when spread ≥ 15 pts
- [ ] Commit any remaining staged changes
