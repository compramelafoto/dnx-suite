import type { MercadoPagoOrdersAdapter } from "../../providers/mercado-pago/orders/adapter.js";
import type { OrderRepository, AuditSink } from "../ports.js";
import type { RefreshProviderOrderCommand } from "./types.js";

export interface RefreshProviderOrderHandlerDeps {
  ordersAdapter: MercadoPagoOrdersAdapter;
  orderRepo: OrderRepository;
  audit: AuditSink;
}

export class RefreshProviderOrderHandler {
  constructor(private readonly deps: RefreshProviderOrderHandlerDeps) {}

  async execute(cmd: RefreshProviderOrderCommand) {
    const remote = await this.deps.ordersAdapter.getOrder(
      cmd.providerOrderId,
      cmd.environment,
    );

    const existing = await this.deps.orderRepo.findByProviderOrderId(cmd.providerOrderId);
    if (existing) {
      await this.deps.orderRepo.updateStatus(existing.id, remote.status, remote.statusDetail);
    }

    await this.deps.audit.record({
      actorType: "provider",
      action: "provider_order.refresh",
      aggregateType: "provider_order",
      aggregateId: cmd.providerOrderId,
      data: { status: remote.status },
    });

    return remote;
  }
}
