import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';
import type { IVDataPoint } from '../types';

interface IVChartProps {
  data: IVDataPoint[];
  height?: number;
  showGrid?: boolean;
  compact?: boolean;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as IVDataPoint;

  const getColor = (v: number) => v < 30 ? '#00d68f' : v < 60 ? '#f5c842' : '#ff4d6d';

  return (
    <div
      className="rounded-xl p-3 text-xs"
      style={{
        background: 'rgba(5, 13, 26, 0.95)',
        border: '1px solid rgba(0, 229, 196, 0.2)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <p className="font-medium mb-1.5" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif' }}>
        {d?.date}
      </p>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ background: getColor(d?.ivRank) }} />
        <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>IV Rank</span>
        <span
          className="font-semibold ml-auto"
          style={{ color: getColor(d?.ivRank), fontFamily: 'JetBrains Mono, monospace' }}
        >
          {d?.ivRank}
        </span>
      </div>
      {d?.iv && (
        <div className="flex items-center gap-2 mt-1">
          <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(0,198,245,0.8)' }} />
          <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>IV</span>
          <span
            className="font-semibold ml-auto"
            style={{ color: '#00c6f5', fontFamily: 'JetBrains Mono, monospace' }}
          >
            {d?.iv}%
          </span>
        </div>
      )}
    </div>
  );
}

export function IVChart({ data, height = 280, showGrid = true, compact = false }: IVChartProps) {
  // Show every 4th label on full chart, every 8th on compact
  const labelInterval = compact ? 12 : 7;

  const displayData = compact ? data.filter((_, i) => i % 2 === 0) : data;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={displayData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
        <defs>
          <linearGradient id="ivGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00e5c4" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#00e5c4" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="ivGradientRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ff4d6d" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#ff4d6d" stopOpacity={0} />
          </linearGradient>
        </defs>

        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
        )}

        <XAxis
          dataKey="date"
          tick={{ fill: '#4a6a8a', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
          tickLine={false}
          axisLine={false}
          interval={labelInterval}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: '#4a6a8a', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
          tickLine={false}
          axisLine={false}
          ticks={compact ? [25, 50, 75] : [0, 25, 50, 75, 100]}
        />

        {/* Reference zones */}
        <ReferenceLine y={30} stroke="rgba(0, 214, 143, 0.15)" strokeDasharray="4 4" />
        <ReferenceLine y={60} stroke="rgba(245, 200, 66, 0.15)" strokeDasharray="4 4" />

        <Tooltip content={<CustomTooltip />} />

        <Area
          type="monotone"
          dataKey="ivRank"
          stroke="#00e5c4"
          strokeWidth={1.5}
          fill="url(#ivGradient)"
          dot={false}
          activeDot={{
            r: 4,
            fill: '#00e5c4',
            stroke: '#050d1a',
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Sparkline for watchlist/dashboard cards
export function IVSparkline({ data, height = 48 }: { data: IVDataPoint[]; height?: number }) {
  const recent = data.slice(-12);
  const last = recent[recent.length - 1]?.ivRank || 50;
  const color = last < 30 ? '#00d68f' : last < 60 ? '#f5c842' : '#ff4d6d';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={recent} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey="ivRank"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          strokeOpacity={0.8}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
