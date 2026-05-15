# Capital Deployment Ring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Market Pulse card (ScreenerPulseColumn) in Zone 5 of the dashboard with a Capital Deployment Ring — a Recharts donut chart showing deployed vs idle capital with an opportunity callout.

**Architecture:** Two files. The hook exposes `accountBalance` (already computed, just not returned). The component deletes `ScreenerPulseColumn` and adds `CapitalDeploymentRing` using Recharts `PieChart`/`Pie`/`Cell` (already in bundle). Idle capital is derived in the component as `Math.max(0, d.accountBalance - d.totalCollateralDeployed)`.

**Tech Stack:** React, TypeScript, Recharts (PieChart, Pie, Cell), Lucide (Zap), react-router-dom (useNavigate)

---

## File Map

| File | Change |
|------|--------|
| `src/hooks/useDashboardIntelligence.ts` | Add `accountBalance: number` to `DashboardIntelligence` interface and return object |
| `src/components/DashboardCommandCentre.tsx` | Add `Zap` + Recharts imports; delete `ScreenerPulseColumn`; add `CapitalDeploymentRing`; update Zone 5 render |

---

## Task 1: Expose `accountBalance` from the hook

**Files:**
- Modify: `src/hooks/useDashboardIntelligence.ts:70` (interface)
- Modify: `src/hooks/useDashboardIntelligence.ts:1044` (return object)

- [ ] **Step 1: Add `accountBalance` to the `DashboardIntelligence` interface**

  Currently at line 69–70 the interface has:
  ```ts
  capitalEfficiencyPercent: number;
  spyIvRank: number | null;
  ```

  Change to:
  ```ts
  capitalEfficiencyPercent: number;
  accountBalance: number;
  spyIvRank: number | null;
  ```

- [ ] **Step 2: Add `accountBalance` to the return object**

  At line 1043–1044 the partial object has:
  ```ts
  capitalEfficiencyPercent: capitalEfficiency,
  spyIvRank: (spyRes.data?.iv_rank ?? null) as number | null,
  ```

  Change to:
  ```ts
  capitalEfficiencyPercent: capitalEfficiency,
  accountBalance,
  spyIvRank: (spyRes.data?.iv_rank ?? null) as number | null,
  ```

  The `accountBalance` variable is already declared at line 576 (`const accountBalance = Number(prefsRes.data?.account_balance ?? 0)`). This is the shorthand property — no new query, no new computation.

- [ ] **Step 3: Type-check**

  ```bash
  npx tsc --noEmit 2>&1 | grep "useDashboardIntelligence\|accountBalance"
  ```

  Expected: no output.

- [ ] **Step 4: Commit**

  ```bash
  git add src/hooks/useDashboardIntelligence.ts
  git commit -m "feat: expose accountBalance from DashboardIntelligence hook"
  ```

---

## Task 2: Replace ScreenerPulseColumn with CapitalDeploymentRing

**Files:**
- Modify: `src/components/DashboardCommandCentre.tsx:3-6` (imports)
- Modify: `src/components/DashboardCommandCentre.tsx:430-511` (delete ScreenerPulseColumn, add CapitalDeploymentRing)
- Modify: `src/components/DashboardCommandCentre.tsx:647` (Zone 5 render)

- [ ] **Step 1: Update imports**

  **Lucide** — add `Zap` to the existing import at lines 3–6:
  ```ts
  import {
    AlertTriangle, Search, Trophy, Lightbulb, BarChart2,
    Calendar, Award, Sun, Cloud, CloudDrizzle, Zap, type LucideIcon,
  } from 'lucide-react';
  ```

  **Recharts** — add a new import immediately after the lucide import (before line 7):
  ```ts
  import { PieChart, Pie, Cell } from 'recharts';
  ```

