import { useEffect, useState } from 'react';
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
  return Math.max(0, Math.ceil((new Date(expiry + 'T12:00:00').getTime() - Date.now()) / 86_400_000));
}

export function PaperPortfolio() {
  const [mounted, setMounted] = useState(false);
  const { account } = usePaperAccount();
  const { positions: openPositions, allPositions } = usePaperPositions();

  useEffect(() => { setMounted(true); }, []);

  const closedPositions = allPositions.filter((p) => p.status !== 'open');
  const lockedCollateral = openPositions
    .filter((p) => p.strategy === 'CSP')
    .reduce((acc, p) => acc + p.strike * p.contracts * 100, 0);
  const totalPremiumOpen = openPositions.reduce((acc, p) => acc + p.premiumCollected * p.contracts * 100, 0);
  const totalAccountValue = account ? account.currentCash + lockedCollateral : 0;
  const totalReturn = account ? totalAccountValue - account.startingBalance : 0;
  const totalReturnPct = account && account.startingBalance > 0
    ? (totalReturn / account.startingBalance) * 100
    : 0;

  const winRate = account && account.tradesTotal > 0
    ? Math.round((account.tradesWon / account.tradesTotal) * 100)
    : null;

  const fadeIn = (delay = '0s') => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'none' : 'translateY(16px)',
    transition: `opacity 0.5s ease ${delay}, transform 0.5s ease ${delay}`,
  });

  return (
    <div className="min-h-screen mesh-bg pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8" style={fadeIn()}>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px w-20" style={{ background: `linear-gradient(90deg, ${A.amber}40, transparent)` }} />
            <span className="text-xs font-bold tracking-widest uppercase px-2 py-0.5 rounded"
              style={{ color: A.amber, background: A.amberBg, border: `1px solid ${A.amberBorder}`, fontFamily: 'JetBrains Mono, monospace' }}>
              PAPER MODE
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: 'Syne, sans-serif', color: A.text, letterSpacing: '-0.02em' }}>
            Paper Portfolio
          </h1>
          <p className="text-sm mt-1" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>
            Virtual account overview · no real money
          </p>
        </div>

        {/* Account breakdown */}
        <div className="grid sm:grid-cols-3 gap-4 mb-6" style={fadeIn('0.05s')}>
          {/* Account value */}
          <div className="sm:col-span-1 rounded-2xl p-5"
            style={{ background: A.amberBg, border: `1px solid ${A.amberBorder}`, backdropFilter: 'blur(12px)' }}>
            <p className="text-xs mb-1 tracking-widest uppercase" style={{ color: A.amber, fontFamily: 'DM Sans, sans-serif' }}>Total Account Value</p>
            <p className="text-3xl font-bold tabular-nums mb-1" style={{ fontFamily: 'JetBrains Mono, monospace', color: A.text }}>
              ${totalAccountValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-sm font-medium" style={{ color: totalReturn >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace' }}>
              {totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(0)} ({totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(1)}%)
            </p>
            <p className="text-xs mt-1" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>
              Started with ${account?.startingBalance.toLocaleString() ?? '100,000'}
            </p>
          </div>

          {/* Cash breakdown */}
          <div className="sm:col-span-2 rounded-2xl p-5"
            style={{ background: A.cardBg, border: `1px solid ${A.cardBorder}`, backdropFilter: 'blur(12px)' }}>
            <p className="text-xs mb-4 tracking-widest uppercase" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Cash Breakdown</p>
            <div className="space-y-3">
              {[
                { label: 'Available Cash', value: account?.currentCash ?? 0, color: '#00e5c4', note: 'Free to deploy' },
                { label: 'CSP Collateral', value: lockedCollateral, color: A.amber, note: 'Locked until expiry/close' },
                { label: 'Open Premium Value', value: totalPremiumOpen, color: '#9ab4d4', note: 'Unrealized (at cost)' },
              ].map(({ label, value, color, note }) => {
                const pct = totalAccountValue > 0 ? (value / totalAccountValue) * 100 : 0;
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="text-sm font-medium" style={{ color: A.text, fontFamily: 'DM Sans, sans-serif' }}>{label}</span>
                        <span className="text-xs ml-2" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>{note}</span>
                      </div>
                      <span className="font-semibold tabular-nums" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>
                        ${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, pct)}%`, background: color, opacity: 0.7 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Performance stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6" style={fadeIn('0.1s')}>
          {[
            { label: 'Realized P&L', value: account ? `${account.totalRealizedPnl >= 0 ? '+' : ''}$${account.totalRealizedPnl.toFixed(0)}` : '—', color: account && account.totalRealizedPnl >= 0 ? '#00d68f' : '#ff4d6d' },
            { label: 'Premium Collected', value: account ? `$${account.totalPremiumCollected.toFixed(0)}` : '—', color: A.amber },
            { label: 'Win Rate', value: winRate !== null ? `${winRate}%` : '—', color: A.amber },
            { label: 'Total Trades', value: account ? String(account.tradesTotal) : '0', color: A.text },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-4"
              style={{ background: A.cardBg, border: `1px solid ${A.cardBorder}`, backdropFilter: 'blur(12px)' }}>
              <p className="text-xs mb-2" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>{label}</p>
              <p className="text-xl font-bold tabular-nums" style={{ fontFamily: 'JetBrains Mono, monospace', color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Open positions table */}
        {openPositions.length > 0 && (
          <div className="rounded-2xl p-5 sm:p-6 mb-6"
            style={{ ...fadeIn('0.15s'), background: A.cardBg, border: `1px solid ${A.cardBorder}`, backdropFilter: 'blur(12px)' }}>
            <h2 className="text-base font-semibold mb-5" style={{ fontFamily: 'Syne, sans-serif', color: A.text }}>Open Paper Positions</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ fontFamily: 'DM Sans, sans-serif', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {['Ticker', 'Strategy', 'Strike', 'Expiry', 'DTE', 'Premium', 'Collateral'].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-medium tracking-widest uppercase first:pl-0"
                        style={{ color: A.muted, borderBottom: `1px solid ${A.amberBorder}` }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {openPositions.map((pos, i) => {
                    const dte = getDTE(pos.expiry);
                    const totalPremium = pos.premiumCollected * pos.contracts * 100;
                    const collateral = pos.strategy === 'CSP' ? pos.strike * pos.contracts * 100 : 0;
                    return (
                      <tr key={pos.id} style={{ borderBottom: i < openPositions.length - 1 ? `1px solid rgba(245,200,66,0.06)` : 'none' }}>
                        <td className="py-3 px-4 first:pl-0">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-sm" style={{ color: A.text, fontFamily: 'Syne, sans-serif' }}>{pos.ticker}</span>
                            <span className="text-xs" style={{ color: A.muted }}>{pos.contracts}x</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs px-2 py-0.5 rounded font-semibold"
                            style={{ color: A.amber, background: A.amberBg, border: `1px solid ${A.amberBorder}`, fontFamily: 'JetBrains Mono, monospace' }}>
                            {pos.strategy}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span style={{ color: A.text, fontFamily: 'JetBrains Mono, monospace' }}>${pos.strike}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>{pos.expiry}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span style={{ color: dte <= 7 ? '#ff4d6d' : dte <= 21 ? A.amber : '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>
                            {dte}d
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span style={{ color: A.amber, fontFamily: 'JetBrains Mono, monospace' }}>${totalPremium.toFixed(0)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span style={{ color: collateral > 0 ? '#ff6b8a' : A.muted, fontFamily: 'JetBrains Mono, monospace' }}>
                            {collateral > 0 ? `$${collateral.toLocaleString()}` : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Trade history */}
        {closedPositions.length > 0 && (
          <div className="rounded-2xl p-5 sm:p-6"
            style={{ ...fadeIn('0.2s'), background: A.cardBg, border: `1px solid ${A.cardBorder}`, backdropFilter: 'blur(12px)' }}>
            <h2 className="text-base font-semibold mb-5" style={{ fontFamily: 'Syne, sans-serif', color: A.text }}>Trade History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ fontFamily: 'DM Sans, sans-serif', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {['Ticker', 'Strategy', 'Strike', 'Opened', 'Status', 'P&L'].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-medium tracking-widest uppercase first:pl-0"
                        style={{ color: A.muted, borderBottom: `1px solid ${A.amberBorder}` }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {closedPositions.map((pos, i) => {
                    const pnl = pos.realizedPnl ?? 0;
                    const statusColors: Record<string, string> = { closed: '#00e5c4', expired: '#00d68f', assigned: '#9ab4d4' };
                    return (
                      <tr key={pos.id} style={{ borderBottom: i < closedPositions.length - 1 ? `1px solid rgba(245,200,66,0.04)` : 'none' }}>
                        <td className="py-2.5 px-4 first:pl-0">
                          <span className="font-semibold" style={{ color: A.text, fontFamily: 'Syne, sans-serif' }}>{pos.ticker}</span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: A.amber, background: A.amberBg, fontFamily: 'JetBrains Mono, monospace' }}>
                            {pos.strategy}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>${pos.strike}</span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span style={{ color: A.muted, fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>{pos.openedAt}</span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="text-xs capitalize" style={{ color: statusColors[pos.status] ?? A.muted }}>
                            {pos.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="font-semibold" style={{ color: pnl >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace' }}>
                            {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!account && (
          <div className="rounded-2xl p-8 text-center" style={{ background: A.amberBg, border: `1px solid ${A.amberBorder}` }}>
            <p className="text-sm" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Enable paper mode to see your virtual portfolio</p>
          </div>
        )}
      </div>
    </div>
  );
}
