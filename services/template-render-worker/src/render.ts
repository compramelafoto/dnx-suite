import {
  parseTemplateDocument,
  type ResolvedTemplateDocument,
} from "@repo/template-engine";
import {
  previewInvalid,
  renderTemplatePreviewPng,
  TemplateRenderError,
} from "@repo/template-engine-renderer";
import { hashBodySha256 } from "./auth.js";
import { recordRenderFailure, recordRenderSuccess } from "./circuit.js";
import type {
  TemplateRenderRequestBody,
  TemplateRenderSuccessResponse,
} from "./types.js";

type IdempotencyEntry = {
  bodyHash: string;
  response: TemplateRenderSuccessResponse;
  expiresAt: number;
};

const idempotencyCache = new Map<string, IdempotencyEntry>();
const IDEMPOTENCY_TTL_MS = 5 * 60_000;

function pruneIdempotency(now = Date.now()): void {
  for (const [key, entry] of idempotencyCache) {
    if (entry.expiresAt <= now) idempotencyCache.delete(key);
  }
}

export function resolveCachedRender(input: {
  idempotencyKey: string;
  body: Buffer;
}):
  | { kind: "hit"; response: TemplateRenderSuccessResponse }
  | { kind: "conflict" }
  | { kind: "miss" } {
  pruneIdempotency();
  const bodyHash = hashBodySha256(input.body);
  const existing = idempotencyCache.get(input.idempotencyKey);
  if (!existing) return { kind: "miss" };
  if (existing.bodyHash !== bodyHash) return { kind: "conflict" };
  return {
    kind: "hit",
    response: { ...existing.response, cached: true },
  };
}

export function storeIdempotentRender(input: {
  idempotencyKey: string;
  body: Buffer;
  response: TemplateRenderSuccessResponse;
}): void {
  const bodyHash = hashBodySha256(input.body);
  idempotencyCache.set(input.idempotencyKey, {
    bodyHash,
    response: input.response,
    expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
  });
}

export function __clearIdempotencyCacheForTests(): void {
  idempotencyCache.clear();
}

function toResolvedDocument(body: TemplateRenderRequestBody): ResolvedTemplateDocument {
  const raw = body.document ?? body.templateDocument;
  if (!raw || typeof raw !== "object") {
    throw previewInvalid("document inválido");
  }

  const parsed = parseTemplateDocument(raw);
  if (!parsed.ok) {
    throw previewInvalid(parsed.error, parsed.issues);
  }

  return parsed.data as ResolvedTemplateDocument;
}

export async function renderTemplateRequest(
  body: TemplateRenderRequestBody,
  rawBody: Buffer
): Promise<TemplateRenderSuccessResponse> {
  const cached = resolveCachedRender({
    idempotencyKey: body.idempotencyKey,
    body: rawBody,
  });
  if (cached.kind === "hit") {
    recordRenderSuccess(cached.response.durationMs, true);
    return cached.response;
  }
  if (cached.kind === "conflict") {
    throw new RenderConflictError();
  }

  const document = toResolvedDocument(body);

  try {
    const rendered = await renderTemplatePreviewPng(document);
    const response: TemplateRenderSuccessResponse = {
      ok: true,
      pngBase64: rendered.png.toString("base64"),
      width: rendered.width,
      height: rendered.height,
      durationMs: rendered.durationMs,
      mimeType: "image/png",
    };

    storeIdempotentRender({
      idempotencyKey: body.idempotencyKey,
      body: rawBody,
      response,
    });
    recordRenderSuccess(rendered.durationMs, false);
    return response;
  } catch (err) {
    recordRenderFailure();
    throw err;
  }
}

export class RenderConflictError extends Error {
  readonly statusCode = 409;
  readonly code = "IDEMPOTENCY_CONFLICT";

  constructor() {
    super("Idempotency key reutilizada con body distinto");
    this.name = "RenderConflictError";
  }
}

export function mapRenderError(err: unknown): { status: number; body: Record<string, unknown> } {
  if (err instanceof RenderConflictError) {
    return {
      status: 409,
      body: { ok: false, error: err.message, code: err.code },
    };
  }

  if (err instanceof TemplateRenderError) {
    const unavailable =
      err.code === "TEMPLATE_PREVIEW_UNAVAILABLE" ||
      err.code === "TEMPLATE_PREVIEW_BUSY";
    return {
      status: unavailable ? 503 : 422,
      body: { ok: false, error: err.message, code: err.code },
    };
  }

  const message = err instanceof Error ? err.message : "Render falló";
  return { status: 500, body: { ok: false, error: message, code: "RENDER_FAILED" } };
}
