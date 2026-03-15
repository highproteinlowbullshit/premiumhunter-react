# Paper Trading Mode — Design Spec
**Date:** 2026-03-15
**Status:** Approved (v2 — post spec-review)

---

## Overview

Add a Paper Trading Mode to Premium Hunter that lets users practice the wheel strategy with $100,000 in virtual money. Paper positions are completely isolated from real positions and never affect real P&L, real holdings, or real stats.

When paper mode is ON, the Dashboard, Wheel Tracker, and Portfolio pages switch entirely to paper data. The Screener gains a "Paper Trade This" shortcut on every row.

---

## Architecture

### Approach: Branch at page level (Approach A)

Each affected page reads `isPaperMode` from context and returns either its real or paper component tree. No shared state between paper and real data paths.

```
if (isPaperMode) return <PaperWheelTracker />;
return <RealWheelTracker />;   // existing code untouched
```

This guarantees complete data isolation. Paper and real code paths never share hooks or state.

---

## Database Schema

### New tables

```sql
-- Paper trading account per user (1 row per user)
CREATE TABLE paper_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  starting_balance DECIMAL(14,2) DEFAULT 100000.00 NOT NULL,
  current_cash DECIMAL(14,2) DEFAULT 100000.00 NOT NULL,
  total_premium_collected DECIMAL(14,2) DEFAULT 0.00,
  total_realized_pnl DECIMAL(14,2) DEFAULT 0.00,
  trades_won INTEGER DEFAULT 0,
  trades_total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reset_at TIMESTAMPTZ DEFAULT NOW()
);

-- Paper wheel positions
-- premium_collected is stored PER-CONTRACT in dollars (same convention as real wheel_positions)
CREATE TABLE paper_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  strategy TEXT CHECK (strategy IN ('CSP', 'CC')) NOT NULL,
  strike DECIMAL(10,2) NOT NULL,
  expiry DATE NOT NULL,
  premium_collected DECIMAL(10,2) NOT NULL,   -- per-contract, in dollars
  contracts INTEGER DEFAULT 1 NOT NULL,
  underlying_price_at_entry DECIMAL(10,2) NOT NULL,
  status TEXT CHECK (status IN ('open', 'closed', 'assigned', 'expired')) DEFAULT 'open',
  notes TEXT,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  closing_premium DECIMAL(10,2),              -- per-contract, in dollars
  realized_pnl DECIMAL(14,2),                 -- total: (premium_collected - closing_premium) × contracts × 100
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily snapshots for P&L chart
CREATE TABLE paper_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  snapshot_date DATE DEFAULT CURRENT_DATE,
  account_value DECIMAL(14,2) NOT NULL,       -- current_cash + sum(unrealized_pnl of open positions)
  cash DECIMAL(14,2) NOT NULL,                -- paper_accounts.current_cash at snapshot time
  unrealized_pnl DECIMAL(14,2) DEFAULT 0,    -- sum of BS-estimated unrealized P&L across open positions
  realized_pnl DECIMAL(14,2) DEFAULT 0,      -- paper_accounts.total_realized_pnl at snapshot time
  UNIQUE(user_id, snapshot_date)
);
```

### RLS policies

All three tables: `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`

### Migration to existing table

```sql
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS paper_mode BOOLEAN DEFAULT false;
```

`AuthContext.initPreferences` upserts `paper_mode: false` on first sign-in (ignoreDuplicates keeps existing values).

---

## Types

Paper-specific types are added to the existing `src/types/index.ts` barrel:

```ts
export interface PaperAccount {
  id: string;
  userId: string;
  startingBalance: number;
  currentCash: number;
  totalPremiumCollected: number;
  totalRealizedPnl: number;
  tradesWon: number;
  tradesTotal: number;
  createdAt: string;
  resetAt: string;
}

export interface PaperPosition {
  id: string;
  ticker: string;
  strategy: 'CSP' | 'CC';
  strike: number;
  expiry: string;
  premiumCollected: number;   // per-contract
  contracts: number;
  underlyingPriceAtEntry: number;
  status: 'open' | 'closed' | 'assigned' | 'expired';
  notes?: string;
  openedAt: string;
  closedAt?: string;
  closingPremium?: number;
  realizedPnl?: number;
  createdAt: string;
}

export type OpenPaperPositionData = {
  ticker: string;
  strategy: 'CSP' | 'CC';
  strike: number;
  expiry: string;
  premiumCollected: number;   // per-contract
  contracts: number;
  underlyingPriceAtEntry: number;
};
```

