// src/components/WebSocketStatus.tsx
import type { WSStatus } from '../lib/finnhubWebSocket';

interface WebSocketStatusProps {
  status: WSStatus;
  /** Show "Live" / "Connecting" / "Offline" label next to the dot */
  showLabel?: boolean;
}

const STATUS_CONFIG: Record<WSStatus, { color: string; label: string; animate: boolean }> = {
  connected: { color: '#00e5c4', label: 'Live', animate: true },
  connecting: { color: '#f5c842', label: 'Connecting', animate: true },
  disconnected: { color: '#4a6a8a', label: 'Offline', animate: false },
  error: { color: '#ff4d6d', label: 'Offline', animate: false },
};

export function WebSocketStatus({ status, showLabel = true }: WebSocketStatusProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div className="flex items-center gap-2">
      <span
        className={cfg.animate ? 'w-2 h-2 rounded-full animate-pulse-glow' : 'w-2 h-2 rounded-full'}
        style={{ background: cfg.color }}
      />
      {showLabel && (
        <span
          className="text-xs"
          style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}
        >
          {cfg.label}
        </span>
      )}
    </div>
  );
}
