# Tier Feature Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate PremiumHunter features behind Free / Pro / Superuser tiers using blur overlays, lock cards, and a contact-based upgrade page (no Stripe yet).

**Architecture:** Single source of truth in `featureConfig.ts` maps every feature key to its required tier. `useSubscription` reads the DB tier and exposes a `can(feature)` check. `FeatureGate` wraps UI sections in blur/lock/hide modes. Pages are updated to import and apply gates. Portfolio is route-gated (Pro only); all other pages are accessible but show blurred content.

**Tech Stack:** React, React Router v6, TanStack Query, Supabase (Postgres + Edge Functions), TypeScript

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/lib/featureConfig.ts` | Single source of truth: every feature → required tier |
| Modify | `src/hooks/useSubscription.ts` | 3-tier (free/pro/superuser), `can(feature)`, `hasTier()` |
| Modify | `src/components/FeatureGate.tsx` | New `feature` prop API, blur/lock/hide + `TierRoute` |
| Modify | `src/pages/UpgradePage.tsx` | Contact-based upgrade (email), no Stripe |
| Modify | `src/App.tsx` | Wrap `/portfolio` in `TierRoute`, import `TierRoute` |
| Modify | `src/components/Navbar.tsx` | Tier badge + Upgrade button for free users |
| Modify | `src/pages/Dashboard.tsx` | FreeDashboardBanner + gate Command Centre, Greeks, Chart |
| Modify | `src/pages/Screener.tsx` | Teaser banner + gate entire screener content |
| Modify | `src/pages/Watchlist.tsx` | Teaser banner + gate watchlist content |
| Modify | `src/pages/WheelTracker.tsx` | Force paper mode for free, gate real tracker |
| Modify | `src/pages/StockDetail.tsx` | Gate IV chart and options chain |
| Create | `supabase/functions/admin-grant-access/index.ts` | Edge function: superuser grants tier to user |
| Migration | `access_until` column on `subscriptions` | Expiry field for timed trial access |

---

## Task 1: Schema Migration — add `access_until` column

The existing `subscriptions` table has `manually_set_by/at/reason` (used for `granted_by/at/reason` in code). Only `access_until` is missing.

**Files:**
- Supabase SQL editor (or `supabase/migrations/`)

- [ ] **Step 1: Run migration**

```sql
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS access_until TIMESTAMPTZ;
```

Run this in the Supabase SQL editor for project `jzxdxcchmuyqbaccfpok`.

- [ ] **Step 2: Verify**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'subscriptions' AND column_name = 'access_until';
```

Expected: 1 row returned.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add access_until column to subscriptions"
```

---

## Task 2: Create `src/lib/featureConfig.ts`

**Files:**
- Create: `src/lib/featureConfig.ts`

- [ ] **Step 1: Create the file**

```typescript
export type Tier = 'free' | 'pro' | 'superuser'

export const TIER_ORDER: Record<Tier, number> = {
  free:      0,
  pro:       1,
  superuser: 2,
}

export const FEATURES = {
  // Free — always on
  paper_trading:               'free',
  help_page:                   'free',
  // Pro — paid
  screener:                    'pro',
  screener_top_picks:          'pro',
  screener_iv_trend:           'pro',
  screener_iv_hv:              'pro',
  screener_earnings_badge:     'pro',
  screener_account_filter:     'pro',
  watchlist:                   'pro',
  wheel_tracker:               'pro',
  wheel_live_prices:           'pro',
  wheel_assignment_gauge:      'pro',
  wheel_dte_traffic:           'pro',
  wheel_cycle_view:            'pro',
  wheel_monthly_target:        'pro',
  wheel_greeks_bar:            'pro',
  wheel_inline_edit:           'pro',
  wheel_urgency_banner:        'pro',
  dashboard:                   'pro',
  dashboard_greeks:            'pro',
  dashboard_positions_card:    'pro',
  dashboard_monthly_chart:     'pro',
  portfolio:                   'pro',
  portfolio_spy_benchmark:     'pro',
  portfolio_greeks:            'pro',
  portfolio_income_split:      'pro',
  portfolio_assigned_shares:   'pro',
  portfolio_leaps:             'pro',
  portfolio_ticker_performance:'pro',
  capital_redeployment:        'pro',
  scenario_analysis:           'pro',
  csv_export:                  'pro',
  leaps_valuator:              'pro',
  leaps_what_if:               'pro',
  ai_trade_analyst:            'pro',
  morning_briefing:            'pro',
  win_rate_by_setup:           'pro',
  expiry_outcome_calendar:     'pro',
  wheel_cycle_timeline:        'pro',
  assignment_flow:             'pro',
  cost_basis_tracker:          'pro',
  // Superuser — admin only
  admin_dashboard:             'superuser',
} as const

export type FeatureKey = keyof typeof FEATURES

