import type { MercadoPagoOrdersAdapter } from "../../providers/mercado-pago/orders/adapter.js";
import type { OrderRepository, AuditSink, Clock, IdGenerator } from "../ports.js";
import type { IdempotencyStore } from "../../idempotency/store.js";
import type { CreateSplitPaymentOrderCommand } from "./types.js";

export interface CreateSplitPaymentOrderHandlerDeps {
  ordersAdapter: MercadoPagoOrdersAdapter;
  orderRepo: OrderRepository;
  idempotency: IdempotencyStore;
  audit: AuditSink;
  clock: Clock;
  idGen: IdGenerator;
  paymentOrderId: string;
}

export class CreateSplitPaymentOrderHandler {
  constructor(private readonly deps: CreateSplitPaymentOrderHandlerDeps) {}

  async execute(cmd: CreateSplitPaymentOrderCommand) {
    const cached = this.deps.idempotency.get<{ providerOrderId: string; status: string }>(
      cmd.idempotencyKey,
    );
    if (cached) {
      return cached.result;
    }

    if (!cmd.payerEmail?.trim()) {
      throw new Error("PAYER_EMAIL_REQUIRED");
    }

    const result = await this.deps.ordersAdapter.createSplitOrder({
      environment: cmd.environment,
      externalReference: cmd.externalReference,
      total: cmd.total,
      distribution: cmd.distribution,
      payerEmail: cmd.payerEmail.trim(),
      idempotencyKey: cmd.idempotencyKey,
      deviceSessionId: cmd.deviceSessionId,
      partnerReceiverIds: cmd.partnerReceiverIds,
      partnerConsentsByRecipientId: cmd.partnerConsentsByRecipientId,
      items: cmd.items,
      ...(cmd.statementDescriptor
        ? { statementDescriptor: cmd.statementDescriptor }
        : {}),
      metadata: cmd.metadata,
    });

    const now = this.deps.clock.now();
    await this.deps.orderRepo.save({
      id: this.deps.idGen.nextId(),
      paymentOrderId: this.deps.paymentOrderId,
      provider: "mercadopago",
      environment: cmd.environment,
      providerOrderId: result.providerOrderId,
      status: "PENDING",
      rawStatus: result.status,
      createdAt: now,
      updatedAt: now,
    });

    this.deps.idempotency.set(cmd.idempotencyKey, result);

    await this.deps.audit.record({
      actorType: "system",
      action: "split_order.create",
      aggregateType: "provider_order",
      aggregateId: result.providerOrderId,
      data: {
        externalReference: cmd.externalReference,
        status: result.status,
      },
    });

    return result;
  }
}
