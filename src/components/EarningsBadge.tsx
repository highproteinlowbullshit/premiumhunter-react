interface EarningsBadgeProps {
  daysToEarnings: number | null;
  compact?: boolean; // smaller form for mobile / card headers
}

function earnColor(dte: number): { text: string; bg: string; border: string } {
  if (dte <= 1)  return { text: '#ff4d6d', bg: 'rgba(255,77,109,0.15)',  border: 'rgba(255,77,109,0.35)'  };
  if (dte <= 7)  return { text: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)'   };
  if (dte <= 14) return { text: '#f5c842', bg: 'rgba(245,200,66,0.12)',  border: 'rgba(245,200,66,0.3)'   };
  if (dte <= 30) return { text: '#9ab4d4', bg: 'rgba(154,180,212,0.08)', border: 'rgba(154,180,212,0.18)' };
  return              { text: '#4a6a8a', bg: 'transparent',             border: 'transparent'             };
}

function label(dte: number): string {
  if (dte <= 0) return 'Today';
  if (dte === 1) return 'Tomorrow';
  return `${dte}d`;
}

export function EarningsBadge({ daysToEarnings, compact = false }: EarningsBadgeProps) {
  if (daysToEarnings === null) {
    return <span style={{ color: '#2e4a6a', fontSize: compact ? 10 : 12 }}>—</span>;
  }

  const c = earnColor(daysToEarnings);
  const urgent = daysToEarnings <= 14;

  return (
    <span
      className="inline-flex items-center gap-1"
      title={`Earnings in ${daysToEarnings} day${daysToEarnings !== 1 ? 's' : ''}`}
      style={{
        padding: compact ? '1px 5px' : '2px 7px',
        borderRadius: 6,
        fontSize: compact ? 9 : 11,
        fontWeight: 600,
        fontFamily: 'JetBrains Mono, monospace',
        color: c.text,
        background: c.bg,
        border: `1px solid ${c.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {/* calendar icon */}
      <svg
        width={compact ? 9 : 11}
        height={compact ? 9 : 11}
        viewBox="0 0 12 12"
        fill="none"
        style={{ flexShrink: 0 }}
      >
        <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M1 5h10" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4 1v2M8 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        {urgent && <circle cx="6" cy="8" r="1" fill="currentColor" />}
      </svg>
      {label(daysToEarnings)}
    </span>
  );
}
