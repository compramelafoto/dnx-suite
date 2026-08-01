import type { CommunicationTrackingEvent } from "../contracts";
import type { RecipientHasher } from "./contracts";
import type { WebhookReceiptReservationInput } from "./types";

export function buildReceiptReservationFromEvent(input: {
  event: CommunicationTrackingEvent;
  recipientHasher?: RecipientHasher;
  initialStatus?: "received" | "ignored";
}): WebhookReceiptReservationInput {
  const { event } = input;
  const emailHash =
    input.recipientHasher && event.recipient?.maskedEmail
      ? undefined
      : event.recipient?.emailHash;

  // Si hay hasher HMAC, preferir re-hash solo si tenemos el email crudo — no lo tenemos.
  // En Imp06 el hash legacy del evento se omite cuando hay hasher configurado
  // (evitar persistir SHA débil). El host puede pasar recipientHash explícito.
  const recipientHash = input.recipientHasher ? undefined : emailHash;

  let safeLinkPath: string | undefined;
  if (event.link?.safeUrl && !event.link.discardedUnsafe) {
    try {
      const url = new URL(event.link.safeUrl);
      safeLinkPath = `${url.pathname}${url.search}`.slice(0, 240);
    } catch {
      safeLinkPath = undefined;
    }
  }

  return {
    provider: event.provider,
    providerEventId: event.providerEventId ?? event.id,
    providerMessageId: event.providerMessageId,
    rawEventType: event.rawEventType ?? event.type,
    normalizedEventType: event.type,
    occurredAt: event.occurredAt,
    receivedAt: event.receivedAt,
    recipientMasked: event.recipient?.maskedEmail,
    recipientHash,
    safeLinkHost: event.link?.hostname,
    safeLinkPath,
    failureCategory: event.reason?.category ?? event.reason?.bounceType,
    failureReasonCode: event.reason?.message?.slice(0, 80),
    initialStatus: input.initialStatus ?? "received",
  };
}

export function buildIgnoredReservation(input: {
  provider: string;
  providerEventId: string;
  rawEventType: string;
  receivedAt: Date;
}): WebhookReceiptReservationInput {
  return {
    provider: input.provider,
    providerEventId: input.providerEventId,
    rawEventType: input.rawEventType.slice(0, 80),
    receivedAt: input.receivedAt,
    initialStatus: "ignored",
  };
}
