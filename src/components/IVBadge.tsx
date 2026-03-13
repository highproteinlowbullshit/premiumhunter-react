interface IVBadgeProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showBar?: boolean;
}

export function IVBadge({ value, size = 'md', showBar = false }: IVBadgeProps) {
  const getColor = (v: number) => {
    if (v < 30) return { text: '#00d68f', bg: 'rgba(0, 214, 143, 0.12)', border: 'rgba(0, 214, 143, 0.25)', bar: '#00d68f' };
    if (v < 60) return { text: '#f5c842', bg: 'rgba(245, 200, 66, 0.12)', border: 'rgba(245, 200, 66, 0.25)', bar: '#f5c842' };
    return { text: '#ff4d6d', bg: 'rgba(255, 77, 109, 0.12)', border: 'rgba(255, 77, 109, 0.25)', bar: '#ff4d6d' };
  };

  const colors = getColor(value);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 rounded-md',
    md: 'text-sm px-2.5 py-1 rounded-lg',
    lg: 'text-base px-3 py-1.5 rounded-lg',
  };

  const fontSizes = { sm: '10px', md: '12px', lg: '13px' };

  return (
    <div className="flex flex-col gap-1">
      <span
        className={`inline-flex items-center font-semibold tabular-nums ${sizeClasses[size]}`}
        style={{
          color: colors.text,
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: fontSizes[size],
          letterSpacing: '0.02em',
        }}
      >
        {value}
      </span>
      {showBar && (
        <div className="h-1 rounded-full overflow-hidden" style={{ width: '100%', background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${value}%`, background: colors.bar, boxShadow: `0 0 6px ${colors.bar}50` }}
          />
        </div>
      )}
    </div>
  );
}

export function IVLabel({ value }: { value: number }) {
  const label = value < 30 ? 'LOW' : value < 60 ? 'MED' : 'HIGH';
  const colors = {
    LOW: '#00d68f',
    MED: '#f5c842',
    HIGH: '#ff4d6d',
  };

  return (
    <span
      className="text-xs font-semibold tracking-widest"
      style={{ color: colors[label], fontFamily: 'JetBrains Mono, monospace' }}
    >
      {label}
    </span>
  );
}
