export interface RateLimiterOptions {
  requestsPerMinute: number;
}

/**
 * Rate limiter simple en memoria (token bucket por minuto).
 */
export class RateLimiter {
  private readonly capacity: number;
  private tokens: number;
  private lastRefillAt: number;

  constructor(options: RateLimiterOptions) {
    this.capacity = Math.max(1, options.requestsPerMinute);
    this.tokens = this.capacity;
    this.lastRefillAt = Date.now();
  }

  async acquire(): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }

      const waitMs = Math.max(50, 60_000 / this.capacity);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillAt;
    if (elapsed <= 0) {
      return;
    }

    const tokensToAdd = (elapsed / 60_000) * this.capacity;
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefillAt = now;
    }
  }
}
