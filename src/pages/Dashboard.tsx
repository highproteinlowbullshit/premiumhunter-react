import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { usePageTitle } from '../hooks/usePageTitle';
import { IVBadge, IVLabel } from '../components/IVBadge';
import { IVSparkline } from '../components/IVChart';
import { useWatchlistContext } from '../context/WatchlistContext';
import { useWatchlistData } from '../hooks/useMarketData';
import { usePaperMode } from '../context/PaperModeContext';
import { PaperDashboard } from './PaperDashboard';
import { MonthlyPnLChart } from '../components/MonthlyPnLChart';
import { MonthlyTargetCompact } from '../components/MonthlyTargetTracker';
import { useDashboardIntelligence } from '../hooks/useDashboardIntelligence';
import { DashboardCommandCentre } from '../components/DashboardCommandCentre';
import { PortfolioGreeksDashboard } from '../components/PortfolioGreeksDashboard';
import { usePortfolioGreeks } from '../hooks/usePortfolioGreeks';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import type { StockTicker, IVDataPoint } from '../types';
import { FeatureGate } from '../components/FeatureGate';
import { useSubscription } from '../hooks/useSubscription';

export function Dashboard() {
  usePageTitle('Dashboard');
  const { isPaperMode } = usePaperMode();
  if (isPaperMode) return <PaperDashboard />;
  return <RealDashboard />;
}


function FreeDashboardBanner() {
  const navigate = useNavigate();
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

function RealDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isFree } = useSubscription();
  const [mounted, setMounted] = useState(false);
  const { tickers } = useWatchlistContext();
  const { data: liveData, isLoading } = useWatchlistData(tickers);
  const { data: intelligence, isLoading: intelligenceLoading } = useDashboardIntelligence();
  const { greeks, isLoading: greeksLoading } = usePortfolioGreeks();

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-intelligence'] }),
      queryClient.invalidateQueries({ queryKey: ['open-positions-for-greeks'] }),
      queryClient.invalidateQueries({ queryKey: ['portfolio-greeks'] }),
    ]);
  }, [queryClient]);

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

  const displayStocks: StockTicker[] = tickers.map((t, i) => {
    const live = liveData?.[i]?.stock;
    if (live) return live;
    return { ticker: t, name: t, price: 0, ivRank: 0, ivPercentile: 0, currentIV: 0, historicalVol: 0, trend: 'flat' as const };
  });

  const ivHistories: Record<string, IVDataPoint[]> = {};
  tickers.forEach((t, i) => { ivHistories[t] = liveData?.[i]?.ivHistory ?? []; });

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="min-h-screen mesh-bg pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">

        {isFree && <FreeDashboardBanner />}

        {/* Morning Command Centre */}
        <FeatureGate feature="dashboard" blurHeight={180}>
          <DashboardCommandCentre
            data={intelligence ?? null}
            isLoading={intelligenceLoading}
          />
        </FeatureGate>

        {/* Portfolio Greeks */}
        <FeatureGate feature="dashboard_greeks" blurHeight={220}>
          <PortfolioGreeksDashboard greeks={greeks} isLoading={greeksLoading} />
        </FeatureGate>

        {/* Monthly Premium Income Chart */}
        <FeatureGate feature="dashboard_monthly_chart" blurHeight={280}>
          <MonthlyPnLChart />
        </FeatureGate>

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
              isLoading={isLoading}
            />
          ))}
        </div>

        {/* IV Rank Summary */}
        <IVRankPanel stocks={displayStocks} />
      </div>
    </div>
    </PullToRefresh>
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
  isLoading?: boolean;
}

function StockCard({ stock, ivHistory, delay, onClick, isLoading }: StockCardProps) {
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
            {isLoading && stock.price === 0 ? '—' : `$${stock.price.toFixed(2)}`}
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

