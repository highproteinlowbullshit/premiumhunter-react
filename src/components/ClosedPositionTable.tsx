import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { WheelPosition } from '../types';

const PAGE_SIZE = 20;

interface ClosedPositionTableProps {
  positions: WheelPosition[];
  onEdit?: (position: WheelPosition) => void;
  onRemove?: (position: WheelPosition) => void;
}

function computeRealPnl(pos: WheelPosition) {
  // Assigned/expired: full premium kept, no buyback cost
  const closeCost =
    pos.status === 'assigned' || pos.status === 'expired'
      ? 0
      : pos.currentPrice * pos.contracts;
  const realPnl = pos.premiumCollected - closeCost;
  const capitalAtRisk = pos.strike * pos.contracts * 100;
  const returnPct = capitalAtRisk > 0 ? (realPnl / capitalAtRisk) * 100 : 0;
  return { realPnl, closeCost, returnPct };
}

export function ClosedPositionTable({ positions, onEdit, onRemove }: ClosedPositionTableProps) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [positions]);

  const totalPages = Math.max(1, Math.ceil(positions.length / PAGE_SIZE));
  const paged = positions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!positions.length) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3">
        <div className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,229,196,0.06)', border: '1px solid rgba(0,229,196,0.1)' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="#00e5c4" strokeWidth="1.5" strokeOpacity="0.4" />
            <path d="M6 10l3 3 5-5" stroke="#00e5c4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.4" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          No closed positions yet
        </p>
      </div>
    );
  }

  const hasActions = onEdit || onRemove;

  return (
    <>
      {/* ── Mobile card layout ── */}
      <div className="sm:hidden space-y-3">
        {paged.map((pos) => {
          const { realPnl, returnPct } = computeRealPnl(pos);
          const pnlColor = realPnl >= 0 ? '#00d68f' : '#ff4d6d';
          const isAssigned = pos.status === 'assigned';
          const isExpired = pos.status === 'expired';

          return (
            <div key={pos.id} className="rounded-xl p-4"
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(0,229,196,0.08)' }}>
              {/* Row 1: ticker + strategy + status */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base font-bold"
                  style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
                  {pos.ticker}
                </span>
                <span className="text-xs px-2 py-0.5 rounded font-semibold"
                  style={{
                    color: pos.strategy === 'CSP' ? '#00c6f5' : '#00e5c4',
                    background: pos.strategy === 'CSP' ? 'rgba(0,198,245,0.1)' : 'rgba(0,229,196,0.1)',
                    border: `1px solid ${pos.strategy === 'CSP' ? 'rgba(0,198,245,0.2)' : 'rgba(0,229,196,0.2)'}`,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                  {pos.strategy}
                </span>
                <span className="text-xs font-semibold"
                  style={{ color: '#c8daf0', fontFamily: 'JetBrains Mono, monospace' }}>
                  {pos.contracts}×
                </span>
                {isAssigned && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ color: '#f5c842', background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.2)', fontFamily: 'JetBrains Mono, monospace' }}>
                    ASSIGNED
                  </span>
                )}
                {isExpired && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ color: '#00d68f', background: 'rgba(0,214,143,0.08)', border: '1px solid rgba(0,214,143,0.2)', fontFamily: 'JetBrains Mono, monospace' }}>
                    EXPIRED
                  </span>
                )}
              </div>

              {/* Row 2: metrics */}
              <div className="grid grid-cols-4 gap-2 mb-2">
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Strike</p>
                  <p className="text-sm font-medium" style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
                    ${pos.strike}
                  </p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Premium</p>
                  <p className="text-sm font-medium" style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>
                    ${pos.premiumCollected.toFixed(0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Real P&L</p>
                  <p className="text-sm font-semibold" style={{ color: pnlColor, fontFamily: 'JetBrains Mono, monospace' }}>
                    {realPnl >= 0 ? '+' : ''}${realPnl.toFixed(0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Return</p>
                  <p className="text-sm font-semibold" style={{ color: pnlColor, fontFamily: 'JetBrains Mono, monospace' }}>
                    {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}%
                  </p>
                </div>
              </div>

              <p className="text-xs" style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace' }}>
                Expired {pos.expiry}{pos.closedAt ? ` · Closed ${pos.closedAt}` : ''}
              </p>

              {hasActions && (
                <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(0,229,196,0.07)' }}>
                  {onEdit && (
                    <button onClick={() => onEdit(pos)}
                      style={{ flex: 1, background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.15)', borderRadius: 7, color: '#f5c842', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600, padding: '8px 0', cursor: 'pointer' }}>
                      Edit
                    </button>
                  )}
                  {onRemove && (
                    <button onClick={() => onRemove(pos)}
                      style={{ flex: 1, background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.15)', borderRadius: 7, color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600, padding: '8px 0', cursor: 'pointer' }}>
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Desktop table layout ── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm" style={{ fontFamily: 'DM Sans, sans-serif', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              {[
                'Ticker', 'Strategy', 'Strike', 'Expiry', 'Premium', 'Close Cost', 'Real P&L', 'Return', 'Closed',
                ...(hasActions ? [''] : []),
              ].map((h, i) => (
                <th
                  key={h}
                  className={`text-left py-3 text-xs font-medium tracking-widest uppercase last:pr-0 ${i === 0 ? 'pl-5 pr-4' : 'px-4'}`}
                  style={{ color: '#4a6a8a', borderBottom: '1px solid rgba(0, 229, 196, 0.08)', letterSpacing: '0.08em' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((pos, i) => {
              const { realPnl, closeCost, returnPct } = computeRealPnl(pos);
              const pnlColor = realPnl >= 0 ? '#00d68f' : '#ff4d6d';
              const isAssigned = pos.status === 'assigned';
              const isExpired = pos.status === 'expired';

              return (
                <tr
                  key={pos.id}
                  className="stock-row-hover group"
                  style={{ borderBottom: i < paged.length - 1 ? '1px solid rgba(0, 229, 196, 0.06)' : 'none' }}
                >
                  {/* Ticker */}
                  <td className="py-3.5 pl-5 pr-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-sm tracking-wide"
                        style={{ color: '#e8f0fe', fontFamily: 'Syne, sans-serif' }}>
                        {pos.ticker}
                      </span>
                      <span className="text-xs" style={{ color: '#4a6a8a' }}>{pos.contracts}×</span>
                    </div>
                  </td>

                  {/* Strategy + assigned badge */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                        style={{
                          color: pos.strategy === 'CSP' ? '#00c6f5' : '#00e5c4',
                          background: pos.strategy === 'CSP' ? 'rgba(0,198,245,0.1)' : 'rgba(0,229,196,0.1)',
                          border: `1px solid ${pos.strategy === 'CSP' ? 'rgba(0,198,245,0.2)' : 'rgba(0,229,196,0.2)'}`,
                          fontFamily: 'JetBrains Mono, monospace',
                        }}>
                        {pos.strategy}
                      </span>
                      {isAssigned && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{ color: '#f5c842', background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.2)', fontFamily: 'JetBrains Mono, monospace' }}>
                          ASSIGNED
                        </span>
                      )}
                      {isExpired && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{ color: '#00d68f', background: 'rgba(0,214,143,0.06)', border: '1px solid rgba(0,214,143,0.2)', fontFamily: 'JetBrains Mono, monospace' }}>
                          EXPIRED
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Strike */}
                  <td className="py-3.5 px-4">
                    <span style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
                      ${pos.strike}
                    </span>
                  </td>

                  {/* Expiry */}
                  <td className="py-3.5 px-4">
                    <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                      {pos.expiry}
                    </span>
                  </td>

                  {/* Premium collected */}
                  <td className="py-3.5 px-4">
                    <span className="font-medium" style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>
                      +${pos.premiumCollected.toFixed(0)}
                    </span>
                  </td>

                  {/* Cost to close */}
                  <td className="py-3.5 px-4">
                    <span style={{ color: closeCost > 0 ? '#ff4d6d' : '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                      {closeCost > 0 ? `-$${closeCost.toFixed(0)}` : '—'}
                    </span>
                  </td>

                  {/* Real P&L — most prominent column */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold tabular-nums"
                        style={{ color: pnlColor, fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
                        {realPnl >= 0 ? '+' : ''}${realPnl.toFixed(0)}
                      </span>
                      {/* mini P&L bar */}
                      <div className="w-14 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.abs(returnPct) * 5)}%`,
                            background: pnlColor,
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Return % */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold" style={{ color: pnlColor, fontFamily: 'JetBrains Mono, monospace' }}>
                        {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}%
                      </span>
                      <span className="text-xs" style={{ color: '#4a6a8a' }}>
                        on ${(pos.strike * pos.contracts * 100 / 1000).toFixed(0)}k
                      </span>
                    </div>
                  </td>

                  {/* Closed date */}
                  <td className="py-3.5 px-4">
                    <span style={{ color: '#6a8aaa', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                      {pos.closedAt ?? '—'}
                    </span>
                  </td>

                  {/* Actions */}
                  {hasActions && (
                    <td className="py-3.5 px-4 last:pr-0">
                      <div className="flex items-center gap-1.5">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(pos)}
                            style={{ background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.15)', borderRadius: 5, color: '#f5c842', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            Edit
                          </button>
                        )}
                        {onRemove && (
                          <button
                            onClick={() => onRemove(pos)}
                            style={{ background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.15)', borderRadius: 5, color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination controls ── */}
      {positions.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-4 mt-2"
          style={{ borderTop: '1px solid rgba(0,229,196,0.07)' }}>
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="flex items-center gap-1"
            style={{
              background: page === 1 ? 'rgba(255,255,255,0.03)' : 'rgba(0,229,196,0.06)',
              border: `1px solid ${page === 1 ? 'rgba(255,255,255,0.06)' : 'rgba(0,229,196,0.15)'}`,
              borderRadius: 7,
              color: page === 1 ? '#2a4a6a' : '#00e5c4',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 12,
              fontWeight: 600,
              padding: '6px 12px',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <ChevronLeft size={14} />
            Prev
          </button>

          <span style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
            <span style={{ color: '#c8daf0' }}>{page}</span>
            {' / '}
            {totalPages}
            <span style={{ color: '#2a4a6a', marginLeft: 8, fontSize: 11 }}>
              ({positions.length} total)
            </span>
          </span>

          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-1"
            style={{
              background: page === totalPages ? 'rgba(255,255,255,0.03)' : 'rgba(0,229,196,0.06)',
              border: `1px solid ${page === totalPages ? 'rgba(255,255,255,0.06)' : 'rgba(0,229,196,0.15)'}`,
              borderRadius: 7,
              color: page === totalPages ? '#2a4a6a' : '#00e5c4',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 12,
              fontWeight: 600,
              padding: '6px 12px',
              cursor: page === totalPages ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </>
  );
}