export function hasAccess(userTier: Tier, feature: FeatureKey): boolean {
  if (userTier === 'superuser') return true
  const required = FEATURES[feature] as Tier
  if (required === 'superuser') return userTier === 'superuser'
  return TIER_ORDER[userTier] >= TIER_ORDER[required]
}

export function getRequiredTier(feature: FeatureKey): Tier {
  return FEATURES[feature] as Tier
}

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  paper_trading:               'Paper trading ($100k virtual)',
  help_page:                   'Help and education centre',
  screener:                    'IV Rank Screener (200 stocks)',
  screener_top_picks:          'Top 5 CSP & CC picks daily',
  screener_iv_trend:           'IV rank trend arrows',
  screener_iv_hv:              'IV/HV ratio analysis',
  screener_earnings_badge:     'Earnings calendar badges',
  screener_account_filter:     'Account size filter',
  watchlist:                   'Watchlist with IV monitoring',
  wheel_tracker:               'Real money wheel tracker',
  wheel_live_prices:           'Live real-time prices',
  wheel_assignment_gauge:      'Assignment probability gauges',
  wheel_dte_traffic:           'DTE traffic light system',
  wheel_cycle_view:            'Cycle grouping view',
  wheel_monthly_target:        'Monthly income target tracker',
  wheel_greeks_bar:            'Greeks summary bar',
  wheel_inline_edit:           'Inline position editing',
  wheel_urgency_banner:        'Position urgency alerts',
  dashboard:                   'Full morning command centre',
  dashboard_greeks:            'Daily theta & Greeks panel',
  dashboard_positions_card:    'Positions intelligence card',
  dashboard_monthly_chart:     'Monthly income chart',
  portfolio:                   'Full portfolio tab',
  portfolio_spy_benchmark:     'Portfolio vs SPY benchmark',
  portfolio_greeks:            'Portfolio Greeks dashboard',
  portfolio_income_split:      'Income vs capital gains split',
  portfolio_assigned_shares:   'Assigned shares tracking',
  portfolio_leaps:             'LEAPS tracking',
  portfolio_ticker_performance:'Ticker performance table',
  capital_redeployment:        'Capital redeployment tracker',
  scenario_analysis:           'Portfolio scenario analysis',
  csv_export:                  'CSV export',
  leaps_valuator:              'LEAPS valuator with Greeks',
  leaps_what_if:               'What-if price simulator',
  ai_trade_analyst:            'AI trade analyst picks',
  morning_briefing:            'AI morning briefing email',
  win_rate_by_setup:           'Win rate by setup analysis',
  expiry_outcome_calendar:     'Expiry outcome calendar',
  wheel_cycle_timeline:        'Wheel cycle timeline',
  assignment_flow:             'Assignment flow wizard',
  cost_basis_tracker:          'Cost basis tracker',
  admin_dashboard:             'Admin dashboard',
}

export const FREE_FEATURES_LIST = [
  'Paper trading with $100,000 virtual money',
  'Full paper wheel tracker (CSP & CC)',
  'Paper portfolio with P&L chart',
  'Paper monthly income target',
  'Help centre and wheel strategy guide',
  'Practice the wheel risk-free, forever',
]

export const PRO_FEATURES_LIST = [
  'Everything in Free, plus:',
  'Full 200-stock IV rank screener',
  'Top 5 CSP & CC picks daily',
  'Real money wheel tracker (unlimited)',
  'Live real-time prices via WebSocket',
  'Assignment probability gauges',
  'DTE traffic light system',
  'Full portfolio tab with SPY benchmark',
  'Portfolio Greeks (daily theta income)',
  'LEAPS valuator with what-if simulator',
  'AI trade analyst daily picks',
  'AI morning briefing email',
  'Monthly income target tracker',
  'Assigned shares cost basis tracking',
  'Ticker performance league table',
  'IV trend arrows and IV/HV ratio',
  'Wheel cycle timeline',
  'CSV export',
]
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/bran/Documents/Repositories/premiumhunter-react && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors from `featureConfig.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/featureConfig.ts
git commit -m "feat: add featureConfig — single source of truth for feature tiers"
```

---

## Task 3: Update `src/hooks/useSubscription.ts`

Replace the current 4-tier implementation with the cleaner 3-tier version using `can()` and `hasTier()`.

**Files:**
- Modify: `src/hooks/useSubscription.ts`

- [ ] **Step 1: Replace the file**

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Tier, TIER_ORDER, FeatureKey, hasAccess } from '../lib/featureConfig'

export type { Tier }

export interface SubscriptionData {
  tier: Tier
  status: string
  accessUntil: string | null
}

