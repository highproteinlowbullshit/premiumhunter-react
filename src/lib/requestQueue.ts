// Slot-based rate limiter: each caller atomically reserves a future time slot.
// Callers fire concurrently but their HTTP requests are staggered by `delayMs`.
// This lets 30 calls complete in ~(30 * delay) ms total, not sequentially blocked.

export const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

class SlottedQueue {
  private nextSlot = 0;
  private delay: number;

  constructor(delay: number) {
    this.delay = delay;
  }

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + this.delay;
    const wait = slot - now;
    if (wait > 0) await sleep(wait);
    return fn();
  }
}

// Finnhub free tier: 60 calls/min → 1 per ~1000ms, but in practice 10/s is safe
export const finnhubQueue = new SlottedQueue(110);

// Polygon free tier: 5 requests/sec → 1 per 200ms
export const polygonQueue = new SlottedQueue(220);
