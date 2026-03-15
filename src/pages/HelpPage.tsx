import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

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
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handler = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

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
            <Link to="/signup" style={ctaButton(true)}>
              Get Started Free
            </Link>
            <Link to="/signup" style={ctaButton(false)}>
              Try Paper Trading
            </Link>
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
            <Link to="/signup" style={ctaButton(true)}>
              Create Free Account
            </Link>
            <Link to="/signup" style={ctaButton(false)}>
              Start Paper Trading
            </Link>
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
