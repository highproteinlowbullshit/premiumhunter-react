# PremiumHunter

A full-stack options income tracker for wheel strategy traders. Track cash-secured puts and covered calls, analyze implied volatility, calculate Greeks, and manage your premium collection — all in one place.

---

## Features

### Wheel Tracker
The core of the app. Log and manage all your CSP and CC positions through their full lifecycle.

- Open positions table with live unrealized P&L, assignment probability gauge, and Greeks per position
- DTE urgency system — positions color-code from comfortable → watch → urgent → critical → expiring today
- Close early with auto-calculated closing price (Black-Scholes estimate from live price + IV)
- Assignment flow walkthrough when a CSP is assigned: acquire shares, transition to covered call mode
- Cycle group view: positions grouped by expiry month with per-group premium totals
- Positions urgency banner surfacing counts of critical/expiring positions
- Pre-trade validation checklist (IV Rank, DTE range, earnings risk, margin, sector concentration, etc.)
- Cash balance tracking with automatic debit/credit on open, close, and assignment events
- Monthly income target progress embedded inline

### Dashboard
Morning briefing that gives you a complete picture before the market opens.

- Market open/close status with time-to-open and time-to-close
- Portfolio Greeks summary (aggregate delta, gamma, theta, vega across all open positions)
- Command Centre: AI-generated position intelligence — urgency ranking, action recommendations, health score
- Monthly P&L chart with realized vs. open potential
- Target tracker showing pace vs. monthly income goal
- Watchlist IV grid with sparklines and live pricing

### Portfolio
Track everything you own, not just your options positions.

- Holdings by type: shares, LEAPS calls, LEAPS puts, cash
- Benchmark chart: portfolio cumulative return vs. SPY
- Per-ticker performance breakdown (contribution to total P&L)
- Assigned shares section for shares received from put assignments
- LEAPS calculator: Black-Scholes pricing with full price-sensitivity table (−30% to +30% scenarios)
- USD/SGD currency conversion using live ECB rates

### Screener
Scan 488 US stocks for elevated IV and premium collection opportunities.

- Real-time IV Rank, IV Percentile, IV:HV ratio for every ticker
- Top Picks algorithm: composite score combining IV Rank, earnings safety, momentum, liquidity, and skew
- Earnings badge with days-to-earnings countdown and color-coded risk warning
- Sector filter, multi-field sorting, virtual list rendering for smooth scrolling
- Session + localStorage cache so the screener loads instantly on return visits

### Watchlist
Your personal shortlist, always up to date.

- Add/remove tickers with autocomplete from the 488-stock universe
- Per-ticker: live price, IV Rank, IV Percentile, 52-week IV Rank sparkline
- Sortable by any column, 60-second background refresh

### Paper Trading Mode
A complete simulation of the real wheel workflow — same UI, different data.

- Separate paper account with configurable starting balance
- Full position lifecycle: open, close early, assign, expire worthless
- Independent P&L tracking, win rate, and monthly stats
- Toggle on/off from the navbar; resets are supported without affecting live data

### Greeks & Options Pricing
- Black-Scholes pricer used throughout: position valuations, closing price estimates, LEAPS scenarios
- Greeks calculated per position: delta, gamma, theta, vega
- Aggregate portfolio Greeks with per-position heatmap
- Assignment probability per position derived from |delta|
- Implied volatility sourced from Polygon, with Supabase snapshot cache and per-ticker HV fallbacks

### Trade Checklist
Pre-trade validation before entering any position.

- IV Rank threshold check (CSP ≥50 preferred, CC ≥40)
- DTE range validation (14–45 days sweet spot)
- Earnings risk flag (<14 days to earnings)
- 52-week support level (strike vs. year low)
- Max risk per trade (% of account balance)
- Sector concentration check
- Covered call coverage verification (must hold ≥100 shares)
- Overridable warnings vs. hard blocks

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| Data fetching | TanStack Query v5 |
| Charts | Recharts |
| Database + Auth | Supabase (PostgreSQL, Row-Level Security) |
| Real-time prices | Finnhub WebSocket |
| Market data | Polygon.io (OHLCV, IV calculations) |
| Earnings & quotes | Finnhub REST API |
| Options pricing | Custom Black-Scholes implementation |
| Error tracking | Sentry |

---

## Data Sources

**Polygon.io** — 1-year daily OHLCV for all tickers, batch snapshot pricing, HV30/HV60 rolling calculations, IV Rank and IV Percentile derivation.

**Finnhub** — Live quotes, earnings calendar (next earnings date), company profiles and financial metrics. WebSocket connection for real-time price streaming.

**Supabase** — Primary database for positions, holdings, and preferences. Also stores daily `iv_snapshots` from a scheduled cron job so the screener doesn't hit Polygon on every page load.

**Frankfurter (ECB)** — USD/SGD exchange rate (Finnhub's forex endpoint returns 0 on the free tier).

---

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_FINNHUB_API_KEY, VITE_POLYGON_API_KEY

# Start dev server
npm run dev
```

---

## Project Structure

```
src/
├── pages/          # Route-level components (Dashboard, WheelTracker, Portfolio, Screener, Watchlist, ...)
├── components/     # Shared UI components
├── hooks/          # Data-fetching and business logic hooks
├── lib/            # API clients, Black-Scholes engine, formatters, utilities
└── context/        # Auth, PaperMode, and other React contexts
```

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `L` | Open LEAPS calculator |
| `?` | Open shortcuts / help modal |
