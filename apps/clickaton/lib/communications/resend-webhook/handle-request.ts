import {
  createCommunicationLogger,
} from "@repo/communications";
import type { CommunicationWebhookReceiptRepository } from "@repo/communications/tracking/persistence";
import {
  disabledEndpointResponse,
  mapWebhookResultToHttp,
  methodNotAllowedResponse,
  type ResendWebhookHttpResult,
} from "./http";
import { buildResendWebhookRuntime } from "./runtime";

export type HandleResendWebhookOptions = {
  request: Request;
  env: Readonly<Record<string, string | undefined>>;
  receiptRepository: CommunicationWebhookReceiptRepository;
  useFakeVerifier?: boolean;
  fakeSignatureValid?: boolean;
  requestId?: string;
};

function extractSvixHeaders(
  request: Request,
): Record<string, string | undefined> {
  return {
    "svix-id": request.headers.get("svix-id") ?? undefined,
    "svix-timestamp": request.headers.get("svix-timestamp") ?? undefined,
    "svix-signature": request.headers.get("svix-signature") ?? undefined,
    "content-type": request.headers.get("content-type") ?? undefined,
  };
}

/**
 * Clave opaca de rate limit: no email, no providerEventId.
 */
function rateLimitKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!fwd) return "rl_global";
  let h = 0;
  for (let i = 0; i < fwd.length; i += 1) {
    h = (Math.imul(31, h) + fwd.charCodeAt(i)) | 0;
  }
  return `rl_${(h >>> 0).toString(16)}`;
}

/**
 * Capa delgada HTTP → processor. Invocable sin servidor (tests / smoke).
 */
export async function handleResendWebhookRequest(
  options: HandleResendWebhookOptions,
): Promise<ResendWebhookHttpResult> {
  const logger = createCommunicationLogger({
    channel: "email",
    provider: "resend",
  });
  const started = Date.now();
  const requestId = options.requestId ?? crypto.randomUUID().slice(0, 12);
  let alertEmitted = false;

  if (options.request.method !== "POST") {
    return methodNotAllowedResponse();
  }

  const runtime = buildResendWebhookRuntime({
    env: options.env,
    receiptRepository: options.receiptRepository,
    useFakeVerifier: options.useFakeVerifier,
    fakeSignatureValid: options.fakeSignatureValid,
  });

  if (runtime.ok && !runtime.enabled) {
    return disabledEndpointResponse("flag_off");
  }
  if (!runtime.ok) {
    if (runtime.reason === "mode_disabled") {
      return mapWebhookResultToHttp({
        ok: false,
        status: "rejected",
        provider: "resend",
        errorCode: "WEBHOOK_DISABLED",
      });
    }
    return disabledEndpointResponse("config_missing");
  }

  const contentType = options.request.headers.get("content-type") ?? "";
  if (
    contentType &&
    !contentType.toLowerCase().includes("application/json") &&
    !contentType.toLowerCase().includes("text/plain")
  ) {
    return {
      status: 415,
      body: { received: false, status: "unsupported_media_type" },
      headers: {
        "Cache-Control": "no-store",
      },
    };
  }

  const rl = await runtime.rateLimiter.consume({
    key: rateLimitKey(options.request),
  });
  if (!rl.allowed) {
    logger.warn("webhook rate limited", {
      requestId,
      backend: rl.backend,
    });
    return {
      status: 429,
      body: { received: false, status: "rate_limited" },
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(rl.retryAfterSeconds || 60),
      },
    };
  }

  // Body crudo — NUNCA request.json() antes de verificar.
  const rawBody = await options.request.text();
  const headers = extractSvixHeaders(options.request);

  const result = await runtime.processor.process({
    rawBody,
    headers,
    receivedAt: new Date(),
  });

  if (
    result.errorCode === "WEBHOOK_SIGNATURE_INVALID" ||
    result.errorCode === "WEBHOOK_SIGNATURE_MISSING" ||
    result.errorCode === "WEBHOOK_SIGNATURE_EXPIRED"
  ) {
    const emitted = await runtime.alertTracker.onSignatureFailure(requestId);
    alertEmitted = emitted.emitted;
  }
  if (
    result.status === "failed" &&
    result.errorCode === "WEBHOOK_HANDLER_FAILED"
  ) {
    const emitted = await runtime.alertTracker.onDatabaseFailure(requestId);
    alertEmitted = emitted.emitted;
  }

  const http = mapWebhookResultToHttp(result);
  logger.info("resend webhook ingress", {
    requestId,
    environment: runtime.environmentPolicy.environment,
    mode: runtime.mode,
    phase: runtime.phase,
    resultStatus: result.status,
    errorCode: result.errorCode ?? null,
    eventType: result.eventType ?? null,
    durationMs: Date.now() - started,
    duplicate: result.status === "duplicate",
    rateLimitBackend: rl.backend,
    alertEmitted,
  });

  return http;
}

export function toNextResponse(result: ResendWebhookHttpResult): Response {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...result.headers,
    },
  });
}