export function useSubscription() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async (): Promise<SubscriptionData> => {
      if (!user) return { tier: 'free', status: 'free', accessUntil: null }
      const { data, error } = await supabase
        .from('subscriptions')
        .select('tier, status, access_until')
        .eq('user_id', user.id)
        .single()
      if (error || !data) return { tier: 'free', status: 'free', accessUntil: null }

      let effectiveTier = data.tier as Tier
      // Downgrade to free if timed access has expired
      if (
        data.access_until &&
        new Date(data.access_until) < new Date() &&
        effectiveTier !== 'superuser'
      ) {
        effectiveTier = 'free'
      }

      return {
        tier: effectiveTier,
        status: data.status,
        accessUntil: data.access_until ?? null,
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!user,
  })

  const tier = data?.tier ?? 'free'

  return {
    subscription: data,
    tier,
    isLoading,
    isFree:      tier === 'free',
    isPro:       tier === 'pro' || tier === 'superuser',
    isSuperuser: tier === 'superuser',
    can: (feature: FeatureKey): boolean => {
      if (tier === 'superuser') return true
      return hasAccess(tier, feature)
    },
    hasTier: (required: Tier): boolean => {
      if (tier === 'superuser') return true
      return TIER_ORDER[tier] >= TIER_ORDER[required]
    },
    // Keep canAccess for any existing callers during migration
    canAccess: (required: Tier): boolean => {
      if (tier === 'superuser') return true
      return TIER_ORDER[tier] >= TIER_ORDER[required]
    },
    refresh: () => queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] }),
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSubscription.ts
git commit -m "feat: update useSubscription to 3-tier with can() and hasTier()"
```

---

## Task 4: Rewrite `src/components/FeatureGate.tsx`

New API: `feature` prop (FeatureKey) instead of `requires` (Tier). Adds `TierRoute` for route-level gating.

**Files:**
- Modify: `src/components/FeatureGate.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription'
import { FeatureKey } from '../lib/featureConfig'
import { PageLoader } from './PageLoader'

function UnlockButton() {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate('/upgrade')}
      style={{
        padding: '9px 22px',
        background: '#14b8a6',
        color: '#0f1923',
        border: 'none',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 2px 12px rgba(20,184,166,0.35)',
      }}
    >
      🔒 Unlock with Pro
    </button>
  )
}

function LockCard() {
  const navigate = useNavigate()
  return (
    <div style={{
      background: 'rgba(13,27,53,0.5)',
      border: '1px solid rgba(0,229,196,0.08)',
      borderRadius: 12,
      padding: '36px 24px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
      <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: 'var(--ph-text-1)' }}>
        Pro feature
      </h3>
      <p style={{
        margin: '0 0 20px', fontSize: 13, color: 'var(--ph-text-2)',
        lineHeight: 1.6, maxWidth: 280, marginLeft: 'auto', marginRight: 'auto',
      }}>
        Upgrade to Pro to unlock this and the complete Premium Hunter toolkit.
      </p>
      <button
        onClick={() => navigate('/upgrade')}
        style={{
          padding: '10px 28px', background: '#14b8a6', color: '#0f1923',
          border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Get Pro access →
      </button>
    </div>
  )
}

interface FeatureGateProps {
  feature: FeatureKey
  children: React.ReactNode
  mode?: 'blur' | 'lock' | 'hide'
  blurHeight?: number
  fallback?: React.ReactNode
}

export function FeatureGate({
  feature,
  children,
  mode = 'blur',
  blurHeight = 120,
  fallback,
}: FeatureGateProps) {
  const { can, isSuperuser, isLoading } = useSubscription()

  if (isSuperuser) return <>{children}</>
  if (isLoading) return null
  if (can(feature)) return <>{children}</>
  if (fallback) return <>{fallback}</>
  if (mode === 'hide') return null
  if (mode === 'lock') return <LockCard />

  return (
    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', minHeight: blurHeight }}>
      <div style={{
        filter: 'blur(5px)', pointerEvents: 'none',
        userSelect: 'none', opacity: 0.45, minHeight: blurHeight,
      }}>
        {children}
      </div>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10,
        background: 'rgba(10, 18, 26, 0.72)', borderRadius: 8,
      }}>
        <UnlockButton />
      </div>
    </div>
  )
}

interface TierRouteProps {
  requires: 'pro' | 'superuser'
  children: React.ReactNode
}

