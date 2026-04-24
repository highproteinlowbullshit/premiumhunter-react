import { useState } from 'react';
import type { AssignedLot } from '../hooks/usePortfolioEnhanced';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(v: number): string {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Cost Basis Journey ────────────────────────────────────────────────────────

function CostJourneyStep({ label, value, muted, projected }: {
  label: string;
  value: string;
  muted?: boolean;
  projected?: boolean;
}) {
  return (
    <div style={{
      textAlign: 'center', padding: '8px 12px', borderRadius: 8,
      background: projected ? 'transparent' : 'rgba(5,13,26,0.5)',
      border: projected ? '1px dashed rgba(20,184,166,0.3)' : '1px solid rgba(255,255,255,0.06)',
      minWidth: 90,
    }}>
      <div style={{ color: muted ? '#4a6a8a' : projected ? '#5eead4' : '#14b8a6', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: projected ? 400 : 700, fontStyle: projected ? 'italic' : 'normal' }}>{value}</div>
      <div style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif', fontSize: 10, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function CostBasisJourney({ lot }: { lot: AssignedLot }) {
  const perShare = (v: number) => `$${(v / (lot.shares * lot.contracts)).toFixed(2)}/sh`;
  const cspEvents = lot.premiumEvents.filter(e => e.type === 'csp_premium');
  const ccEvents = lot.premiumEvents.filter(e => e.type === 'cc_premium');
  const afterCSP = lot.grossCostBasis - (cspEvents.reduce((s, e) => s + e.amount, 0));

  const steps: Array<{ label: string; value: string; muted?: boolean; projected?: boolean }> = [
    { label: 'Assigned at', value: `$${lot.assignmentStrike.toFixed(2)}/sh`, muted: true },
  ];
  if (cspEvents.length > 0) {
    steps.push({ label: 'After CSP premium', value: perShare(afterCSP) });
  }
  ccEvents.forEach((_e, i) => {
    const cum = cspEvents.reduce((s, ev) => s + ev.amount, 0) +
      ccEvents.slice(0, i + 1).reduce((s, ev) => s + ev.amount, 0);
    steps.push({ label: `After CC #${i + 1}`, value: perShare(lot.grossCostBasis - cum) });
  });
  if (lot.currentCC && steps.length > 0) {
    steps.push({
      label: 'If current CC expires',
      value: perShare(lot.projectedFinalCostBasis),
      projected: true,
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {i > 0 && <span style={{ color: '#2e4a6a', fontSize: 16 }}>→</span>}
            <CostJourneyStep {...s} />
          </div>
        ))}
      </div>

      {/* Recovery progress bar */}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 11 }}>
            {lot.percentageRecovered}% of cost basis recovered via premium
          </span>
          <span style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif', fontSize: 11 }}>
            {fmt$(lot.totalPremiumCollected)} / {fmt$(lot.grossCostBasis)}
          </span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            width: `${Math.min(100, lot.percentageRecovered)}%`,
            background: lot.percentageRecovered >= 100 ? '#00d68f' : 'linear-gradient(90deg, #14b8a660, #14b8a6)',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>
    </div>
  );
}

// ── Premium History (collapsible) ─────────────────────────────────────────────

