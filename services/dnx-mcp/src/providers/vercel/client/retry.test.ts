import { describe, expect, it } from "vitest";
import {
  calculateBackoffMs,
  isRetryableStatus,
  parseRetryAfterMs,
  RetryableRequestError,
  withRetry,
} from "./retry.js";

describe("retry", () => {
  it("identifica status retryables", () => {
    expect(isRetryableStatus(429, [429, 500])).toBe(true);
    expect(isRetryableStatus(400, [429, 500])).toBe(false);
  });

  it("parsea Retry-After en segundos", () => {
    expect(parseRetryAfterMs("2")).toBe(2000);
  });

  it("calcula backoff exponencial", () => {
    expect(calculateBackoffMs(0, 500, 10_000)).toBeGreaterThanOrEqual(500);
    expect(calculateBackoffMs(3, 500, 10_000)).toBeLessThanOrEqual(10_000);
  });

  it("reintenta en errores retryables y luego tiene éxito", async () => {
    let attempts = 0;
    const sleeps: number[] = [];

    const result = await withRetry(
      () => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(new RetryableRequestError(503, "temporal"));
        }
        return Promise.resolve("ok");
      },
      {
        maxRetries: 3,
        baseDelayMs: 10,
        sleep: (ms) => {
          sleeps.push(ms);
          return Promise.resolve();
        },
      },
    );

    expect(result).toBe("ok");
    expect(attempts).toBe(2);
    expect(sleeps).toHaveLength(1);
  });

  it("no reintenta errores no retryables", async () => {
    let attempts = 0;

    await expect(
      withRetry(
        () => {
          attempts++;
          return Promise.reject(new RetryableRequestError(400, "bad request"));
        },
        { maxRetries: 3, baseDelayMs: 10 },
      ),
    ).rejects.toThrow("bad request");

    expect(attempts).toBe(1);
  });
});
