import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import { IVBadge, IVLabel } from '../components/IVBadge';
import { IVSparkline } from '../components/IVChart';
import { usePositions } from '../hooks/usePositions';
import { useWatchlistContext } from '../context/WatchlistContext';
import { useWatchlistData } from '../hooks/useMarketData';
import { usePaperMode } from '../context/PaperModeContext';
import { PaperDashboard } from './PaperDashboard';
import { MonthlyPnLChart } from '../components/MonthlyPnLChart';
import { MonthlyTargetCompact } from '../components/MonthlyTargetTracker';
import type { StockTicker, IVDataPoint, WheelPosition } from '../types';

export function Dashboard() {
  usePageTitle('Dashboard');
  const { isPaperMode } = usePaperMode();
  if (isPaperMode) return <PaperDashboard />;
  return <RealDashboard />;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getMarketStatus(): { isOpen: boolean; label: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: 'numeric', hour12: false, weekday: 'short',
  }).formatToParts(new Date());
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? '';
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0');
  const isWeekday = !['Sat', 'Sun'].includes(weekday);
  const afterOpen = hour > 9 || (hour === 9 && minute >= 30);
  const isOpen = isWeekday && afterOpen && hour < 16;
  return { isOpen, label: isOpen ? 'Market Open' : 'Market Closed' };
}