---

## File Map

### New files

| File | Purpose |
|---|---|
| `src/context/PaperModeContext.tsx` | Global isPaperMode state, toggle, paperAccount |
| `src/hooks/usePaperTrading.ts` | All paper DB operations |
| `src/pages/PaperDashboard.tsx` | Paper stat cards + mini positions list |
| `src/pages/PaperWheelTracker.tsx` | Full paper tracker with cash indicator + stats |
| `src/pages/PaperPortfolio.tsx` | Paper P&L chart using paper_snapshots |
| `src/components/PaperBanner.tsx` | Dismissable amber banner below navbar |
| `src/components/PaperModals.tsx` | WelcomeModal, ResetConfirmModal, SwitchOffConfirmModal, PaperTradeModal (Screener pre-fill) |

### Modified files

| File | Change |
|---|---|
| `src/App.tsx` | Wrap AppInner with PaperModeProvider |
| `src/components/Navbar.tsx` | Paper toggle button, amber top border, PAPER badge, document.title |
| `src/pages/Dashboard.tsx` | Branch: isPaperMode → PaperDashboard |
| `src/pages/WheelTracker.tsx` | Branch: isPaperMode → PaperWheelTracker |
| `src/pages/Portfolio.tsx` | Branch: isPaperMode → PaperPortfolio |
| `src/pages/Screener.tsx` | "Paper Trade This" button on each row |
| `src/context/AuthContext.tsx` | initPreferences upserts paper_mode: false |
| `src/types/index.ts` | Add PaperAccount, PaperPosition, OpenPaperPositionData |

---

## PaperModeContext

```ts
interface PaperModeContextType {
  isPaperMode: boolean;
  togglePaperMode: () => void;   // confirms if switching OFF with open/assigned positions
  paperAccount: PaperAccount | null;
  refreshAccount: () => void;
}
```

### State persistence and precedence

- On mount: read `localStorage` key `ph_paper_mode` for immediate startup state (avoids flash).
- On auth resolve: read `user_preferences.paper_mode` from Supabase — **this value wins and overwrites localStorage**. Supabase is the authoritative source; localStorage is only a startup cache.
- On toggle: write to both localStorage and `user_preferences.paper_mode` simultaneously.
- On sign-out: clear localStorage `ph_paper_mode`, reset context to `false`.

### Provider placement

```tsx
<AuthProvider>
  <ToastProvider>
    <PaperModeProvider>        {/* reads user after AuthProvider resolves */}
      <WatchlistProvider>
        <AppInner />
      </WatchlistProvider>
    </PaperModeProvider>
  </ToastProvider>
</AuthProvider>
```

### First-time enable

Attempts `INSERT INTO paper_accounts (...) ON CONFLICT (user_id) DO NOTHING`. If a row was newly inserted (result count = 1), shows `WelcomeModal`. If the row already existed (result count = 0), skip the modal. This is idempotent against rapid double-toggles.

---

## usePaperTrading Hook

All monetary values use per-contract semantics matching the real `wheel_positions` convention.

