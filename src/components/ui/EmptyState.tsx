import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 12, padding: '48px 24px', textAlign: 'center',
    }}>
      <div style={{ color: 'var(--ph-text-3)', opacity: 0.7 }}>
        {icon ?? <Inbox size={36} strokeWidth={1.5} />}
      </div>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ph-text-1)', fontFamily: 'Syne, sans-serif' }}>
        {title}
      </h3>
      {description && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ph-text-3)', maxWidth: 360, lineHeight: 1.6, fontFamily: 'DM Sans, sans-serif' }}>
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600,
            background: '#00e5c4', color: '#050d1a', border: 'none', borderRadius: 8, cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          {action.label}
        </button>
      )}
      {secondaryAction && (
        <button
          onClick={secondaryAction.onClick}
          style={{
            padding: '6px 16px', fontSize: 12, background: 'transparent',
            color: 'var(--ph-text-3)', border: '1px solid var(--ph-border-md)',
            borderRadius: 6, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          }}
        >
          {secondaryAction.label}
        </button>
      )}
    </div>
  );
}
