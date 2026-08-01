import type { CommunicationsWebhookMode } from "../contracts";
import {
  parseAllowedTrackingEvents,
  parseDeclaredEnvironment,
  resolveWebhookEnvironmentPolicy,
  type CommunicationWebhookEnvironmentPolicy,
} from "../environment-policy";
import type { WebhookAlertConfig } from "../alerts";
import type { WebhookRateLimitConfig } from "../rate-limit";
import { DEFAULT_WEBHOOK_MAX_BYTES } from "./types";

export type ResendWebhookConfig = {
  secret: string;
  toleranceSeconds: number;
  mode: CommunicationsWebhookMode;
  maxBytes: number;
  enabled: boolean;
  recipientHashSecret?: string;
  environmentPolicy: CommunicationWebhookEnvironmentPolicy;
  rateLimit: WebhookRateLimitConfig;
  alerts: WebhookAlertConfig;
  expectedStagingUrl?: string;
};

export type LoadResendWebhookConfigResult =
  | { ok: true; config: ResendWebhookConfig }
  | {
      ok: false;
      errorCode: "WEBHOOK_CONFIGURATION_MISSING";
      errorMessage: string;
    };

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === "") return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return fallback;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? String(fallback), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Carga config webhook desde un env explícito — no en import time.
 */
export function loadResendWebhookConfig(
  env: Readonly<Record<string, string | undefined>>,
): LoadResendWebhookConfigResult {
  const secret = env.RESEND_WEBHOOK_SECRET?.trim() ?? "";
  const enabled = parseBool(env.COMMUNICATIONS_RESEND_WEBHOOK_ENABLED, false);
  const modeRaw = (env.COMMUNICATIONS_WEBHOOK_MODE ?? "disabled")
    .trim()
    .toLowerCase();
  const mode: CommunicationsWebhookMode =
    modeRaw === "verify_only" || modeRaw === "process" || modeRaw === "disabled"
      ? modeRaw
      : "disabled";

  const allowed = parseAllowedTrackingEvents(
    env.COMMUNICATIONS_WEBHOOK_ALLOWED_EVENTS,
  );
  if (!allowed.ok) {
    return {
      ok: false,
      errorCode: "WEBHOOK_CONFIGURATION_MISSING",
      errorMessage: allowed.errorMessage,
    };
  }

  const environment = parseDeclaredEnvironment(
    env.COMMUNICATIONS_WEBHOOK_ENVIRONMENT ?? env.COMMUNICATIONS_ENVIRONMENT,
  );

  const environmentPolicy = resolveWebhookEnvironmentPolicy({
    environment,
    allowedEvents: allowed.events,
    persistBehavioralEvents: parseBool(
      env.COMMUNICATIONS_WEBHOOK_PERSIST_BEHAVIORAL_EVENTS,
      false,
    ),
    productEffectsEnabled: false,
  });

  if (enabled && mode !== "disabled" && !secret) {
    return {
      ok: false,
      errorCode: "WEBHOOK_CONFIGURATION_MISSING",
      errorMessage: "RESEND_WEBHOOK_SECRET ausente para modo distinto de disabled.",
    };
  }

  return {
    ok: true,
    config: {
      secret,
      enabled,
      toleranceSeconds: parsePositiveInt(
        env.COMMUNICATIONS_WEBHOOK_TOLERANCE_SECONDS,
        300,
      ),
      mode,
      maxBytes: parsePositiveInt(
        env.COMMUNICATIONS_WEBHOOK_MAX_BYTES,
        DEFAULT_WEBHOOK_MAX_BYTES,
      ),
      recipientHashSecret:
        env.COMMUNICATIONS_RECIPIENT_HASH_SECRET?.trim() || undefined,
      environmentPolicy,
      rateLimit: {
        enabled: parseBool(env.COMMUNICATIONS_WEBHOOK_RATE_LIMIT_ENABLED, false),
        requests: parsePositiveInt(
          env.COMMUNICATIONS_WEBHOOK_RATE_LIMIT_REQUESTS,
          120,
        ),
        windowSeconds: parsePositiveInt(
          env.COMMUNICATIONS_WEBHOOK_RATE_LIMIT_WINDOW_SECONDS,
          60,
        ),
      },
      alerts: {
        enabled: parseBool(env.COMMUNICATIONS_WEBHOOK_ALERTS_ENABLED, false),
        signatureFailureThreshold: parsePositiveInt(
          env.COMMUNICATIONS_WEBHOOK_SIGNATURE_FAILURE_THRESHOLD,
          5,
        ),
        databaseFailureThreshold: parsePositiveInt(
          env.COMMUNICATIONS_WEBHOOK_DATABASE_FAILURE_THRESHOLD,
          3,
        ),
        windowSeconds: parsePositiveInt(
          env.COMMUNICATIONS_WEBHOOK_ALERT_WINDOW_SECONDS,
          300,
        ),
      },
      expectedStagingUrl:
        env.COMMUNICATIONS_WEBHOOK_STAGING_URL?.trim() ||
        "https://clickaton-staging.vercel.app/api/webhooks/resend",
    },
  };
}
