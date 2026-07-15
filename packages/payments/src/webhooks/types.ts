import type { ProviderName, PaymentEnvironment } from "../contracts/primitives.js";
import type { WebhookInboxStatus } from "../contracts/entities.js";

export interface WebhookInboxRecord {
  id: string;
  provider: ProviderName;
  environment: PaymentEnvironment;
  eventKey: string;
  status: WebhookInboxStatus;
  payloadDigest: string;
  receivedAt: string;
}

/** Contract only — persistence in Etapa 03+. */
export interface WebhookInboxPort {
  claim(eventKey: string, provider: ProviderName): Promise<"accepted" | "duplicate">;
  markProcessed(id: string): Promise<void>;
  markFailed(id: string, reason: string): Promise<void>;
}