```ts
// Account
usePaperAccount(): { account: PaperAccount | null; isLoading: boolean }

// Positions
usePaperPositions(): { positions: PaperPosition[]; isLoading: boolean }

// Actions
openPaperPosition(data: OpenPaperPositionData): Promise<void>
  // Validates CSP: strike × contracts × 100 ≤ current_cash
  //   → inline error "Insufficient paper cash — you need $X to open this position"
  // CC: no cash block, warn only
  // On success: INSERT paper_position, deduct collateral from paper_accounts.current_cash
  //   UPDATE paper_accounts SET current_cash = current_cash - (strike × contracts × 100)
  //   UPDATE paper_accounts SET total_premium_collected = total_premium_collected + (premiumCollected × contracts × 100)

editPaperPosition(id: string, data: { strike: number; expiry: string; premiumCollected: number; contracts: number }): Promise<void>
  // Fetch current position to get old strike, contracts, and strategy
  // Collateral adjustment applies ONLY to CSP positions (CC positions never consume collateral)
  // If strategy === 'CSP':
  //   oldCollateral = old_strike × old_contracts × 100
  //   newCollateral = new_strike × new_contracts × 100
  //   collateralDelta = newCollateral - oldCollateral
  //   Validate: if collateralDelta > 0, check current_cash ≥ collateralDelta
  //     → error "Insufficient cash to cover the increased collateral requirement"
  //   UPDATE paper_accounts SET current_cash = current_cash - collateralDelta
  //     (negative delta = cash is returned; positive = cash is deducted)
  // If strategy === 'CC': skip all cash adjustment
  // UPDATE paper_position fields (strike, expiry, premium_collected, contracts)

closePaperPosition(id: string, closingPremium: number): Promise<void>
  // Fetch position to get strategy, strike, contracts, premium_collected
  // realizedPnl = (premium_collected - closingPremium) × contracts × 100
  // collateralReturn = strategy === 'CSP' ? strike × contracts × 100 : 0
  //   (CC positions never had collateral deducted at open, so nothing is returned)
  // UPDATE paper_position: status='closed', closing_premium, realized_pnl, closed_at=now
  // UPDATE paper_accounts:
  //   current_cash += collateralReturn + realizedPnl
  //   total_realized_pnl += realizedPnl
  //   trades_total += 1
  //   trades_won += 1 if realizedPnl > 0

expirePaperPosition(id: string): Promise<void>
  // Fetch position to get strategy, strike, contracts, premium_collected
  // realizedPnl = premium_collected × contracts × 100 (full premium kept, closing_premium = 0)
  // collateralReturn = strategy === 'CSP' ? strike × contracts × 100 : 0
  //   (same CSP-only gate as closePaperPosition — CC has no collateral to return)
  // UPDATE paper_position: status='expired', closing_premium=0, realized_pnl, closed_at=now
  // UPDATE paper_accounts:
  //   current_cash += collateralReturn + realizedPnl
  //   total_realized_pnl += realizedPnl
  //   trades_total += 1; trades_won += 1
  // Toast: "Position expired worthless — full premium kept! +$X"

assignPaperPosition(id: string): Promise<void>
  // Fetch position to get strategy
  // UPDATE paper_position: status='assigned', closed_at=now
  // Cash adjustment:
  //   CSP: collateral stays consumed (cash not returned — user "bought" virtual shares).
  //        No cash change on assignment.
  //   CC: no collateral was ever deducted at open, so no cash change on assignment.
  //   → In both cases: current_cash is NOT modified by assignment.
  // trades_total is NOT incremented (assignment is not a terminal P&L event)
  // Toast (CSP): "Assigned — you now hold virtual shares of {ticker} at ${strike}.
  //               Sell covered calls to continue the wheel."
  // Toast (CC): "Assigned — your virtual {ticker} shares were called away at ${strike}."

resetPaperAccount(): Promise<void>
  // DELETE FROM paper_positions WHERE user_id = auth.uid()
  // DELETE FROM paper_snapshots WHERE user_id = auth.uid()
  // UPDATE paper_accounts SET
  //   current_cash = 100000, starting_balance = 100000,
  //   total_premium_collected = 0, total_realized_pnl = 0,
  //   trades_won = 0, trades_total = 0, reset_at = now()
  //   WHERE user_id = auth.uid()
  // Toast: "Paper account reset to $100,000"
  // Chart after reset: anchors at reset_at date with $100,000 as baseline
```

---

## Navbar Changes

When `isPaperMode = true`:
- `borderTop: '3px solid #f5c842'` added to nav element
- `PAPER` badge (amber, monospace) appears in right action area, left of user chip
- Paper toggle button sits right of LEAPS calc icon — glows amber when active
- `document.title = 'Paper Mode — Premium Hunter'`

When `isPaperMode = false`:
- `document.title = 'Premium Hunter'`
- No amber border, no badge

---

## PaperBanner

Renders as a DOM sibling to `<Navbar />` in AppInner, immediately below it. Pushes page content down — no overlap.

```
⚠  You are in Paper Trading Mode — positions here use virtual money and do not affect your real portfolio   [×]
```

- `background: rgba(245,200,66,0.08)`, `border-bottom: 1px solid rgba(245,200,66,0.15)`
- Dismissable per session via `sessionStorage` key `ph_paper_banner_dismissed`
- Re-appears on next browser session if still in paper mode
- When paper mode is toggled OFF then ON within the same session, the banner re-appears
  (clear `ph_paper_banner_dismissed` from sessionStorage when paper mode is disabled)
- Only renders when `isPaperMode = true`

---

## Paper Wheel Tracker

### Page header
"Wheel Tracker — Paper Mode" with amber `PAPER` badge.

### Cash indicator bar (top of page, always visible)
```
Virtual Cash: $82,400   |   CSP Collateral: $15,200   |   Free Cash: $67,200
```
- "Virtual Cash" = `paper_accounts.current_cash`
- "CSP Collateral" = sum of `strike × contracts × 100` across open CSP positions
- "Free Cash" = Virtual Cash − CSP Collateral

