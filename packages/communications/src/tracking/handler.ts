import type {
  CommunicationTrackingEvent,
  CommunicationTrackingEventHandler,
  TrackingHandlerResult,
} from "./contracts";

export type InMemoryTrackingHandlerOptions = {
  /** Simula fallo en handle. */
  failWith?: string;
  /** Trata como duplicado interno. */
  treatAsDuplicate?: boolean;
};

/**
 * Collector in-memory para tests — sin persistencia.
 */
export class InMemoryTrackingEventHandler
  implements CommunicationTrackingEventHandler
{
  readonly events: CommunicationTrackingEvent[] = [];
  private failWith?: string;
  private treatAsDuplicate: boolean;

  constructor(options: InMemoryTrackingHandlerOptions = {}) {
    this.failWith = options.failWith;
    this.treatAsDuplicate = options.treatAsDuplicate === true;
  }

  async handle(event: CommunicationTrackingEvent): Promise<TrackingHandlerResult> {
    if (this.failWith) {
      return { ok: false, errorMessage: this.failWith, errorCode: "WEBHOOK_HANDLER_FAILED" };
    }
    if (this.treatAsDuplicate) {
      return { ok: true, duplicate: true };
    }
    this.events.push(event);
    return { ok: true };
  }

  reset(): void {
    this.events.length = 0;
    this.failWith = undefined;
    this.treatAsDuplicate = false;
  }

  setFailWith(message: string | undefined): void {
    this.failWith = message;
  }

  setTreatAsDuplicate(value: boolean): void {
    this.treatAsDuplicate = value;
  }
}

export function createInMemoryTrackingEventHandler(
  options?: InMemoryTrackingHandlerOptions,
): InMemoryTrackingEventHandler {
  return new InMemoryTrackingEventHandler(options);
}
