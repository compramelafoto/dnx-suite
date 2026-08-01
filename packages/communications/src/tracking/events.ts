/**
 * Catálogo tipado de eventos internos de tracking email.
 * Strings dispersos prohibidos — usar este union.
 */
export const COMMUNICATION_TRACKING_EVENT_TYPES = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.opened",
  "email.clicked",
  "email.failed",
  "email.suppressed",
] as const;

export type CommunicationTrackingEventType =
  (typeof COMMUNICATION_TRACKING_EVENT_TYPES)[number];

export function isCommunicationTrackingEventType(
  value: string,
): value is CommunicationTrackingEventType {
  return (COMMUNICATION_TRACKING_EVENT_TYPES as readonly string[]).includes(value);
}
