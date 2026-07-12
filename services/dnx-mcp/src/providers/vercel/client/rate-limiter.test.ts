import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limiter.js";

describe("RateLimiter", () => {
  it("permite requests hasta el límite configurado", async () => {
    let now = 0;
    const sleeps: number[] = [];

    const limiter = new RateLimiter({
      requestsPerMinute: 2,
      now: () => now,
      sleep: (ms) => {
        sleeps.push(ms);
        now += ms;
        return Promise.resolve();
      },
    });

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    expect(sleeps.length).toBeGreaterThan(0);
  });
});
