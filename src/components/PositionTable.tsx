import { useState } from 'react';
import type { WheelPosition } from '../types';
import type { AssignmentProbabilityResult } from '../lib/blackScholes';
import { DTEIndicator } from './DTEIndicator';
import { AssignmentProbabilityGauge } from './AssignmentProbabilityGauge';

interface PositionTableProps {
  positions: WheelPosition[];
  livePrices?: Map<string, number>;
  probabilities?: Map<string, AssignmentProbabilityResult>;
  probabilitySummary?: {
    highRiskCount: number;
    watchCount: number;
    safeCount: number;
    avgProbability: number;
  };
  onRemove?: (position: WheelPosition) => void;
  onClose?: (position: WheelPosition) => void;
  onEdit?: (position: WheelPosition) => void;
  onAssign?: (position: WheelPosition) => void;
}

interface LivePnl {
  unrealizedPnl: number;
  pctMaxProfit: number;
  isItm: boolean;
  stockPrice: number;
}

function computeLivePnl(pos: WheelPosition, stockPrice: number): LivePnl {
  const intrinsicPerShare =
    pos.strategy === 'CSP'
      ? Math.max(0, pos.strike - stockPrice)
      : Math.max(0, stockPrice - pos.strike);
  const estimatedCostToClose = intrinsicPerShare * 100 * pos.contracts;
  const unrealizedPnl = pos.premiumCollected - estimatedCostToClose;
  const pctMaxProfit =
    pos.premiumCollected > 0
      ? Math.min(100, Math.max(0, (unrealizedPnl / pos.premiumCollected) * 100))
      : 0;
  const isItm = intrinsicPerShare > 0;
  return { unrealizedPnl, pctMaxProfit, isItm, stockPrice };
}

function getDTE(expiry: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(expiry);
  d.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((d.getTime() - today.getTime()) / 86400000));
}

type SortKey = 'expiry' | 'probability' | null;

function sortPositions(
  positions: WheelPosition[],
  sortKey: SortKey,
  probabilities?: Map<string, AssignmentProbabilityResult>,
): WheelPosition[] {
  const sorted = [...positions];
  if (sortKey === 'expiry') {
    sorted.sort((a, b) => a.expiry.localeCompare(b.expiry));
  } else if (sortKey === 'probability' && probabilities) {
    sorted.sort((a, b) => {
      const pa = probabilities.get(a.id)?.probability ?? -1;
      const pb = probabilities.get(b.id)?.probability ?? -1;
      return pb - pa;
    });
  } else {
    // Default: ITM floats to top, then sort by expiry
    sorted.sort((a, b) => {
      const ra = probabilities?.get(a.id);
      const rb = probabilities?.get(b.id);
      const aItm = ra?.status === 'itm' ? 0 : 1;
      const bItm = rb?.status === 'itm' ? 0 : 1;
      if (aItm !== bItm) return aItm - bItm;
      return a.expiry.localeCompare(b.expiry);
    });
  }
  return sorted;
}

function rowBorderStyle(pos: WheelPosition, probabilities?: Map<string, AssignmentProbabilityResult>): React.CSSProperties {
  const r = probabilities?.get(pos.id);
  const dte = getDTE(pos.expiry);
  if (dte <= 2) return { borderLeft: '3px solid #dc2626', background: 'rgba(220,38,38,0.05)' };
  if (r?.status === 'itm') return { borderLeft: '3px solid #ef4444', background: 'rgba(239,68,68,0.04)' };
  if (r?.status === 'near' && dte <= 7) return { borderLeft: '3px solid #f97316', background: 'rgba(249,115,22,0.03)' };
  return { borderLeft: '3px solid transparent' };
}

function ProbabilityDot({ result }: { result: AssignmentProbabilityResult | null }) {
  if (!result) return <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'inline-block' }} />;
  const colors: Record<string, string> = { safe: '#14b8a6', watch: '#f59e0b', near: '#f97316', itm: '#ef4444' };
  return (
    <span
      title={`${result.probability}% — ${result.label}`}
      style={{
        width: 10, height: 10, borderRadius: '50%',
        background: colors[result.status] ?? '#9ab4d4',
        display: 'inline-block', flexShrink: 0,
      }}
    />
  );
}

