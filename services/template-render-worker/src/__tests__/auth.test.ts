import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  authenticateRequest,
  AuthError,
  hashBodySha256,
  ReplayGuard,
  signRequest,
} from "../auth.js";
import type { WorkerConfig } from "../config.js";

const SECRET = "test-hmac-secret";

const baseConfig: WorkerConfig = {
  port: 8787,
  hmacSecret: SECRET,
  maxBodyBytes: 2 * 1024 * 1024,
  timestampSkewMs: 60_000,
  replayTtlMs: 5 * 60_000,
};

function signedHeaders(input: {
  body: Buffer;
  requestId?: string;
  idempotencyKey?: string;
  timestamp?: string;
  signature?: string;
}) {
  const requestId = input.requestId ?? "req-1";
  const idempotencyKey = input.idempotencyKey ?? "idem-1";
  const timestamp = input.timestamp ?? String(Date.now());
  const signature =
    input.signature ??
    signRequest({
      secret: SECRET,
      timestamp,
      requestId,
      idempotencyKey,
      body: input.body,
    });

  return {
    "x-dnx-request-id": requestId,
    "x-dnx-timestamp": timestamp,
    "x-dnx-idempotency-key": idempotencyKey,
    "x-dnx-signature": signature,
  };
}

describe("template-render-worker auth", () => {
  let replayGuard: ReplayGuard;

  beforeEach(() => {
    replayGuard = new ReplayGuard(baseConfig.replayTtlMs);
    replayGuard.clearForTests();
  });

  it("accepts valid signature", () => {
    const body = Buffer.from(JSON.stringify({ hello: "world" }));
    const headers = signedHeaders({ body });
    const result = authenticateRequest({
      config: baseConfig,
      headers,
      body,
      replayGuard,
    });
    assert.equal(result.requestId, "req-1");
  });

  it("rejects invalid signature", () => {
    const body = Buffer.from("{}");
    const headers = signedHeaders({ body, signature: "deadbeef".repeat(8) });
    assert.throws(
      () =>
        authenticateRequest({
          config: baseConfig,
          headers,
          body,
          replayGuard,
        }),
      (err: unknown) =>
        err instanceof AuthError && err.code === "AUTH_SIGNATURE_INVALID"
    );
  });

  it("rejects expired timestamp", () => {
    const body = Buffer.from("{}");
    const headers = signedHeaders({
      body,
      timestamp: String(Date.now() - 120_000),
    });
    assert.throws(
      () =>
        authenticateRequest({
          config: baseConfig,
          headers,
          body,
          replayGuard,
        }),
      (err: unknown) =>
        err instanceof AuthError && err.code === "AUTH_TIMESTAMP_EXPIRED"
    );
  });

  it("rejects replayed requestId", () => {
    const body = Buffer.from("{}");
    const headers = signedHeaders({ body, requestId: "same-req" });
    authenticateRequest({ config: baseConfig, headers, body, replayGuard });
    assert.throws(
      () =>
        authenticateRequest({
          config: baseConfig,
          headers,
          body,
          replayGuard,
        }),
      (err: unknown) => err instanceof AuthError && err.code === "AUTH_REPLAY"
    );
  });

  it("hashes body deterministically", () => {
    const body = Buffer.from("abc");
    assert.equal(
      hashBodySha256(body),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});
