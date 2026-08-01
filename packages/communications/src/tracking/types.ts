import type { CommunicationChannel } from "../shared/channels";
import type { CommunicationMetadata } from "../shared/types";

/** Eventos de tracking de lifecycle de un mensaje. */
export const TRACKING_EVENT_TYPES = [
  "delivery",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "unsubscribed",
] as const;

export type TrackingEventType = (typeof TRACKING_EVENT_TYPES)[number];

export type TrackingEvent = {
  id: string;
  type: TrackingEventType;
  communicationId: string;
  providerMessageId?: string;
  channel: CommunicationChannel;
  providerName?: string;
  occurredAt: Date;
  url?: string;
  reason?: string;
  recipientId?: string;
  metadata?: CommunicationMetadata;
};

export type RecordTrackingInput = Omit<TrackingEvent, "id"> & {
  id?: string;
};

/**
 * Puerto de tracking. Persistencia real en etapas posteriores.
 */
export interface CommunicationTrackingStore {
  record(event: RecordTrackingInput): Promise<TrackingEvent>;
  listByCommunication(communicationId: string): Promise<TrackingEvent[]>;
}
