import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { IVChart } from '../components/IVChart';
import { IVBadge } from '../components/IVBadge';
import { useStockDetailData } from '../hooks/useMarketData';
import { usePageTitle } from '../hooks/usePageTitle';
import { TrendingUp, Minus } from 'lucide-react';
import { FeatureGate } from '../components/FeatureGate';

export function StockDetail() {
  const { ticker = '' } = useParams<{ ticker: string }>();
  usePageTitle(ticker ? ticker.toUpperCase() : '');
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [mounted, setMounted] = useState(false);
  const { data, isLoading } = useStockDetailData(ticker);
  const stock = data?.stock ?? null;
  const ivHistory = data?.ivHistory ?? [];

  useEffect(() => {
    if (!isLoading) setMounted(true);
  }, [isLoading]);

  if (isLoading) return <LoadingState />;
  if (!stock) return <NotFoundState ticker={ticker} onBack={() => navigate(-1)} />;

  const isUp = stock.trend === 'up';
  const isDown = stock.trend === 'down';
  const pct = stock.priceChangePct;
  const pctLabel = pct != null ? `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%` : null;
  const earningsDaysAway = stock.earningsDate
    ? Math.ceil((new Date(stock.earningsDate + 'T12:00:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="min-h-screen mesh-bg pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm mb-6 transition-colors hover:text-[#e8f0fe]"
          style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {from === 'screener' ? 'Back to Screener' : from === 'watchlist' ? 'Back to Watchlist' : 'Back'}
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between mb-8"
          style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.5s ease' }}>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-4xl sm:text-5xl font-bold"
                style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe', letterSpacing: '-0.03em' }}>
                {stock.ticker}
              </h1>
              <span className="text-2xl" style={{ color: isUp ? '#00d68f' : isDown ? '#ff4d6d' : '#4a6a8a' }}>
                {isUp ? '↑' : isDown ? '↓' : '→'}
              </span>
              {earningsDaysAway !== null && earningsDaysAway > 0 && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{
                    background: earningsDaysAway < 14 ? 'rgba(245,200,66,0.12)' : 'rgba(0,198,245,0.1)',
                    border: earningsDaysAway < 14 ? '1px solid rgba(245,200,66,0.25)' : '1px solid rgba(0,198,245,0.2)',
                    color: earningsDaysAway < 14 ? '#f5c842' : '#00c6f5',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                  ER in {earningsDaysAway}d
                </span>
              )}
            </div>
            <p className="text-base" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
              {stock.name}
            </p>
          </div>

          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums"
              style={{ fontFamily: 'JetBrains Mono, monospace', color: '#e8f0fe' }}>
              {stock.price > 0 ? `$${stock.price.toFixed(2)}` : '—'}
            </p>
            {pctLabel && (
              <p className="text-sm font-medium mt-0.5"
                style={{
                  color: isUp ? '#00d68f' : isDown ? '#ff4d6d' : '#4a6a8a',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                {pctLabel}
              </p>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
          style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.5s ease 0.1s' }}>
          {[
            { label: 'IV Rank', value: stock.ivRank, suffix: '/100', badge: true },
            { label: 'IV Percentile', value: stock.ivPercentile, suffix: 'th', badge: false },
            { label: 'Current IV', value: `${stock.currentIV}%`, suffix: '', badge: false },
            { label: 'Hist. Vol', value: `${stock.historicalVol}%`, suffix: '', badge: false },
          ].map(({ label, value, suffix, badge }) => (
            <div key={label} className="rounded-xl p-4"
              style={{
                background: 'rgba(13,27,53,0.6)',
                border: '1px solid rgba(0,229,196,0.1)',
                backdropFilter: 'blur(12px)',
              }}>
              <p className="text-xs mb-2" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.06em' }}>
                {label}
              </p>
              {badge ? (
                <IVBadge value={value as number} size="lg" showBar />
              ) : (
                <p className="text-xl font-bold tabular-nums"
                  style={{ fontFamily: 'JetBrains Mono, monospace', color: '#e8f0fe' }}>
                  {value}{suffix}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* IV History Chart */}
        <FeatureGate feature="screener" blurHeight={280}>
          <div className="rounded-2xl p-5 mb-6"
            style={{
              background: 'rgba(13,27,53,0.6)',
              border: '1px solid rgba(0,229,196,0.1)',
              backdropFilter: 'blur(12px)',
              opacity: mounted ? 1 : 0,
              transition: 'opacity 0.5s ease 0.2s',
            }}>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-base font-semibold"
                  style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
                  IV Rank History
                </h2>
                <p className="text-xs mt-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
                  52-week implied volatility rank
                </p>
              </div>
              <div className="flex items-center gap-3">
                {[
                  { label: 'Low', color: '#00d68f' },
                  { label: 'Med', color: '#f5c842' },
                  { label: 'High', color: '#ff4d6d' },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-xs" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="sm:hidden"><IVChart data={ivHistory || []} height={200} /></div>
            <div className="hidden sm:block"><IVChart data={ivHistory || []} height={300} /></div>
          </div>
        </FeatureGate>

        {/* Earnings + Strategy suggestion */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.5s ease 0.3s' }}>
          {/* Earnings info — only show if earnings are in the future */}
          {stock.earningsDate && earningsDaysAway !== null && earningsDaysAway > 0 && (
            <div className="rounded-xl p-5"
              style={{
                background: 'rgba(13,27,53,0.6)',
                border: '1px solid rgba(0,229,196,0.1)',
                backdropFilter: 'blur(12px)',
              }}>
              <h3 className="text-sm font-semibold mb-3"
                style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
                Earnings
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.2)' }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="2" y="3" width="14" height="13" rx="2" stroke="#f5c842" strokeWidth="1.3" />
                    <line x1="6" y1="1" x2="6" y2="5" stroke="#f5c842" strokeWidth="1.3" strokeLinecap="round" />
                    <line x1="12" y1="1" x2="12" y2="5" stroke="#f5c842" strokeWidth="1.3" strokeLinecap="round" />
                    <line x1="2" y1="8" x2="16" y2="8" stroke="#f5c842" strokeWidth="1.3" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold"
                    style={{ fontFamily: 'JetBrains Mono, monospace', color: '#e8f0fe' }}>
                    {new Date(stock.earningsDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                  {earningsDaysAway !== null && (
                    <p className="text-xs mt-0.5"
                      style={{ color: earningsDaysAway < 14 ? '#f5c842' : '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
                      {earningsDaysAway} days away
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Strategy suggestion */}
          <div className="rounded-xl p-5"
            style={{
              background: 'rgba(13,27,53,0.6)',
              border: '1px solid rgba(0,229,196,0.1)',
              backdropFilter: 'blur(12px)',
            }}>
            <h3 className="text-sm font-semibold mb-3"
              style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
              Wheel Signal
            </h3>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: stock.ivRank >= 60 ? 'rgba(0,229,196,0.1)' : 'rgba(245,200,66,0.1)',
                  border: stock.ivRank >= 60 ? '1px solid rgba(0,229,196,0.2)' : '1px solid rgba(245,200,66,0.2)',
                }}>
                {stock.ivRank >= 60
                  ? <TrendingUp size={18} color="#00e5c4" strokeWidth={2} />
                  : <Minus size={18} color="#f5c842" strokeWidth={2} />
                }
              </div>
              <div>
                <p className="font-semibold text-sm"
                  style={{ fontFamily: 'DM Sans, sans-serif', color: '#e8f0fe' }}>
                  {stock.ivRank >= 60 ? 'Premium Selling Opportunity' : stock.ivRank >= 30 ? 'Moderate IV — Consider CSP' : 'Low IV — Avoid Selling'}
                </p>
                <p className="text-xs mt-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
                  IV Rank {stock.ivRank} — {stock.ivRank >= 60 ? 'High' : stock.ivRank >= 30 ? 'Moderate' : 'Low'} relative to 52-week range
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen mesh-bg pt-24 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(0,229,196,0.3)', borderTopColor: '#00e5c4' }} />
        <p className="text-sm" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          Loading data...
        </p>
      </div>
    </div>
  );
}

function NotFoundState({ ticker, onBack }: { ticker: string; onBack: () => void }) {
  return (
    <div className="min-h-screen mesh-bg pt-24 flex items-center justify-center">
      <div className="text-center">
        <p className="text-4xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
          {ticker} not found
        </p>
        <p className="text-sm mb-6" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          This ticker isn't in your watchlist yet
        </p>
        <button onClick={onBack} className="px-4 py-2 rounded-lg text-sm"
          style={{ background: 'rgba(0,229,196,0.1)', border: '1px solid rgba(0,229,196,0.2)', color: '#00e5c4', fontFamily: 'DM Sans, sans-serif' }}>
          ← Go Back
        </button>
      </div>
    </div>
  );
}
