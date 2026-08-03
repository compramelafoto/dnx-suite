import { createHash, createHmac, randomUUID } from "node:crypto";
import type { ResolvedTemplateDocument } from "@repo/template-engine";
import { CLICKATON_CARD_RENDERER_VERSION } from "./participant-card-renderer-version";

export const DNX_TEMPLATE_RENDER_AUTH_HEADERS = {
  requestId: "X-DNX-Request-Id",
  timestamp: "X-DNX-Timestamp",
  signature: "X-DNX-Signature",
  idempotencyKey: "X-DNX-Idempotency-Key",
} as const;

export function hashBodySha256(body: string | Buffer): string {
  return createHash("sha256")
    .update(typeof body === "string" ? Buffer.from(body) : body)
    .digest("hex");
}

export function buildTemplateRenderSignaturePayload(input: {
  timestamp: string;
  requestId: string;
  idempotencyKey: string;
  bodySha256: string;
}): string {
  return `${input.timestamp}.${input.requestId}.${input.idempotencyKey}.${input.bodySha256}`;
}

export function signTemplateRenderRequest(input: {
  secret: string;
  requestId: string;
  idempotencyKey: string;
  body: string | Buffer;
  timestampMs?: number;
}): {
  requestId: string;
  idempotencyKey: string;
  timestamp: string;
  signature: string;
  headers: Record<string, string>;
} {
  const timestamp = String(input.timestampMs ?? Date.now());
  const bodySha256 = hashBodySha256(input.body);
  const payload = buildTemplateRenderSignaturePayload({
    timestamp,
    requestId: input.requestId,
    idempotencyKey: input.idempotencyKey,
    bodySha256,
  });
  const signature = createHmac("sha256", input.secret).update(payload).digest("hex");

  return {
    requestId: input.requestId,
    idempotencyKey: input.idempotencyKey,
    timestamp,
    signature,
    headers: {
      [DNX_TEMPLATE_RENDER_AUTH_HEADERS.requestId]: input.requestId,
      [DNX_TEMPLATE_RENDER_AUTH_HEADERS.timestamp]: timestamp,
      [DNX_TEMPLATE_RENDER_AUTH_HEADERS.idempotencyKey]: input.idempotencyKey,
      [DNX_TEMPLATE_RENDER_AUTH_HEADERS.signature]: signature,
      "content-type": "application/json",
    },
  };
}

export function buildRemoteTemplateRenderBody(input: {
  document: ResolvedTemplateDocument;
  requestId: string;
  idempotencyKey: string;
}): string {
  const metadata = input.document.metadata ?? {};
  const templateKey =
    typeof metadata.templateKey === "string"
      ? metadata.templateKey
      : input.document.id ?? input.document.name;

  return JSON.stringify({
    requestId: input.requestId,
    idempotencyKey: input.idempotencyKey,
    templateKey,
    templateVersion: String(input.document.schemaVersion),
    rendererVersion: CLICKATON_CARD_RENDERER_VERSION,
    templateDocument: input.document,
    document: input.document,
    output: {
      format: "png",
      width: input.document.width,
      height: input.document.height,
    },
  });
}

export function createRemoteRenderRequestIds(): {
  requestId: string;
  idempotencyKey: string;
} {
  return {
    requestId: randomUUID(),
    idempotencyKey: randomUUID(),
  };
}
