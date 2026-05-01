import { useState, useRef } from 'react';

interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: number;
}

export function Tooltip({ content, children, position = 'top', maxWidth = 240 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const posStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 1000,
    ...(position === 'top'    && { bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' }),
    ...(position === 'bottom' && { top: 'calc(100% + 6px)',    left: '50%', transform: 'translateX(-50%)' }),
    ...(position === 'left'   && { right: 'calc(100% + 6px)',  top: '50%',  transform: 'translateY(-50%)' }),
    ...(position === 'right'  && { left: 'calc(100% + 6px)',   top: '50%',  transform: 'translateY(-50%)' }),
  };

  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div style={{
          ...posStyle,
          background: 'rgba(5,13,26,0.95)',
          color: '#9ab4d4',
          fontSize: 12,
          lineHeight: 1.5,
          padding: '6px 10px',
          borderRadius: 6,
          maxWidth,
          whiteSpace: 'normal',
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          border: '1px solid rgba(0,229,196,0.15)',
          fontFamily: 'DM Sans, sans-serif',
        }}>
          {content}
        </div>
      )}
    </div>
  );
}
