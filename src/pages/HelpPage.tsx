import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePaperMode } from '../context/PaperModeContext';
import { usePageTitle } from '../hooks/usePageTitle';

// ── Section heading with teal left border ─────────────────────────────────────
function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{
        fontFamily: 'Syne, sans-serif',
        fontSize: 'clamp(22px, 4vw, 30px)',
        fontWeight: 700,
        color: '#e8f0fe',
        margin: 0,
        paddingLeft: 16,
        borderLeft: '3px solid #00e5c4',
        lineHeight: 1.3,
      }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 16,
          color: '#6a8fb0',
          margin: '10px 0 0',
          lineHeight: 1.7,
          paddingLeft: 19,
        }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ── Prose paragraph ──────────────────────────────────────────────────────────
function Prose({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 16,
      color: '#9ab4d4',
      lineHeight: 1.85,
      margin: '0 0 18px',
      ...style,
    }}>
      {children}
    </p>
  );
}

// ── Subsection heading ────────────────────────────────────────────────────────
function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontFamily: 'Syne, sans-serif',
      fontSize: 18,
      fontWeight: 700,
      color: '#e8f0fe',
      margin: '32px 0 10px',
    }}>
      {children}
    </h3>
  );
}

// ── FAQ Accordion ─────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'Is Premium Hunter free to use?',
    a: 'Yes. Premium Hunter is free to use for all core features including the screener, watchlist, wheel tracker, and paper trading. We may introduce optional premium features in the future but the core tool will always be free.',
  },
  {
    q: 'Does Premium Hunter place trades for me?',
    a: 'No. Premium Hunter is a tracking and analysis tool only. It does not connect to your brokerage to place, modify, or cancel any trades. All trades are executed manually through your own brokerage platform.',
  },
  {
    q: 'How accurate is the IV rank data?',
    a: 'IV rank is calculated using live options chain data from Polygon.io and real-time stock prices from Finnhub. Results are cached daily in our database to ensure fast load times. IV rank figures are estimates based on available data and should be used as a directional guide, not as precise measurements.',
  },
  {
    q: 'How accurate is the Black-Scholes LEAPS valuation?',
    a: "Black-Scholes is the industry-standard options pricing model and provides a reliable theoretical estimate. However, real market prices may differ due to bid-ask spreads, liquidity, skew, and other market microstructure factors. Always check your brokerage's live options chain for the actual tradeable price before making any decision.",
  },
  {
    q: 'Is my trading data private?',
    a: 'Yes. Your positions, watchlist, and portfolio data are private to your account and protected by Supabase row-level security. We do not share, sell, or analyse individual user trading data.',
  },
  {
    q: 'Can I use Premium Hunter on my phone?',
    a: 'Yes. Premium Hunter is fully responsive and works on mobile browsers. A dedicated mobile app may be available in the future.',
  },
  {
    q: 'What does assignment mean and should I be scared of it?',
    a: 'Assignment happens when the stock you sold a put on drops below your strike price at expiry — meaning you are obligated to buy 100 shares at your strike price. This is not a loss of your money — it is a transition to step 2 of the wheel. You now own shares at a price you agreed to in advance, and you can immediately begin selling covered calls to generate more premium. Assignment is a feature of the wheel strategy, not a failure.',
  },
  {
    q: 'What is the difference between IV rank and IV percentile?',
    a: 'IV rank measures where current IV sits between the 52-week high and low on a scale of 0–100. IV percentile measures the percentage of days in the past year where IV was lower than today. Both indicate high or low volatility environments — IV rank is more commonly used by wheel traders as a quick gut-check before selling premium.',
  },
];

