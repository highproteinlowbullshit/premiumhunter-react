import { useToast } from '../context/ToastContext';

const TYPE_STYLES = {
  success: {
    border: '1px solid rgba(0,214,143,0.3)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="#00d68f" strokeWidth="1.2" />
        <path d="M4 7l2 2 4-4" stroke="#00d68f" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: '#00d68f',
  },
  error: {
    border: '1px solid rgba(255,77,109,0.3)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="#ff4d6d" strokeWidth="1.2" />
        <path d="M5 5l4 4M9 5l-4 4" stroke="#ff4d6d" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
    color: '#ff4d6d',
  },
  info: {
    border: '1px solid rgba(0,198,245,0.3)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="#00c6f5" strokeWidth="1.2" />
        <line x1="7" y1="6" x2="7" y2="10" stroke="#00c6f5" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="7" cy="4" r="0.7" fill="#00c6f5" />
      </svg>
    ),
    color: '#00c6f5',
  },
};

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-20 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      style={{ maxWidth: '320px' }}
    >
      {toasts.map((toast) => {
        const styles = TYPE_STYLES[toast.type];
        return (
          <div
            key={toast.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl pointer-events-auto"
            style={{
              background: 'rgba(5, 13, 26, 0.96)',
              border: styles.border,
              backdropFilter: 'blur(16px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              animation: 'fadeSlideIn 0.25s ease-out',
            }}
          >
            <span className="flex-shrink-0">{styles.icon}</span>
            <span
              className="text-sm flex-1"
              style={{ color: '#e8f0fe', fontFamily: 'DM Sans, sans-serif' }}
            >
              {toast.message}
            </span>
            <button
              onClick={() => dismissToast(toast.id)}
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-md hover:bg-[rgba(255,255,255,0.06)] transition-colors"
              style={{ color: '#4a6a8a' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
