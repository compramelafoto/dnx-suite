import { RETRY_DEFAULTS } from "./config";
import type { DeliveryStatus } from "./contracts";

export type RetryableErrorKind = "RETRYABLE" | "FINAL";

const FINAL_ERROR_CODES = new Set([
  "OPTED_OUT",
  "BLOCKED",
  "INVALID_RECIPIENT",
  "INVALID_TEMPLATE",
  "CHANNEL_NOT_IMPLEMENTED",
  "CANCELLED",
]);

export function classifyDeliveryError(errorCode: string | null | undefined): RetryableErrorKind {
  if (!errorCode) return "RETRYABLE";
  if (FINAL_ERROR_CODES.has(errorCode)) return "FINAL";
  return "RETRYABLE";
}

export function nextBackoffMs(
  attempt: number,
  limits: Partial<typeof RETRY_DEFAULTS> = {},
): number {
  const base = limits.baseBackoffMs ?? RETRY_DEFAULTS.baseBackoffMs;
  const max = limits.maxBackoffMs ?? RETRY_DEFAULTS.maxBackoffMs;
  const exp = Math.max(0, attempt - 1);
  return Math.min(max, base * 2 ** exp);
}

export function resolveNextDeliveryStatus(input: {
  current: DeliveryStatus;
  success: boolean;
  attempts: number;
  errorCode?: string | null;
  maxAttempts?: number;
}): { status: DeliveryStatus; retryAt: Date | null; final: boolean } {
  const max = input.maxAttempts ?? RETRY_DEFAULTS.maxAttempts;
  if (input.success) {
    return { status: "SENT", retryAt: null, final: true };
  }
  const kind = classifyDeliveryError(input.errorCode);
  if (kind === "FINAL") {
    return { status: "DEAD_LETTER", retryAt: null, final: true };
  }
  if (input.attempts >= max) {
    return { status: "DEAD_LETTER", retryAt: null, final: true };
  }
  const delay = nextBackoffMs(input.attempts);
  return {
    status: "FAILED",
    retryAt: new Date(Date.now() + delay),
    final: false,
  };
}

export type DeliveryMetrics = {
  audience_count: number;
  eligible_count: number;
  sent_count: number;
  failed_count: number;
  read_count: number;
  click_count: number;
  application_count: number;
};

export function emptyDeliveryMetrics(): DeliveryMetrics {
  return {
    audience_count: 0,
    eligible_count: 0,
    sent_count: 0,
    failed_count: 0,
    read_count: 0,
    click_count: 0,
    application_count: 0,
  };
}
