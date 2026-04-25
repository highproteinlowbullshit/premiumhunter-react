export function measurePageLoad(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('load', () => {
    // Defer so paint entries are available
    setTimeout(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return;

      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find(e => e.name === 'first-contentful-paint')?.startTime ?? 0;
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint' as any);
      const lcp = lcpEntries.length > 0 ? (lcpEntries[lcpEntries.length - 1] as PerformanceEntry).startTime : 0;

      const metrics = {
        ttfb: Math.round(nav.responseStart - nav.requestStart),
        fcp:  Math.round(fcp),
        lcp:  Math.round(lcp),
        domInteractive: Math.round(nav.domInteractive),
        loadComplete:   Math.round(nav.loadEventEnd),
        url: window.location.pathname,
      };

      if (import.meta.env.DEV) {
        console.group('%c⚡ Performance Metrics', 'color:#00e5c4;font-weight:bold');
        console.table(metrics);
        console.groupEnd();
      }
    }, 0);
  });
}
