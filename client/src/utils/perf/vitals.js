// lightweight web-vitals setup (lazy-import)
export async function initWebVitals(onReport) {
  try {
    const { onCLS, onFID, onLCP, onFCP, onTTFB, onINP } = await import('web-vitals');
    const report = (metric) => (typeof onReport === 'function' ? onReport(metric) : console.info('[vitals]', metric));
    onCLS(report); onFID(report); onLCP(report); onFCP(report); onTTFB(report); onINP?.(report);
  } catch {
    // ignore if not supported
  }
}
