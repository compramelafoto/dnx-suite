import type { CommunicationEvent, CommunicationMetadata } from "../shared/types";
import type {
  CommunicationEventPayloadMap,
  CommunicationEventType,
} from "./catalog";

export type TypedCommunicationEvent<T extends CommunicationEventType = CommunicationEventType> =
  CommunicationEvent<CommunicationEventPayloadMap[T]> & {
    type: T;
  };

export type CreateCommunicationEventInput<T extends CommunicationEventType> = {
  type: T;
  payload: CommunicationEventPayloadMap[T];
  occurredAt?: Date;
  sourceApp?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  idempotencyKey?: string;
  metadata?: CommunicationMetadata;
};

export function createCommunicationEvent<T extends CommunicationEventType>(
  input: CreateCommunicationEventInput<T>,
): TypedCommunicationEvent<T> {
  return {
    type: input.type,
    payload: input.payload,
    occurredAt: input.occurredAt ?? new Date(),
    sourceApp: input.sourceApp,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    idempotencyKey: input.idempotencyKey,
    metadata: input.metadata,
  };
}
