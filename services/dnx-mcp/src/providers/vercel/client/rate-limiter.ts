export interface RateLimiterOptions {
  requestsPerMinute: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Rate limiter basado en ventana deslizante.
 * Garantiza que no se exceda el límite de requests por minuto.
 */
export class RateLimiter {
  private readonly windowMs = 60_000;
  private readonly maxRequests: number;
  private readonly timestamps: number[] = [];
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.requestsPerMinute;
    this.now = options.now ?? (() => Date.now());
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async acquire(): Promise<void> {
    for (;;) {
      this.prune();
      if (this.timestamps.length < this.maxRequests) {
        this.timestamps.push(this.now());
        return;
      }

      const oldest = this.timestamps[0];
      if (oldest === undefined) {
        return;
      }

      const waitMs = this.windowMs - (this.now() - oldest) + 10;
      await this.sleep(Math.max(waitMs, 50));
    }
  }

  private prune(): void {
    const cutoff = this.now() - this.windowMs;
    while (this.timestamps.length > 0) {
      const oldest = this.timestamps[0];
      if (oldest === undefined || oldest > cutoff) {
        break;
      }
      this.timestamps.shift();
    }
  }
}
