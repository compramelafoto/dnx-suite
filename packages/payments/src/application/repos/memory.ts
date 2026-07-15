import type { PaymentEnvironment } from "../../contracts/primitives.js";
import type {
  SplitConsent,
  ProviderRecipient,
  ProviderOrder,
  AuditEvent,
} from "../../contracts/entities.js";
import type {
  RecipientRepository,
  ConsentRepository,
  OrderRepository,
  AuditSink,
  Clock,
  IdGenerator,
} from "../ports.js";

export class SystemClock implements Clock {
  now(): string {
    return new Date().toISOString();
  }
}

export class UuidIdGenerator implements IdGenerator {
  nextId(): string {
    return crypto.randomUUID();
  }
}

export class InMemoryRecipientRepository implements RecipientRepository {
  private readonly byId = new Map<string, ProviderRecipient>();
  private readonly byExternal = new Map<string, ProviderRecipient>();

  private externalKey(externalId: string, environment: PaymentEnvironment): string {
    return `${environment}:${externalId}`;
  }

  async findById(id: string): Promise<ProviderRecipient | null> {
    return this.byId.get(id) ?? null;
  }

  async findByExternalId(
    externalId: string,
    environment: PaymentEnvironment,
  ): Promise<ProviderRecipient | null> {
    return this.byExternal.get(this.externalKey(externalId, environment)) ?? null;
  }

  async save(recipient: ProviderRecipient): Promise<void> {
    this.byId.set(recipient.id, recipient);
    this.byExternal.set(this.externalKey(recipient.externalId, recipient.environment), recipient);
  }

  async listByEnvironment(environment: PaymentEnvironment): Promise<ProviderRecipient[]> {
    return [...this.byId.values()].filter((r) => r.environment === environment);
  }
}

export class InMemoryConsentRepository implements ConsentRepository {
  private readonly byReceiver = new Map<string, SplitConsent>();
  private readonly byEmail = new Map<string, SplitConsent>();

  private emailKey(email: string, environment: PaymentEnvironment): string {
    return `${environment}:${email.toLowerCase()}`;
  }

  async findByReceiverId(receiverId: string): Promise<SplitConsent | null> {
    return this.byReceiver.get(receiverId) ?? null;
  }

  async findByEmail(email: string, environment: PaymentEnvironment): Promise<SplitConsent | null> {
    return this.byEmail.get(this.emailKey(email, environment)) ?? null;
  }

  async save(consent: SplitConsent): Promise<void> {
    if (consent.receiverId) {
      this.byReceiver.set(consent.receiverId, consent);
    }
    this.byEmail.set(this.emailKey(consent.sellerEmail, consent.environment), consent);
  }

  async list(environment: PaymentEnvironment): Promise<SplitConsent[]> {
    return [...this.byReceiver.values()].filter((c) => c.environment === environment);
  }
}

export class InMemoryOrderRepository implements OrderRepository {
  private readonly byProviderOrderId = new Map<string, ProviderOrder>();
  private readonly byId = new Map<string, ProviderOrder>();

  async findByProviderOrderId(providerOrderId: string): Promise<ProviderOrder | null> {
    return this.byProviderOrderId.get(providerOrderId) ?? null;
  }

  async save(order: ProviderOrder): Promise<void> {
    this.byId.set(order.id, order);
    this.byProviderOrderId.set(order.providerOrderId, order);
  }

  async updateStatus(id: string, status: string, rawStatus?: string): Promise<void> {
    const order = this.byId.get(id);
    if (!order) return;
    const updated: ProviderOrder = {
      ...order,
      status: status as ProviderOrder["status"],
      rawStatus: rawStatus ?? order.rawStatus,
      updatedAt: new Date().toISOString(),
    };
    this.byId.set(id, updated);
    this.byProviderOrderId.set(updated.providerOrderId, updated);
  }
}

const SENSITIVE_KEYS = new Set(["authorization", "token", "accesstoken", "bearertoken"]);

function sanitizeAuditData(
  data?: Record<string, string>,
): Record<string, string> | undefined {
  if (!data) return undefined;
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase()) || value.startsWith("TEST-") || value.startsWith("APP_USR-")) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class InMemoryAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];
  private readonly idGen: IdGenerator;
  private readonly clock: Clock;

  constructor(idGen: IdGenerator = new UuidIdGenerator(), clock: Clock = new SystemClock()) {
    this.idGen = idGen;
    this.clock = clock;
  }

  async record(event: Omit<AuditEvent, "id" | "occurredAt">): Promise<void> {
    const next: AuditEvent = {
      id: this.idGen.nextId(),
      occurredAt: this.clock.now(),
      actorType: event.actorType,
      action: event.action,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
    };
    if (event.actorId) next.actorId = event.actorId;
    const sanitized = sanitizeAuditData(event.data);
    if (sanitized) next.data = sanitized;
    this.events.push(next);
  }

  async list(aggregateType?: string, aggregateId?: string): Promise<AuditEvent[]> {
    return this.events.filter((e) => {
      if (aggregateType && e.aggregateType !== aggregateType) return false;
      if (aggregateId && e.aggregateId !== aggregateId) return false;
      return true;
    });
  }
}