function FaqAccordion() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {FAQ_ITEMS.map((item) => {
        const isOpen = open === item.q;
        return (
          <div
            key={item.q}
            style={{
              background: isOpen ? 'rgba(0,229,196,0.04)' : 'rgba(0,0,0,0.2)',
              border: `1px solid ${isOpen ? 'rgba(0,229,196,0.18)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 10,
              overflow: 'hidden',
              transition: 'border-color 0.2s',
            }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : item.q)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '16px 20px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 15,
                fontWeight: 600,
                color: isOpen ? '#00e5c4' : '#c9daf0',
                lineHeight: 1.4,
                transition: 'color 0.2s',
              }}>
                {item.q}
              </span>
              <span style={{
                flexShrink: 0,
                color: isOpen ? '#00e5c4' : '#4a6a8a',
                transition: 'transform 0.25s, color 0.2s',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                display: 'flex',
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: '0 20px 18px' }}>
                <p style={{
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 15,
                  color: '#9ab4d4',
                  lineHeight: 1.8,
                  margin: 0,
                }}>
                  {item.a}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Feature cards ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="2" width="18" height="4" rx="1.5" stroke="#00e5c4" strokeWidth="1.4" />
        <rect x="2" y="9" width="13" height="4" rx="1.5" stroke="#00e5c4" strokeWidth="1.4" />
        <rect x="2" y="16" width="9" height="4" rx="1.5" stroke="#00e5c4" strokeWidth="1.4" />
        <circle cx="18.5" cy="18" r="2.5" stroke="#00e5c4" strokeWidth="1.2" />
      </svg>
    ),
    title: 'IV Rank Screener',
    body: 'Scan 75 of the most actively traded stocks and ETFs ranked by Implied Volatility rank. Instantly identify which stocks have elevated IV — the ideal conditions for selling premium. Filter by sector, price range, and IV threshold to find your next trade in seconds.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="8.5" stroke="#00e5c4" strokeWidth="1.4" />
        <circle cx="11" cy="11" r="2.2" fill="#00e5c4" />
        <line x1="11" y1="2.5" x2="11" y2="8.8" stroke="#00e5c4" strokeWidth="1.4" />
        <line x1="11" y1="13.2" x2="11" y2="19.5" stroke="#00e5c4" strokeWidth="1.4" />
        <line x1="2.5" y1="11" x2="8.8" y2="11" stroke="#00e5c4" strokeWidth="1.4" />
        <line x1="13.2" y1="11" x2="19.5" y2="11" stroke="#00e5c4" strokeWidth="1.4" />
      </svg>
    ),
    title: 'Wheel Tracker',
    body: 'Log every Cash Secured Put and Covered Call you sell. Track premium collected, current P&L, days to expiry, and assignment status in one clean table. Never lose track of an open position again.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="8.5" stroke="#00e5c4" strokeWidth="1.4" />
        <path d="M11 11 L11 2.5 A8.5 8.5 0 0 1 19.5 11 Z" fill="#00e5c4" fillOpacity="0.2" stroke="#00e5c4" strokeWidth="1.2" />
        <path d="M11 11 L19.5 11 A8.5 8.5 0 0 1 11 19.5 Z" fill="#00e5c4" fillOpacity="0.08" stroke="#00e5c4" strokeWidth="1.2" />
      </svg>
    ),
    title: 'Portfolio View',
    body: 'See your entire portfolio in one place — stocks, LEAPS, and wheel positions combined. A live P&L chart shows your portfolio value growing over time as premium income compounds.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="2" width="18" height="18" rx="2" stroke="#00e5c4" strokeWidth="1.4" />
        <line x1="6" y1="7" x2="16" y2="7" stroke="#00e5c4" strokeWidth="1.2" strokeLinecap="round" />
        <rect x="5" y="11" width="3" height="2" rx="0.5" fill="#00e5c4" />
        <rect x="9.5" y="11" width="3" height="2" rx="0.5" fill="#00e5c4" />
        <rect x="14" y="11" width="3" height="2" rx="0.5" fill="#00e5c4" />
        <rect x="5" y="15" width="3" height="2" rx="0.5" fill="#00e5c4" />
        <rect x="9.5" y="15" width="3" height="2" rx="0.5" fill="#00e5c4" />
        <rect x="14" y="15" width="3" height="2" rx="0.5" fill="#00e5c4" />
      </svg>
    ),
    title: 'Black-Scholes LEAPS Valuator',
    body: 'Get an estimated theoretical value for any LEAPS call or put using the industry-standard Black-Scholes model. Understand your Greeks — delta, theta, vega — without needing a Bloomberg terminal.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="2" width="14" height="18" rx="2" stroke="#00e5c4" strokeWidth="1.4" />
        <line x1="6" y1="7" x2="12" y2="7" stroke="#00e5c4" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="6" y1="11" x2="12" y2="11" stroke="#00e5c4" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="6" y1="15" x2="9" y2="15" stroke="#00e5c4" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="18" cy="17" r="3.5" fill="rgba(0,229,196,0.15)" stroke="#00e5c4" strokeWidth="1.2" />
        <path d="M17.5 17h1M18 16.5v1" stroke="#00e5c4" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
    title: 'Paper Trading Mode',
    body: 'New to the wheel? Practice with $100,000 in virtual money before risking real capital. Paper trading mode mirrors the real app exactly — same stocks, same mechanics, real market prices — just zero risk.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 3L14 9h6l-5 4 2 6-6-4-6 4 2-6-5-4h6z" stroke="#00e5c4" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Watchlist and Alerts',
    body: 'Build a personal watchlist of your favourite tickers and monitor their IV rank daily. Add stocks directly from the screener with one click and always know when conditions are right to sell.',
  },
];

// ── Feature deep-dive data ────────────────────────────────────────────────────
const FEATURE_DETAILS = [
  {
    id: 'screener',
    tag: 'Screener',
    tagColor: '#00c6f5',
    title: 'IV Rank Screener',
    tagline: 'Find the right stock to sell premium on — in under 10 seconds.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="2" width="18" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="2" y="9" width="13" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="2" y="16" width="9" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <circle cx="18.5" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
    forBeginners: 'When you are new to the wheel, the hardest question is "which stock should I sell a put on today?" The screener answers it. It shows you every stock\'s Implied Volatility rank — a single number between 0 and 100 — so you can immediately see which ones have elevated IV and are therefore ideal for collecting premium. Higher IV means more expensive options, which means more money in your pocket when you sell. You do not need to know how IV is calculated; you just need to know that higher is better when you\'re the seller.',
    forExperienced: 'The screener covers 488 actively traded stocks and ETFs. IV rank and IV percentile are calculated from live options chain data and cached nightly via a Supabase edge function — so first page load is instant and does not cost Polygon API credits. Additional columns include the IV/HV ratio (current implied vol divided by 30-day realised vol — above 1.3 is a strong premium-selling signal), the 52-week IV range visualised as a range bar, put/call skew, and ATM open interest. Sort by any column, filter by sector, or type a ticker directly to find your setup.',
    bullets: [
      '488 tickers across 14 sectors including Technology, Finance, Energy, Crypto, and ETFs',
      'IV rank, IV percentile, IV/HV ratio, 52-week IV range — all in one row',
      'Put/call skew column: positive skew means puts are pricier, ideal for CSPs',
      'ATM open interest shows liquidity depth — avoid tickers with thin markets',
      'Earnings calendar badges: colour-coded by urgency (today / 7d / 14d / 30d)',
      'Affordability filter: hides or dims stocks where your capital per trade is insufficient for even one contract',
      'Sort by IV rank, IV percentile, price, volume, or ticker name',
      'Sector filter, price range filter, and minimum IV rank threshold',
    ],
  },
  {
    id: 'toppicks',
    tag: 'Screener',
    tagColor: '#00c6f5',
    title: 'Top Picks Engine',
    tagline: 'An algorithmic shortlist of the best setups right now, based on your own preferences.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
        <path d="M11 3L14 9h6l-5 4 2 6-6-4-6 4 2-6-5-4h6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      </svg>
    ),
    forBeginners: 'The Top Picks section, at the top of the Screener page, takes all 488 stocks and ranks them using a multi-factor scoring system so you do not have to analyse dozens of rows yourself. It shows you the top 5 candidates right now with a breakdown of exactly why each one scored highly. For a beginner, this is the fastest way to understand what a "good" setup looks like — each card shows the IV rank, IV/HV ratio, earnings safety, and premium income potential so you can see the factors side by side.',
    forExperienced: 'The scoring engine weights IV rank (the primary factor), IV/HV ratio, put/call skew, ATM open interest, and earnings proximity. Any stock with earnings within 14 days is penalised heavily — IV collapses after announcements and you do not want to be short premium into an event. You can tune the engine to your preferences via the Settings panel: set your preferred sectors, minimum annual return target, and capital per trade. The engine adjusts the shortlist accordingly, filtering out stocks you cannot afford and sectors you do not want exposure to.',
    bullets: [
      'Multi-factor algorithm: IV rank, IV/HV ratio, skew, earnings safety, and liquidity',
      'Earnings penalty: stocks with earnings within 14 days are filtered down the rankings',
      'Personalised shortlist: configure preferred sectors, capital per trade, and return target in Settings',
      'Per-stock score breakdown card shows exactly which factors drove the ranking',
      'Updates in real-time as screener data loads — no page reload needed',
    ],
  },
  {
    id: 'wheeltracker',
    tag: 'Wheel Tracker',
    tagColor: '#00e5c4',
    title: 'Wheel Tracker',
    tagline: 'Log every trade. See your P&L, DTE, and assignment status in one clean table.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="8.5" stroke="currentColor" strokeWidth="1.4"/>
        <circle cx="11" cy="11" r="2.2" fill="currentColor"/>
        <line x1="11" y1="2.5" x2="11" y2="8.8" stroke="currentColor" strokeWidth="1.4"/>
        <line x1="13.2" y1="11" x2="19.5" y2="11" stroke="currentColor" strokeWidth="1.4"/>
      </svg>
    ),
    forBeginners: 'The Wheel Tracker is where you log every Cash Secured Put and Covered Call you sell. Once you add a trade, the tracker shows you how many days are left until expiry, what the position is currently worth, and your net profit or loss so far. You never have to wonder "what did I sell that for again?" — it is all there. When a trade expires worthless or you close it, you mark it as closed and the full premium flows into your realised P&L. When a CSP is assigned, you hit Assign and the tracker transitions the position into step 2 automatically.',
    forExperienced: 'The tracker pulls live option prices via Finnhub to show mark-to-market P&L per position. The urgency banner at the top of the open positions table flags anything expiring today, within 2 days, or within 6 days — so nothing falls off your radar at expiry. Assignment probability is calculated using Black-Scholes delta for each open CSP so you can see at a glance which positions are at risk. The "Cycles" view groups your closed positions by ticker and reconstructs full CSP→assignment→CC chains — each cycle shows total premium collected, annualised return for that cycle, and a per-leg breakdown. Monthly income target tracker shows progress toward your goal.',
    bullets: [
      'Log CSPs and CCs with strike, expiry, premium per contract, and number of contracts',
      'Live mark-to-market P&L using real option prices — no manual updates',
      'DTE countdown with urgency flags at 0, 2, and 6 days to expiry',
      'Black-Scholes assignment probability for each open CSP',
      'One-click assignment flow transitions CSP to share ownership with cost basis tracking',
      'Cycle view: groups trades by ticker into full wheel cycles with annualised return per cycle',
      'Monthly income target tracker with progress bar',
      'Realised P&L summary across all closed trades with win rate',
    ],
  },
  {
    id: 'portfolio',
    tag: 'Portfolio',
    tagColor: '#a78bfa',
    title: 'Portfolio & Analytics',
    tagline: 'Your full picture — shares, premium income, capital gains, and benchmark comparison.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="8.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M11 11 L11 2.5 A8.5 8.5 0 0 1 19.5 11 Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M11 11 L19.5 11 A8.5 8.5 0 0 1 11 19.5 Z" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
    forBeginners: 'The Portfolio tab gives you the big picture. It shows all the shares you own from CSP assignments, how much premium you have collected against each lot, and what your true cost basis is after that premium is subtracted. If you were assigned 100 shares at $25 but collected $300 in premium along the way, your real cost basis is $22 per share — the Portfolio tab calculates that for you automatically. There is also a P&L attribution chart that breaks down how much of your total return came from premium income versus capital gains, so you can see exactly what the wheel strategy is contributing.',
    forExperienced: 'The Portfolio page integrates data from both your wheel positions and your assigned share lots into a single analytics layer. The benchmark comparison chart shows your portfolio return versus SPY over the same period. The P&L attribution section breaks down premium income by CSP vs CC, plus capital gains from exited lots, with a monthly bar chart. The assigned lots table shows gross cost basis, total premium collected, net cost basis, percentage of capital recovered through premium, and unrealised gain versus both gross and net cost. The ticker performance league table ranks every stock you have ever wheeled by annualised return, win rate, total P&L, and consistency — so you can see which tickers have been your best performers and double down on them.',
    bullets: [
      'Assigned lots tracker: shows gross cost, premium recovered, net cost basis, and unrealised gain',
      'Benchmark comparison: your portfolio return vs SPY over 1M, 3M, 6M, 1Y, or all-time',
      'P&L attribution: premium income (CSP + CC) vs capital gains, charted monthly',
      'Ticker performance league table: ranks all your tickers by annualised return, win rate, and consistency',
      'Expandable ticker rows with monthly P&L bar chart for each underlying',
      'Portfolio snapshot history tracked daily for charting portfolio growth over time',
      'Cash balance awareness: cash holdings from Wheel Tracker flow into portfolio total',
    ],
  },
  {
    id: 'watchlist',
    tag: 'Watchlist',
    tagColor: '#f5c842',
    title: 'Watchlist',
    tagline: 'Monitor your favourite tickers\' IV daily without running a full scan.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M4.5 19c0-3.31 2.91-6 6.5-6s6.5 2.69 6.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    forBeginners: 'The watchlist lets you bookmark the stocks you are most interested in trading. Once a ticker is on your watchlist, the Watchlist tab shows you its current IV rank, price, and recent trend at a glance every time you open Premium Hunter. Rather than running a full screener scan every day, you check your watchlist, and when conditions are right on one of your favourites, you head straight to the screener or your brokerage to place the trade.',
    forExperienced: 'Watchlist entries are synced to your account and load with fresh Finnhub quote and IV data on each visit. Each ticker card shows IV rank, IV percentile, current HV, price, and 24-hour price change. Add tickers directly from the screener with one click — the watchlist button appears on every screener row. IV history chart is available per ticker to visualise how volatility has moved over the past year and identify regime shifts.',
    bullets: [
      'Add tickers directly from the screener with one click',
      'IV rank, IV percentile, HV, price, and 24h change per card',
      'IV history sparkline chart per ticker',
      'Synced to your account — available across devices',
      'Refreshes automatically every 60 seconds while the tab is open',
    ],
  },
  {
    id: 'leaps',
    tag: 'LEAPS',
    tagColor: '#34d399',
    title: 'LEAPS Valuator',
    tagline: 'Black-Scholes pricing and full Greeks for any long-dated option — in seconds.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="2" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.4"/>
        <line x1="6" y1="7" x2="16" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <rect x="5" y="11" width="3" height="2" rx="0.5" fill="currentColor"/>
        <rect x="9.5" y="11" width="3" height="2" rx="0.5" fill="currentColor"/>
        <rect x="14" y="11" width="3" height="2" rx="0.5" fill="currentColor"/>
      </svg>
    ),
    forBeginners: 'LEAPS are long-dated options — contracts that expire one to three years in the future. Some wheel traders use LEAPS calls as a low-cost substitute for owning 100 shares, allowing them to sell covered calls without committing full share capital. The LEAPS Valuator lets you enter any stock ticker, strike price, and expiry date and instantly see the theoretical fair value of that option along with its Greeks. Delta, gamma, theta, and vega are explained in plain English so you understand not just the number but what it means for your position.',
    forExperienced: 'The valuator uses Black-Scholes with live underlying price from Finnhub and IV from Polygon. It outputs theoretical price, delta, gamma, theta (daily decay in dollars), and vega. A sensitivity table shows how the position value changes if the stock moves ±5%, ±10%, or ±20%, and if IV changes by ±5 or ±10 points. Useful for evaluating poor man\'s covered call setups before you enter, or for checking mid-cycle whether your LEAPS position is still priced fairly versus where you bought it.',
    bullets: [
      'Black-Scholes pricing using live underlying price and IV — no manual input needed',
      'Full Greeks: delta, gamma, theta (in $/day), and vega',
      'Sensitivity table: price and IV shock scenarios side by side',
      'Works for both calls and puts across any strike and expiry',
      'Useful for PMCC (Poor Man\'s Covered Call) setup evaluation and mid-cycle review',
    ],
  },
  {
    id: 'paper',
    tag: 'Paper Trading',
    tagColor: '#fb923c',
    title: 'Paper Trading Mode',
    tagline: 'The full Premium Hunter experience with $100,000 of virtual money. Zero risk.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="2" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.4"/>
        <line x1="6" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="6" y1="11" x2="12" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="18" cy="17" r="3.5" fill="rgba(251,146,60,0.15)" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M17.5 17h1M18 16.5v1" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
    forBeginners: 'Paper trading is the single most important feature for anyone new to the wheel. It gives you a completely realistic simulation of the strategy — real stocks, real prices, real mechanics — without any real money at risk. You start with $100,000 of virtual capital. Sell puts, get assigned, sell covered calls, watch theta decay work in your favour. Make mistakes. Learn from them. By the time you open a live account, you will have been through the full cycle multiple times and you will know exactly what to expect. Most traders who go straight to live trading wish they had papered first.',
    forExperienced: 'Paper mode mirrors the real tracker exactly — same position table, same assignment flow, same P&L calculations. It is useful for experienced traders in two ways: testing a new ticker or strategy variant before committing real capital, and onboarding new traders or family members. Toggle between paper and live mode with the switch in the top navigation bar — your real positions are preserved and separate. Paper positions do not affect your live analytics or portfolio.',
    bullets: [
      '$100,000 of virtual starting capital',
      'Full feature parity with real mode — same screener, tracker, and portfolio',
      'Real market prices used for all paper positions',
      'Toggle between paper and live mode instantly — positions are kept separate',
      'Great for testing new tickers, strategies, or position sizing before going live',
      'Useful for onboarding new traders without any account access required',
    ],
  },
  {
    id: 'checklist',
    tag: 'Trade Checklist',
    tagColor: '#00d68f',
    title: 'Pre-Trade Checklist',
    tagline: 'A structured sanity check before you pull the trigger on any new trade.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="2" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M7 11l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    forBeginners: 'Before you place a trade in your brokerage, the pre-trade checklist runs you through a series of questions that experienced wheel traders ask themselves on every setup: Is IV rank elevated? Is there an earnings event coming up? Is the strike far enough below the current price? How much capital will this tie up? For beginners, this structured walkthrough replaces the anxiety of "am I doing this right?" with a clear process. The checklist scores the setup so you can see at a glance whether it passes or has any red flags.',
    forExperienced: 'The checklist evaluates your trade inputs against the scoring factors used by the Top Picks engine — IV rank threshold, earnings proximity, distance from ATM, capital commitment, and sector concentration. Each factor is shown as a pass/warn/fail with a brief explanation. You can attach a checklist snapshot to a position when you log it in the Wheel Tracker, so you have a record of your reasoning at the time of entry. Useful for post-trade review and for building consistent trade discipline over time.',
    bullets: [
      'Evaluates IV rank, earnings proximity, strike selection, and capital usage',
      'Pass / warn / fail scoring per factor with explanations',
      'Attach checklist snapshot to a Wheel Tracker position at entry',
      'Score summary shown on the Add Position modal when checklist is complete',
      'Helps build consistent entry discipline over time',
    ],
  },
];

// ── Feature detail section component ─────────────────────────────────────────
function FeatureDetailSection() {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div>
      {FEATURE_DETAILS.map((f) => {
        const isExpanded = activeId === f.id;
        return (
          <div
            key={f.id}
            style={{
              borderRadius: 14,
              overflow: 'hidden',
              marginBottom: 8,
              border: isExpanded
                ? `1px solid ${f.tagColor}30`
                : '1px solid rgba(255,255,255,0.06)',
              background: isExpanded ? `${f.tagColor}06` : 'rgba(0,0,0,0.2)',
              transition: 'border-color 0.2s, background 0.2s',
            }}
          >
            {/* Header / toggle row */}
            <button
              onClick={() => setActiveId(isExpanded ? null : f.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '18px 22px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {/* Icon bubble */}
              <div style={{
                flexShrink: 0,
                width: 38,
                height: 38,
                borderRadius: 10,
                background: `${f.tagColor}14`,
                border: `1px solid ${f.tagColor}28`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: f.tagColor,
              }}>
                {f.icon}
              </div>

              {/* Title block */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: 'Syne, sans-serif',
                    fontSize: 15,
                    fontWeight: 700,
                    color: isExpanded ? '#e8f0fe' : '#c9daf0',
                    transition: 'color 0.2s',
                  }}>
                    {f.title}
                  </span>
                  <span style={{
                    fontSize: 10,
                    fontFamily: 'DM Sans, sans-serif',
                    fontWeight: 600,
                    color: f.tagColor,
                    background: `${f.tagColor}14`,
                    border: `1px solid ${f.tagColor}28`,
                    borderRadius: 20,
                    padding: '1px 8px',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase' as const,
                    whiteSpace: 'nowrap' as const,
                  }}>
                    {f.tag}
                  </span>
                </div>
                <p style={{
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 13,
                  color: '#4a6a8a',
                  margin: '3px 0 0',
                  lineHeight: 1.5,
                }}>
                  {f.tagline}
                </p>
              </div>

              {/* Chevron */}
              <span style={{
                flexShrink: 0,
                color: isExpanded ? f.tagColor : '#4a6a8a',
                transition: 'transform 0.25s, color 0.2s',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                display: 'flex',
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div style={{ padding: '0 22px 24px' }}>
                {/* Two-column explainer */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: 16,
                  marginBottom: 22,
                }}>
                  <div style={{
                    background: 'rgba(0,229,196,0.04)',
                    border: '1px solid rgba(0,229,196,0.1)',
                    borderRadius: 10,
                    padding: '16px 18px',
                  }}>
                    <p style={{
                      fontFamily: 'DM Sans, sans-serif',
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#00e5c4',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      margin: '0 0 10px',
                    }}>
                      If you are new to the wheel
                    </p>
                    <p style={{
                      fontFamily: 'DM Sans, sans-serif',
                      fontSize: 14,
                      color: '#9ab4d4',
                      lineHeight: 1.8,
                      margin: 0,
                    }}>
                      {f.forBeginners}
                    </p>
                  </div>
                  <div style={{
                    background: 'rgba(167,139,250,0.04)',
                    border: '1px solid rgba(167,139,250,0.1)',
                    borderRadius: 10,
                    padding: '16px 18px',
                  }}>
                    <p style={{
                      fontFamily: 'DM Sans, sans-serif',
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#a78bfa',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      margin: '0 0 10px',
                    }}>
                      If you are an experienced trader
                    </p>
                    <p style={{
                      fontFamily: 'DM Sans, sans-serif',
                      fontSize: 14,
                      color: '#9ab4d4',
                      lineHeight: 1.8,
                      margin: 0,
                    }}>
                      {f.forExperienced}
                    </p>
                  </div>
                </div>

                {/* Bullet list */}
                <p style={{
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#4a6a8a',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  margin: '0 0 10px',
                }}>
                  What it includes
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {f.bullets.map((b) => (
                    <li key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{
                        flexShrink: 0,
                        width: 16,
                        height: 16,
                        marginTop: 1,
                        borderRadius: '50%',
                        background: `${f.tagColor}18`,
                        border: `1px solid ${f.tagColor}30`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 4l2 2 3-3" stroke={f.tagColor} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                      <span style={{
                        fontFamily: 'DM Sans, sans-serif',
                        fontSize: 13.5,
                        color: '#7a9bc0',
                        lineHeight: 1.65,
                      }}>
                        {b}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Pain points ───────────────────────────────────────────────────────────────
const PAIN_POINTS = [
  {
    title: 'Your brokerage shows positions but not context',
    body: "IBKR, Tastytrade, and Schwab are excellent execution platforms. But they were not built to help you decide which stock to trade next. They show you your open positions — they do not show you which of your watchlist stocks currently has an IV rank above 70 and is therefore ideal for selling premium. Premium Hunter's screener fills that gap. Open it alongside your brokerage and you have the decision-making context your platform was never designed to provide.",
  },
  {
    title: 'Tracking P&L across multiple positions is a spreadsheet nightmare',
    body: "Most experienced wheel traders end up managing a Google Sheet with dozens of tabs tracking premiums, assignment prices, cost basis, and net P&L per position. It works until it doesn't — one wrong formula or forgotten entry and your numbers are off. Premium Hunter's Wheel Tracker replaces that spreadsheet with a clean, auto-calculating table that shows your real net P&L per position and cumulative monthly income without a single formula to maintain.",
  },
  {
    title: 'LEAPS valuation requires tools you don\'t have',
    body: "Estimating the fair value of a LEAPS position mid-cycle is surprisingly hard without a proper options calculator. Most traders either guess or pull up a clunky third-party Black-Scholes calculator, manually enter all the inputs, and hope they got the volatility figure right. Premium Hunter's LEAPS valuator pulls the live underlying price and IV automatically and gives you the theoretical value, all Greeks, and a sensitivity table showing how the position changes if the stock moves 10% or 20% — in seconds, from the same screen where your position is tracked.",
  },
  {
    title: 'You have no visual record of your premium income over time',
    body: "One of the most motivating things about the wheel strategy is watching premium income compound over months. But most brokerages show a running account balance — not a chart of premium collected versus capital deployed. Premium Hunter's portfolio chart shows your account value growing over time specifically from wheel income, making it easy to see and share your progress.",
  },
  {
    title: 'Switching between screener, brokerage, and tracker wastes time',
    body: 'A typical wheel trading session involves: checking a screener for high IV, opening your brokerage to look up the options chain, calculating the premium on a separate calculator, logging the trade in a spreadsheet, and then setting a reminder to check the position. Premium Hunter compresses all of that into one tab. Screen, value, log, track — without leaving the platform.',
  },
  {
    title: 'Teaching someone else the wheel means starting from scratch every time',
    body: "If you manage money for family members or want to help a friend learn the wheel, you currently have no structured way to walk them through it. Premium Hunter's paper trading mode and built-in educational content means you can onboard someone in minutes — hand them a paper account, point them to the Help section, and let the platform do the teaching.",
  },
];

// ── Main component ────────────────────────────────────────────────────────────
export function HelpPage() {
  usePageTitle('Help');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const { user } = useAuth();
  const { isPaperMode, togglePaperMode } = usePaperMode();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const handleGetStarted = () => {
    if (user) { navigate('/wheel'); return; }
    navigate('/signup');
  };

  const handlePaperTrading = () => {
    if (user) {
      if (!isPaperMode) togglePaperMode();
      navigate('/wheel');
      return;
    }
    navigate('/signup');
  };

  const section: React.CSSProperties = {
    marginBottom: 72,
  };

  const ctaButton = (primary: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '13px 28px',
    borderRadius: 12,
    fontFamily: 'DM Sans, sans-serif',
    fontSize: 15,
    fontWeight: 700,
    textDecoration: 'none',
    transition: 'opacity 0.2s, transform 0.15s',
    cursor: 'pointer',
    ...(primary
      ? {
          background: 'linear-gradient(135deg, #00e5c4, #00b4d8)',
          color: '#050d1a',
          border: 'none',
          boxShadow: '0 4px 20px rgba(0,229,196,0.25)',
        }
      : {
          background: 'rgba(0,229,196,0.08)',
          color: '#00e5c4',
          border: '1px solid rgba(0,229,196,0.25)',
        }),
  });

  return (
    <div className="min-h-screen mesh-bg pt-20 pb-20">
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px' }}>

        {/* ── Hero ── */}
        <div style={{ textAlign: 'center', padding: '56px 0 48px', ...section }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(0,229,196,0.08)',
            border: '1px solid rgba(0,229,196,0.18)',
            borderRadius: 20,
            padding: '5px 14px',
            marginBottom: 24,
          }}>
            <span style={{ color: '#00e5c4', fontSize: 11, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Help &amp; Documentation
            </span>
          </div>

          <h1 style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 'clamp(32px, 6vw, 52px)',
            fontWeight: 800,
            color: '#e8f0fe',
            lineHeight: 1.15,
            margin: '0 0 18px',
            letterSpacing: '-0.01em',
          }}>
            Welcome to <span style={{ color: '#00e5c4' }}>Premium Hunter</span>
          </h1>

          <p style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 18,
            color: '#9ab4d4',
            lineHeight: 1.7,
            margin: '0 auto 36px',
            maxWidth: 580,
          }}>
            Your all-in-one toolkit for tracking, learning, and mastering the wheel options strategy.
          </p>

          {/* CTA buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 36 }}>
            <button onClick={handleGetStarted} style={{ ...ctaButton(true), border: 'none', cursor: 'pointer' }}>
              {user ? 'Go to Wheel Tracker' : 'Get Started Free'}
            </button>
            <button onClick={handlePaperTrading} style={{ ...ctaButton(false), cursor: 'pointer' }}>
              {user ? 'Switch to Paper Trading' : 'Try Paper Trading'}
            </button>
          </div>

          {/* Trust badges */}
          <div style={{ display: 'flex', gap: 0, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['Free to use', 'No financial advice', 'Built by traders, for traders'].map((badge, i) => (
              <div key={badge} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <span style={{
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 12,
                  color: '#4a6a8a',
                  padding: '0 14px',
                }}>
                  {badge}
                </span>
                {i < 2 && <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: 18 }}>|</span>}
              </div>
            ))}
          </div>
        </div>

        {/* ── Financial Disclaimer ── */}
        <div style={{
          ...section,
          background: 'rgba(245,200,66,0.05)',
          border: '1px solid rgba(245,200,66,0.25)',
          borderLeft: '4px solid #f5c842',
          borderRadius: 12,
          padding: '24px 28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L18.66 17H1.34L10 2z" stroke="#f5c842" strokeWidth="1.4" strokeLinejoin="round" />
                <line x1="10" y1="8" x2="10" y2="12" stroke="#f5c842" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="10" cy="14.5" r="0.8" fill="#f5c842" />
              </svg>
            </div>
            <h3 style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 16,
              fontWeight: 700,
              color: '#f5c842',
              margin: 0,
            }}>
              Important Disclaimer
            </h3>
          </div>
          <p style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 14,
            color: '#c9a227',
            lineHeight: 1.8,
            margin: '0 0 10px',
          }}>
            Premium Hunter is a trade tracking and analysis tool designed to improve your trading workflow and quality of life. It does not provide financial advice, investment recommendations, or trading signals of any kind.
          </p>
          <p style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 14,
            color: '#c9a227',
            lineHeight: 1.8,
            margin: '0 0 10px',
          }}>
            All data, calculations, and estimates displayed on this platform — including IV rank, Black-Scholes valuations, P&L figures, and strategy suggestions — are for informational and educational purposes only. They should not be construed as recommendations to buy, sell, or hold any financial instrument.
          </p>
          <p style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 14,
            color: '#c9a227',
            lineHeight: 1.8,
            margin: '0 0 10px',
          }}>
            Options trading involves significant risk and is not suitable for all investors. You may lose some or all of your invested capital. Past performance of any strategy displayed on this platform is not indicative of future results.
          </p>
          <p style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 14,
            color: '#c9a227',
            lineHeight: 1.8,
            margin: 0,
          }}>
            Always conduct your own research and consult a licensed financial advisor before making any investment decisions. Premium Hunter accepts no liability for trading decisions made based on information displayed on this platform.
          </p>
        </div>

        {/* ── Feature Overview ── */}
        <div style={section}>
          <SectionHeading
            title="Everything you need in one place"
            subtitle="Premium Hunter brings together the tools that serious wheel traders use every day — without the subscription fees, cluttered interfaces, or missing features of traditional brokerages."
          />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16,
          }}>
            {FEATURES.map((f) => (
              <div
                key={f.title}
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(0,229,196,0.1)',
                  borderRadius: 12,
                  padding: '22px 20px',
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: 'rgba(0,229,196,0.08)',
                  border: '1px solid rgba(0,229,196,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}>
                  {f.icon}
                </div>
                <h3 style={{
                  fontFamily: 'Syne, sans-serif',
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#e8f0fe',
                  margin: '0 0 8px',
                }}>
                  {f.title}
                </h3>
                <p style={{
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 13.5,
                  color: '#6a8fb0',
                  lineHeight: 1.75,
                  margin: 0,
                }}>
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Features Deep-Dive ── */}
        <div style={section}>
          <SectionHeading
            title="Features"
            subtitle="A full walkthrough of every tool in Premium Hunter — what it does, why it exists, and how to get the most out of it whether you are brand new to options or have been running the wheel for years."
          />
          <FeatureDetailSection />
        </div>

        {/* ── Newcomers Section ── */}
        <div style={section}>
          <SectionHeading
            title="Never traded options before? Start here."
            subtitle="Options trading sounds complicated. The wheel strategy makes it simple. Here's everything you need to know."
          />

          <SubHeading>What is an option?</SubHeading>
          <Prose>
            An option is a contract that gives you the right — but not the obligation — to buy or sell 100 shares of a stock at a specific price before a specific date. When you buy an option, you pay a premium. When you sell an option, you collect that premium as income. The wheel strategy is built entirely around <em style={{ color: '#c9daf0', fontStyle: 'normal', fontWeight: 600 }}>selling</em> options — which means you are the one collecting income, not paying it.
          </Prose>

          <SubHeading>What is the Wheel Strategy?</SubHeading>
          <Prose>
            The wheel is a three-step process that generates consistent premium income from stocks you already like.
          </Prose>

          {/* Wheel steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
            {[
              {
                step: '1',
                title: 'Sell a Cash Secured Put (CSP)',
                body: 'You agree to buy 100 shares of a stock at a price below the current market price. In exchange, someone pays you a premium upfront — cash in your account immediately. If the stock stays above your strike price, you keep the premium and repeat. If the stock drops below your strike, you buy the shares — which leads to step 2.',
              },
              {
                step: '2',
                title: 'You Own the Shares',
                body: 'You now own 100 shares of a stock you were happy to buy at that price. This is not a disaster — it is part of the plan.',
              },
              {
                step: '3',
                title: 'Sell a Covered Call (CC)',
                body: 'You now sell someone the right to buy your shares at a price above what you paid. You collect more premium. If the stock rises above your strike, your shares get called away at a profit. If not, you keep the shares and repeat — collecting premium week after week.',
              },
            ].map(({ step, title, body }) => (
              <div key={step} style={{
                display: 'flex',
                gap: 16,
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(0,229,196,0.08)',
                borderRadius: 10,
                padding: '18px 20px',
              }}>
                <div style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(0,229,196,0.12)',
                  border: '1px solid rgba(0,229,196,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Syne, sans-serif',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#00e5c4',
                }}>
                  {step}
                </div>
                <div>
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 700, color: '#c9daf0', marginBottom: 6 }}>{title}</div>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: '#6a8fb0', lineHeight: 1.75, margin: 0 }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
          <Prose>
            This cycle of collecting premium on the way down and on the way up is the wheel.
          </Prose>

          <SubHeading>What is IV Rank and why does it matter?</SubHeading>
          <Prose>
            Implied Volatility (IV) measures how much the market expects a stock to move. IV Rank tells you whether that volatility is high or low compared to the past year — on a scale of 0 to 100.
          </Prose>
          <Prose>
            When IV rank is <strong style={{ color: '#00d68f' }}>high (above 50)</strong>, options premiums are expensive. That is when you want to be a seller — you collect more income for the same trade. When IV rank is <strong style={{ color: '#ff8c42' }}>low (below 30)</strong>, premiums are cheap. That is not a good time to sell.
          </Prose>
          <Prose>
            Premium Hunter's screener shows you IV rank for 75 stocks at a glance so you can instantly find the best selling conditions without manually checking each one.
          </Prose>

          <SubHeading>Why use Paper Trading first?</SubHeading>
          <Prose>
            Paper trading lets you practice the entire wheel strategy with $100,000 of virtual money before risking a single real dollar. You will make mistakes at first — and that is exactly why paper trading exists. Learn what assignment feels like, understand how theta decay works, and build confidence in your strategy — all with zero real risk. When you are ready to go live, you will trade with clarity instead of anxiety.
          </Prose>

          <SubHeading>How much money do I need to start the wheel?</SubHeading>
          <Prose>
            The wheel requires owning 100 shares or having enough cash to buy them. For a $10 stock, that is $1,000. For a $50 stock, $5,000. Most wheel traders start with stocks priced between $5 and $30 to keep capital requirements manageable. SOFI, GME, and MARA — three of the stocks pre-loaded in Premium Hunter — are popular starting points because of their low price, high IV rank, and active options markets.
          </Prose>
          <Prose style={{ fontSize: 13, color: '#4a6a8a', fontStyle: 'italic' }}>
            This is general educational context only — not a recommendation to trade any specific stock.
          </Prose>
        </div>

        {/* ── Experienced Traders Section ── */}
        <div style={section}>
          <SectionHeading
            title="Already trading the wheel? Here is what Premium Hunter solves."
            subtitle="If you have been wheeling for a while, you already know the frustration. Here is exactly what this platform fixes."
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {PAIN_POINTS.map((p) => (
              <div key={p.title} style={{ paddingLeft: 20, borderLeft: '2px solid rgba(0,229,196,0.15)' }}>
                <h3 style={{
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#c9daf0',
                  margin: '0 0 8px',
                  lineHeight: 1.4,
                }}>
                  {p.title}
                </h3>
                <Prose style={{ margin: 0 }}>
                  {p.body}
                </Prose>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ── */}
        <div style={section}>
          <SectionHeading title="Frequently asked questions" />
          <FaqAccordion />
        </div>

        {/* ── Getting Started CTA ── */}
        <div style={{
          ...section,
          marginBottom: 0,
          background: 'rgba(0,229,196,0.04)',
          border: '1px solid rgba(0,229,196,0.12)',
          borderRadius: 16,
          padding: 'clamp(32px, 5vw, 56px)',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 'clamp(24px, 4vw, 34px)',
            fontWeight: 800,
            color: '#e8f0fe',
            margin: '0 0 14px',
            letterSpacing: '-0.01em',
          }}>
            Ready to start hunting premium?
          </h2>
          <p style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 16,
            color: '#9ab4d4',
            lineHeight: 1.7,
            margin: '0 auto 32px',
            maxWidth: 520,
          }}>
            Join Premium Hunter free. Start with paper trading, learn the wheel, and build the confidence to trade with real capital.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
            <button onClick={handleGetStarted} style={{ ...ctaButton(true), border: 'none', cursor: 'pointer' }}>
              {user ? 'Go to Wheel Tracker' : 'Create Free Account'}
            </button>
            <button onClick={handlePaperTrading} style={{ ...ctaButton(false), cursor: 'pointer' }}>
              {user ? 'Switch to Paper Trading' : 'Start Paper Trading'}
            </button>
          </div>
          <p style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 12,
            color: '#4a6a8a',
            margin: 0,
          }}>
            No credit card required. Free forever for core features.
          </p>
        </div>
      </div>

      {/* ── Back to top button ── */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            bottom: 28,
            right: 24,
            zIndex: 100,
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: 'rgba(0,229,196,0.12)',
            border: '1px solid rgba(0,229,196,0.25)',
            color: '#00e5c4',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            transition: 'opacity 0.2s',
          }}
          title="Back to top"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 10l5-5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
