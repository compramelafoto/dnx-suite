import type { PersistedRefundRecord } from "./types.js";

export interface RefundStore {
  save(record: PersistedRefundRecord): Promise<void>;
  findById(id: string): Promise<PersistedRefundRecord | null>;
  findByIdempotencyKey(
    environment: string,
    idempotencyKey: string,
  ): Promise<PersistedRefundRecord | null>;
  listByPaymentOrderId(paymentOrderId: string): Promise<PersistedRefundRecord[]>;
  listByProviderOrderId(providerOrderId: string): Promise<PersistedRefundRecord[]>;
}

/**
 * In-memory durable store for unit/integration tests and sandbox CLI.
 * Prisma-backed store can implement the same port later.
 */
export class InMemoryRefundStore implements RefundStore {
  private readonly byId = new Map<string, PersistedRefundRecord>();
  private readonly byKey = new Map<string, string>();

  async save(record: PersistedRefundRecord): Promise<void> {
    this.byId.set(record.id, { ...record, allocations: [...record.allocations] });
    this.byKey.set(`${record.environment}:${record.idempotencyKey}`, record.id);
  }

  async findById(id: string): Promise<PersistedRefundRecord | null> {
    return this.byId.get(id) ?? null;
  }

  async findByIdempotencyKey(
    environment: string,
    idempotencyKey: string,
  ): Promise<PersistedRefundRecord | null> {
    const id = this.byKey.get(`${environment}:${idempotencyKey}`);
    if (!id) return null;
    return this.byId.get(id) ?? null;
  }

  async listByPaymentOrderId(paymentOrderId: string): Promise<PersistedRefundRecord[]> {
    return [...this.byId.values()]
      .filter((r) => r.paymentOrderId === paymentOrderId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }

  async listByProviderOrderId(providerOrderId: string): Promise<PersistedRefundRecord[]> {
    return [...this.byId.values()]
      .filter((r) => r.providerOrderId === providerOrderId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }
}
