import { useState } from 'react';
import type { CycleGroup, WheelCycle, CycleLeg } from '../hooks/useCycleGroups';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function fmtMoney(v: number) {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '+';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function statusDot(status: CycleLeg['status']): { color: string; label: string } {
  switch (status) {
    case 'closed':   return { color: '#00d68f', label: 'Closed' };
    case 'assigned': return { color: '#f5c842', label: 'Assigned' };
    case 'expired':  return { color: '#9ab4d4', label: 'Expired' };
    default:         return { color: '#4a6a8a', label: 'Open' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Single leg row
// ─────────────────────────────────────────────────────────────────────────────

function LegRow({ leg, isLast }: { leg: CycleLeg; isLast: boolean }) {
  const dot = statusDot(leg.status);
  const stratColor = leg.strategy === 'CSP' ? '#00c6f5' : '#00e5c4';

  return (
    <div
      className="flex items-center gap-3 py-2 px-3 rounded-lg"
      style={{
        borderBottom: isLast ? 'none' : '1px solid rgba(0,229,196,0.05)',
        background: 'rgba(0,0,0,0.12)',
        marginBottom: isLast ? 0 : 2,
      }}
    >
      {/* Strategy pill */}
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
        style={{ color: stratColor, background: `${stratColor}18`, border: `1px solid ${stratColor}30`, fontFamily: 'JetBrains Mono, monospace', minWidth: 30, textAlign: 'center' }}
      >
        {leg.strategy}
      </span>

      {/* Strike + expiry */}
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium tabular-nums" style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
          ${leg.strike} · {fmtDate(leg.expiry)}
        </span>
        <span className="text-[10px] ml-2" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          {leg.contracts}× · opened {fmtDate(leg.openedAt)}
        </span>
      </div>

      {/* Premium */}
      <span className="text-xs tabular-nums font-medium" style={{ color: '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>
        +${leg.premiumCollected.toFixed(0)}
      </span>

      {/* Status */}
      <span className="text-[10px] flex items-center gap-1" style={{ color: dot.color, fontFamily: 'DM Sans, sans-serif' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot.color, display: 'inline-block' }} />
        {dot.label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single cycle card
// ─────────────────────────────────────────────────────────────────────────────

function CycleCard({ cycle, defaultOpen }: { cycle: WheelCycle; defaultOpen?: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen ?? false);

  const retColor = cycle.annualisedReturn == null ? '#4a6a8a'
    : cycle.annualisedReturn >= 20 ? '#00d68f'
    : cycle.annualisedReturn >= 10 ? '#f5c842'
    : '#f97316';

  const cycleBorder = cycle.isComplete
    ? cycle.annualisedReturn != null && cycle.annualisedReturn >= 20
      ? 'rgba(0,214,143,0.2)'
      : 'rgba(0,229,196,0.08)'
    : 'rgba(245,200,66,0.15)'; // in-progress = amber tint

  return (
    <div
      className="rounded-xl overflow-hidden mb-2"
      style={{ border: `1px solid ${cycleBorder}`, background: 'rgba(5,13,26,0.4)' }}
    >
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ cursor: 'pointer', background: 'none', border: 'none' }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Status indicator */}
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
          style={
            cycle.isComplete
              ? { color: '#00d68f', background: 'rgba(0,214,143,0.12)', border: '1px solid rgba(0,214,143,0.2)' }
              : { color: '#f5c842', background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.2)' }
          }
        >
          {cycle.isComplete ? 'Complete' : 'Active'}
        </span>

        {/* Assignment badge */}
        {cycle.wasAssigned && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ color: '#f97316', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
            Assigned
          </span>
        )}

        {/* Date range */}
        <span className="text-xs flex-1 min-w-0" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          {fmtDate(cycle.openedAt)}
          {cycle.closedAt ? ` → ${fmtDate(cycle.closedAt)}` : ' → present'}
          {cycle.daysHeld != null && <span style={{ color: '#2e4a6a' }}> ({cycle.daysHeld}d)</span>}
        </span>

        {/* Metrics */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs font-semibold tabular-nums" style={{ color: '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>
              {fmtMoney(cycle.totalPremium)}
            </p>
            <p className="text-[10px]" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>premium</p>
          </div>
          {cycle.annualisedReturn != null && (
            <div className="text-right">
              <p className="text-xs font-semibold tabular-nums" style={{ color: retColor, fontFamily: 'JetBrains Mono, monospace' }}>
                {cycle.annualisedReturn >= 0 ? '+' : ''}{cycle.annualisedReturn}%
              </p>
              <p className="text-[10px]" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>ann. return</p>
            </div>
          )}
          <span style={{ color: '#4a6a8a', fontSize: 12, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            ▾
          </span>
        </div>
      </button>

      {/* Expanded legs */}
      {expanded && (
        <div className="px-3 pb-3">
          {cycle.legs.map((leg, i) => (
            <LegRow key={leg.id} leg={leg} isLast={i === cycle.legs.length - 1} />
          ))}
          {cycle.capitalDeployed > 0 && (
            <p className="text-[10px] mt-2 px-1" style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif' }}>
              Capital deployed: ${cycle.capitalDeployed.toLocaleString()} · {cycle.legs.length} leg{cycle.legs.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ticker group
// ─────────────────────────────────────────────────────────────────────────────

function TickerGroup({ group }: { group: CycleGroup }) {
  const [collapsed, setCollapsed] = useState(false);

  const avgAnn = (() => {
    const completed = group.cycles.filter((c) => c.annualisedReturn != null);
    if (completed.length === 0) return null;
    return Math.round(completed.reduce((s, c) => s + c.annualisedReturn!, 0) / completed.length * 10) / 10;
  })();

  return (
    <div className="mb-6">
      {/* Ticker header */}
      <button
        className="w-full flex items-center gap-3 mb-3"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <h3 className="text-sm font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
          {group.ticker}
        </h3>
        <div className="h-px flex-1" style={{ background: 'rgba(0,229,196,0.1)' }} />
        <span className="text-xs tabular-nums" style={{ color: '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>
          +${group.totalPremium.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
        <span className="text-xs" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          {group.completedCycles}/{group.totalCycles} cycles
        </span>
        {avgAnn != null && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{
              color: avgAnn >= 20 ? '#00d68f' : avgAnn >= 10 ? '#f5c842' : '#f97316',
              background: avgAnn >= 20 ? 'rgba(0,214,143,0.08)' : avgAnn >= 10 ? 'rgba(245,200,66,0.08)' : 'rgba(249,115,22,0.08)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            avg {avgAnn >= 0 ? '+' : ''}{avgAnn}% ann.
          </span>
        )}
        <span style={{ color: '#4a6a8a', fontSize: 11, transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s' }}>
          ▾
        </span>
      </button>

      {!collapsed && group.cycles.map((cycle, i) => (
        <CycleCard key={cycle.id} cycle={cycle} defaultOpen={i === 0 && group.cycles.length === 1} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

interface CycleGroupViewProps {
  groups: CycleGroup[];
  isLoading: boolean;
}

export function CycleGroupView({ groups, isLoading }: CycleGroupViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl h-14 animate-pulse" style={{ background: 'rgba(0,229,196,0.04)' }} />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-10" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 14 }}>
        No closed positions yet. Complete a trade to see your wheel cycles here.
      </div>
    );
  }

  return (
    <div>
      {groups.map((g) => (
        <TickerGroup key={g.ticker} group={g} />
      ))}
      <p className="text-[11px] text-center mt-2" style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif' }}>
        Cycles are reconstructed from your trade history. Annualised returns exclude capital gains from share lots.
      </p>
    </div>
  );
}
