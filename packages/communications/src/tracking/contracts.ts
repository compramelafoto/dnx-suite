import type { CommunicationMetadata } from "../shared/types";
import type { CommunicationTrackingEventType } from "./events";

/** Destinatario minimizado — nunca email completo en persistencia futura. */
export type MaskedOrHashedRecipient = {
  maskedEmail?: string;
  emailHash?: string;
};

export type TrackingLinkData = {
  /** URL segura reducida (sin credenciales; query sanitizada). */
  safeUrl?: string;
  hostname?: string;
  protocol?: string;
  /** true si la URL se descartó por insegura. */
  discardedUnsafe?: boolean;
};

export type TrackingFailureReason = {
  /** hard | soft | unknown — solo si el proveedor lo informa. */
  bounceType?: "hard" | "soft" | "unknown";
  category?: string;
  /** Motivo acotado, sin SMTP completo. */
  message?: string;
  responseCode?: string;
};

/**
 * Evento de tracking normalizado (dominio DNX).
 * No incluye payload crudo, firma, HTML ni headers.
 */
export type CommunicationTrackingEvent = {
  id: string;
  type: CommunicationTrackingEventType;
  channel: "email";
  provider: string;
  providerEventId?: string;
  providerMessageId?: string;
  occurredAt: Date;
  receivedAt: Date;
  recipient?: MaskedOrHashedRecipient;
  link?: TrackingLinkData;
  reason?: TrackingFailureReason;
  metadata?: CommunicationMetadata;
  /** Tipo crudo del proveedor (sanitizado), útil si se ignora. */
  rawEventType?: string;
};

export type WebhookProcessingStatus =
  | "processed"
  | "ignored"
  | "rejected"
  | "duplicate"
  | "failed";

export type WebhookProcessingResult = {
  ok: boolean;
  status: WebhookProcessingStatus;
  provider: "resend";
  eventType?: CommunicationTrackingEventType;
  providerEventId?: string;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
  durationMs?: number;
};

export type WebhookVerificationResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "WEBHOOK_SIGNATURE_MISSING"
        | "WEBHOOK_SIGNATURE_INVALID"
        | "WEBHOOK_SIGNATURE_EXPIRED"
        | "WEBHOOK_CONFIGURATION_MISSING";
      message: string;
    };

export type WebhookSignatureVerifier = {
  verify(input: {
    payload: string;
    headers: Record<string, string | undefined>;
  }): Promise<WebhookVerificationResult>;
};

export type TrackingHandlerResult =
  | { ok: true; duplicate?: boolean }
  | { ok: false; errorCode?: string; errorMessage: string; duplicate?: boolean };

export type CommunicationTrackingEventHandler = {
  handle(event: CommunicationTrackingEvent): Promise<TrackingHandlerResult>;
};

export type TrackingEventDeduplicator = {
  has(eventId: string): Promise<boolean>;
  mark(eventId: string): Promise<void>;
};

export type CommunicationsWebhookMode = "disabled" | "verify_only" | "process";
