import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { GatewayConfig } from "./config.js";
import {
  checkUploadRateLimit,
  rateLimitKey,
  recordSuccessfulUpload,
  resetRateLimitState,
} from "./rate-limit.js";

function testConfig(maxFiles: number, windowMs: number): GatewayConfig {
  return {
    DATABASE_URL: "postgresql://test",
    R2_ACCOUNT_ID: "a",
    R2_ACCESS_KEY_ID: "b",
    R2_SECRET_ACCESS_KEY: "c",
    R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
    CAMERA_CONNECTION_FTP_PORT: 21,
    FTP_PASV_MIN_PORT: 50000,
    FTP_PASV_MAX_PORT: 50050,
    FTP_MAX_UPLOAD_BYTES: 31_457_280,
    FTP_RATE_LIMIT_WINDOW_MS: windowMs,
    FTP_RATE_LIMIT_MAX_FILES: maxFiles,
    HEALTH_PORT: 8080,
    r2BucketName: "test-bucket",
    pasvUrl: "127.0.0.1",
  };
}

describe("rate-limit", () => {
  beforeEach(() => {
    resetRateLimitState();
  });

  it("permite subidas dentro del límite", () => {
    const config = testConfig(3, 60_000);
    const key = rateLimitKey(1, "u1");

    assert.equal(checkUploadRateLimit(config, key).allowed, true);
    recordSuccessfulUpload(key);
    recordSuccessfulUpload(key);

    const third = checkUploadRateLimit(config, key);
    assert.equal(third.allowed, true);
    if (third.allowed) {
      assert.equal(third.remaining, 1);
    }
  });

  it("bloquea al superar el máximo", () => {
    const config = testConfig(2, 60_000);
    const key = rateLimitKey(9, "u9");

    recordSuccessfulUpload(key);
    recordSuccessfulUpload(key);

    const blocked = checkUploadRateLimit(config, key);
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.ok(blocked.retryAfterMs > 0);
    }
  });
});