function PremiumHistory({ lot }: { lot: AssignedLot }) {
  const [open, setOpen] = useState(false);
  if (lot.premiumEvents.length === 0) return null;

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 12, padding: 0 }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
          <path d="M3 2l4 3-4 3V2z" fill="currentColor" />
        </svg>
        Premium history ({lot.premiumEvents.length} events)
      </button>

      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lot.premiumEvents.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: '#2e4a6a', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, width: 90, flexShrink: 0 }}>{fmtDate(e.date)}</span>
              <span style={{
                background: e.type === 'csp_premium' ? 'rgba(20,184,166,0.1)' : 'rgba(45,212,191,0.08)',
                border: `1px solid ${e.type === 'csp_premium' ? 'rgba(20,184,166,0.2)' : 'rgba(45,212,191,0.15)'}`,
                borderRadius: 4, padding: '1px 6px',
                color: e.type === 'csp_premium' ? '#14b8a6' : '#2dd4bf',
                fontFamily: 'DM Sans, sans-serif', fontSize: 10, fontWeight: 600,
              }}>
                {e.type === 'csp_premium' ? 'CSP premium' : 'CC premium'}
              </span>
              <span style={{ color: '#00d68f', fontFamily: 'JetBrains Mono, monospace', marginLeft: 'auto' }}>+${e.amount.toLocaleString()}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 12 }}>Total premium collected</span>
            <span style={{ color: '#14b8a6', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700 }}>${lot.totalPremiumCollected.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Active lot card ───────────────────────────────────────────────────────────

function ActiveLotCard({ lot, onAddCC }: { lot: AssignedLot; onAddCC: (ticker: string) => void }) {
  const totalShares = lot.shares * lot.contracts;
  const gainColor = (v: number | null) => v === null ? '#9ab4d4' : v >= 0 ? '#00d68f' : '#ff4d6d';

  return (
    <div style={{
      background: 'rgba(13,27,53,0.6)', border: '1px solid rgba(0,229,196,0.1)',
      borderRadius: 12, padding: '18px 20px', marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ color: '#e8f0fe', fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700 }}>{lot.ticker}</span>
            <span style={{ color: '#4a6a8a', background: 'rgba(0,229,196,0.06)', border: '1px solid rgba(0,229,196,0.1)', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>
              {lot.contracts} contract{lot.contracts !== 1 ? 's' : ''} · {totalShares} shares
            </span>
          </div>
          <span style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif', fontSize: 12 }}>Assigned {fmtDate(lot.assignmentDate)}</span>
        </div>
        {lot.unrealizedGainVsTrueCost !== null && (
          <div style={{
            background: lot.unrealizedGainVsTrueCost >= 0 ? 'rgba(0,214,143,0.08)' : 'rgba(245,200,66,0.08)',
            border: `1px solid ${lot.unrealizedGainVsTrueCost >= 0 ? 'rgba(0,214,143,0.2)' : 'rgba(245,200,66,0.2)'}`,
            borderRadius: 6, padding: '4px 10px',
            color: lot.unrealizedGainVsTrueCost >= 0 ? '#00d68f' : '#f5c842',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
          }}>
            {lot.unrealizedGainVsTrueCost >= 0 ? '+' : ''}{fmt$(lot.unrealizedGainVsTrueCost)} vs true cost
          </div>
        )}
      </div>

      {/* Cost basis journey */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Cost Basis Journey
        </div>
        <CostBasisJourney lot={lot} />
      </div>

      {/* Three-column position row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
        {/* Current price */}
        <div style={{ background: 'rgba(5,13,26,0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 10, marginBottom: 4 }}>Current price</div>
          <div style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700 }}>
            {lot.currentPrice ? `$${lot.currentPrice.toFixed(2)}` : '—'}
          </div>
          {lot.currentPrice && (
            <div style={{ color: lot.currentPrice >= lot.breakEvenPrice ? '#00d68f' : '#f5c842', fontFamily: 'DM Sans, sans-serif', fontSize: 10, marginTop: 3 }}>
              {lot.currentPrice >= lot.breakEvenPrice ? '+' : '−'}${Math.abs(lot.currentPrice - lot.breakEvenPrice).toFixed(2)} vs breakeven
            </div>
          )}
        </div>

        {/* Position value */}
        <div style={{ background: 'rgba(5,13,26,0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 10, marginBottom: 4 }}>Position value</div>
          <div style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700 }}>
            {lot.currentValue ? fmt$(lot.currentValue) : '—'}
          </div>
          <div style={{ color: '#2e4a6a', fontSize: 10, fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>True cost: {fmt$(lot.netCostBasis)}</div>
          {lot.unrealizedGainVsTrueCost !== null && (
            <div style={{ color: gainColor(lot.unrealizedGainVsTrueCost), fontFamily: 'JetBrains Mono, monospace', fontSize: 11, marginTop: 2 }}>
              {lot.unrealizedGainVsTrueCost >= 0 ? '+' : ''}{fmt$(lot.unrealizedGainVsTrueCost)}
              {lot.unrealizedGainPercent !== null && ` (${lot.unrealizedGainPercent >= 0 ? '+' : ''}${lot.unrealizedGainPercent}%)`}
            </div>
          )}
        </div>

        {/* CC status */}
        <div style={{ background: 'rgba(5,13,26,0.4)', border: `1px solid ${lot.currentCC ? 'rgba(0,229,196,0.15)' : 'rgba(245,200,66,0.15)'}`, borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 10, marginBottom: 4 }}>Covered Call</div>
          {lot.currentCC ? (
            <>
              <div style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                ${lot.currentCC.strike} · {lot.currentCC.dte}d
              </div>
              <div style={{ color: '#2e8a7a', fontFamily: 'DM Sans, sans-serif', fontSize: 10, marginTop: 2 }}>
                {lot.currentCC.expiry} exp
              </div>
              <div style={{ background: 'rgba(0,229,196,0.08)', border: '1px solid rgba(0,229,196,0.15)', borderRadius: 4, padding: '1px 6px', color: '#00e5c4', fontSize: 10, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, marginTop: 5, display: 'inline-block' }}>
                Actively wheeling
              </div>
            </>
          ) : (
            <>
              <div style={{ color: '#f5c842', fontFamily: 'DM Sans, sans-serif', fontSize: 11, marginBottom: 4 }}>No CC open</div>
              <button
                onClick={() => onAddCC(lot.ticker)}
                style={{ background: 'rgba(0,229,196,0.06)', border: '1px solid rgba(0,229,196,0.2)', borderRadius: 6, color: '#00e5c4', fontFamily: 'DM Sans, sans-serif', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}>
                + Sell CC
              </button>
            </>
          )}
        </div>
      </div>

      <PremiumHistory lot={lot} />

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <span style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif', fontSize: 12 }}>
          Breakeven: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>${lot.breakEvenPrice.toFixed(2)}/share</span>
        </span>
      </div>
    </div>
  );
}

// ── Closed lot card (compact) ─────────────────────────────────────────────────

function ClosedLotCard({ lot }: { lot: AssignedLot }) {
  const statusLabel = lot.status === 'called_away' ? 'Called away' : 'Sold';
  const statusColor = lot.status === 'called_away' ? '#14b8a6' : '#9ab4d4';

  return (
    <div style={{ background: 'rgba(13,27,53,0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '14px 16px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ color: '#9ab4d4', fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700 }}>{lot.ticker}</span>
        <span style={{ background: `${statusColor}14`, border: `1px solid ${statusColor}30`, borderRadius: 4, padding: '1px 7px', color: statusColor, fontSize: 11, fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>
          {statusLabel}
        </span>
        {lot.exitDate && <span style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif', fontSize: 11 }}>{fmtDate(lot.exitDate)}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ color: '#4a6a8a' }}>
          Assigned ${lot.assignmentStrike}/sh → Exit {lot.exitPrice ? `$${lot.exitPrice.toFixed(2)}/sh` : '—'}
        </div>
        <div style={{ color: lot.realizedCapitalGain !== null && lot.realizedCapitalGain >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace' }}>
          Capital gain: {lot.realizedCapitalGain !== null ? `${lot.realizedCapitalGain >= 0 ? '+' : ''}${fmt$(lot.realizedCapitalGain)}` : '—'}
        </div>
        <div style={{ color: '#14b8a6', fontFamily: 'JetBrains Mono, monospace' }}>
          Premium: +${lot.totalPremiumCollected.toLocaleString()}
        </div>
        <div style={{ color: lot.totalLotReturn !== null && lot.totalLotReturn >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace' }}>
          Total: {lot.totalLotReturn !== null ? `+${fmt$(lot.totalLotReturn)}` : '—'}
          {lot.lotAnnualisedReturn !== null && <span style={{ color: '#9ab4d4', marginLeft: 6 }}>({lot.lotAnnualisedReturn}% ann.)</span>}
        </div>
      </div>
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

interface Props {
  activeLots: AssignedLot[];
  closedLots: AssignedLot[];
  hasAnyLots: boolean;
  totalLotsPremiumCollected: number;
  orphanedAssignments: number;
  isLoading: boolean;
  onAddCC?: (ticker: string) => void;
  onImportAssignments?: () => void;
}

export function AssignedSharesSection({
  activeLots, closedLots, hasAnyLots, totalLotsPremiumCollected,
  orphanedAssignments, isLoading, onAddCC, onImportAssignments,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const [importDismissed, setImportDismissed] = useState(false);

  const cardStyle: React.CSSProperties = {
    background: 'rgba(13,27,53,0.6)', border: '1px solid rgba(0,229,196,0.08)',
    borderRadius: 12, padding: '20px 24px', marginBottom: 24,
  };

  if (isLoading) {
    return (
      <div style={cardStyle}>
        <div style={{ height: 80, display: 'flex', alignItems: 'center', color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>
          Loading assigned shares…
        </div>
      </div>
    );
  }

  if (!hasAnyLots && orphanedAssignments === 0) {
    return (
      <div style={cardStyle}>
        <h3 style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>
          Assigned Share Lots
        </h3>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', fontSize: 14, marginBottom: 8 }}>No assignment history yet</div>
          <p style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 12, maxWidth: 400, margin: '0 auto' }}>
            When a CSP is assigned, those shares appear here with full cost basis tracking across your wheel cycles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 2px' }}>
            Assigned Share Lots
          </h3>
          <p style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif', fontSize: 11, margin: 0 }}>
            Shares acquired through CSP assignment — true cost basis reflects all premium collected
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ background: 'rgba(0,229,196,0.06)', border: '1px solid rgba(0,229,196,0.12)', borderRadius: 6, padding: '3px 9px', color: '#00e5c4', fontFamily: 'DM Sans, sans-serif', fontSize: 11 }}>
            Active: {activeLots.length}
          </span>
          <span style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.1)', borderRadius: 6, padding: '3px 9px', color: '#14b8a6', fontFamily: 'DM Sans, sans-serif', fontSize: 11 }}>
            Premium recovered: ${totalLotsPremiumCollected.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Orphaned assignments import banner */}
      {orphanedAssignments > 0 && !importDismissed && (
        <div style={{ background: 'rgba(0,198,245,0.06)', border: '1px solid rgba(0,198,245,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <p style={{ color: '#6a9fb0', fontFamily: 'DM Sans, sans-serif', fontSize: 12, margin: 0 }}>
            {orphanedAssignments} existing assignment{orphanedAssignments !== 1 ? 's' : ''} found without cost basis records.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {onImportAssignments && (
              <button
                onClick={onImportAssignments}
                style={{ background: 'rgba(0,198,245,0.1)', border: '1px solid rgba(0,198,245,0.25)', borderRadius: 6, color: '#00c6f5', fontFamily: 'DM Sans, sans-serif', fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}>
                Import assignments
              </button>
            )}
            <button
              onClick={() => setImportDismissed(true)}
              style={{ background: 'none', border: 'none', color: '#2e4a6a', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Active lots */}
      {activeLots.map(lot => (
        <ActiveLotCard key={lot.id} lot={lot} onAddCC={onAddCC ?? (() => {})} />
      ))}

      {/* Closed lots (expandable) */}
      {closedLots.length > 0 && (
        <>
          <button
            onClick={() => setShowAll(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 12, padding: 0, display: 'flex', alignItems: 'center', gap: 6, marginBottom: showAll ? 10 : 0 }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: showAll ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
              <path d="M3 2l4 3-4 3V2z" fill="currentColor" />
            </svg>
            {showAll ? 'Hide' : 'Show'} {closedLots.length} closed lot{closedLots.length !== 1 ? 's' : ''}
          </button>
          {showAll && closedLots.map(lot => <ClosedLotCard key={lot.id} lot={lot} />)}
        </>
      )}
    </div>
  );
}
