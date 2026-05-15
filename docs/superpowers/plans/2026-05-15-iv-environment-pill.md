# Market IV Environment Pill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Market IV environment StatPill to the dashboard QuickStatsRow showing the SPY IV rank as "Elevated / Normal / Suppressed" with a weather-style conditions line.

**Architecture:** Two files. The hook gets one new parallel Supabase query for SPY and one new `spyIvRank: number | null` field on `DashboardIntelligence`. The component gets a `classifyIvEnvironment` helper and the StatPill rendered after the Deployed pill.

**Tech Stack:** React, TypeScript, Supabase JS client, Lucide icons (Sun, Cloud, CloudDrizzle)

---

## File Map

| File | What changes |
|------|-------------|
| `src/hooks/useDashboardIntelligence.ts` | Add `spyIvRank: number \| null` to `DashboardIntelligence` type; add SPY query to `Promise.all`; destructure result; set field in return object |
| `src/components/DashboardCommandCentre.tsx` | Add `Sun`, `Cloud`, `CloudDrizzle` to lucide imports; add `classifyIvEnvironment` helper; add Market IV `StatPill` to `QuickStatsRow` |

---

## Task 1: Add `spyIvRank` to the hook

**Files:**
- Modify: `src/hooks/useDashboardIntelligence.ts:57-69` (type)
- Modify: `src/hooks/useDashboardIntelligence.ts:489-552` (Promise.all + destructure)
- Modify: `src/hooks/useDashboardIntelligence.ts:1082-1086` (return object)

- [ ] **Step 1: Add `spyIvRank` to the `DashboardIntelligence` interface**

  The interface starts at line 57. Add the new field after `capitalEfficiencyPercent` (line 69):

  ```ts
  // existing:
  capitalEfficiencyPercent: number;

  // add immediately after:
  spyIvRank: number | null;
  ```

- [ ] **Step 2: Add the SPY query to the `Promise.all` batch**

  The `Promise.all` at line 498 currently ends with the `prefsRes` query at line 547–551. Add SPY as a 9th parallel query, immediately before the closing `]);`:

  ```ts
  // add before the closing ]);
  supabase
    .from('iv_snapshots')
    .select('iv_rank')
    .eq('ticker', 'SPY')
    .eq('calculation_success', true)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle(),
  ```

  Why `order snapshot_date desc` instead of `eq snapshot_date todayStr`: weekends and holidays have no snapshot for today, so the most-recent row guarantees a value. This matches the pattern used by the per-position IV fallback query.

- [ ] **Step 3: Destructure the SPY result**

  The destructure array at lines 489–498 currently has 8 names. Add `spyRes` as the 9th:

  ```ts
  const [
    openRes,
    thisMonthRes,
    lastMonthRes,
    allTimeRes,
    ivRes,
    watchlistRes,
    targetRes,
    prefsRes,
    spyRes,           // ← add this
  ] = await Promise.all([
  ```

- [ ] **Step 4: Set `spyIvRank` in the return object**

  Near line 1082–1086, in the `partial` object literal, add `spyIvRank` alongside the other computed values. Add it after `capitalEfficiencyPercent` (line 1032):

  ```ts
  // existing:
  capitalEfficiencyPercent: capitalEfficiency,

  // add immediately after:
  spyIvRank: (spyRes.data?.iv_rank ?? null) as number | null,
  ```

- [ ] **Step 5: Type-check**

  ```bash
  npx tsc --noEmit 2>&1 | grep "useDashboardIntelligence\|spyIvRank"
  ```

  Expected: no output (zero errors).

- [ ] **Step 6: Commit**

  ```bash
  git add src/hooks/useDashboardIntelligence.ts
  git commit -m "feat: add spyIvRank to DashboardIntelligence via iv_snapshots SPY query"
  ```

---

## Task 2: Add the Market IV pill to the component

**Files:**
- Modify: `src/components/DashboardCommandCentre.tsx:3-6` (lucide imports)
- Modify: `src/components/DashboardCommandCentre.tsx` (add helper + pill to QuickStatsRow)

- [ ] **Step 1: Add weather icons to the Lucide import**

  Line 3–6 currently reads:
  ```ts
  import {
    AlertTriangle, Search, Trophy, Lightbulb, BarChart2,
    Calendar, Award,
  } from 'lucide-react';
  ```

  Change to:
  ```ts
  import {
    AlertTriangle, Search, Trophy, Lightbulb, BarChart2,
    Calendar, Award, Sun, Cloud, CloudDrizzle, type LucideIcon,
  } from 'lucide-react';
  ```

- [ ] **Step 2: Add `classifyIvEnvironment` helper**

  Add this function immediately above the `QuickStatsRow` function (around line 282, before `function QuickStatsRow`). It is pure presentation logic — no async, no hooks:

  ```ts
  function classifyIvEnvironment(rank: number): {
    label: string;
    conditions: string;
    color: string;
    Icon: LucideIcon;
  } {
    if (rank >= 50) return { label: 'Elevated',   conditions: 'Favourable for sellers', color: '#f5c842',  Icon: Sun          };
    if (rank >= 20) return { label: 'Normal',      conditions: 'Standard conditions',    color: '#00e5c4',  Icon: Cloud        };
                    return { label: 'Suppressed',  conditions: 'Thin premium',           color: '#9ab4d4',  Icon: CloudDrizzle };
  }
  ```

- [ ] **Step 3: Add the Market IV StatPill to `QuickStatsRow`**

  In `QuickStatsRow`, find the Deployed `StatPill` closing tag followed by the closing `</div>` (currently around line 354–357):

  ```tsx
      />


    </div>
  ```

  Replace with:

  ```tsx
      />

      {/* Market IV environment */}
      {d.spyIvRank !== null && (() => {
        const { label, conditions, color, Icon } = classifyIvEnvironment(d.spyIvRank!);
        return (
          <StatPill
            label="Market IV"
            value={label}
            sub={`SPY rank ${d.spyIvRank}`}
            color={color}
            isPaper={isPaper}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
              <Icon size={10} color={color} strokeWidth={2} />
              <span style={{ fontSize: 9, color, fontFamily: 'DM Sans, sans-serif' }}>{conditions}</span>
            </div>
          </StatPill>
        );
      })()}

    </div>
  ```

  The IIFE is required to define local `const` variables inside JSX — this is the same pattern used elsewhere in this file.

- [ ] **Step 4: Type-check**

  ```bash
  npx tsc --noEmit 2>&1 | grep "DashboardCommandCentre\|spyIvRank\|classifyIv"
  ```

  Expected: no output.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/DashboardCommandCentre.tsx
  git commit -m "feat: add Market IV environment pill to dashboard QuickStatsRow"
  ```

---

## Final Verification

- [ ] Run full type-check: `npx tsc --noEmit` — must be clean (no output)
- [ ] Start dev server: `npm run dev`
- [ ] Open the dashboard tab and confirm:
  - Five pills visible: This month · Win rate · Open · Deployed · **Market IV**
  - Market IV shows "Elevated" / "Normal" / "Suppressed" with the correct color
  - Sub shows "SPY rank N" with the raw number
  - Small weather icon + conditions text appear below the value
  - If SPY IV rank is unavailable (null), the pill is simply absent — no broken state