function RealDashboard() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const { openPositions, monthlyPnL } = usePositions();
  const { tickers } = useWatchlistContext();
  const { data: liveData, isLoading } = useWatchlistData(tickers);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void import('./Screener');
      void import('./WheelTracker');
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  const marketStatus = getMarketStatus();
  const expiringCount = openPositions.filter(p => {
    const dte = Math.ceil((new Date(p.expiry).getTime() - Date.now()) / 86400000);
    return dte >= 0 && dte <= 7;
  }).length;
  const totalPremium = openPositions.reduce((acc, p) => acc + p.premiumCollected, 0);

  const displayStocks: StockTicker[] = tickers.map((t, i) => {
    const live = liveData?.[i]?.stock;
    if (live) return live;
    return { ticker: t, name: t, price: 0, ivRank: 0, ivPercentile: 0, currentIV: 0, historicalVol: 0, trend: 'flat' as const };
  });

  const ivHistories: Record<string, IVDataPoint[]> = {};
  tickers.forEach((t, i) => { ivHistories[t] = liveData?.[i]?.ivHistory ?? []; });

  return (
    <div className="min-h-screen mesh-bg pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div
          className="mb-8"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'none' : 'translateY(16px)',
            transition: 'opacity 0.5s ease, transform 0.5s ease',
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(0,229,196,0.3), transparent)' }} />
            <span className="text-xs font-medium tracking-widest uppercase"
              style={{ color: 'var(--ph-text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
              Live Dashboard
            </span>
            <div className="w-2 h-2 rounded-full animate-pulse-glow" style={{ background: '#00e5c4' }} />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold"
                style={{ fontFamily: 'Syne, sans-serif', color: 'var(--ph-text-1)', letterSpacing: '-0.02em' }}>
                {getGreeting()}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <p className="text-sm" style={{ color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: marketStatus.isOpen ? 'rgba(0,214,143,0.12)' : 'rgba(74,106,138,0.15)',
                    color: marketStatus.isOpen ? '#00d68f' : '#6a8fb0',
                    fontFamily: 'DM Sans, sans-serif',
                  }}>
                  {marketStatus.label}
                </span>
                {expiringCount > 0 && (
                  <button
                    onClick={() => navigate('/wheel')}
                    className="text-xs px-2 py-0.5 rounded-full transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(255,77,109,0.12)', color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif', border: 'none', cursor: 'pointer' }}>
                    {expiringCount} expiring within 7d →
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => navigate('/screener')}
                className="text-xs px-3 py-2 rounded-xl transition-all hover:opacity-80"
                style={{ background: 'rgba(0,229,196,0.08)', color: '#00e5c4', border: '1px solid rgba(0,229,196,0.2)', fontFamily: 'DM Sans, sans-serif' }}>
                Screen for opportunities →
              </button>
              <button
                onClick={() => navigate('/wheel')}
                className="text-xs px-3 py-2 rounded-xl transition-all hover:opacity-80"
                style={{ background: 'rgba(0,229,196,0.05)', color: '#9ab4d4', border: '1px solid rgba(0,229,196,0.1)', fontFamily: 'DM Sans, sans-serif' }}>
                Log a trade →
              </button>
            </div>
          </div>
        </div>

        {/* Monthly Premium Income Chart */}
        <MonthlyPnLChart />

        {/* Monthly Income Target (compact) */}
        <MonthlyTargetCompact />

        {/* Watchlist Grid */}
        <div className="mb-6 flex items-center justify-between">
          <div
            style={{
              opacity: mounted ? 1 : 0,
              transition: 'opacity 0.5s ease 0.4s',
            }}
          >
            <h2 className="text-lg font-semibold"
              style={{ fontFamily: 'Syne, sans-serif', color: 'var(--ph-text-1)' }}>
              Watchlist
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>
              {tickers.length} tracked symbols{isLoading ? ' · Loading...' : ''}
            </p>
          </div>
          <button
            onClick={() => navigate('/watchlist')}
            className="text-xs px-3 py-1.5 rounded-lg transition-all duration-200 hover:opacity-80"
            style={{
              color: '#00e5c4',
              background: 'rgba(0, 229, 196, 0.08)',
              border: '1px solid rgba(0, 229, 196, 0.15)',
              fontFamily: 'DM Sans, sans-serif',
              opacity: mounted ? 1 : 0,
              transition: 'opacity 0.5s ease 0.45s',
            }}
          >
            Manage Watchlist →
          </button>
        </div>

        {/* Stock Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {displayStocks.map((stock, i) => (
            <StockCard
              key={stock.ticker}
              stock={stock}
              ivHistory={ivHistories[stock.ticker] ?? []}
              delay={420 + i * 80}
              onClick={() => navigate(`/stock/${stock.ticker}`)}
            />
          ))}
        </div>

        {/* Recent Activity / IV Heatmap Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* IV Rank Summary */}
          <IVRankPanel stocks={displayStocks} />

          {/* Quick Wheel Summary */}
          <WheelSummaryPanel
            openPositions={openPositions}
            monthlyPnL={monthlyPnL}
            totalPremium={totalPremium}
            onNavigate={() => navigate('/wheel')}
          />
        </div>
      </div>
    </div>
  );
}

// ——————————————————————————————————
// Stock Card Component
// ——————————————————————————————————
interface StockCardProps {
  stock: StockTicker;
  ivHistory: any[];
  delay: number;
  onClick: () => void;
}

function StockCard({ stock, ivHistory, delay, onClick }: StockCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const pct = stock.priceChangePct;
  const pctColor = pct != null ? (pct > 0 ? '#00d68f' : pct < 0 ? '#ff4d6d' : '#4a6a8a') : '#4a6a8a';
  const pctLabel = pct != null ? `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%` : '—';

  return (
    <div
      onClick={onClick}
      className="rounded-xl p-5 cursor-pointer group relative overflow-hidden"
      style={{
        background: 'var(--ph-surface-60)',
        border: '1px solid var(--ph-border-md)',
        backdropFilter: 'blur(12px)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms, border-color 0.2s ease, box-shadow 0.2s ease`,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = 'rgba(0, 229, 196, 0.25)';
        el.style.boxShadow = '0 8px 32px rgba(0, 229, 196, 0.06)';
        el.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = 'var(--ph-border-md)';
        el.style.boxShadow = 'none';
        el.style.transform = 'translateY(0)';
      }}
    >
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(0,229,196,0.4), transparent)' }} />

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-xl font-bold tracking-tight"
              style={{ fontFamily: 'Syne, sans-serif', color: 'var(--ph-text-1)' }}>
              {stock.ticker}
            </h3>
            <TrendArrow trend={stock.trend} />
          </div>
          <p className="text-xs" style={{ color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>
            {stock.name}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xl font-semibold tabular-nums"
            style={{ color: 'var(--ph-text-1)', fontFamily: 'JetBrains Mono, monospace' }}>
            ${stock.price.toFixed(2)}
          </p>
          <p
            className="text-xs font-medium"
            style={{ color: pctColor, fontFamily: 'JetBrains Mono, monospace' }}
          >
            {pctLabel}
          </p>
        </div>
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-3 sm:gap-4 mb-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>
            IV Rank
          </span>
          <IVBadge value={stock.ivRank} size="md" showBar />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>
            IV%ile
          </span>
          <span
            className="text-sm font-medium tabular-nums"
            style={{ color: 'var(--ph-text-2)', fontFamily: 'JetBrains Mono, monospace' }}
          >
            {stock.ivPercentile}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>
            IV
          </span>
          <span
            className="text-sm font-medium tabular-nums"
            style={{ color: 'var(--ph-text-2)', fontFamily: 'JetBrains Mono, monospace' }}
          >
            {stock.currentIV}%
          </span>
        </div>
        <div className="ml-auto">
          <IVLabel value={stock.ivRank} />
        </div>
      </div>

      {/* Sparkline */}
      <div className="rounded-lg overflow-hidden" style={{ background: 'var(--ph-overlay)' }}>
        <IVSparkline data={ivHistory || []} height={48} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs" style={{ color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>
          52-wk IV rank range
        </span>
        <span className="text-xs" style={{ color: '#00e5c4', fontFamily: 'DM Sans, sans-serif' }}>
          View Details →
        </span>
      </div>
    </div>
  );
}

// ——————————————————————————————————
// Trend Arrow
// ——————————————————————————————————
function TrendArrow({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return (
    <span className="text-sm" style={{ color: '#00d68f' }}>↑</span>
  );
  if (trend === 'down') return (
    <span className="text-sm" style={{ color: '#ff4d6d' }}>↓</span>
  );
  return <span className="text-sm" style={{ color: '#4a6a8a' }}>→</span>;
}

// ——————————————————————————————————
// IV Rank Panel
// ——————————————————————————————————
function IVRankPanel({ stocks }: { stocks: StockTicker[] }) {
  return (
    <div className="rounded-xl p-5"
      style={{
        background: 'var(--ph-surface-60)',
        border: '1px solid var(--ph-border-md)',
        backdropFilter: 'blur(12px)',
      }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--ph-text-1)' }}>
            IV Rank Overview
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>
            Current implied volatility environment
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {stocks.map((stock) => (
          <div key={stock.ticker} className="flex items-center gap-4">
            <span className="text-sm font-bold w-12"
              style={{ fontFamily: 'Syne, sans-serif', color: 'var(--ph-text-1)' }}>
              {stock.ticker}
            </span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${stock.ivRank}%`,
                  background: stock.ivRank >= 60
                    ? 'linear-gradient(90deg, #ff4d6d80, #ff4d6d)'
                    : stock.ivRank >= 30
                    ? 'linear-gradient(90deg, #f5c84280, #f5c842)'
                    : 'linear-gradient(90deg, #00d68f80, #00d68f)',
                  boxShadow: stock.ivRank >= 60
                    ? '0 0 8px rgba(255,77,109,0.4)'
                    : stock.ivRank >= 30
                    ? '0 0 8px rgba(245,200,66,0.4)'
                    : '0 0 8px rgba(0,214,143,0.4)',
                }}
              />
            </div>
            <div className="flex items-center gap-2 w-24 justify-end">
              <IVBadge value={stock.ivRank} size="sm" />
              <span className="text-xs" style={{ color: 'var(--ph-text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
                /100
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-5 pt-4" style={{ borderTop: '1px solid var(--ph-border-row)' }}>
        {[
          { label: 'Low < 30', color: '#00d68f' },
          { label: 'Med 30-60', color: '#f5c842' },
          { label: 'High > 60', color: '#ff4d6d' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-xs" style={{ color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ——————————————————————————————————
// Wheel Summary Panel
// ——————————————————————————————————
interface WheelSummaryPanelProps {
  openPositions: WheelPosition[];
  monthlyPnL: number;
  totalPremium: number;
  onNavigate: () => void;
}

function WheelSummaryPanel({ openPositions, monthlyPnL, totalPremium, onNavigate }: WheelSummaryPanelProps) {
  const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const preview = openPositions.slice(0, 3);

  return (
    <div className="rounded-xl p-5"
      style={{
        background: 'var(--ph-surface-60)',
        border: '1px solid var(--ph-border-md)',
        backdropFilter: 'blur(12px)',
      }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--ph-text-1)' }}>
            Wheel Positions
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>
            {openPositions.length} open · {month}
          </p>
        </div>
        <button onClick={onNavigate}
          className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
          style={{
            color: '#00e5c4', background: 'rgba(0,229,196,0.08)',
            border: '1px solid rgba(0,229,196,0.15)', fontFamily: 'DM Sans, sans-serif',
          }}>
          View All →
        </button>
      </div>

      {/* Mini position list */}
      <div className="space-y-2.5 mb-5">
        {preview.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>
            No open positions · Add one in the Wheel Tracker
          </p>
        ) : (
          preview.map((pos) => {
            const positionPnL = pos.premiumCollected - pos.currentPrice * pos.contracts;
            return (
              <div key={pos.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                style={{ background: 'var(--ph-overlay)' }}>
                <span className="font-bold text-sm w-12"
                  style={{ fontFamily: 'Syne, sans-serif', color: 'var(--ph-text-1)' }}>{pos.ticker}</span>
                <span className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    color: pos.strategy === 'CSP' ? '#00c6f5' : '#00e5c4',
                    background: pos.strategy === 'CSP' ? 'rgba(0,198,245,0.1)' : 'rgba(0,229,196,0.1)',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                  {pos.strategy}
                </span>
                <span className="text-xs ml-auto" style={{ color: 'var(--ph-text-2)', fontFamily: 'JetBrains Mono, monospace' }}>
                  ${pos.strike} · {pos.daysToExpiry}d
                </span>
                <span className="text-xs font-semibold"
                  style={{ color: positionPnL >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace' }}>
                  {positionPnL >= 0 ? '+' : '-'}${Math.abs(positionPnL).toFixed(0)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* P&L Summary */}
      <div className="grid grid-cols-2 gap-3 pt-4" style={{ borderTop: '1px solid var(--ph-border-row)' }}>
        <div className="rounded-lg p-3" style={{
          background: monthlyPnL >= 0 ? 'rgba(0,214,143,0.06)' : 'rgba(255,77,109,0.06)',
          border: monthlyPnL >= 0 ? '1px solid rgba(0,214,143,0.12)' : '1px solid rgba(255,77,109,0.12)',
        }}>
          <p className="text-xs mb-1" style={{ color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>Avg Monthly (realized)</p>
          <p className="text-lg font-bold" style={{ color: monthlyPnL >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace' }}>
            {monthlyPnL >= 0 ? '+' : '-'}${Math.abs(monthlyPnL).toFixed(0)}
          </p>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'rgba(0,229,196,0.06)', border: '1px solid rgba(0,229,196,0.12)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>Open Premium (locked)</p>
          <p className="text-lg font-bold" style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>
            ${totalPremium.toFixed(0)}
          </p>
        </div>
      </div>
    </div>
  );
}

