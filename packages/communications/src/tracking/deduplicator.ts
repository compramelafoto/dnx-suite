import type { TrackingEventDeduplicator } from "./contracts";

/**
 * Deduplicador in-memory — NO apto para producción distribuida.
 * Clave: providerEventId (svix-id). Nunca email ni payload.
 */
export class InMemoryTrackingEventDeduplicator implements TrackingEventDeduplicator {
  private readonly seen = new Set<string>();

  async has(eventId: string): Promise<boolean> {
    return this.seen.has(eventId);
  }

  async mark(eventId: string): Promise<void> {
    this.seen.add(eventId);
  }

  reset(): void {
    this.seen.clear();
  }

  size(): number {
    return this.seen.size;
  }
}

export function createInMemoryTrackingEventDeduplicator(): InMemoryTrackingEventDeduplicator {
  return new InMemoryTrackingEventDeduplicator();
}