### Position rows
- Subtle amber row tint: `background: rgba(245,200,66,0.03)`
- Amber `PAPER` badge beside ticker
- Actions: Close · Expire Worthless · Assigned · Edit · Delete

### Close Position modal — Black-Scholes pre-fill

Loading state is shown while fetching. If `getQuote` fails (network error, rate limit):
- Modal opens without pre-fill
- Field shows placeholder "Enter closing premium"
- Inline note: "Live price unavailable — enter manually"
- "Closing Premium" field is required; user cannot submit without a value

Success path:
1. Show loading spinner in modal
2. Fetch spot price via `getQuote(ticker)` (Finnhub)
3. Fetch IV via `getIVData(ticker)` (Polygon)
   - `volatility = ivData.currentHV / 100`  ← currentHV is an integer percentage (e.g. 45), must divide by 100 to get decimal (0.45)
   - Fall back to `estimateVolatility(ticker)` (already returns a decimal) if getIVData fails or currentHV ≤ 0
4. Compute `T = yearsToExpiry(expiry)`; if T ≤ 0, pre-fill = 0.00 (expired)
5. Run `blackScholes({ spotPrice, strikePrice: strike, timeToExpiry: T, riskFreeRate: 0.045, volatility, optionType: strategy === 'CSP' ? 'put' : 'call' })`
   - Note: the parameter is `timeToExpiry`, not `T` — matches the actual blackScholes function signature
6. Pre-fill "Closing Premium (per contract)" with BS result — field is user-editable
7. If DTE = 0, BS ≈ $0 — hint: "This position may have expired. Use 'Expire Worthless' for a clean close."

### Edit Position modal
Same fields as open form (strike, expiry, contracts, premium).
- On submit, `editPaperPosition` validates collateral delta against `current_cash`
- Shows inline error if new collateral requirement exceeds available cash

### Open Position form
Fields: Ticker, Strategy (CSP/CC), Strike, Expiry, Contracts, Premium per contract, Underlying price at entry.

- Underlying price at entry: auto-fetched from Finnhub on ticker blur, user-editable
- Cash validation (CSP): `strike × contracts × 100 ≤ current_cash` → inline error if insufficient
- CC: shows warning "Paper mode doesn't track share lots — ensure you have virtual shares" but does not block

### My Paper Stats section (below position table)
Only shown if `trades_total > 0`.

**Performance summary card:**
Starting balance · Current value · Total return (+X% / +$X) · Win rate (X% — X/X trades) · Avg premium per trade · Best trade (+$X on {ticker}) · Worst trade (-$X on {ticker}) · Avg DTE at close · Most traded ticker

Computed from closed + expired paper_positions (not assigned).

**Learning insights (auto-generated, shown if applicable):**
- Win rate > 70%: "Great job! Your win rate of X% is above the wheel strategy average."
- Avg DTE at close < 14: "Tip: Consider holding longer — closing early reduces premium capture."
- All trades same ticker: "Tip: Diversifying across tickers reduces concentration risk."
- Has assigned positions: "You experienced assignment — this is normal. Now sell covered calls!"

---

## Paper Dashboard

Replaces the 4 real stat cards with 5 paper stat cards:
1. Virtual Cash Available (`paper_accounts.current_cash`)
2. Virtual Portfolio Value — reads `account_value` from the latest `paper_snapshots` row (not computed live on Dashboard load to avoid Finnhub/Polygon API calls). Falls back to `current_cash` if no snapshot exists yet.
3. Paper P&L all-time (`total_realized_pnl` with +$X / +X% vs $100k baseline)
4. Win Rate (`trades_won / trades_total × 100`, shows `—` if 0 trades)
5. Total Premium Collected (`total_premium_collected`)

Wheel Positions mini-panel shows open paper positions instead of real.

"Reset Paper Account" — small subtle link at page bottom. Opens `ResetConfirmModal`:
> "Reset your paper account to $100,000? All paper positions and history will be deleted. This cannot be undone."

---

## Paper Portfolio

Single-purpose page showing paper account performance over time.

### Snapshot calculation (upserted on page visit)