export function TierRoute({ requires, children }: TierRouteProps) {
  const { hasTier, isSuperuser, isLoading } = useSubscription()
  const navigate = useNavigate()

  if (isLoading) return <PageLoader />
  if (isSuperuser) return <>{children}</>
  if (!hasTier(requires)) {
    navigate('/upgrade', { replace: true, state: { from: window.location.pathname } })
    return null
  }
  return <>{children}</>
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors from FeatureGate.

- [ ] **Step 3: Commit**

```bash
git add src/components/FeatureGate.tsx
git commit -m "feat: rewrite FeatureGate with feature-key API and TierRoute"
```

---

## Task 5: Rewrite `src/pages/UpgradePage.tsx`

Contact-based upgrade page. No Stripe. Users email `premiumhuntersupport@gmail.com`.

**Files:**
- Modify: `src/pages/UpgradePage.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription'
import { FREE_FEATURES_LIST, PRO_FEATURES_LIST } from '../lib/featureConfig'

const SUPPORT_EMAIL = 'premiumhuntersupport@gmail.com'

export function UpgradePage() {
  const { tier } = useSubscription()
  const navigate = useNavigate()
  const [emailCopied, setEmailCopied] = useState(false)

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(SUPPORT_EMAIL)
    setEmailCopied(true)
    setTimeout(() => setEmailCopied(false), 2000)
  }

  const handleEmailClick = () => {
    const subject = encodeURIComponent('Premium Hunter — Pro Access Request')
    const body = encodeURIComponent(
      `Hi,\n\nI'd like to request Pro access to Premium Hunter.\n\nMy account email: \n\nA bit about how I plan to use it:\n\nThanks`
    )
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
  }

  return (
    <div className="min-h-screen mesh-bg pt-24 pb-12 px-4 sm:px-6">
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ margin: '0 0 12px', fontSize: 28, fontWeight: 700, fontFamily: 'Syne, sans-serif' }}>
            Upgrade to Pro
          </h1>
          <p style={{
            margin: 0, fontSize: 15, color: 'var(--ph-text-2)',
            lineHeight: 1.6, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto',
          }}>
            Get full access to the Premium Hunter toolkit — IV screener, live tracker,
            portfolio analytics, Greeks, and AI picks.
          </p>
        </div>

        {/* Pricing cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: 20, marginBottom: 40,
        }}>
          {/* Free card */}
          <div style={{
            background: 'rgba(13,27,53,0.5)',
            border: '1px solid rgba(0,229,196,0.08)',
            borderRadius: 12, padding: '28px 24px',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Free</div>
            <div style={{ fontSize: 34, fontWeight: 700, marginBottom: 4 }}>
              $0
              <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--ph-text-2)', marginLeft: 4 }}>
                forever
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ph-text-2)', lineHeight: 1.5, margin: '0 0 20px' }}>
              Practice the wheel strategy risk-free with virtual money.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', flex: 1 }}>
              {FREE_FEATURES_LIST.map((f, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 13 }}>
                  <span style={{ color: '#14b8a6', flexShrink: 0 }}>✓</span>
                  <span style={{ color: 'var(--ph-text-2)' }}>{f}</span>
                </li>
              ))}
            </ul>
            <button disabled style={{
              width: '100%', padding: 10,
              background: 'transparent',
              border: '1px solid rgba(0,229,196,0.12)',
              borderRadius: 8, fontSize: 13,
              color: 'var(--ph-text-3)', cursor: 'not-allowed',
            }}>
              {tier === 'free' ? '✓ Your current plan' : 'Free plan'}
            </button>
          </div>

          {/* Pro card */}
          <div style={{
            background: 'rgba(13,27,53,0.5)',
            border: '2px solid #14b8a6',
            borderRadius: 12, padding: '28px 24px',
            display: 'flex', flexDirection: 'column',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
              padding: '3px 16px', borderRadius: 20,
              background: '#14b8a6', color: '#0f1923',
              fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
            }}>
              Full access
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: '#14b8a6' }}>Pro</div>
            <div style={{ fontSize: 34, fontWeight: 700, marginBottom: 4 }}>
              $29
              <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--ph-text-2)', marginLeft: 4 }}>
                / month
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ph-text-2)', lineHeight: 1.5, margin: '0 0 20px' }}>
              Everything you need to trade the wheel professionally.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', flex: 1 }}>
              {PRO_FEATURES_LIST.map((f, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 13 }}>
                  <span style={{ color: i === 0 ? 'transparent' : '#14b8a6', flexShrink: 0 }}>
                    {i === 0 ? '·' : '✓'}
                  </span>
                  <span style={{
                    color: i === 0 ? 'var(--ph-text-1)' : 'var(--ph-text-2)',
                    fontWeight: i === 0 ? 500 : 400,
                  }}>
                    {f}
                  </span>
                </li>
              ))}
            </ul>
            {tier === 'pro' ? (
              <button disabled style={{
                width: '100%', padding: 11, background: 'transparent',
                border: '1px solid rgba(0,229,196,0.12)', borderRadius: 8,
                fontSize: 13, color: 'var(--ph-text-3)', cursor: 'not-allowed',
              }}>
                ✓ Your current plan
              </button>
            ) : (
              <button onClick={handleEmailClick} style={{
                width: '100%', padding: 11,
                background: '#14b8a6', color: '#0f1923',
                border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                Request Pro access →
              </button>
            )}
          </div>
        </div>

        {/* How to get Pro */}
        {tier !== 'pro' && tier !== 'superuser' && (
          <div style={{
            background: 'rgba(13,27,53,0.5)',
            border: '1px solid rgba(0,229,196,0.08)',
            borderRadius: 12, padding: '28px 32px',
            textAlign: 'center', marginBottom: 32,
          }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, fontFamily: 'Syne, sans-serif' }}>
              How to get Pro access
            </h2>
            <p style={{
              margin: '0 0 24px', fontSize: 14, color: 'var(--ph-text-2)',
              lineHeight: 1.7, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto',
            }}>
              We're onboarding Pro users personally right now. Send us an email and we'll get
              you set up — usually within a few hours.
            </p>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '10px 20px',
              background: 'rgba(13,27,53,0.8)',
              border: '1px solid rgba(0,229,196,0.15)',
              borderRadius: 8, marginBottom: 20,
            }}>
              <span style={{ fontSize: 15, fontWeight: 500, fontFamily: 'JetBrains Mono, monospace' }}>
                {SUPPORT_EMAIL}
              </span>
              <button onClick={handleCopyEmail} style={{
                padding: '3px 10px',
                background: emailCopied ? 'rgba(20,184,166,0.15)' : 'rgba(0,229,196,0.06)',
                border: '1px solid rgba(0,229,196,0.15)',
                borderRadius: 4, fontSize: 11,
                color: emailCopied ? '#14b8a6' : 'var(--ph-text-2)',
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}>
                {emailCopied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleEmailClick} style={{
                padding: '11px 28px', background: '#14b8a6', color: '#0f1923',
                border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                ✉ Send us an email
              </button>
              <button onClick={handleCopyEmail} style={{
                padding: '11px 22px', background: 'transparent',
                border: '1px solid rgba(0,229,196,0.2)',
                borderRadius: 8, fontSize: 14, cursor: 'pointer', color: 'var(--ph-text-1)',
              }}>
                {emailCopied ? 'Copied ✓' : 'Copy email address'}
              </button>
            </div>
            <p style={{ margin: '16px 0 0', fontSize: 12, color: 'var(--ph-text-3)', lineHeight: 1.6 }}>
              Include your account email and we'll activate Pro access for you directly.
            </p>
          </div>
        )}

        {/* FAQ */}
        <div style={{
          background: 'rgba(13,27,53,0.5)',
          border: '1px solid rgba(0,229,196,0.08)',
          borderRadius: 12, padding: '24px 28px',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, fontFamily: 'Syne, sans-serif' }}>
            Questions
          </h3>
          {[
            {
              q: 'How quickly will I get Pro access?',
              a: 'Usually within a few hours of your email. We activate access manually and confirm by reply.',
            },
            {
              q: 'Can I use paper trading on the free plan forever?',
              a: 'Yes. Paper trading is always free. Practice the wheel with $100,000 in virtual money for as long as you want.',
            },
            {
              q: 'Is there a trial?',
              a: "Email us and mention you'd like to try Pro first — we're happy to set up trial access so you can see the full toolkit before committing.",
            },
            {
              q: 'What payment methods are accepted?',
              a: "We'll sort this out over email. We're flexible while we onboard early users.",
            },
            {
              q: 'Is this financial advice?',
              a: 'No. Premium Hunter is a tracking and analysis tool only. It does not provide financial advice, recommendations, or trading signals.',
            },
          ].map(({ q, a }, i, arr) => (
            <div key={i} style={{
              padding: '12px 0',
              borderBottom: i < arr.length - 1 ? '1px solid rgba(0,229,196,0.08)' : 'none',
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 5 }}>{q}</div>
              <div style={{ fontSize: 13, color: 'var(--ph-text-2)', lineHeight: 1.6 }}>{a}</div>
            </div>
          ))}
        </div>

        {/* Back link */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button onClick={() => navigate(-1)} style={{
            background: 'none', border: 'none',
            color: 'var(--ph-text-3)', fontSize: 13, cursor: 'pointer',
          }}>
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/UpgradePage.tsx
git commit -m "feat: upgrade page — contact-based Pro onboarding via email"
```

---

## Task 6: Update `src/App.tsx` — add `TierRoute` to `/portfolio`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add TierRoute import**

Add to the imports at the top:

```typescript
import { TierRoute } from './components/FeatureGate'
```

- [ ] **Step 2: Wrap portfolio route**

Find:
```typescript
<Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
```

Replace with:
```typescript
<Route path="/portfolio" element={
  <ProtectedRoute>
    <TierRoute requires="pro">
      <Portfolio />
    </TierRoute>
  </ProtectedRoute>
} />
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: route-gate /portfolio behind Pro tier"
```

---

## Task 7: Update `src/components/Navbar.tsx` — tier badge

**Files:**
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: Read the current admin NavLink block**

Find the block starting with `{isSuperuser && (` (around line 151). Read the surrounding context to understand what's already there and where to add the tier badge.

- [ ] **Step 2: Add `isFree` and `tier` to the destructure**

Find:
```typescript
const { isSuperuser } = useSubscription();
```

Replace with:
```typescript
const { isSuperuser, isFree, tier } = useSubscription();
```

- [ ] **Step 3: Add tier badge + upgrade button**

Immediately after the closing `}` of the `{isSuperuser && ...}` block, add:

```tsx
{/* Tier badge for non-superusers */}
{!isSuperuser && (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: tier === 'pro' ? 'rgba(20,184,166,0.12)' : 'rgba(13,27,53,0.6)',
      color: tier === 'pro' ? '#14b8a6' : 'var(--ph-text-3)',
      border: '1px solid',
      borderColor: tier === 'pro' ? 'rgba(20,184,166,0.3)' : 'rgba(0,229,196,0.08)',
    }}>
      {tier === 'pro' ? 'Pro' : 'Free'}
    </span>
    {isFree && (
      <button
        onClick={() => navigate('/upgrade')}
        style={{
          padding: '5px 12px',
          background: '#14b8a6', color: '#0f1923',
          border: 'none', borderRadius: 6,
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Upgrade
      </button>
    )}
  </div>
)}
```

- [ ] **Step 4: Ensure `navigate` is imported** (it should be from useNavigate already — check)

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat: add tier badge and upgrade button to navbar"
```

---

## Task 8: Gate `src/pages/Dashboard.tsx`

Free users see a welcome banner and blurred Pro content.

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Add imports to Dashboard.tsx**

At the top of the file, add:
```typescript
import { FeatureGate } from '../components/FeatureGate'
import { useSubscription } from '../hooks/useSubscription'
import { useNavigate } from 'react-router-dom'
```

- [ ] **Step 2: Add FreeDashboardBanner component** (add before the `RealDashboard` function)

```tsx
function FreeDashboardBanner() {
  const navigate = useNavigate()
  return (
    <div style={{
      background: 'rgba(13,27,53,0.5)',
      border: '0.5px solid rgba(0,229,196,0.12)',
      borderRadius: 12,
      padding: '20px 24px',
      marginBottom: 20,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
    }}>
      <div>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600, fontFamily: 'Syne, sans-serif' }}>
          Welcome to Premium Hunter
        </h2>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--ph-text-2)', lineHeight: 1.6 }}>
          You're on the free plan. You have full access to paper trading — practice
          the wheel strategy with $100,000 in virtual money, risk-free.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/wheel')}
            style={{
              padding: '8px 16px', background: '#14b8a6', color: '#0f1923',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Start paper trading
          </button>
          <button
            onClick={() => navigate('/help')}
            style={{
              padding: '8px 16px', background: 'transparent',
              border: '1px solid rgba(0,229,196,0.2)',
              borderRadius: 8, fontSize: 13, cursor: 'pointer', color: 'var(--ph-text-1)',
            }}
          >
            Learn the wheel
          </button>
        </div>
      </div>
      <div style={{
        padding: '14px 20px',
        background: 'rgba(20,184,166,0.06)',
        border: '1px solid rgba(20,184,166,0.2)',
        borderRadius: 10, minWidth: 190, textAlign: 'center',
      }}>
        <div style={{ fontSize: 12, color: 'var(--ph-text-2)', marginBottom: 10, lineHeight: 1.5 }}>
          Unlock the full toolkit — screener, live tracker, portfolio & more.
        </div>
        <button
          onClick={() => navigate('/upgrade')}
          style={{
            width: '100%', padding: 8, background: '#14b8a6', color: '#0f1923',
            border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Get Pro access →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update `RealDashboard` to use gates**

Find the `RealDashboard` function's return block. Replace the contents of the inner `<div className="max-w-7xl mx-auto">` with:

```tsx
const { isFree } = useSubscription()

// … inside the return JSX:
{isFree && <FreeDashboardBanner />}

<FeatureGate feature="dashboard" blurHeight={180}>
  <DashboardCommandCentre
    data={intelligence ?? null}
    isLoading={intelligenceLoading}
  />
</FeatureGate>

<FeatureGate feature="dashboard_greeks" blurHeight={220}>
  <PortfolioGreeksDashboard greeks={greeks} isLoading={greeksLoading} />
</FeatureGate>

<FeatureGate feature="dashboard_monthly_chart" blurHeight={280}>
  <MonthlyPnLChart />
</FeatureGate>

{/* MonthlyTargetCompact and Watchlist Grid remain ungated */}
<MonthlyTargetCompact />
```

Read Dashboard.tsx:55-100 carefully to preserve all existing JSX and just wrap the three gated sections.

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: gate Dashboard command centre, Greeks, and chart for Pro"
```

---

## Task 9: Gate `src/pages/Screener.tsx`

Free users see a teaser description then blurred screener.

**Files:**
- Modify: `src/pages/Screener.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { FeatureGate } from '../components/FeatureGate'
import { useSubscription } from '../hooks/useSubscription'
```

- [ ] **Step 2: Add `isFree` to hook call**

Inside the `Screener` function, add:
```typescript
const { isFree } = useSubscription()
```

- [ ] **Step 3: Read the return JSX**

Read `src/pages/Screener.tsx` lines 1–60 to find the outermost container div and where the filter/table content starts.

- [ ] **Step 4: Wrap screener content**

Find the top-level container inside the page's return. Add the teaser banner before the main content, then wrap the main content in `FeatureGate`:

```tsx
{isFree && (
  <div style={{
    padding: '10px 14px', marginBottom: 16,
    background: 'rgba(20,184,166,0.06)',
    border: '1px solid rgba(20,184,166,0.2)',
    borderRadius: 8, fontSize: 13, color: 'var(--ph-text-2)', lineHeight: 1.6,
  }}>
    📊 The IV Rank Screener shows 200 stocks ranked by implied volatility —
    your daily source for premium selling opportunities. Upgrade to Pro to access.
  </div>
)}

<FeatureGate feature="screener" blurHeight={600}>
  {/* existing screener content */}
</FeatureGate>
```

Wrap the existing JSX body (filter bar + table) inside the `FeatureGate`. Do not duplicate JSX — just add the wrapper tags.

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/Screener.tsx
git commit -m "feat: gate Screener behind Pro tier with teaser banner"
```

---

## Task 10: Gate `src/pages/Watchlist.tsx`

**Files:**
- Modify: `src/pages/Watchlist.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { FeatureGate } from '../components/FeatureGate'
import { useSubscription } from '../hooks/useSubscription'
```

- [ ] **Step 2: Add `isFree` in hook call inside `Watchlist` function**

```typescript
const { isFree } = useSubscription()
```

- [ ] **Step 3: Read Watchlist.tsx lines 1–60** to understand the outer container structure.

- [ ] **Step 4: Add teaser + gate**

Inside the main return, before the primary content, add:

```tsx
{isFree && (
  <div style={{
    padding: '10px 14px', marginBottom: 16,
    background: 'rgba(20,184,166,0.06)',
    border: '1px solid rgba(20,184,166,0.2)',
    borderRadius: 8, fontSize: 13, color: 'var(--ph-text-2)',
  }}>
    ⭐ Monitor IV rank on your favourite stocks daily — know when conditions
    are right to sell premium.
  </div>
)}

<FeatureGate feature="watchlist" blurHeight={350}>
  {/* existing watchlist content */}
</FeatureGate>
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/Watchlist.tsx
git commit -m "feat: gate Watchlist behind Pro tier"
```

---

## Task 11: Gate `src/pages/WheelTracker.tsx`

Free users are forced into paper mode. Real money tracker is blurred.

**Files:**
- Modify: `src/pages/WheelTracker.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { FeatureGate } from '../components/FeatureGate'
import { useSubscription } from '../hooks/useSubscription'
```

- [ ] **Step 2: Read WheelTracker.tsx lines 1–80** to understand how `isPaperMode` / `togglePaperMode` / the paper mode toggle button are structured.

- [ ] **Step 3: Add `isFree` and paper mode force**

Inside `WheelTracker`, add:

```typescript
const { isFree } = useSubscription()
const { isPaperMode, togglePaperMode } = usePaperMode()

// Force free users into paper mode
useEffect(() => {
  if (isFree && !isPaperMode) {
    togglePaperMode()
  }
}, [isFree])
```

- [ ] **Step 4: Replace the paper mode toggle UI**

Find the paper mode toggle button/component. Replace it so free users see a locked label:

```tsx
{isFree ? (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '5px 12px',
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.25)',
    borderRadius: 6, fontSize: 12,
  }}>
    <span style={{ color: '#f59e0b', fontWeight: 600 }}>📝 Paper trading mode</span>
    <span style={{ color: 'var(--ph-text-2)' }}>— practice with virtual money</span>
  </div>
) : (
  /* existing paper mode toggle component */
)}
```

- [ ] **Step 5: Gate the real positions section**

Find the JSX that renders real (non-paper) positions. Wrap with:

```tsx
<FeatureGate feature="wheel_tracker" blurHeight={380}>
  {/* real positions table JSX */}
</FeatureGate>
```

The paper positions rendering must remain outside the gate (free users need it).

- [ ] **Step 6: Add post-paper-positions upgrade teaser for free users**

After the paper positions table, add:

```tsx
{isFree && (
  <div style={{
    marginTop: 20, padding: '16px 20px',
    background: 'rgba(13,27,53,0.5)',
    border: '0.5px solid rgba(0,229,196,0.12)',
    borderRadius: 10,
  }}>
    <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 500 }}>
      Ready for real money trading?
    </p>
    <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--ph-text-2)', lineHeight: 1.6 }}>
      Pro unlocks the live tracker with real-time prices, assignment gauges,
      Greeks, IV screener, and portfolio analytics.
    </p>
    <button
      onClick={() => navigate('/upgrade')}
      style={{
        padding: '7px 18px', background: '#14b8a6', color: '#0f1923',
        border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}
    >
      Get Pro access →
    </button>
  </div>
)}
```

- [ ] **Step 7: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 8: Commit**

```bash
git add src/pages/WheelTracker.tsx
git commit -m "feat: force paper mode for free users, gate real wheel tracker"
```

---

## Task 12: Gate `src/pages/StockDetail.tsx`

IV chart blurred; header stats visible to all.

**Files:**
- Modify: `src/pages/StockDetail.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { FeatureGate } from '../components/FeatureGate'
```

- [ ] **Step 2: Read StockDetail.tsx lines 126–200** to find the IV chart section boundaries.

- [ ] **Step 3: Wrap the IV chart section**

The IV chart is in a `<div className="rounded-2xl p-5 mb-6">` at line ~127. Wrap the entire div:

```tsx
<FeatureGate feature="screener" blurHeight={280}>
  <div className="rounded-2xl p-5 mb-6" style={{ /* existing styles */ }}>
    {/* existing IV chart content */}
  </div>