- [ ] **Step 2: Delete `ScreenerPulseColumn` and add `CapitalDeploymentRing`**

  Replace the entire block from line 430 (`// ── Zone 5: Screener pulse`) through line 511 (closing `}`) with the following:

  ```tsx
  // ── Zone 5: Capital deployment ring ───────────────────────────────────────────

  function CapitalDeploymentRing({ d }: { d: DashboardIntelligence }) {
    const navigate = useNavigate();
    const idleCapital = Math.max(0, d.accountBalance - d.totalCollateralDeployed);
    const pct = d.accountBalance > 0
      ? Math.min(100, Math.round((d.totalCollateralDeployed / d.accountBalance) * 100))
      : 0;

    const ringData = [
      { value: d.totalCollateralDeployed },
      { value: Math.max(0, idleCapital) || 0.0001 }, // prevent empty donut when 100% deployed
    ];

    return (
      <div style={{ flex: 1, minWidth: 0, height: '100%', background: 'rgba(13,27,53,0.5)', border: '1px solid rgba(0,229,196,0.08)', borderRadius: 12, padding: '14px 16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
          Capital Deployment
        </span>

        {d.accountBalance === 0 ? (
          /* No-balance state */
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif', textAlign: 'center', lineHeight: 1.5 }}>
              Set your account balance in Settings<br />to track capital deployment.
            </span>
          </div>
        ) : (
          <>
            {/* Donut chart + center label */}
            <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto' }}>
              <PieChart width={160} height={160}>
                <Pie
                  data={ringData}
                  cx={80}
                  cy={80}
                  innerRadius={52}
                  outerRadius={70}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  isAnimationActive={false}
                  stroke="none"
                >
                  <Cell fill="#00e5c4" />
                  <Cell fill="rgba(0,229,196,0.10)" />
                </Pie>
              </PieChart>
              {/* Center label — absolutely positioned over chart */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--ph-text-1)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>
                  {fmt$(idleCapital, true)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>
                  idle
                </span>
              </div>
            </div>

            {/* Stat line */}
            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif', marginTop: 6, marginBottom: 10 }}>
              {pct}% deployed · {fmt$(d.totalCollateralDeployed, true)}
            </div>

            {/* Opportunity callout */}
            {idleCapital > 0 && d.highIVCount > 0 && (
              <div style={{ padding: '8px 10px', background: 'rgba(0,229,196,0.04)', border: '1px solid rgba(0,229,196,0.18)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Zap size={10} color="#00e5c4" strokeWidth={2} />
                  <span style={{ fontSize: 11, color: 'var(--ph-text-1)', fontFamily: 'DM Sans, sans-serif' }}>
                    {d.highIVCount} elevated IV {d.highIVCount === 1 ? 'opportunity' : 'opportunities'}
                  </span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>
                  Deploy idle capital
                </span>
                <button
                  onClick={() => navigate('/screener')}
                  style={{ marginTop: 2, fontSize: 11, color: '#00e5c4', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: 0, textAlign: 'left' }}
                >
                  Open screener →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 3: Update Zone 5 render call**

  At line 647, change:
  ```tsx
          <ScreenerPulseColumn d={d} />
  ```

  To:
  ```tsx
          <CapitalDeploymentRing d={d} />
  ```

- [ ] **Step 4: Type-check**

  ```bash
  npx tsc --noEmit 2>&1 | grep "DashboardCommandCentre\|CapitalDeploymentRing\|accountBalance"
  ```

  Expected: no output.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/DashboardCommandCentre.tsx
  git commit -m "feat: replace Market Pulse with Capital Deployment Ring donut chart"
  ```

---

## Final Verification

- [ ] Run full type-check: `npx tsc --noEmit` — must be clean
- [ ] Start dev server: `npm run dev`
- [ ] Open dashboard and confirm:
  - Zone 5 right column shows "CAPITAL DEPLOYMENT" header
  - Teal donut ring renders with deployed vs idle segments
  - Center shows idle dollar amount + "idle" label
  - Below ring: "{N}% deployed · ${X}k"
  - If `highIVCount > 0` and idle capital exists: Zap callout appears with "Open screener →" link
  - If `accountBalance === 0`: placeholder text shown instead of chart
  - No TypeScript errors, no console errors
