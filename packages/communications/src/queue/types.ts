import type { CommunicationChannel } from "../shared/channels";
import type { CommunicationMetadata, CommunicationRecipient } from "../shared/types";

export type QueueJobStatus =
  | "pending"
  | "scheduled"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type CommunicationQueueJob = {
  id: string;
  channel: CommunicationChannel;
  status: QueueJobStatus;
  runAt: Date;
  createdAt: Date;
  updatedAt: Date;
  attempts: number;
  maxAttempts: number;
  payload: CommunicationQueuePayload;
  lastError?: string;
  metadata?: CommunicationMetadata;
};

export type CommunicationQueuePayload = {
  to: CommunicationRecipient | CommunicationRecipient[];
  templateKey?: string;
  subject?: string;
  text?: string;
  html?: string;
  from?: { email?: string; name?: string };
  templateVariables?: Record<string, string | number | boolean | null | undefined>;
  idempotencyKey?: string;
  metadata?: CommunicationMetadata;
};

export type EnqueueCommunicationInput = {
  channel: CommunicationChannel;
  runAt?: Date;
  maxAttempts?: number;
  payload: CommunicationQueuePayload;
  metadata?: CommunicationMetadata;
};

/**
 * Puerto de cola. Sin workers/cron en etapa 01.
 */
export interface CommunicationQueue {
  enqueue(input: EnqueueCommunicationInput): Promise<CommunicationQueueJob>;
  get(jobId: string): Promise<CommunicationQueueJob | undefined>;
  cancel(jobId: string): Promise<boolean>;
}
