import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePaperAccount, usePaperPositions } from '../hooks/usePaperTrading';

const A = {
  amber: '#f5c842',
  amberBg: 'rgba(245,200,66,0.08)',
  amberBorder: 'rgba(245,200,66,0.2)',
  cardBg: 'rgba(13,27,53,0.6)',
  cardBorder: 'rgba(0,229,196,0.1)',
  text: '#e8f0fe',
  muted: '#4a6a8a',
};

function getDTE(expiry: string): number {
  return Math.max(0, Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000));
}

export function PaperDashboard() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const { account } = usePaperAccount();
  const { positions: openPositions, allPositions } = usePaperPositions();

  useEffect(() => { setMounted(true); }, []);

  const closedPositions = allPositions.filter((p) => p.status !== 'open');
  const winRate = account && account.tradesTotal > 0
    ? Math.round((account.tradesWon / account.tradesTotal) * 100)
    : null;
  const lockedCollateral = openPositions
    .filter((p) => p.strategy === 'CSP')
    .reduce((acc, p) => acc + p.strike * p.contracts * 100, 0);
  const totalAccountValue = account ? account.currentCash + lockedCollateral : 0;
  const totalReturn = account ? totalAccountValue - account.startingBalance : 0;
  const totalReturnPct = account && account.startingBalance > 0
    ? (totalReturn / account.startingBalance) * 100
    : 0;

  const fadeIn = (delay = '0s') => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'none' : 'translateY(16px)',
    transition: `opacity 0.5s ease ${delay}, transform 0.5s ease ${delay}`,
  });

  const stats = [
    {
      label: 'Account Value',
      value: `$${totalAccountValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      sub: account ? `${totalReturn >= 0 ? '+' : ''}$${totalReturn.toFixed(0)} from start` : '—',
      color: A.amber,
    },
    {
      label: 'Available Cash',
      value: account ? `$${account.currentCash.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—',
      sub: lockedCollateral > 0 ? `$${lockedCollateral.toLocaleString()} locked` : 'No collateral locked',
      color: A.text,
    },
    {
      label: 'Realized P&L',
      value: account ? `${account.totalRealizedPnl >= 0 ? '+' : ''}$${account.totalRealizedPnl.toFixed(0)}` : '—',
      sub: account ? `${account.tradesWon}W / ${account.tradesTotal - account.tradesWon}L` : '—',
      color: account && account.totalRealizedPnl >= 0 ? '#00d68f' : '#ff4d6d',
    },
    {
      label: 'Win Rate',
      value: winRate !== null ? `${winRate}%` : '—',
      sub: account ? `${account.tradesTotal} total trades` : '0 trades',
      color: A.amber,
    },
    {
      label: 'Total Return',
      value: `${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(1)}%`,
      sub: 'Since account start',
      color: totalReturnPct >= 0 ? '#00d68f' : '#ff4d6d',
    },
  ];

  return (
    <div className="min-h-screen mesh-bg pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8" style={fadeIn()}>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${A.amber}40, transparent)` }} />
            <span className="text-xs font-bold tracking-widest uppercase px-2 py-0.5 rounded"
              style={{ color: A.amber, background: A.amberBg, border: `1px solid ${A.amberBorder}`, fontFamily: 'JetBrains Mono, monospace' }}>
              PAPER MODE
            </span>
            <div className="w-2 h-2 rounded-full" style={{ background: A.amber, boxShadow: `0 0 8px ${A.amber}` }} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: 'Syne, sans-serif', color: A.text, letterSpacing: '-0.02em' }}>
            Paper Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>
            Virtual trading simulation · no real money at risk
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8" style={fadeIn('0.1s')}>
          {stats.map(({ label, value, sub, color }) => (
            <div key={label} className="rounded-xl p-4"
              style={{ background: A.cardBg, border: `1px solid ${A.cardBorder}`, backdropFilter: 'blur(12px)' }}>
              <p className="text-xs mb-2 tracking-wide" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>{label}</p>
              <p className="text-xl font-bold tabular-nums mb-1" style={{ fontFamily: 'JetBrains Mono, monospace', color }}>{value}</p>
              <p className="text-xs" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* Open positions quick view */}
        <div className="grid sm:grid-cols-2 gap-6" style={fadeIn('0.15s')}>
          <div className="rounded-2xl p-5" style={{ background: A.cardBg, border: `1px solid ${A.cardBorder}`, backdropFilter: 'blur(12px)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ fontFamily: 'Syne, sans-serif', color: A.text }}>
                Open Positions
              </h2>
              <button onClick={() => navigate('/wheel')}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: A.amber, background: A.amberBg, border: `1px solid ${A.amberBorder}`, fontFamily: 'DM Sans, sans-serif' }}>
                View all →
              </button>
            </div>
            {openPositions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>No open paper positions</p>
                <button onClick={() => navigate('/wheel')}
                  className="mt-3 text-xs px-3 py-1.5 rounded-lg"
                  style={{ color: '#1a1200', background: 'linear-gradient(135deg, #f5c842, #f59e0b)', fontFamily: 'DM Sans, sans-serif' }}>
                  Open Paper Trade
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {openPositions.slice(0, 5).map((pos) => {
                  const dte = getDTE(pos.expiry);
                  const totalPremium = pos.premiumCollected * pos.contracts * 100;
                  return (
                    <div key={pos.id} className="flex items-center justify-between py-2"
                      style={{ borderBottom: '1px solid rgba(245,200,66,0.06)' }}>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm" style={{ color: A.text, fontFamily: 'Syne, sans-serif' }}>{pos.ticker}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded"
                          style={{ color: A.amber, background: A.amberBg, fontFamily: 'JetBrains Mono, monospace' }}>
                          {pos.strategy}
                        </span>
                        <span className="text-xs" style={{ color: A.muted }}>${pos.strike}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium" style={{ color: A.amber, fontFamily: 'JetBrains Mono, monospace' }}>
                          ${totalPremium.toFixed(0)}
                        </span>
                        <span className="text-xs" style={{ color: dte <= 7 ? '#ff4d6d' : A.muted, fontFamily: 'JetBrains Mono, monospace' }}>
                          {dte}d
                        </span>
                      </div>
                    </div>
                  );
                })}
                {openPositions.length > 5 && (
                  <p className="text-xs pt-1" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>
                    +{openPositions.length - 5} more positions
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Recent history */}
          <div className="rounded-2xl p-5" style={{ background: A.cardBg, border: `1px solid ${A.cardBorder}`, backdropFilter: 'blur(12px)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ fontFamily: 'Syne, sans-serif', color: A.text }}>
                Recent Trades
              </h2>
              <span className="text-xs" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>
                {closedPositions.length} closed
              </span>
            </div>
            {closedPositions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>No closed trades yet</p>
                <p className="text-xs mt-1" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>
                  Close or expire positions to see trade history
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {closedPositions.slice(0, 5).map((pos) => {
                  const pnl = pos.realizedPnl ?? 0;
                  const statusColors: Record<string, string> = { closed: '#00e5c4', expired: '#00d68f', assigned: '#9ab4d4' };
                  return (
                    <div key={pos.id} className="flex items-center justify-between py-2"
                      style={{ borderBottom: '1px solid rgba(245,200,66,0.06)' }}>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm" style={{ color: A.text, fontFamily: 'Syne, sans-serif' }}>{pos.ticker}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded"
                          style={{ color: A.amber, background: A.amberBg, fontFamily: 'JetBrains Mono, monospace' }}>
                          {pos.strategy}
                        </span>
                        <span className="text-xs" style={{ color: statusColors[pos.status] ?? A.muted }}>
                          {pos.status}
                        </span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums"
                        style={{ color: pnl >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace' }}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Performance tip */}
        {account && account.tradesTotal === 0 && (
          <div className="mt-6 rounded-2xl p-5" style={fadeIn('0.2s')}>
            <div className="rounded-xl p-5" style={{ background: A.amberBg, border: `1px solid ${A.amberBorder}` }}>
              <p className="text-sm font-semibold mb-1" style={{ color: A.amber, fontFamily: 'DM Sans, sans-serif' }}>
                Ready to start?
              </p>
              <p className="text-xs leading-relaxed mb-4" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif' }}>
                Head to the <strong style={{ color: A.text }}>Paper Wheel Tracker</strong> to open your first virtual trade.
                You have <strong style={{ color: A.amber }}>${account.currentCash.toLocaleString()} in virtual cash</strong> to practice with.
                No real money at risk.
              </p>
              <button onClick={() => navigate('/wheel')}
                className="px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #f5c842, #f59e0b)', color: '#1a1200', fontFamily: 'DM Sans, sans-serif' }}>
                Open Paper Trade →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
