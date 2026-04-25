export function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#050d1a',
    }}>
      <div style={{
        width: 28,
        height: 28,
        border: '2px solid rgba(0,229,196,0.2)',
        borderTopColor: '#00e5c4',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