</FeatureGate>
```

Keep the header stats (IV Rank, IV Percentile, Current IV, Hist. Vol) ungated — they're the teaser.

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/StockDetail.tsx
git commit -m "feat: gate IV history chart on StockDetail for Pro"
```

---

## Task 13: Create `supabase/functions/admin-grant-access/index.ts`

Edge function for superusers to grant/change tier on any user.

**Files:**
- Create: `supabase/functions/admin-grant-access/index.ts`

- [ ] **Step 1: Create the function directory and file**

```bash
mkdir -p /Users/bran/Documents/Repositories/premiumhunter-react/supabase/functions/admin-grant-access
```

- [ ] **Step 2: Write index.ts**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    // Verify caller is superuser
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No auth header')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !adminUser) throw new Error('Invalid token')

    const { data: adminSub } = await supabase
      .from('subscriptions').select('tier').eq('user_id', adminUser.id).single()
    if (adminSub?.tier !== 'superuser') throw new Error('Superuser required')

    const { targetUserId, tier, reason, accessUntil } = await req.json()
    if (!targetUserId || !tier) throw new Error('targetUserId and tier required')
    if (!['free', 'pro', 'superuser'].includes(tier)) throw new Error(`Invalid tier: ${tier}`)

    const { data: oldSub } = await supabase
      .from('subscriptions').select('tier').eq('user_id', targetUserId).single()

    await supabase.from('subscriptions').upsert({
      user_id: targetUserId,
      tier,
      status: tier === 'free' ? 'free' : tier === 'superuser' ? 'superuser' : 'active',
      manually_set_by: adminUser.id,
      manually_set_at: new Date().toISOString(),
      manually_set_reason: reason ?? 'Granted by admin',
      access_until: accessUntil ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    await supabase.from('admin_audit_log').insert({
      admin_user_id: adminUser.id,
      action: 'tier_change',
      target_user_id: targetUserId,
      old_value: { tier: oldSub?.tier ?? 'free' },
      new_value: { tier },
      reason: reason ?? 'Granted by admin',
      created_at: new Date().toISOString(),
    })

    return new Response(JSON.stringify({ success: true, tier }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

- [ ] **Step 3: Deploy**

```bash
cd /Users/bran/Documents/Repositories/premiumhunter-react && npx supabase functions deploy admin-grant-access
```

Expected output: `Deployed Functions on project jzxdxcchmuyqbaccfpok: admin-grant-access`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/admin-grant-access/
git commit -m "feat: admin-grant-access edge function for manual Pro tier granting"
```

---

## Task 14: Final TypeScript check and smoke test

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

- [ ] **Step 3: Verify as free user**
  - Dashboard shows `FreeDashboardBanner` at top; Command Centre, Greeks, Chart are blurred
  - Screener shows teaser banner; content is blurred
  - Watchlist shows teaser; content is blurred
  - Wheel Tracker forces paper mode; upgrade teaser shows below positions
  - StockDetail shows stats row; IV chart is blurred
  - Portfolio route redirects to `/upgrade`
  - Navbar shows `Free` badge and `Upgrade` button

- [ ] **Step 4: Verify as superuser**
  - No blurs anywhere; full access to all pages
  - Navbar shows admin shield icon, no upgrade button

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete tier gating system — Free/Pro/Superuser"
```
