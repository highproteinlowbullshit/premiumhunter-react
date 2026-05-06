// src/components/WebSocketStatus.tsx
import type { WSStatus } from '../lib/finnhubWebSocket';
import { Tooltip } from './ui/Tooltip';

interface WebSocketStatusProps {
  status: WSStatus;
  /** Show "Live" / "Connecting" / "Offline" label next to the dot */
  showLabel?: boolean;
}

const STATUS_CONFIG: Record<WSStatus, { color: string; label: string; animate: boolean; tooltip: string }> = {
  connected:    { color: '#00e5c4', label: 'Live',       animate: true,  tooltip: 'Real-time prices are streaming live via Finnhub WebSocket.' },
  connecting:   { color: '#f5c842', label: 'Connecting', animate: true,  tooltip: 'Establishing live price feed — prices will update shortly.' },
  disconnected: { color: '#4a6a8a', label: 'Offline',    animate: false, tooltip: 'Live price feed is offline. Prices shown are from the last cached snapshot.' },
  error:        { color: '#ff4d6d', label: 'Offline',    animate: false, tooltip: 'Live price feed encountered an error. Prices shown are from the last cached snapshot.' },
};

export function WebSocketStatus({ status, showLabel = true }: WebSocketStatusProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <Tooltip content={cfg.tooltip} position="bottom" maxWidth={220}>
      <div className="flex items-center gap-2" style={{ cursor: 'default' }}>
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
    </Tooltip>
  );
}