function SortHeader({ label, current, sortKey, onSort }: {
  label: string; current: SortKey; sortKey: SortKey; onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <button
      onClick={() => onSort(active ? null : sortKey)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        color: active ? '#00e5c4' : '#4a6a8a',
        fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      {label}
      <span style={{ fontSize: 9, opacity: active ? 1 : 0.5 }}>{active ? '↑' : '↕'}</span>
    </button>
  );
}

export function PositionTable({
  positions, livePrices, probabilities, probabilitySummary,
  onRemove, onClose, onEdit, onAssign,
}: PositionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>(null);

  if (!positions.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0, 229, 196, 0.08)', border: '1px solid rgba(0, 229, 196, 0.15)' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="#00e5c4" strokeWidth="1.5" strokeOpacity="0.5" />
            <circle cx="10" cy="10" r="2.5" fill="#00e5c4" fillOpacity="0.5" />
            <line x1="10" y1="2" x2="10" y2="7.5" stroke="#00e5c4" strokeWidth="1.5" strokeOpacity="0.5" />
            <line x1="10" y1="12.5" x2="10" y2="18" stroke="#00e5c4" strokeWidth="1.5" strokeOpacity="0.5" />
            <line x1="2" y1="10" x2="7.5" y2="10" stroke="#00e5c4" strokeWidth="1.5" strokeOpacity="0.5" />
            <line x1="12.5" y1="10" x2="18" y2="10" stroke="#00e5c4" strokeWidth="1.5" strokeOpacity="0.5" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          No open positions
        </p>
      </div>
    );
  }

  const hasActions = onRemove || onClose || onEdit || onAssign;
  const sorted = sortPositions(positions, sortKey, probabilities);

  return (
    <>
      {/* ── Mobile card layout (< sm) ── */}
      <div className="sm:hidden space-y-3">
        {sorted.map((pos) => {
          const capitalAtRisk = pos.strike * pos.contracts * 100;
          const returnPct = capitalAtRisk > 0 ? (pos.premiumCollected / capitalAtRisk) * 100 : 0;
          const prob = probabilities?.get(pos.id) ?? null;
          const sp = livePrices?.get(pos.ticker);

          return (
            <div key={pos.id} className="rounded-xl p-4"
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(0,229,196,0.08)', ...rowBorderStyle(pos, probabilities) }}>
              {/* Row 1: ticker + badges */}
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
                {sp && (() => {
                  const { isItm } = computeLivePnl(pos, sp);
                  return (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                      style={{
                        color: isItm ? '#ff4d6d' : '#00d68f',
                        background: isItm ? 'rgba(255,77,109,0.1)' : 'rgba(0,214,143,0.1)',
                        border: `1px solid ${isItm ? 'rgba(255,77,109,0.2)' : 'rgba(0,214,143,0.2)'}`,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>
                      {isItm ? 'ITM' : 'OTM'}
                    </span>
                  );
                })()}
                {/* Mobile probability dot */}
                <ProbabilityDot result={prob} />
              </div>

              {/* Row 2: metrics grid */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Strike</p>
                  <p className="text-sm font-medium" style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
                    ${pos.strike}
                  </p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Premium</p>
                  <p className="text-sm font-medium" style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>
                    ${pos.premiumCollected}
                  </p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Return</p>
                  <p className="text-sm font-semibold" style={{ color: '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>
                    {returnPct.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>DTE</p>
                  <DTEIndicator expiry={pos.expiry} strategy={pos.strategy} compact />
                </div>
              </div>

              {/* Row 3: actions */}
              {(onAssign || onEdit || onClose || onRemove) && (
                <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(0,229,196,0.07)' }}>
                  {onAssign && <button onClick={() => onAssign(pos)} style={mobileBtn('#f5c842')}>Assign</button>}
                  {onEdit   && <button onClick={() => onEdit(pos)}   style={mobileBtn('#f5c842')}>Edit</button>}
                  {onClose  && <button onClick={() => onClose(pos)}  style={mobileBtn('#00e5c4')}>Close</button>}
                  {onRemove && <button onClick={() => onRemove(pos)} style={mobileBtn('#ff4d6d')}>Delete</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Desktop table layout (sm+) ── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm" style={{ fontFamily: 'DM Sans, sans-serif', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className="text-left py-3 pl-5 pr-4" style={thStyle}>Ticker</th>
              <th className="text-left py-3 px-4" style={thStyle}>Strategy</th>
              <th className="text-left py-3 px-4" style={thStyle}>Strike</th>
              <th className="text-left py-3 px-4" style={thStyle}>Premium</th>
              <th className="text-left py-3 px-4" style={thStyle}>Return</th>
              <th className="text-left py-3 px-4" style={thStyle}>
                <SortHeader label="Expires" current={sortKey} sortKey="expiry" onSort={setSortKey} />
              </th>
              {probabilities && (
                <th className="text-left py-3 px-4" style={thStyle}>
                  <SortHeader label="Assignment Risk" current={sortKey} sortKey="probability" onSort={setSortKey} />
                </th>
              )}
              {livePrices && <th className="text-left py-3 px-4" style={thStyle}>Stock $</th>}
              {livePrices && <th className="text-left py-3 px-4" style={thStyle}>Unreal P&L</th>}
              {hasActions && <th className="text-left py-3 px-4 last:pr-0" style={thStyle}></th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((pos, i) => {
              const capitalAtRisk = pos.strike * pos.contracts * 100;
              const returnPct = capitalAtRisk > 0 ? (pos.premiumCollected / capitalAtRisk) * 100 : 0;
              const prob = probabilities?.get(pos.id) ?? null;
              const rowStyle = rowBorderStyle(pos, probabilities);
              const isLastRow = i === sorted.length - 1;

              return (
                <tr
                  key={pos.id}
                  className="stock-row-hover group"
                  style={{
                    borderBottom: !isLastRow ? '1px solid rgba(0, 229, 196, 0.06)' : 'none',
                    ...rowStyle,
                  }}
                >
                  <td className="py-3.5 pl-5 pr-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-sm tracking-wide"
                        style={{ color: '#e8f0fe', fontFamily: 'Syne, sans-serif' }}>
                        {pos.ticker}
                      </span>
                      <span className="text-xs" style={{ color: '#4a6a8a' }}>{pos.contracts}×</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                      style={{
                        color: pos.strategy === 'CSP' ? '#00c6f5' : '#00e5c4',
                        background: pos.strategy === 'CSP' ? 'rgba(0,198,245,0.1)' : 'rgba(0,229,196,0.1)',
                        border: `1px solid ${pos.strategy === 'CSP' ? 'rgba(0,198,245,0.2)' : 'rgba(0,229,196,0.2)'}`,
                        fontFamily: 'JetBrains Mono, monospace',
                        letterSpacing: '0.04em',
                      }}>
                      {pos.strategy}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
                      ${pos.strike}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="font-medium" style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>
                      ${pos.premiumCollected.toFixed(0)}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold" style={{ color: '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>
                        {returnPct.toFixed(1)}%
                      </span>
                      <span className="text-xs" style={{ color: '#4a6a8a' }}>
                        on ${(capitalAtRisk / 1000).toFixed(0)}k
                      </span>
                    </div>
                  </td>

                  {/* Expires column (replaces Expiry + DTE) */}
                  <td className="py-3.5 px-4">
                    <DTEIndicator expiry={pos.expiry} strategy={pos.strategy} compact />
                  </td>

                  {/* Assignment Risk column */}
                  {probabilities && (
                    <td className="py-3.5 px-4" style={{ minWidth: 180 }}>
                      <AssignmentProbabilityGauge
                        result={prob}
                        strategy={pos.strategy}
                        strike={pos.strike}
                        currentPrice={livePrices?.get(pos.ticker) ?? null}
                        compact
                      />
                    </td>
                  )}

                  {/* Stock price + unrealized P&L */}
                  {livePrices && (() => {
                    const stockPrice = livePrices.get(pos.ticker);
                    if (stockPrice == null) {
                      return (
                        <>
                          <td className="py-3.5 px-4"><span style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>—</span></td>
                          <td className="py-3.5 px-4"><span style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>—</span></td>
                        </>
                      );
                    }
                    const { unrealizedPnl, pctMaxProfit, isItm } = computeLivePnl(pos, stockPrice);
                    const pnlColor = unrealizedPnl >= 0 ? '#00d68f' : '#ff4d6d';
                    return (
                      <>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                              ${stockPrice.toFixed(2)}
                            </span>
                            <span className="text-[10px]" style={{ color: isItm ? '#ff4d6d' : '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>
                              {isItm ? 'ITM' : 'OTM'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1.5">
                            <span className="font-medium tabular-nums" style={{ color: pnlColor, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                              {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(0)}
                            </span>
                            <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${pctMaxProfit}%`,
                                  background: pctMaxProfit >= 75 ? '#00d68f' : pctMaxProfit >= 40 ? '#f5c842' : '#ff4d6d',
                                }} />
                            </div>
                            <span className="text-[10px]" style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace' }}>
                              {pctMaxProfit.toFixed(0)}% max
                            </span>
                          </div>
                        </td>
                      </>
                    );
                  })()}

                  {hasActions && (
                    <td className="py-3.5 px-4 last:pr-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {onAssign && <button onClick={() => onAssign(pos)} style={deskBtn('#f5c842')}>Assign</button>}
                        {onEdit   && <button onClick={() => onEdit(pos)}   style={deskBtn('#f5c842')}>Edit</button>}
                        {onClose  && <button onClick={() => onClose(pos)}  style={deskBtn('#00e5c4')}>Close</button>}
                        {onRemove && <button onClick={() => onRemove(pos)} style={deskBtn('#ff4d6d')}>Delete</button>}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>

          {/* Portfolio summary footer */}
          {probabilitySummary && positions.length > 1 && (
            <tfoot>
              <tr>
                <td colSpan={6} style={{ padding: '10px 16px 4px 0', borderTop: '1px solid rgba(0,229,196,0.1)' }}>
                  <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 11 }}>
                    Portfolio avg:
                  </span>
                  <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, marginLeft: 6 }}>
                    {probabilitySummary.avgProbability}% assignment risk
                  </span>
                </td>
                <td colSpan={99} style={{ padding: '10px 0 4px', borderTop: '1px solid rgba(0,229,196,0.1)' }}>
                  {probabilitySummary.highRiskCount > 0 ? (
                    <span style={{ color: '#ef4444', fontFamily: 'DM Sans, sans-serif', fontSize: 11 }}>
                      {probabilitySummary.highRiskCount} position{probabilitySummary.highRiskCount > 1 ? 's' : ''} need attention
                    </span>
                  ) : (
                    <span style={{ color: '#00d68f', fontFamily: 'DM Sans, sans-serif', fontSize: 11 }}>
                      All positions comfortable
                    </span>
                  )}
                  {probabilitySummary.watchCount > 0 && (
                    <span style={{ color: '#f59e0b', fontFamily: 'DM Sans, sans-serif', fontSize: 11, marginLeft: 12 }}>
                      {probabilitySummary.watchCount} watching
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  color: '#4a6a8a', borderBottom: '1px solid rgba(0, 229, 196, 0.08)',
  letterSpacing: '0.08em', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap',
};

function mobileBtn(color: string): React.CSSProperties {
  return {
    flex: 1, background: `${color}14`, border: `1px solid ${color}33`,
    borderRadius: 7, color, fontFamily: 'DM Sans, sans-serif',
    fontSize: 12, fontWeight: 600, padding: '8px 0', cursor: 'pointer',
  };
}

function deskBtn(color: string): React.CSSProperties {
  return {
    background: `${color}14`, border: `1px solid ${color}26`,
    borderRadius: 5, color, fontFamily: 'DM Sans, sans-serif',
    fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap',
  };
}
