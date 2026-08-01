import type { CommunicationChannel } from "../shared/channels";
import type { CommunicationMetadata } from "../shared/types";
import type { PreferenceTopic } from "../preferences/types";

export type UnsubscribeReason =
  | "user_request"
  | "complaint"
  | "bounce"
  | "admin"
  | "unknown";

export type UnsubscribeRecord = {
  id: string;
  subjectId: string;
  channel: CommunicationChannel;
  topic?: PreferenceTopic;
  reason: UnsubscribeReason;
  occurredAt: Date;
  metadata?: CommunicationMetadata;
};

/**
 * Puerto de baja / opt-out.
 * Tokens firmados y páginas públicas llegan en etapas posteriores.
 */
export interface UnsubscribeService {
  unsubscribe(input: Omit<UnsubscribeRecord, "id" | "occurredAt"> & {
    id?: string;
    occurredAt?: Date;
  }): Promise<UnsubscribeRecord>;
  isUnsubscribed(input: {
    subjectId: string;
    channel: CommunicationChannel;
    topic?: PreferenceTopic;
  }): Promise<boolean>;
}
