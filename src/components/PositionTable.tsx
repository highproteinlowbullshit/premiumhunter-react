import { useState, useEffect, useRef } from 'react';
import { ClipboardList } from 'lucide-react';
import type { WheelPosition } from '../types';
import type { AssignmentProbabilityResult, PositionGreeks } from '../lib/blackScholes';
import { DTEIndicator } from './DTEIndicator';
import { AssignmentProbabilityGauge } from './AssignmentProbabilityGauge';
import { EmptyState } from './ui/EmptyState';

interface PositionTableProps {
  positions: WheelPosition[];
  livePrices?: Map<string, number>;
  probabilities?: Map<string, AssignmentProbabilityResult>;
  positionGreeks?: Map<string, PositionGreeks>;
  highlightTicker?: string | null;
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
  onOpenAdd?: () => void;
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
  const isItm = intrinsicPerShare > 0;

  const costToClose = pos.optionMid != null
    ? pos.optionMid * 100 * pos.contracts
    : intrinsicPerShare * 100 * pos.contracts;

  const unrealizedPnl = pos.premiumCollected - costToClose;
  const pctMaxProfit =
    pos.premiumCollected > 0
      ? Math.min(100, Math.max(0, (unrealizedPnl / pos.premiumCollected) * 100))
      : 0;
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

// ── Swipeable card wrapper (mobile only) ──────────────────────────────────────
// Direct DOM style mutation for smooth 60fps drag; React state only at snap points.

function SwipePositionCard({
  children, pos, onEdit, onClose,
}: {
  children: React.ReactNode;
  pos: WheelPosition;
  onEdit?: (pos: WheelPosition) => void;
  onClose?: (pos: WheelPosition) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const dirRef = useRef<'h' | 'v' | null>(null);
  const curOffsetRef = useRef(0);
  const openRef = useRef(false);
  const [swipeRatio, setSwipeRatio] = useState(0);

  const btnCount = (onEdit ? 1 : 0) + (onClose ? 1 : 0);
  const PANEL_W = btnCount * 76;

  useEffect(() => {
    const el = wrapRef.current;
    const slide = slideRef.current;
    if (!el || !slide || PANEL_W === 0) return;

    const applyTransform = (offset: number, animate: boolean) => {
      slide.style.transition = animate ? 'transform 0.22s ease' : 'none';
      slide.style.transform = `translateX(${offset}px)`;
    };

    const onTouchStart = (e: TouchEvent) => {
      startXRef.current = e.touches[0].clientX;
      startYRef.current = e.touches[0].clientY;
      dirRef.current = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startXRef.current === null || startYRef.current === null) return;
      const dx = e.touches[0].clientX - startXRef.current;
      const dy = e.touches[0].clientY - startYRef.current;

      if (!dirRef.current) {
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          dirRef.current = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
        }
        return;
      }
      if (dirRef.current === 'v') return;

      e.preventDefault();
      const base = openRef.current ? -PANEL_W : 0;
      const newOffset = Math.max(-PANEL_W, Math.min(0, base + dx));
      curOffsetRef.current = newOffset;
      applyTransform(newOffset, false);
      setSwipeRatio(-newOffset / PANEL_W);
    };

    const onTouchEnd = () => {
      if (dirRef.current !== 'h') return;
      const cur = curOffsetRef.current;
      const wasOpen = openRef.current;
      let snap: number;

      if (!wasOpen && cur < -PANEL_W / 2) {
        snap = -PANEL_W;
        openRef.current = true;
        setSwipeRatio(1);
      } else if (wasOpen && cur > -PANEL_W / 2) {
        snap = 0;
        openRef.current = false;
        setSwipeRatio(0);
      } else {
        snap = wasOpen ? -PANEL_W : 0;
        setSwipeRatio(-snap / PANEL_W);
      }

      curOffsetRef.current = snap;
      applyTransform(snap, true);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [PANEL_W]);

  const reset = () => {
    const slide = slideRef.current;
    if (slide) {
      slide.style.transition = 'transform 0.22s ease';
      slide.style.transform = 'translateX(0px)';
    }
    curOffsetRef.current = 0;
    openRef.current = false;
    setSwipeRatio(0);
  };

  if (PANEL_W === 0) return <>{children}</>;

  return (
    <div ref={wrapRef} style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
      {/* Action panel revealed by swipe */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: PANEL_W, display: 'flex',
        opacity: Math.min(swipeRatio * 1.5, 1),
      }}>
        {onEdit && (
          <button
            onClick={() => { onEdit(pos); reset(); }}
            style={{
              flex: 1, border: 'none', cursor: 'pointer',
              background: 'rgba(245,200,66,0.18)',
              borderLeft: '1px solid rgba(245,200,66,0.2)',
              color: '#f5c842',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 13, fontWeight: 700,
            }}
          >
            Edit
          </button>
        )}
        {onClose && (
          <button
            onClick={() => { onClose(pos); reset(); }}
            style={{
              flex: 1, border: 'none', cursor: 'pointer',
              background: 'rgba(0,229,196,0.18)',
              borderLeft: '1px solid rgba(0,229,196,0.2)',
              color: '#00e5c4',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 13, fontWeight: 700,
            }}
          >
            Close
          </button>
        )}
      </div>

      {/* Card content slides on swipe */}
      <div ref={slideRef} style={{ willChange: 'transform' }}>
        {children}
      </div>
    </div>
  );
}

export function PositionTable({
  positions, livePrices, probabilities, probabilitySummary, positionGreeks,
  onRemove, onClose, onEdit, onAssign, highlightTicker, onOpenAdd,
}: PositionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    try {
      const saved = localStorage.getItem('ph-position-sort');
      return (saved === 'expiry' || saved === 'probability') ? saved : null;
    } catch { return null; }
  });

  useEffect(() => {
    if (sortKey) localStorage.setItem('ph-position-sort', sortKey);
    else localStorage.removeItem('ph-position-sort');
  }, [sortKey]);

  if (!positions.length) {
    return (
      <EmptyState
        icon={<ClipboardList size={36} strokeWidth={1.5} />}
        title="No open positions"
        description="Log a CSP or Covered Call to start tracking your premium income."
        action={onOpenAdd ? { label: 'Add position  (N)', onClick: onOpenAdd } : undefined}
      />
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
            <SwipePositionCard key={pos.id} pos={pos} onEdit={onEdit} onClose={onClose}>
            <div id={`position-${pos.id}`} className="rounded-xl p-4"
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
                    ${pos.premiumCollected.toFixed(0)}
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

              {/* Row 3: actions — Assign/Delete always visible; Edit/Close via swipe */}
              {(onAssign || onRemove) && (
                <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(0,229,196,0.07)' }}>
                  {onAssign && <button onClick={() => onAssign(pos)} style={mobileBtn('#f5c842')}>Assign</button>}
                  {onRemove && <button onClick={() => onRemove(pos)} style={mobileBtn('#ff4d6d')}>Delete</button>}
                  {(onEdit || onClose) && (
                    <span className="ml-auto text-[10px]" style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif' }}>
                      ← swipe
                    </span>
                  )}
                </div>
              )}
            </div>
            </SwipePositionCard>
          );
        })}
      </div>

      {/* ── Desktop table layout (sm+) ── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm" style={{ fontFamily: 'DM Sans, sans-serif', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className="text-left py-3 pl-5 pr-4" style={thStyle}>Position</th>
              {livePrices && <th className="text-left py-3 px-4" style={thStyle}>Stock $</th>}
              <th className="text-left py-3 px-4" style={thStyle}>Price Sold</th>
              <th className="text-left py-3 px-4" style={thStyle}>Market</th>
              <th className="text-left py-3 px-4" style={thStyle}>
                <SortHeader label="DTE" current={sortKey} sortKey="expiry" onSort={setSortKey} />
              </th>
              {livePrices && <th className="text-left py-3 px-4" style={thStyle}>Unreal P&L</th>}
              {probabilities && (
                <th className="text-left py-3 px-4" style={thStyle}>
                  <SortHeader label="Assignment Risk" current={sortKey} sortKey="probability" onSort={setSortKey} />
                </th>
              )}
              {hasActions && <th className="text-left py-3 px-4 last:pr-0" style={thStyle}></th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((pos, i) => {
              const prob = probabilities?.get(pos.id) ?? null;
              const rowStyle = rowBorderStyle(pos, probabilities);
              const isLastRow = i === sorted.length - 1;
              const isHighlighted = highlightTicker === pos.ticker;
              const stockPrice = livePrices?.get(pos.ticker);
              const livePnl = stockPrice != null ? computeLivePnl(pos, stockPrice) : null;
              const pricePerShare = pos.premiumCollected / (pos.contracts * 100);

              return (
                <tr
                  key={pos.id}
                  id={`position-${pos.id}`}
                  className="stock-row-hover group"
                  style={{
                    borderBottom: !isLastRow ? '1px solid rgba(0, 229, 196, 0.06)' : 'none',
                    background: isHighlighted ? 'rgba(0,229,196,0.12)' : undefined,
                    transition: 'background 1.5s ease',
                    ...rowStyle,
                  }}
                >
                  {/* Position: $16 SOFI CSP */}
                  <td className="py-3.5 pl-5 pr-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-sm tracking-wide" style={{ fontFamily: 'Syne, sans-serif' }}>
                        <span style={{ color: '#9ab4d4' }}>${pos.strike} </span>
                        <span style={{ color: '#e8f0fe' }}>{pos.ticker} </span>
                        <span style={{ color: pos.strategy === 'CSP' ? '#00c6f5' : '#00e5c4' }}>{pos.strategy}</span>
                      </span>
                      <span className="text-xs" style={{ color: '#4a6a8a' }}>
                        {pos.contracts} contract{pos.contracts !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </td>

                  {/* Stock $ + ITM/OTM */}
                  {livePrices && (
                    <td className="py-3.5 px-4">
                      {stockPrice != null ? (
                        <div className="flex flex-col gap-0.5">
                          <span style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                            ${stockPrice.toFixed(2)}
                          </span>
                          <span className="text-[10px]" style={{ color: livePnl?.isItm ? '#ff4d6d' : '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>
                            {livePnl?.isItm ? 'ITM' : 'OTM'}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  )}

                  {/* Price Sold — per-share premium collected */}
                  <td className="py-3.5 px-4">
                    <span className="font-medium" style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                      ${pricePerShare.toFixed(2)}
                    </span>
                  </td>

                  {/* Market — last option price from snapshot */}
                  <td className="py-3.5 px-4">
                    {pos.optionBid != null && pos.optionAsk != null && pos.optionMid != null ? (
                      <div className="flex flex-col gap-0.5">
                        <span style={{ color: '#6a8fb0', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                          ${pos.optionBid.toFixed(2)} / ${pos.optionAsk.toFixed(2)}
                        </span>
                        <span style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600 }}>
                          last ${pos.optionMid.toFixed(2)}
                        </span>
                      </div>
                    ) : pos.optionMid != null ? (
                      <span style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600 }}>
                        last ${pos.optionMid.toFixed(2)}
                      </span>
                    ) : (
                      <span style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>—</span>
                    )}
                  </td>

                  {/* DTE */}
                  <td className="py-3.5 px-4">
                    <DTEIndicator expiry={pos.expiry} strategy={pos.strategy} compact />
                  </td>

                  {/* Unreal P&L */}
                  {livePrices && (
                    <td className="py-3.5 px-4">
                      {livePnl != null ? (
                        <div className="flex flex-col gap-1.5">
                          <span className="font-medium tabular-nums" style={{ color: livePnl.unrealizedPnl >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                            {livePnl.unrealizedPnl >= 0 ? '+' : ''}${livePnl.unrealizedPnl.toFixed(0)}
                          </span>
                          <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${livePnl.pctMaxProfit}%`,
                                background: livePnl.pctMaxProfit >= 75 ? '#00d68f' : livePnl.pctMaxProfit >= 40 ? '#f5c842' : '#ff4d6d',
                              }} />
                          </div>
                          <span className="text-[10px]" style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace' }}>
                            {livePnl.pctMaxProfit.toFixed(0)}% max
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  )}

                  {/* Assignment Risk */}
                  {probabilities && (
                    <td className="py-3.5 px-4" style={{ minWidth: 180 }}>
                      <AssignmentProbabilityGauge
                        result={prob}
                        strategy={pos.strategy}
                        strike={pos.strike}
                        currentPrice={stockPrice ?? null}
                        compact
                      />
                    </td>
                  )}

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
                <td colSpan={4} style={{ padding: '10px 16px 4px 0', borderTop: '1px solid rgba(0,229,196,0.1)' }}>
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
