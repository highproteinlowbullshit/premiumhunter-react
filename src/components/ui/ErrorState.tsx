interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

import { AlertTriangle } from 'lucide-react';

export function ErrorState({ message = 'Failed to load data', onRetry, compact = false }: ErrorStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 12, padding: compact ? '16px' : '40px',
      color: 'var(--ph-text-3)',
    }}>
      <AlertTriangle size={compact ? 20 : 32} strokeWidth={1.5} color="#f5c842" />
      <p style={{ margin: 0, fontSize: 13, textAlign: 'center', fontFamily: 'DM Sans, sans-serif', color: 'var(--ph-text-2)' }}>
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '6px 16px', fontSize: 12, border: '1px solid var(--ph-border-md)',
            borderRadius: 6, background: 'transparent', color: 'var(--ph-text-2)',
            cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
