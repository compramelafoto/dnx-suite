import type {
  CommunicationTrackingStore,
  RecordTrackingInput,
  TrackingEvent,
} from "./types";

function createTrackingId(): string {
  return `trk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Store en memoria para tests y fundación (sin DB). */
export class InMemoryTrackingStore implements CommunicationTrackingStore {
  private readonly events: TrackingEvent[] = [];

  async record(input: RecordTrackingInput): Promise<TrackingEvent> {
    const event: TrackingEvent = {
      id: input.id ?? createTrackingId(),
      type: input.type,
      communicationId: input.communicationId,
      providerMessageId: input.providerMessageId,
      channel: input.channel,
      providerName: input.providerName,
      occurredAt: input.occurredAt,
      url: input.url,
      reason: input.reason,
      recipientId: input.recipientId,
      metadata: input.metadata,
    };
    this.events.push(event);
    return event;
  }

  async listByCommunication(communicationId: string): Promise<TrackingEvent[]> {
    return this.events.filter((event) => event.communicationId === communicationId);
  }
}

export function createInMemoryTrackingStore(): InMemoryTrackingStore {
  return new InMemoryTrackingStore();
}
