import {
  createCommunicationLogger,
  createInMemoryWebhookRateLimiter,
  createNoopDeliveryPolicyHandler,
  createNoopWebhookAlertSink,
  createNoopWebhookRateLimiter,
  createThresholdAlertTracker,
  createFakeWebhookSignatureVerifier,
} from "@repo/communications";
import {
  createResendSdkWebhookSignatureVerifier,
  createResendWebhookProcessor,
  loadResendWebhookConfig,
  type ResendWebhookProcessor,
} from "@repo/communications/tracking/resend";
import type { CommunicationWebhookReceiptRepository } from "@repo/communications/tracking/persistence";
import type { CommunicationWebhookEnvironmentPolicy } from "@repo/communications";
import type { CommunicationWebhookRateLimiter } from "@repo/communications";
import type { WebhookAlertConfig } from "@repo/communications";

export type BuildResendWebhookRuntimeOptions = {
  env: Readonly<Record<string, string | undefined>>;
  receiptRepository: CommunicationWebhookReceiptRepository;
  /** Solo tests / smoke — nunca en route productiva. */
  useFakeVerifier?: boolean;
  fakeSignatureValid?: boolean;
  rateLimiter?: CommunicationWebhookRateLimiter;
};

export type ResendWebhookRuntime =
  | {
      ok: true;
      enabled: true;
      mode: "verify_only" | "process" | "disabled";
      processor: ResendWebhookProcessor;
      environmentPolicy: CommunicationWebhookEnvironmentPolicy;
      rateLimiter: CommunicationWebhookRateLimiter;
      alertTracker: ReturnType<typeof createThresholdAlertTracker>;
      alerts: WebhookAlertConfig;
      phase: "C_verify_only" | "D_process";
    }
  | { ok: true; enabled: false; reason: "flag_off"; phase: "A_prepared" }
  | {
      ok: false;
      reason: "config_missing" | "mode_disabled";
      message: string;
      phase: "B_exposed_disabled" | "misconfigured";
    };

/**
 * Construye dependencias del webhook en request-time (sin side effects al importar).
 */
export function buildResendWebhookRuntime(
  options: BuildResendWebhookRuntimeOptions,
): ResendWebhookRuntime {
  const loaded = loadResendWebhookConfig(options.env);
  if (!loaded.ok) {
    return {
      ok: false,
      reason: "config_missing",
      message: loaded.errorMessage,
      phase: "misconfigured",
    };
  }

  const { config } = loaded;
  if (!config.enabled) {
    return { ok: true, enabled: false, reason: "flag_off", phase: "A_prepared" };
  }

  if (config.mode === "disabled") {
    return {
      ok: false,
      reason: "mode_disabled",
      message: "COMMUNICATIONS_WEBHOOK_MODE=disabled",
      phase: "B_exposed_disabled",
    };
  }

  const verifier = options.useFakeVerifier
    ? createFakeWebhookSignatureVerifier({
        valid: options.fakeSignatureValid !== false,
      })
    : createResendSdkWebhookSignatureVerifier({
        secret: config.secret,
        toleranceSeconds: config.toleranceSeconds,
      });

  const rateLimiter =
    options.rateLimiter ??
    (config.rateLimit.enabled
      ? createInMemoryWebhookRateLimiter(config.rateLimit)
      : createNoopWebhookRateLimiter());

  const alertTracker = createThresholdAlertTracker({
    config: config.alerts,
    sink: createNoopWebhookAlertSink(),
    environment: config.environmentPolicy.environment,
  });

  const processor = createResendWebhookProcessor({
    verifier,
    receiptRepository: options.receiptRepository,
    deliveryPolicy: createNoopDeliveryPolicyHandler(),
    environmentPolicy: config.environmentPolicy,
    logger: createCommunicationLogger({
      channel: "email",
      provider: "resend",
    }),
    mode: config.mode,
    maxBytes: config.maxBytes,
    allowHttpLinks: false,
  });

  return {
    ok: true,
    enabled: true,
    mode: config.mode,
    processor,
    environmentPolicy: config.environmentPolicy,
    rateLimiter,
    alertTracker,
    alerts: config.alerts,
    phase: config.mode === "process" ? "D_process" : "C_verify_only",
  };
}
