import { useEffect, useState } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  accentColor?: string;
  delay?: number;
}

export function StatCard({
  label,
  value,
  prefix = '',
  suffix = '',
  change,
  changeLabel,
  icon,
  accentColor = '#00e5c4',
  delay = 0,
}: StatCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const isPositive = change !== undefined && change >= 0;

  return (
    <div
      className="stat-card-hover rounded-xl p-5 relative overflow-hidden"
      style={{
        background: 'rgba(13, 27, 53, 0.6)',
        border: '1px solid rgba(0, 229, 196, 0.1)',
        backdropFilter: 'blur(12px)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      }}
    >
      {/* Accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}40, transparent)` }}
      />

      {/* Icon + label row */}
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-medium tracking-widest uppercase"
          style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.1em' }}>
          {label}
        </p>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${accentColor}15`, color: accentColor }}
        >
          {icon}
        </div>
      </div>

      {/* Value */}
      <div className="flex items-end gap-2">
        <p
          className="text-2xl font-bold tabular-nums leading-none"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            color: '#e8f0fe',
          }}
        >
          {prefix}<span>{value}</span>{suffix}
        </p>
      </div>

      {/* Change indicator */}
      {change !== undefined && (
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className="text-xs font-medium"
            style={{
              color: isPositive ? '#00d68f' : '#ff4d6d',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {isPositive ? '↑' : '↓'} {Math.abs(change)}{suffix}
          </span>
          {changeLabel && (
            <span className="text-xs" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
              {changeLabel}
            </span>
          )}
        </div>
      )}

      {/* Background glow */}
      <div
        className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full pointer-events-none"
        style={{ background: `${accentColor}06`, filter: 'blur(20px)' }}
      />
    </div>
  );
}
