import { useNavigate } from 'react-router-dom';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
      <div className="text-center">
        <p
          className="text-8xl font-bold mb-4"
          style={{ fontFamily: 'Syne, sans-serif', color: '#00e5c4' }}
        >
          404
        </p>
        <h1
          className="text-2xl font-bold mb-2"
          style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}
        >
          Page not found
        </h1>
        <p
          className="text-sm mb-8"
          style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}
        >
          This page doesn't exist or has been moved.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 rounded-xl text-sm font-semibold"
          style={{
            background: 'linear-gradient(135deg, #00e5c4, #00b4d8)',
            color: '#050d1a',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}
