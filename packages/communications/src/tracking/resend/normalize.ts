import { createHash } from "node:crypto";
import type { CommunicationTrackingEvent } from "../contracts";
import {
  isCommunicationTrackingEventType,
  type CommunicationTrackingEventType,
} from "../events";
import { toMaskedRecipient } from "../sanitize";
import { assertValidOccurredAt } from "./parser";
import { normalizeClickedUrl } from "./click-url";
import type { ResendWebhookEnvelope } from "./types";
import { RESEND_EMAIL_WEBHOOK_TYPES } from "./types";

export type NormalizeResendResult =
  | {
      ok: true;
      supported: true;
      event: CommunicationTrackingEvent;
    }
  | {
      ok: true;
      supported: false;
      rawEventType: string;
    }
  | {
      ok: false;
      errorCode: string;
      errorMessage: string;
    };

/**
 * Mapping Resend externo → DNX interno (1:1 para email.* soportados).
 */
export const RESEND_TO_DNX_EVENT_MAP: Record<
  (typeof RESEND_EMAIL_WEBHOOK_TYPES)[number],
  CommunicationTrackingEventType
> = {
  "email.sent": "email.sent",
  "email.delivered": "email.delivered",
  "email.delivery_delayed": "email.delivery_delayed",
  "email.bounced": "email.bounced",
  "email.complained": "email.complained",
  "email.opened": "email.opened",
  "email.clicked": "email.clicked",
  "email.failed": "email.failed",
  "email.suppressed": "email.suppressed",
};

function firstRecipient(data: ResendWebhookEnvelope["data"]): string | undefined {
  if (!data?.to) return undefined;
  if (typeof data.to === "string") return data.to;
  if (Array.isArray(data.to) && typeof data.to[0] === "string") return data.to[0];
  return undefined;
}

function bounceType(
  raw: string | undefined,
): "hard" | "soft" | "unknown" | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower.includes("hard")) return "hard";
  if (lower.includes("soft")) return "soft";
  return "unknown";
}

function buildFallbackEventId(input: {
  type: string;
  emailId?: string;
  createdAt?: string;
}): string {
  const basis = `${input.type}|${input.emailId ?? ""}|${input.createdAt ?? ""}`;
  return `fallback_${createHash("sha256").update(basis).digest("hex").slice(0, 24)}`;
}

export function normalizeResendWebhookEvent(input: {
  envelope: ResendWebhookEnvelope;
  providerEventId?: string;
  receivedAt?: Date;
  allowHttpLinks?: boolean;
}): NormalizeResendResult {
  const rawType = input.envelope.type;
  if (!(RESEND_EMAIL_WEBHOOK_TYPES as readonly string[]).includes(rawType)) {
    return { ok: true, supported: false, rawEventType: rawType.slice(0, 80) };
  }

  if (!isCommunicationTrackingEventType(rawType)) {
    return { ok: true, supported: false, rawEventType: rawType.slice(0, 80) };
  }

  try {
    const occurredAt = assertValidOccurredAt(
      input.envelope.created_at ?? input.envelope.data?.created_at,
    );
    const data = input.envelope.data ?? {};
    const providerMessageId =
      typeof data.email_id === "string" && data.email_id.trim()
        ? data.email_id.trim()
        : undefined;

    const providerEventId =
      input.providerEventId?.trim() ||
      buildFallbackEventId({
        type: rawType,
        emailId: providerMessageId,
        createdAt: input.envelope.created_at,
      });

    const event: CommunicationTrackingEvent = {
      id: `trk_${providerEventId}`,
      type: RESEND_TO_DNX_EVENT_MAP[rawType as keyof typeof RESEND_TO_DNX_EVENT_MAP],
      channel: "email",
      provider: "resend",
      providerEventId,
      providerMessageId,
      occurredAt,
      receivedAt: input.receivedAt ?? new Date(),
      recipient: toMaskedRecipient(firstRecipient(data)),
      rawEventType: rawType,
      metadata: {
        hasRecipient: Boolean(firstRecipient(data)),
      },
    };

    if (rawType === "email.clicked") {
      event.link = normalizeClickedUrl(data.click?.link, {
        allowHttp: input.allowHttpLinks,
      });
    }

    if (rawType === "email.bounced" || rawType === "email.failed") {
      const message = (data.bounce?.message ?? data.reason)?.slice(0, 160);
      event.reason = {
        bounceType: bounceType(data.bounce?.type ?? data.bounce_type),
        category: data.bounce?.type?.slice(0, 40),
        message,
      };
    }

    if (rawType === "email.complained") {
      event.reason = {
        message: (data.reason ?? "complaint").slice(0, 80),
      };
    }

    return { ok: true, supported: true, event };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al normalizar evento";
    const code =
      error instanceof Error && "code" in error
        ? String((error as { code?: string }).code)
        : "WEBHOOK_SCHEMA_INVALID";
    return { ok: false, errorCode: code, errorMessage: message };
  }
}
