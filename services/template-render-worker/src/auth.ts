import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { WorkerConfig } from "./config.js";

export const DNX_AUTH_HEADERS = {
  requestId: "x-dnx-request-id",
  timestamp: "x-dnx-timestamp",
  signature: "x-dnx-signature",
  idempotencyKey: "x-dnx-idempotency-key",
} as const;

export type AuthHeaderValues = {
  requestId: string;
  timestamp: string;
  idempotencyKey: string;
  signature: string;
};

export class AuthError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function hashBodySha256(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

export function buildSignaturePayload(input: {
  timestamp: string;
  requestId: string;
  idempotencyKey: string;
  bodySha256: string;
}): string {
  return `${input.timestamp}.${input.requestId}.${input.idempotencyKey}.${input.bodySha256}`;
}

export function signRequest(input: {
  secret: string;
  timestamp: string;
  requestId: string;
  idempotencyKey: string;
  body: Buffer | string;
}): string {
  const bodySha256 = hashBodySha256(
    typeof input.body === "string" ? Buffer.from(input.body) : input.body
  );
  const payload = buildSignaturePayload({
    timestamp: input.timestamp,
    requestId: input.requestId,
    idempotencyKey: input.idempotencyKey,
    bodySha256,
  });
  return createHmac("sha256", input.secret).update(payload).digest("hex");
}

export function readAuthHeaders(
  headers: Record<string, string | string[] | undefined>
): AuthHeaderValues {
  const requestId = headerValue(headers, DNX_AUTH_HEADERS.requestId);
  const timestamp = headerValue(headers, DNX_AUTH_HEADERS.timestamp);
  const idempotencyKey = headerValue(headers, DNX_AUTH_HEADERS.idempotencyKey);
  const signature = headerValue(headers, DNX_AUTH_HEADERS.signature);

  if (!requestId || !timestamp || !idempotencyKey || !signature) {
    throw new AuthError(401, "AUTH_HEADERS_MISSING", "Headers X-DNX-* incompletos");
  }

  return { requestId, timestamp, idempotencyKey, signature };
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  const raw = headers[name];
  if (Array.isArray(raw)) return raw[0]?.trim() || undefined;
  return raw?.trim() || undefined;
}

export function verifySignature(input: {
  secret: string;
  headers: AuthHeaderValues;
  body: Buffer;
}): void {
  const expected = signRequest({
    secret: input.secret,
    timestamp: input.headers.timestamp,
    requestId: input.headers.requestId,
    idempotencyKey: input.headers.idempotencyKey,
    body: input.body,
  });

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(input.headers.signature, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AuthError(401, "AUTH_SIGNATURE_INVALID", "Firma HMAC inválida");
  }
}

export function assertTimestampFresh(
  timestampRaw: string,
  config: Pick<WorkerConfig, "timestampSkewMs">
): void {
  const timestamp = Number.parseInt(timestampRaw, 10);
  if (!Number.isFinite(timestamp)) {
    throw new AuthError(401, "AUTH_TIMESTAMP_INVALID", "Timestamp inválido");
  }
  const skew = Math.abs(Date.now() - timestamp);
  if (skew > config.timestampSkewMs) {
    throw new AuthError(401, "AUTH_TIMESTAMP_EXPIRED", "Timestamp fuera de ventana");
  }
}

type ReplayEntry = { expiresAt: number };

export class ReplayGuard {
  private readonly seen = new Map<string, ReplayEntry>();

  constructor(private readonly ttlMs: number) {}

  assertFreshRequestId(requestId: string, now = Date.now()): void {
    this.prune(now);
    if (this.seen.has(requestId)) {
      throw new AuthError(409, "AUTH_REPLAY", "RequestId ya procesado (replay)");
    }
    this.seen.set(requestId, { expiresAt: now + this.ttlMs });
  }

  prune(now = Date.now()): void {
    for (const [key, entry] of this.seen) {
      if (entry.expiresAt <= now) this.seen.delete(key);
    }
  }

  clearForTests(): void {
    this.seen.clear();
  }
}

export function authenticateRequest(input: {
  config: WorkerConfig;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  replayGuard: ReplayGuard;
}): AuthHeaderValues {
  if (input.body.length > input.config.maxBodyBytes) {
    throw new AuthError(413, "AUTH_BODY_TOO_LARGE", "Body supera 2MB");
  }

  const authHeaders = readAuthHeaders(input.headers);
  assertTimestampFresh(authHeaders.timestamp, input.config);
  verifySignature({
    secret: input.config.hmacSecret,
    headers: authHeaders,
    body: input.body,
  });
  input.replayGuard.assertFreshRequestId(authHeaders.requestId);

  return authHeaders;
}
