interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

export function Skeleton({ width = '100%', height = 16, rounded = 'md', className }: SkeletonProps) {
  const r = rounded === 'full' ? '9999px' : rounded === 'lg' ? '8px' : rounded === 'sm' ? '2px' : '4px';
  return (
    <div
      className={`skeleton${className ? ` ${className}` : ''}`}
      style={{ width, height, borderRadius: r }}
    />
  );
}