```
account_value = paper_accounts.current_cash + sum(unrealized_pnl for each open position)

For each open position's unrealized P&L:
  1. Fetch spot price via getQuote(ticker)
  2. Fetch IV via getIVData(ticker)
     - volatility = ivData.currentHV / 100  ← currentHV is an integer % (e.g. 45), divide by 100 for decimal
     - Fallback to estimateVolatility(ticker) if getIVData fails or currentHV ≤ 0 (already returns decimal)
  3. Compute T = yearsToExpiry(expiry); if T ≤ 0, unrealized_pnl = 0 for this position
  4. BS price = blackScholes({ spotPrice, strikePrice: strike, timeToExpiry: T, riskFreeRate: 0.045, volatility, optionType })
     - Note: parameter is `timeToExpiry`, not `T` — matches actual blackScholes function signature
  5. unrealized_pnl = (premium_collected - BS price) × contracts × 100

Snapshot upsert uses ON CONFLICT (user_id, snapshot_date) DO UPDATE to overwrite same-day values
(consistent with real portfolio snapshot logic in usePortfolio.ts).
Guard: always recompute and upsert the snapshot on page visit (using ON CONFLICT DO UPDATE).
This ensures the snapshot reflects any positions opened/closed since the last visit.
The UNIQUE constraint prevents duplicates; the DO UPDATE clause overwrites stale same-day values.

If getQuote fails for a ticker: use underlyingPriceAtEntry as fallback spot price.
If BS computation returns null (expired): treat unrealized_pnl as 0 for that position.
Snapshot is always saved regardless of individual position failures.
```

After `resetPaperAccount()`:
- All paper_snapshots deleted
- First page visit after reset creates a new Day 1 snapshot at $100,000
- Chart baseline anchors at `paper_accounts.reset_at` date, not original `created_at`

### Chart
- Line chart of `paper_snapshots.account_value` over time (same Recharts pattern as real portfolio)
- Time range: 1W · 1M · 3M · All
- Area fill: green (`rgba(0,214,143,0.1)`) if latest value > $100,000, red (`rgba(255,77,109,0.1)`) if below
- X-axis anchors at `reset_at` if a reset has occurred
- Summary row: Starting $100k · Current Value · Total Return · Cash Available

---

## Screener Integration

Each screener row gains a "Paper Trade This" button (amber, appears on hover alongside existing watchlist button).

### Monthly expiry calculation

Computed at runtime — no API call, no lookup table:
1. Find the third Friday of the current month
2. If that date is < 7 DTE from today, use the third Friday of next month instead
3. Repeat for months ahead until a date ≥ 7 DTE is found

### Pre-filled modal
- Ticker: locked (from screener row)
- Strategy: CSP (default)
- Expiry: nearest monthly expiry ≥ 7 DTE (computed above)
- Strike + Premium: iterate in $1 steps downward from `floor(spotPrice)` to find the strike
  where |put delta| is closest to 0.30. Delta is approximated from the BS `delta` result.
  Iteration cap: 100 steps. If no strike within ±0.05 of 0.30 delta is found within the cap,
  use the strike that produced the closest delta. Premium is the BS price at that strike.
- Underlying price at entry: from live Finnhub quote
- User reviews and clicks "Open Paper Position"
- Inline error if insufficient virtual cash

---

## Mode Switching

"Open positions" for switch-off modal = positions with `status IN ('open', 'assigned')`.
Closed and expired are terminal — they do not block the switch.

| Transition | Behaviour |
|---|---|
| OFF → ON (first time) | INSERT paper_accounts → WelcomeModal → amber banner |
| OFF → ON (returning) | Instant switch, amber banner, no modal |
| ON → OFF (no open/assigned positions) | Instant switch, document.title restored |
| ON → OFF (open/assigned positions exist) | `SwitchOffConfirmModal`: "You have X open paper positions. They'll be saved and waiting when you return to paper mode." |

Paper positions are **never deleted** when switching modes.

---

## Visual System

| Element | Style |
|---|---|
| Badge background | `rgba(245,200,66,0.15)` |
| Badge border | `rgba(245,200,66,0.3)` |
| Badge / accent text | `#f5c842` |
| Position row tint | `rgba(245,200,66,0.03)` |
| Navbar top border | `3px solid #f5c842` |
| Banner background | `rgba(245,200,66,0.08)` |
| Banner border | `1px solid rgba(245,200,66,0.15)` |

Green (`#00d68f`, `#00e5c4`) is reserved for real profitable trades and paper P&L numbers only. Amber signals "practice" UI chrome throughout.

---

## Constraints

- No existing real-trading code is modified beyond the three page branch points, Navbar, App wrapper, and type additions
- Real positions, real P&L, real portfolio holdings are completely untouched
- All paper DB operations are user-scoped with RLS — no cross-user data access possible
