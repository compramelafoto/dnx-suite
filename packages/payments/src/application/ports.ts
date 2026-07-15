import type { PaymentEnvironment, ProviderName } from "../contracts/primitives.js";
import type { SplitConsent, ProviderRecipient, ProviderOrder } from "../contracts/entities.js";
import type { AuditEvent } from "../contracts/entities.js";

export interface RecipientRepository {
  findById(id: string): Promise<ProviderRecipient | null>;
  findByExternalId(externalId: string, environment: PaymentEnvironment): Promise<ProviderRecipient | null>;
  save(recipient: ProviderRecipient): Promise<void>;
  listByEnvironment(environment: PaymentEnvironment): Promise<ProviderRecipient[]>;
}

export interface ConsentRepository {
  findByReceiverId(receiverId: string): Promise<SplitConsent | null>;
  findByEmail(email: string, environment: PaymentEnvironment): Promise<SplitConsent | null>;
  save(consent: SplitConsent): Promise<void>;
  list(environment: PaymentEnvironment): Promise<SplitConsent[]>;
}

export interface OrderRepository {
  findByProviderOrderId(providerOrderId: string): Promise<ProviderOrder | null>;
  save(order: ProviderOrder): Promise<void>;
  updateStatus(id: string, status: string, rawStatus?: string): Promise<void>;
}

export interface AuditSink {
  record(event: Omit<AuditEvent, "id" | "occurredAt">): Promise<void>;
  list(aggregateType?: string, aggregateId?: string): Promise<AuditEvent[]>;
}

export interface Clock {
  now(): string;
}

export interface IdGenerator {
  nextId(): string;
}
