import type { NotificationChannel, NotificationEventType } from "./contracts";

/**
 * Clave de deduplicación de entrega.
 * Reintentar un fallo debe reutilizar la misma clave (no crear otra fila lógica).
 */
export function buildDeliveryDedupeKey(input: {
  eventType: NotificationEventType | string;
  sourceEntityId: string;
  recipientUserId: number | string;
  channel: NotificationChannel | string;
  campaignCycle: string;
}): string {
  return [
    input.eventType,
    input.sourceEntityId,
    String(input.recipientUserId),
    input.channel,
    input.campaignCycle.trim() || "default",
  ].join(":");
}

export function buildCampaignDedupeKey(input: {
  eventType: NotificationEventType | string;
  sourceEntityId: string;
  campaignCycle: string;
  channels: readonly string[];
}): string {
  const channels = [...input.channels].map((c) => c.toUpperCase()).sort().join(",");
  return `campaign:${input.eventType}:${input.sourceEntityId}:${input.campaignCycle}:${channels}`;
}

/** Indica si un reintento debe reutilizar la entrega existente. */
export function isRetrySameDelivery(input: {
  existingDedupeKey: string;
  nextDedupeKey: string;
  status: string;
}): boolean {
  if (input.existingDedupeKey !== input.nextDedupeKey) return false;
  return input.status === "FAILED" || input.status === "PENDING" || input.status === "PROCESSING";
}
